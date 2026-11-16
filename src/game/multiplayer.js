// Multiplayer em tempo real: visitas entre lojas via Supabase (Realtime + store_directory) e canal local (BroadcastChannel + localStorage).
import { reactive, watch } from 'vue'
import { game, ui, settings, hooks, toast, money, save, uid, gainXp, nextTipCost, nextTipXp, MAX_TIPS, tipsLeft } from './state.js'
import { sb, cloud } from './cloud.js'
import { doorTile } from './layout.js'
import { sfx } from './audio.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  let out = ''
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return out
}
if (!settings.storeCode) settings.storeCode = genCode()
if (!settings.storeName) settings.storeName = 'Lojinha Lofi'

const TAB_CODE_KEY = 'lojinha-tab-code'
let initialCode = settings.storeCode
try {
  const savedTabCode = sessionStorage.getItem(TAB_CODE_KEY)
  if (savedTabCode) initialCode = savedTabCode
  else sessionStorage.setItem(TAB_CODE_KEY, initialCode)
} catch (e) { /* ignore */ }

const MY_ID = crypto.randomUUID()
const STARTED_AT = Date.now() + Math.random()
const BC_NAME = 'cltshop-mp'
const DIR_KEY = 'lojinha-mp-directory'

export const mp = reactive({
  myId: MY_ID,
  myCode: initialCode,
  storeName: settings.storeName,
  openToVisitors: true,
  hasSupabase: !!sb,
  supaConnected: false,
  onlineStores: [],
  visitors: [],
  visiting: null,
  connecting: false,
  chatMessages: [],
})

const displayUser = () => String(game.playerName || settings.playerName || mp.storeName || 'Visitante').trim()
hooks.syncStoreName = (name) => { mp.storeName = name || 'Lojinha Lofi' }

watch(() => mp.storeName, (v) => { settings.storeName = v || 'Lojinha Lofi' })
watch(() => cloud.status, (st) => {
  mp.supaConnected = st === 'online'
  if (st === 'online') {
    publishToSupabase(true)
    fetchDirectoryStores()
  }
})

let bc = null
let lobbyCh = null
let roomCh = null
let activeRoom = null
let savedHomeState = null
let pendingVisit = null
let lobbyTimer = 0
let posTimer = 0
let visitTimeout = 0
let supaSubscribed = false
let hostAlive = false
let lastSupaPush = 0
let lastDirFetch = 0
const dirLobby = new Map()
let supaLobby = []

const snap = (v) => JSON.parse(JSON.stringify(v))
try { localStorage.removeItem(DIR_KEY) } catch (e) { /* ignore */ }

async function publishToSupabase(force = false) {
  if (!sb || mp.visiting || pendingVisit) return
  const now = Date.now()
  if (!force && now - lastSupaPush < 6000) return
  lastSupaPush = now
  try {
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.user?.id) return
    mp.supaConnected = true
    await sb.from('store_directory').delete().eq('user_id', session.user.id).neq('code', mp.myCode)
    const snapshot = buildStoreSnapshot()
    await sb.from('store_directory').upsert({
      code: mp.myCode,
      user_id: session.user.id,
      store_name: mp.storeName,
      region: game.region,
      level: game.level,
      rep: game.rep,
      open_to_visitors: mp.openToVisitors,
      snapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'code' })

    const { data: tipAmt } = await sb.rpc('claim_store_tips', { p_code: mp.myCode })
    const tips = Number(tipAmt) || 0
    if (tips > 0) {
      game.money += tips
      game.rep = Math.min(5, game.rep + 0.05)
      sfx('coin')
      toast(`💝 Você recebeu ${money(tips)} em gorjetas de visitantes!`, 'good')
    }
  } catch (e) { /* tabela 002_multiplayer pode não estar criada ainda */ }
}

export async function fetchDirectoryStores() {
  dirLobby.clear()
  if (sb) {
    try {
      const { data: { session } } = await sb.auth.getSession()
      if (session?.user?.id) {
        await sb.from('store_directory').delete().eq('user_id', session.user.id).neq('code', mp.myCode)
      }
      const { data } = await sb
        .from('store_directory')
        .select('code,store_name,region,level,rep,open_to_visitors,snapshot,updated_at')
        .eq('open_to_visitors', true)
        .neq('code', mp.myCode)
        .order('updated_at', { ascending: false })
        .limit(20)
      if (Array.isArray(data)) {
        mp.supaConnected = true
        for (const r of data) {
          if (!r.snapshot) continue
          dirLobby.set(r.code, {
            code: r.code,
            storeName: r.store_name,
            region: r.region,
            level: r.level,
            rep: Number(r.rep) || 3,
            snapshot: r.snapshot,
            live: false,
          })
        }
      }
    } catch (e) { /* ignore */ }
  }
  refreshOnlineList()
}

function refreshOnlineList() {
  const merged = new Map()
  for (const [code, s] of dirLobby) if (code && code !== mp.myCode) merged.set(code, s)
  for (const s of supaLobby) if (s.code && s.code !== mp.myCode) merged.set(s.code, { ...merged.get(s.code), ...s, live: true })
  mp.onlineStores = [...merged.values()]
}

function sendLobbyMsg(payload) {
  if (bc) try { bc.postMessage({ channel: 'lobby', ...payload }) } catch (e) { /* ignore */ }
}

function sendRoomMsg(payload) {
  if (!activeRoom) return
  const msg = { channel: 'room', room: activeRoom, sender: MY_ID, ...payload }
  if (bc) try { bc.postMessage(msg) } catch (e) { /* ignore */ }
  if (roomCh && supaSubscribed) {
    try { roomCh.send({ type: 'broadcast', event: 'mp', payload: msg }) } catch (e) { /* ignore */ }
  }
}

function buildStoreSnapshot() {
  const pl = hooks.getPlayerState?.() || { x: 4, z: 4, face: 0, moving: false, emote: null, anim: null }
  return {
    branchName: mp.storeName || game.branchName,
    region: game.region,
    level: game.level,
    plan: snap(game.plan),
    shelves: snap(game.shelves),
    register: snap(game.register),
    decor: snap(game.decor),
    cafe: snap(game.cafe),
    doormat: snap(game.doormat),
    pet: settings.pet,
    weather: game.weather,
    clock: game.clock,
    phase: game.phase,
    rep: game.rep,
    dirt: snap(game.dirt),
    entities: hooks.getHostEntities?.() || null,
    host: { id: MY_ID, name: displayUser(), avatar: snap(settings.avatar), ...pl },
  }
}

function upsertVisitor(v) {
  if (!v?.id || v.id === MY_ID) return
  const now = Date.now()
  const cur = mp.visitors.find((x) => x.id === v.id)
  if (cur) {
    Object.assign(cur, {
      name: v.name ?? cur.name,
      avatar: v.avatar ?? cur.avatar,
      x: v.x ?? cur.x,
      z: v.z ?? cur.z,
      face: v.face ?? cur.face,
      moving: !!v.moving,
      emote: v.emote !== undefined ? v.emote : cur.emote,
      anim: v.anim || cur.anim || null,
      chat: v.chat !== undefined ? v.chat : cur.chat || null,
      lastSeen: now,
    })
  } else {
    mp.visitors.push({
      id: v.id,
      name: v.name || 'Visitante',
      avatar: v.avatar || null,
      x: v.x ?? 4,
      z: v.z ?? 6,
      face: v.face ?? 0,
      moving: !!v.moving,
      emote: v.emote || null,
      anim: v.anim || null,
      chat: v.chat || null,
      emoteClearAt: 0,
      lastSeen: now,
    })
  }
}

function beginVisitSession(code, st) {
  if (!mp.visiting) {
    const pl = hooks.getPlayerState?.() || { x: 4, z: 6, face: 0 }
    savedHomeState = {
      game: snap(game),
      playerPos: { x: pl.x, z: pl.z, face: pl.face },
    }
    window.__visiting = true
    mp.visiting = {
      code,
      storeName: st.branchName || `Loja ${code}`,
      region: st.region || 'residencial',
    }
  }
  ui.modal = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.npc = null
  ui.selectedBox = null
  applyVisitedState(st, true)
}

function applyVisitedState(st, isInitial = false) {
  if (!st || !mp.visiting) return
  mp.connecting = false
  clearTimeout(visitTimeout)
  mp.visiting.storeName = st.branchName || mp.visiting.storeName
  mp.visiting.region = st.region || 'residencial'

  if (isInitial) {
    Object.assign(game, {
      branchName: st.branchName || 'Loja Visitada',
      region: st.region || 'residencial',
      level: st.level || 0,
      plan: st.plan,
      shelves: (st.shelves || []).map((s) => ({ ...s, id: uid() })),
      register: st.register,
      decor: (st.decor || []).map((d) => ({ ...d, id: uid() })),
      cafe: st.cafe || null,
      doormat: st.doormat || null,
      visitedPet: st.pet || 'cat',
      weather: st.weather || 'mild',
      clock: st.clock || 0,
      phase: st.phase || 'open',
      rep: st.rep || 3,
      dirt: (st.dirt || []).map((d) => ({ ...d, id: uid(), res: null })),
      boxes: [],
      pending: [],
      team: [],
      paused: false,
    })
    hooks.resetEntities?.()
    hooks.refreshGrid?.()
    hooks.rebuildShop?.()
    const door = doorTile(game.plan)
    hooks.setPlayerPos?.(door.x, door.z - 0.5, Math.PI)
  } else {
    Object.assign(game, {
      weather: st.weather || game.weather,
      clock: st.clock ?? game.clock,
      phase: st.phase || game.phase,
      rep: st.rep ?? game.rep,
      dirt: (st.dirt || []).map((d) => ({ ...d, id: uid(), res: null })),
    })
    if (Array.isArray(st.shelves) && st.shelves.length === game.shelves.length) {
      st.shelves.forEach((ns, i) => {
        Object.assign(game.shelves[i], { product: ns.product, count: ns.count, price: ns.price, broken: ns.broken })
      })
    }
  }
  if (st.entities) hooks.syncHostEntities?.(st.entities)
}

function handleRoomMsg(msg) {
  if (!msg || msg.sender === MY_ID || msg.room !== activeRoom) return
  if (msg.type === 'req_state' && !mp.visiting && !pendingVisit && mp.openToVisitors) {
    const isNew = !mp.visitors.some((v) => v.id === msg.sender)
    upsertVisitor({ id: msg.sender, name: msg.name, avatar: msg.avatar, x: msg.x, z: msg.z })
    sendRoomMsg({ type: 'store_state', to: msg.sender, initial: true, state: buildStoreSnapshot() })
    if (isNew) {
      toast(`👋 ${msg.name || 'Alguém'} entrou para visitar sua loja!`, 'good')
      sfx('chime')
    }
    return
  }
  if (msg.type === 'store_state' && (!msg.to || msg.to === MY_ID)) {
    hostAlive = true
    if (pendingVisit && pendingVisit.code === activeRoom) {
      const code = pendingVisit.code
      pendingVisit = null
      clearTimeout(visitTimeout)
      beginVisitSession(code, msg.state)
      toast(`🌐 Visitando ${mp.visiting.storeName}!`, 'good')
    } else if (mp.visiting) {
      applyVisitedState(msg.state, false)
    }
    if (msg.state?.host) upsertVisitor(msg.state.host)
    if (mp.visiting && msg.state?.entities) hooks.syncHostEntities?.(msg.state.entities)
    return
  }
  if (msg.type === 'pos') {
    if (mp.visiting) hostAlive = true
    upsertVisitor({ ...msg, id: msg.sender })
    if (mp.visiting && msg.entities) hooks.syncHostEntities?.(msg.entities)
    return
  }
  if (msg.type === 'emote') {
    const v = mp.visitors.find((x) => x.id === msg.sender)
    if (v) { v.emote = msg.emoji; v.emoteClearAt = Date.now() + 3000; v.lastSeen = Date.now() }
    return
  }
  if (msg.type === 'tip' && !mp.visiting) {
    const amt = Math.max(1, Math.min(1000000, Number(msg.amount) || 10))
    const xp = Math.max(0, Number(msg.xp) || 0)
    game.money += amt
    if (xp > 0) gainXp(xp)
    game.rep = Math.min(5, game.rep + 0.05)
    hooks.showBubble?.(money(amt), '💝')
    sfx('coin')
    toast(`💝 ${msg.fromName || 'Visitante'} deu uma gorjeta de ${money(amt)}${xp > 0 ? ` (+${xp} XP)` : ''}!`, 'good')
    return
  }
  if (msg.type === 'clean') {
    hooks.remoteClean?.(msg.x, msg.z)
    return
  }
  if (msg.type === 'pet') {
    hooks.remotePet?.(msg.fromName)
    return
  }
  if (msg.type === 'prank') {
    hooks.remotePrank?.(msg)
    return
  }
  if (msg.type === 'chat') {
    const entry = { id: msg.id || uid(), sender: msg.sender, fromName: msg.fromName || 'Visitante', text: msg.text, startAt: Date.now(), dur: 6500 }
    mp.chatMessages.push(entry)
    if (mp.chatMessages.length > 35) mp.chatMessages.shift()
    const v = mp.visitors.find((x) => x.id === msg.sender)
    if (v) { v.chat = entry; v.lastSeen = Date.now() }
    sfx('pop')
    return
  }
  if (msg.type === 'leave') {
    const i = mp.visitors.findIndex((x) => x.id === msg.sender)
    if (i >= 0) mp.visitors.splice(i, 1)
    if (mp.visiting && msg.hostClosed) {
      toast('O anfitrião encerrou as visitas', 'info')
      leaveVisit()
    }
  }
}

function joinRoom(roomCode, onReady) {
  if (roomCh) {
    try { sb?.removeChannel(roomCh) } catch (e) { /* ignore */ }
    roomCh = null
  }
  supaSubscribed = false
  hostAlive = false
  activeRoom = roomCode
  mp.visitors = []
  if (!roomCode) return
  if (!sb) {
    onReady?.()
    return
  }
  roomCh = sb
    .channel(`cltshop-room-${roomCode}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'mp' }, ({ payload }) => handleRoomMsg(payload))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        supaSubscribed = true
        onReady?.()
      }
    })
  if (bc) setTimeout(() => onReady?.(), 50)
}

function announceLobby() {
  if (!mp.visiting && !pendingVisit) {
    const snapshot = buildStoreSnapshot()
    const info = {
      id: MY_ID,
      startedAt: STARTED_AT,
      code: mp.myCode,
      storeName: mp.storeName,
      region: game.region,
      level: game.level,
      rep: game.rep,
      visitors: mp.visitors.length,
      ts: Date.now(),
    }
    publishToSupabase(false)
    if (mp.openToVisitors) {
      sendLobbyMsg({ type: 'lobby', info })
      if (lobbyCh) {
        try { lobbyCh.track(info) } catch (e) { /* ignore */ }
      }
      if (mp.visitors.length > 0) {
        sendRoomMsg({ type: 'store_state', initial: false, state: snapshot })
      }
    } else {
      sendLobbyMsg({ type: 'lobby_bye', id: MY_ID })
      if (lobbyCh) {
        try { lobbyCh.untrack() } catch (e) { /* ignore */ }
      }
    }
  } else {
    sendLobbyMsg({ type: 'lobby_bye', id: MY_ID })
    if (lobbyCh) {
      try { lobbyCh.untrack() } catch (e) { /* ignore */ }
    }
  }
  const now = Date.now()
  if (now - lastDirFetch > 8000) {
    lastDirFetch = now
    fetchDirectoryStores()
  }
  for (let i = mp.visitors.length - 1; i >= 0; i--) {
    const v = mp.visitors[i]
    if (v.emote && v.emoteClearAt && now > v.emoteClearAt) v.emote = null
    if (now - v.lastSeen > 3500) mp.visitors.splice(i, 1)
  }
  refreshOnlineList()
}

let posTick = 0

function broadcastPos() {
  if (!activeRoom) return
  if (!mp.visiting && !mp.visitors.length) return
  const pl = hooks.getPlayerState?.()
  if (!pl) return
  const entities = (!mp.visiting && mp.visitors.length > 0 && (++posTick % 2 === 0))
    ? (hooks.getHostEntities?.() || null)
    : undefined
  sendRoomMsg({
    type: 'pos',
    name: displayUser(),
    avatar: settings.avatar,
    x: pl.x,
    z: pl.z,
    face: pl.face,
    moving: pl.moving,
    emote: pl.emote,
    anim: pl.anim || null,
    entities,
  })
}

function resolveTabCodeConflict(otherInfo) {
  if (!otherInfo || otherInfo.id === MY_ID || otherInfo.code !== mp.myCode) return
  if ((otherInfo.startedAt || 0) < STARTED_AT) {
    mp.myCode = genCode()
    try { sessionStorage.setItem(TAB_CODE_KEY, mp.myCode) } catch (e) { /* ignore */ }
    if (!mp.visiting && !pendingVisit) joinRoom(mp.myCode)
    announceLobby()
  }
}

export function startMultiplayer() {
  if (!bc && typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(BC_NAME)
    bc.onmessage = ({ data }) => {
      if (!data) return
      if (data.channel === 'lobby') {
        if (data.type === 'lobby' && data.info?.id !== MY_ID) {
          resolveTabCodeConflict(data.info)
        } else if (data.type === 'ping' && data.id !== MY_ID) {
          announceLobby()
        }
      } else if (data.channel === 'room') {
        handleRoomMsg(data)
      }
    }
    sendLobbyMsg({ type: 'ping', id: MY_ID })
  }
  if (sb && !lobbyCh) {
    lobbyCh = sb
      .channel('cltshop-lobby', { config: { presence: { key: mp.myCode } } })
      .on('presence', { event: 'sync' }, () => {
        const st = lobbyCh.presenceState()
        supaLobby = Object.values(st).flat().filter(Boolean)
        refreshOnlineList()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          mp.supaConnected = true
          announceLobby()
        }
      })
  }
  joinRoom(mp.myCode)
  fetchDirectoryStores()
  announceLobby()
  clearInterval(lobbyTimer)
  clearInterval(posTimer)
  lobbyTimer = setInterval(announceLobby, 2000)
  posTimer = setInterval(broadcastPos, 85)
}

export function stopMultiplayer() {
  sendRoomMsg({ type: 'leave', hostClosed: !mp.visiting })
  sendLobbyMsg({ type: 'lobby_bye', id: MY_ID })
  clearInterval(lobbyTimer)
  clearInterval(posTimer)
  clearTimeout(visitTimeout)
  if (roomCh) { try { sb?.removeChannel(roomCh) } catch (e) { /* ignore */ } roomCh = null }
  if (lobbyCh) { try { sb?.removeChannel(lobbyCh) } catch (e) { /* ignore */ } lobbyCh = null }
  if (bc) { bc.close(); bc = null }
}

export function toggleOpenToVisitors() {
  mp.openToVisitors = !mp.openToVisitors
  if (!mp.openToVisitors && !mp.visiting) {
    sendRoomMsg({ type: 'leave', hostClosed: true })
    mp.visitors = []
  }
  publishToSupabase(true)
  announceLobby()
}

export async function visitStore(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) return toast('Informe o código da loja', 'bad')
  if (code === mp.myCode) return toast('Esse é o código da sua própria loja!', 'bad')
  if (ui.editing || ui.build) return toast('Saia do modo layout/obra antes de visitar', 'bad')
  if (mp.visiting) leaveVisit()

  clearTimeout(visitTimeout)
  pendingVisit = null
  mp.connecting = true

  // 1. Checa lista em memória
  let snapshot = mp.onlineStores.find((s) => s.code === code)?.snapshot || null

  // 2. Checa Supabase (store_directory)
  if (!snapshot && sb) {
    try {
      const { data } = await sb.from('store_directory').select('*').eq('code', code).maybeSingle()
      if (data?.open_to_visitors !== false && data?.snapshot) snapshot = data.snapshot
    } catch (e) { /* ignore */ }
  }

  if (activeRoom === mp.myCode && !mp.visiting) {
    sendRoomMsg({ type: 'leave' })
  }

  const sendReq = () => {
    const door = doorTile(game.plan)
    sendRoomMsg({ type: 'req_state', name: displayUser(), avatar: settings.avatar, x: door.x, z: door.z })
  }

  if (snapshot) {
    mp.connecting = false
    joinRoom(code, sendReq)
    beginVisitSession(code, snapshot)
    announceLobby()
    toast(`🌐 Visitando ${mp.visiting.storeName}!`, 'good')
    return
  }

  // 4. Fallback via canal Realtime efêmero
  pendingVisit = { code }
  joinRoom(code, sendReq)
  toast(`🌐 Buscando loja ${code}...`)

  setTimeout(() => {
    if (pendingVisit && pendingVisit.code === code) sendReq()
  }, 1000)

  visitTimeout = setTimeout(() => {
    if (pendingVisit && pendingVisit.code === code) {
      pendingVisit = null
      mp.connecting = false
      joinRoom(mp.myCode)
      announceLobby()
      toast('Nenhuma loja online encontrada com esse código', 'bad')
    }
  }, 3500)
}

export function leaveVisit() {
  clearTimeout(visitTimeout)
  pendingVisit = null
  if (!mp.visiting) return
  sendRoomMsg({ type: 'leave' })
  mp.visiting = null
  mp.connecting = false
  mp.visitors = []
  hostAlive = false
  window.__visiting = false
  if (savedHomeState) {
    const home = savedHomeState.game
    const pos = savedHomeState.playerPos
    savedHomeState = null
    Object.assign(game, home)
    hooks.resetEntities?.()
    hooks.refreshGrid?.()
    hooks.rebuildShop?.()
    hooks.setPlayerPos?.(pos.x, pos.z, pos.face)
  }
  joinRoom(mp.myCode)
  announceLobby()
  save()
  toast('🏠 Você voltou para sua loja!', 'good')
}

export function sendEmote(emoji) {
  hooks.sayEmote?.(emoji, 3)
  sendRoomMsg({ type: 'emote', emoji })
}

export async function sendTip() {
  if (!mp.visiting) return
  if ((game.tipCount || 0) >= MAX_TIPS) return toast('💝 Limite de 10 gorjetas atingido (não ganhará mais XP)!', 'bad')
  const amount = nextTipCost()
  const xp = nextTipXp()
  if (game.money < amount) return toast(`Saldo insuficiente para dar gorjeta (${money(amount)})`, 'bad')
  const code = mp.visiting.code
  game.money -= amount
  game.tipCount = (game.tipCount || 0) + 1
  if (xp > 0) gainXp(xp)
  if (savedHomeState) {
    savedHomeState.game.money = game.money
    savedHomeState.game.tipCount = game.tipCount
    savedHomeState.game.career = snap(game.career)
  }
  hooks.showBubble?.(xp > 0 ? `-${money(amount)} · +${xp} XP` : `-${money(amount)}`, '💝')
  sfx('coin')

  if (hostAlive) {
    sendRoomMsg({ type: 'tip', fromName: displayUser(), amount, xp })
  } else if (sb) {
    try { await sb.rpc('send_store_tip', { p_code: code, p_amount: amount }) } catch (e) { /* ignore */ }
  }
  toast(xp > 0 ? `💝 Gorjeta de ${money(amount)} enviada! Você ganhou +${xp} XP!` : `💝 Gorjeta de ${money(amount)} enviada (não ganhará XP)!`, 'good')
}

export function broadcastClean(x, z) {
  if (mp.visiting || mp.visitors.length) sendRoomMsg({ type: 'clean', x, z })
}

export function broadcastPet() {
  if (mp.visiting || mp.visitors.length) sendRoomMsg({ type: 'pet', fromName: displayUser() })
}

export function broadcastPrank(payload) {
  if (mp.visiting || mp.visitors.length) sendRoomMsg({ type: 'prank', fromName: displayUser(), ...payload })
}

export function sendChat(rawText) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 100)
  if (!text) return false
  const fromName = displayUser()
  const entry = { id: uid(), sender: MY_ID, fromName, text, startAt: Date.now(), dur: 6500, self: true }
  mp.chatMessages.push(entry)
  if (mp.chatMessages.length > 35) mp.chatMessages.shift()
  hooks.sayChat?.(entry)
  sfx('pop')
  if (activeRoom) {
    sendRoomMsg({ type: 'chat', id: entry.id, fromName, text })
  }
  return true
}
