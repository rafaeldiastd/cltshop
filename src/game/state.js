import { reactive, watch } from 'vue'
import { PRODUCTS, PID, LEVELS, STAFF, START_MONEY, PACK, DAY_SECONDS, DECOR, EVENTS, WEATHER, EXPRESS_FEE, CAFE_ID, CAFE_MENU, SHELF_CAP, SHELF_CAP_BIG, CAREER_ID, careerNext, CONTRACTS, SHELF_BOOST, PASS, DOORMAT, RUMOR, canStockProduct, shelfLifeOf, GAME_MODES, REGIONS } from './config.js'
import { makePerson } from './people.js'
import { AVATAR_PARTS, defaultAvatar } from './avatarData.js'
import { basePlan, planArea, stockRoom, defaultRegister, defaultShelves, defaultFreezers, defaultProduce, produceSlots, defaultDecor, usableDecor, settleLayout } from './layout.js'

let _id = 1
export const uid = () => _id++
export const hooks = { refreshGrid: () => {}, beforeSave: () => {}, afterSave: () => {}, shiftActors: () => {} }

export const newStats = () => ({ revenue: 0, units: 0, cogs: 0, customers: 0, served: 0, sold: {}, oos: {}, price: {}, patience: 0, lostValue: 0, moods: {}, stolen: 0, stolenUnits: 0, caught: 0, cafeSales: 0, cafeRevenue: 0, lunchMissed: 0, deliveries: 0, deliveryRevenue: 0, arcadeRevenue: 0, petFound: 0, petFinds: 0, impulse: 0, xp: 0, maintenance: 0, spoiled: 0, spoiledValue: 0, cleaned: 0, dirty: 0, expired: 0, expiredValue: 0, sanitaryFine: 0, branchRevenue: 0 })
const noMarket = () => ({ text: null, mods: {} })
const newCareer = () => ({ xp: 0, earned: 0, points: 0, perks: {} })
const newPomodoro = () => ({ focusMin: 25, breakMin: 5, autoCycle: true, autoRestock: true, autoPilot: true, sessions: 0 })
const newLifetime = () => ({ served: 0, revenue: 0, robberiesStopped: 0, goalsDone: 0 })
export const defaultShopStyle = () => ({ wallPaper: 'solid', wallColor: '#f2dcc0', trimColor: '#b98a5a', wallMode: 'full' })

export const game = reactive({
  day: 1,
  phase: 'prep', // prep | open | lunch | closing | night
  lunchOn: false,
  lunchDone: false,
  cafePrices: {},
  plan: basePlan(0),
  clock: 0,
  speed: 1,
  paused: false,
  money: START_MONEY,
  rep: 3,
  level: 0,
  unlocked: {},
  shelves: [],
  register: null,
  decor: [],
  boxes: [],
  pending: [],
  priceMemory: {},
  team: [], // funcionários contratados (pessoas, com status próprios)
  candidates: [], // catálogo de candidatos
  today: newStats(),
  summary: null,
  playerPos: null,
  market: noMarket(),
  forecast: null, // boato ativo: { text, mods, created: dia em que saiu }
  nextRumorDay: RUMOR.firstDay, // dia em que sai o próximo boato
  weather: 'mild',
  cafe: null,
  career: newCareer(),
  bought: {}, // unidades já compradas de cada produto (contratos e livro de receitas)
  recipes: {}, // receitas descobertas
  orders: [], // pedidos do Zap da Lojinha no dia
  zapOn: true,
  decorV2: false, // relógio, quadros e vitrines viraram decoração comprável (saves antigos ganham os que já tinham)
  pass: { claimed: {} }, // recompensas do passe já resgatadas, por nível
  goals: [], // metas do dia
  goalsDay: 0,
  dirt: [], // manchas no chão: { id, x, z, type, level }
  doormat: null, // tapete de entrada comprado: { text, color }
  mode: 'normal', // lofi | normal | hardcore
  pomodoro: newPomodoro(),
  region: 'residencial',
  branchId: 'main',
  branchName: 'Matriz',
  branches: [],
  lifetime: newLifetime(),
  bigGoals: { claimed: {} },
  visitedPet: null,
  tipCount: 0,
  dayUnlocked: {},
  expiryPriceMemory: {},
  playerName: 'Lojista',
  shopName: 'Lojinha Lofi',
  shopStyle: defaultShopStyle(),
  visitorLog: [],
})

export const ui = reactive({
  modal: null, // summary | computer | menu | multiplayer | start
  computerApp: 'products', // products | store
  selectedBox: null,
  panelShelf: null,
  npc: null, // id do cliente aberto no painel lateral
  npcInfo: null, // resumo atualizado desse cliente (nome, idade, o que buscou e comprou)
  hover: null,
  mouse: { x: 0, y: 0 },
  log: [],
  toasts: [],
  action: null,
  editing: false,
  held: null,
  cart: {},
  ready: false,
  prompt: null,
  musicPanel: false,
  externalPlaying: false,
  panned: false,
  recenter: false,
  panelCafe: false,
  build: null, // obra sendo planejada: quantos quadrados cada parede anda
  buildArrows: [], // posição na tela dos controles de cada parede
  atRegister: false,
  theft: null, // balão do roubo em andamento: posição na tela e tempo restante
  petMenu: null, // menu do pet aberto: posição na tela
  buyTool: null, // modo layout: móvel que continua sendo comprado a cada clique (shelf | fridge | meat | produce)
  produceStyle: 'island', // formato do próximo expositor de hortifruti
  shelfType: 'std', // tipo da próxima prateleira: std | wall | corner
  pomoBreakLeft: 0, // contagem regressiva da pausa Pomodoro (segundos)
  chatBubbles: [],
  prankMode: 'swap_price',
  arcadeDecorId: null,
  panelArcade: null,
})

// preferências ficam fora do save: sobrevivem a um "Novo jogo"
const SETTINGS_KEY = 'lojinha-lofi-settings'
function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch (e) { return {} }
}
export const settings = reactive({ character: 0, hat: 'none', hatColor: '#ef8a77', pet: 'cat', musicOn: true, sfxOn: true, volume: 0.8, playlist: null, storeCode: '', storeName: 'Lojinha Lofi', playerName: 'Lojista', prankDay: '', prankCount: 0, ...readSettings() })
// personagem montado (cabeça, corpo, cores e acessórios). Quem já jogava continua com o visual
// escolhido antes: cabeça e corpo do mesmo modelo, cores originais e o mesmo chapéu
if (!settings.avatar) settings.avatar = { ...defaultAvatar(AVATAR_PARTS[settings.character] || AVATAR_PARTS[0]), hat: settings.hat, hatColor: settings.hatColor }
watch(settings, () => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch (e) { /* ignore */ }
})

export const modeMods = () => GAME_MODES[game.mode] || GAME_MODES.normal
export const regionOf = (r = game.region) => REGIONS[r] || REGIONS.residencial
export const regionMods = (r = game.region) => regionOf(r).mods
export const daySeconds = () => (game.mode === 'lofi' ? Math.max(60, (game.pomodoro?.focusMin || 25) * 60) : DAY_SECONDS)

export const MAX_DAILY_PRANKS = 3
export const utcDayKey = () => new Date().toISOString().slice(0, 10)
export function pranksLeft() {
  const today = utcDayKey()
  if (settings.prankDay !== today) return MAX_DAILY_PRANKS
  return Math.max(0, MAX_DAILY_PRANKS - (settings.prankCount || 0))
}
export function usePrankQuota() {
  const today = utcDayKey()
  if (settings.prankDay !== today) {
    settings.prankDay = today
    settings.prankCount = 0
  }
  if (settings.prankCount >= MAX_DAILY_PRANKS) return false
  settings.prankCount++
  return true
}
export const PRANK_TYPES = [
  { id: 'swap_price', name: 'Trocar Preço', emoji: '🏷️', minLevel: 0, target: 'shelf' },
  { id: 'pee', name: 'Mijar no Chão', emoji: '🚽', minLevel: 1, target: 'floor' },
  { id: 'unstock', name: 'Esvaziar Prateleira', emoji: '📦', minLevel: 2, target: 'shelf' },
]
export const MAX_TIPS = 10
export const tipsLeft = () => Math.max(0, MAX_TIPS - (game.tipCount || 0))
export const nextTipCost = () => 10 * Math.pow(2, Math.min(MAX_TIPS, game.tipCount || 0))
export const nextTipXp = () => Math.max(0, 10 - (game.tipCount || 0))

export const money = (n) => 'R$ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
export const isClosed = () => game.phase === 'prep' || game.phase === 'night' || game.phase === 'lunch'
export const canExpand = () => game.phase === 'prep' || game.phase === 'night'
export function clockText() {
  if (game.phase === 'prep') return '08:30'
  if (game.phase === 'night') return '21:00'
  const dur = daySeconds()
  const h = 9 + (Math.min(game.clock, dur) / dur) * 12
  return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0')
}

// cada mensagem vira um toast passageiro e fica guardada no histórico do Menu; repetidas viram um contador
const LOG_MAX = 80, TOAST_MAX = 4, TOAST_MS = 4200
export function toast(msg, kind = 'info') {
  const last = ui.log[ui.log.length - 1]
  if (last && last.msg === msg && last.day === game.day) { last.count++; last.time = clockText() }
  else {
    ui.log.push({ id: uid(), msg, kind, day: game.day, time: clockText(), count: 1 })
    if (ui.log.length > LOG_MAX) ui.log.shift()
  }
  let t = ui.toasts.find((x) => x.msg === msg)
  if (t) { t.count++; clearTimeout(t.timer) }
  else {
    ui.toasts.push({ id: uid(), msg, kind, count: 1 })
    t = ui.toasts[ui.toasts.length - 1]
    if (ui.toasts.length > TOAST_MAX) ui.toasts.shift()
  }
  const id = t.id
  t.timer = setTimeout(() => {
    const i = ui.toasts.findIndex((x) => x.id === id)
    if (i >= 0) ui.toasts.splice(i, 1)
  }, TOAST_MS)
}

export function logVisitorAction({ actorName, storeCode, emoji, text, kind = 'info' }) {
  if (!window.__visiting) {
    if (!Array.isArray(game.visitorLog)) game.visitorLog = []
    game.visitorLog.unshift({
      id: uid(),
      day: game.day,
      time: clockText(),
      actorName: actorName || 'Visitante',
      storeCode: storeCode || '',
      emoji: emoji || '👤',
      text,
      kind,
    })
    if (game.visitorLog.length > 40) game.visitorLog.length = 40
    save()
  }
  toast(`${emoji || '👤'} ${text}`, kind)
}

export function mergeArcadeScores(decor, entry, incomingScores = null) {
  if (!decor) return false
  const prevTop = decor.highScore?.score || 0
  if (!Array.isArray(decor.scores)) decor.scores = decor.highScore ? [decor.highScore] : []
  const byKey = new Map()
  const add = (rec) => {
    if (!rec || !(rec.score > 0)) return
    const k = rec.storeCode || rec.holder || 'Visitante'
    const cur = byKey.get(k)
    if (!cur || rec.score > cur.score) {
      byKey.set(k, {
        holder: rec.holder || cur?.holder || 'Visitante',
        storeName: rec.storeName || cur?.storeName || '',
        storeCode: rec.storeCode || cur?.storeCode || '',
        score: rec.score,
      })
    } else if (cur) {
      if (!cur.storeName && rec.storeName) cur.storeName = rec.storeName
      if (!cur.storeCode && rec.storeCode) cur.storeCode = rec.storeCode
    }
  }
  for (const r of decor.scores) add(r)
  if (Array.isArray(incomingScores)) for (const r of incomingScores) add(r)
  if (entry) add(entry)
  decor.scores = [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 15)
  if (decor.scores.length) decor.highScore = decor.scores[0]
  return !!(entry && entry.score > prevTop)
}

export function setupStarterStore(plan) {
  game.register = defaultRegister(plan)
  game.decor = defaultDecor(plan).map((d) => ({ id: uid(), ...d }))
  for (const s of defaultShelves(plan)) addShelf(s)
  const dp = defaultProduce(plan), groupId = 'produce_' + uid()
  for (const s of produceSlots(dp.x, dp.z, dp.rot, dp.style)) {
    addShelf({ ...s, kind: 'produce', groupId })
  }
  settleLayout(plan, game)
  if (!game.boxes.length) {
    for (const p of PRODUCTS.filter((p) => p.start)) {
      game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null, daysLeft: shelfLifeOf(p.id) })
      game.bought[p.id] = PACK
    }
  }
  discoverRecipes(false)
}

export function newGame(opts = {}) {
  const mode = opts.mode && GAME_MODES[opts.mode] ? opts.mode : 'normal'
  const built = mode === 'lofi'
  const plan = basePlan(0, built)
  const pName = String(opts.playerName ?? settings.playerName ?? 'Lojista').trim() || 'Lojista'
  const sName = String(opts.shopName ?? settings.storeName ?? 'Lojinha Lofi').trim() || 'Lojinha Lofi'
  const startMoney = GAME_MODES[mode]?.startMoney ?? START_MONEY
  const unlocked = Object.fromEntries(PRODUCTS.filter((p) => p.start).map((p) => [p.id, true]))
  settings.playerName = pName
  settings.storeName = sName
  Object.assign(game, {
    day: 1, phase: 'prep', clock: 0, speed: 1, paused: false, money: startMoney, rep: 3, level: 0, plan,
    unlocked, dayUnlocked: { ...unlocked },
    shelves: [], register: null, decor: [],
    boxes: [], pending: [], priceMemory: {}, expiryPriceMemory: {}, team: [], candidates: [],
    today: newStats(), summary: null, playerPos: null, market: noMarket(), forecast: null, nextRumorDay: RUMOR.firstDay, weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {},
    career: newCareer(), bought: {}, recipes: {}, orders: [], zapOn: true, decorV2: true,
    pass: { claimed: {} }, goals: [], goalsDay: 0, dirt: [], doormat: null,
    mode, pomodoro: newPomodoro(), region: 'residencial', branchId: 'main', branchName: sName, shopName: sName, playerName: pName, shopStyle: defaultShopStyle(), branches: [],
    lifetime: newLifetime(), bigGoals: { claimed: {} }, visitedPet: null, tipCount: 0, visitorLog: [],
  })
  ui.build = null
  ui.cart = {}
  ui.selectedBox = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.panelArcade = null
  ui.arcadeDecorId = null
  ui.modal = null
  ui.log = []
  ui.toasts = []
  ui.pomoBreakLeft = 0
  ui.prankMode = 'swap_price'
  if (built) {
    setupStarterStore(plan)
    toast('Bem-vindo à lojinha! A primeira entrega está na calçada')
  } else {
    discoverRecipes(false)
    toast('🏗️ Terreno pronto! Clique em "Construir Loja" para montar sua loja e definir o estoque.', 'info')
  }
  hooks.refreshGrid()
}

export function addShelf(spot) {
  const kind = spot.kind || (spot.fridge ? 'fridge' : 'shelf')
  const fridge = kind === 'fridge' || kind === 'meat' || !!spot.fridge
  game.shelves.push({
    id: uid(),
    x: spot.x,
    z: spot.z,
    rot: spot.rot || 0,
    ...(spot.groupId ? { groupId: spot.groupId, slot: spot.slot, style: spot.style, level: spot.level, reach: spot.reach, grot: spot.grot || 0 } : {}),
    product: null,
    count: 0,
    price: null,
    kind,
    fridge,
    boost: 0,
    wear: 0,
    broken: false,
    brokenT: 0,
    call: null,
    techAt: null,
    daysLeft: null,
    batches: [],
  })
  hooks.refreshGrid()
}

export function syncShelfBatches(s) {
  if (!s || !s.product || (s.count <= 0 && (!Array.isArray(s.batches) || !s.batches.length))) {
    if (s) { s.batches = []; s.count = 0; s.daysLeft = null }
    return
  }
  const defDays = s.daysLeft ?? shelfLifeOf(s.product)
  if (!Array.isArray(s.batches) || !s.batches.length) {
    s.batches = [{ count: s.count, daysLeft: defDays }]
  }
  const byDays = new Map()
  for (const b of s.batches) {
    const c = Math.max(0, Math.round(b.count || 0))
    if (!c) continue
    const d = b.daysLeft ?? defDays
    const prev = byDays.get(d)
    byDays.set(d, { count: (prev?.count || 0) + c, price: b.price ?? prev?.price ?? null })
  }
  s.batches = [...byDays.entries()]
    .map(([daysLeft, v]) => ({ count: v.count, daysLeft, ...(v.price != null ? { price: v.price } : {}) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
  s.count = s.batches.reduce((sum, b) => sum + b.count, 0)
  s.daysLeft = s.batches.length ? s.batches[0].daysLeft : null
}

export function addShelfBatch(s, count, daysLeft) {
  if (!s || count <= 0) return
  if (!Array.isArray(s.batches) || !s.batches.length) {
    s.batches = s.count > 0 ? [{ count: s.count, daysLeft: s.daysLeft ?? shelfLifeOf(s.product) }] : []
  }
  s.batches.push({ count, daysLeft: daysLeft ?? shelfLifeOf(s.product) })
  syncShelfBatches(s)
}

export function consumeShelfStock(s, qty) {
  if (!s || qty <= 0) return 0
  syncShelfBatches(s)
  let rem = qty, taken = 0
  for (const b of s.batches) {
    if (rem <= 0) break
    const t = Math.min(rem, b.count)
    b.count -= t
    rem -= t
    taken += t
  }
  syncShelfBatches(s)
  return taken
}

export function transferStockBatches(from, to, maxQty) {
  if (!from || !to || maxQty <= 0) return 0
  syncShelfBatches(from)
  if (!to.product || to.count <= 0) {
    to.product = from.product
    to.batches = []
    to.count = 0
  } else {
    syncShelfBatches(to)
  }
  let rem = maxQty, moved = 0
  for (const b of from.batches) {
    if (rem <= 0) break
    const t = Math.min(rem, b.count)
    if (t > 0) {
      b.count -= t
      rem -= t
      moved += t
      to.batches.push({ count: t, daysLeft: b.daysLeft })
    }
  }
  syncShelfBatches(from)
  syncShelfBatches(to)
  return moved
}

// ---------- plano de carreira ----------
export const hasPerk = (id) => !!game.career?.perks?.[id]
export const shelfCap = () => (hasPerk('shelf') ? SHELF_CAP_BIG : SHELF_CAP)
export const perkLocked = (id) => { const r = CAREER_ID[id].req; return r && !hasPerk(r) ? CAREER_ID[r].name : null }
export const canBuyPerk = (id) => !hasPerk(id) && !perkLocked(id) && game.career.points >= CAREER_ID[id].cost
export function buyPerk(id) {
  if (!canBuyPerk(id)) return toast('Pontos de maestria insuficientes', 'bad')
  game.career.points -= CAREER_ID[id].cost
  game.career.perks[id] = true
  toast(`Melhoria de carreira: ${CAREER_ID[id].name}!`, 'good')
}
export const xpNext = () => careerNext(game.career.earned)
export function gainXp(n = 1) {
  const c = game.career
  const pts = Math.max(1, Math.round(n * modeMods().xpMult))
  c.xp += pts
  game.today.xp += pts
  while (c.xp >= careerNext(c.earned)) {
    c.xp -= careerNext(c.earned)
    c.earned++
    c.points++
    toast(passReward(c.earned)
      ? `Nível ${c.earned}! Recompensa do passe e ponto de maestria liberados no computador`
      : `Nível ${c.earned}! Novo ponto de maestria no Plano de Carreira`, 'good')
  }
}

// ---------- passe da lojinha: o nível de experiência libera recompensas, resgatadas uma a uma ----------
export const passLevel = () => game.career.earned
export const passReward = (level) => PASS[level - 1] || null
export const passLevelOf = (pid) => { const i = PASS.findIndex((r) => r.product === pid); return i >= 0 ? i + 1 : null }
export const passClaimed = (level) => !!game.pass?.claimed?.[level]
export const passClaimable = (level) => !!passReward(level) && level <= passLevel() && !passClaimed(level)
export const passPending = () => PASS.reduce((n, r, i) => n + (passClaimable(i + 1) ? 1 : 0), 0)
export function claimPass(level) {
  if (!passClaimable(level)) return
  const r = passReward(level)
  game.pass.claimed[level] = true
  const got = []
  if (r.product && !game.unlocked[r.product]) { game.unlocked[r.product] = true; got.push(`fornecedor de ${PID[r.product].name}`) }
  if (r.money) { game.money += r.money; got.push(money(r.money)) }
  toast(got.length ? `Passe nível ${level}: ${got.join(' e ')}` : `Passe nível ${level} resgatado`, 'good')
}
export function claimAllPass() { for (let i = 1; i <= PASS.length; i++) if (passClaimable(i)) claimPass(i) }

// ---------- livro de receitas: descobre quando já comprou todos os ingredientes ----------
export const knowsIngredient = (pid) => (game.bought[pid] || 0) > 0
export function discoverRecipes(announce = true) {
  for (const m of CAFE_MENU) {
    if (game.recipes[m.id] || !m.uses.every(knowsIngredient)) continue
    game.recipes[m.id] = true
    if (announce) toast(`📖 Nova receita no livro: ${m.name}!`, 'good')
  }
}
export const cafeMenu = () => CAFE_MENU.filter((m) => game.recipes[m.id])

// ---------- mercado: custo, preço de referência e procura variam com o evento e o clima do dia ----------
const mod = (pid) => game.market?.mods?.[pid] || {}
const cents = (n) => Math.round(n * 100) / 100
export const costOf = (pid) => cents(PID[pid].cost * (mod(pid).cost ?? 1))
export const refOf = (pid) => cents(PID[pid].ref * (mod(pid).ref ?? 1))
export const demandOf = (pid) => PID[pid].demand * (mod(pid).demand ?? 1) * (PID[pid].cold && !PID[pid].steady ? WEATHER[game.weather]?.cold ?? 1 : 1) * (regionMods().sections?.[PID[pid].section] ?? 1) * (PID[pid].cold ? (regionMods().coldDemand ?? 1) : 1)
export const costChange = (pid) => Math.round(((mod(pid).cost ?? 1) - 1) * 100)

// ---------- preços da cafeteria: custo e mercado seguem a média dos ingredientes ----------
const usesMod = (item, field) => item.uses.reduce((s, pid) => s + (mod(pid)[field] ?? 1), 0) / item.uses.length
export const cafeCost = (id) => cents(CAFE_ID[id].cost * usesMod(CAFE_ID[id], 'cost'))
export const cafeRef = (id) => cents(CAFE_ID[id].ref * usesMod(CAFE_ID[id], 'ref'))
export const cafeCostChange = (id) => Math.round((usesMod(CAFE_ID[id], 'cost') - 1) * 100)
export const cafePrice = (id) => game.cafePrices[id] ?? CAFE_ID[id].ref
export function setCafePrice(id, value) {
  const price = Math.max(0.1, Math.round(value * 100) / 100)
  if (Number.isFinite(price)) game.cafePrices[id] = price
}
export function cafeVerdict(id) {
  const r = cafePrice(id) / cafeRef(id)
  if (r < 0.9) return { text: 'Barato', cls: 'cheap' }
  if (r < 1.15) return { text: 'Justo', cls: 'fair' }
  return { text: 'Caro', cls: 'dear' }
}
// o evento aparece no mercado do dia seguinte; um boato só avisa antes e pode não se cumprir
const pickEvent = (excludePids = []) => {
  const pool = EVENTS.filter((e) => Object.keys(e.mods).some((pid) => game.unlocked[pid]) && !excludePids.some((pid) => e.mods[pid]))
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}
const asMarket = (e) => (e ? { text: e.text, mods: e.mods } : noMarket())
// dias que faltam para o boato se resolver, contados do ponto de vista de quem lê (2 = depois de amanhã, 1 = amanhã)
export const rumorDays = () => (game.forecast ? game.forecast.created + RUMOR.lead - game.day : 0)
export function rollMarket() {
  let market = noMarket(), failed = null
  const r = game.forecast
  if (r) {
    // chegou a hora do boato: ele se cumpre com a chance definida
    if (Math.random() < RUMOR.chance) market = { text: r.text, mods: r.mods }
    else failed = r
    game.forecast = null
  }
  // sem boato cumprido, às vezes aparece uma notícia sem aviso (nunca repetindo o boato que falhou)
  if (!market.text && Math.random() < RUMOR.surprise) market = asMarket(pickEvent(failed ? Object.keys(failed.mods) : []))
  game.market = market
  // boato novo a cada 3 ou 4 dias, sobre outros produtos que o evento de hoje
  if (!game.forecast && game.day >= game.nextRumorDay) {
    const e = pickEvent(market.mods ? Object.keys(market.mods) : [])
    if (e) {
      game.forecast = { text: e.text, mods: e.mods, created: game.day }
      game.nextRumorDay = game.day + RUMOR.every[0] + Math.floor(Math.random() * (RUMOR.every[1] - RUMOR.every[0] + 1))
    }
  }
  const w = Math.random()
  game.weather = w < 0.3 ? 'hot' : w < 0.8 ? 'mild' : 'cold'
  if (failed) toast(`O boato não se confirmou: ${failed.text}`)
  if (market.text) toast(`Notícia: ${market.text}`)
  if (game.forecast) toast(`Boato: ${Math.round(RUMOR.chance * 100)}% de chance, em ${RUMOR.lead} dias: ${game.forecast.text}`)
}
// quanto o custo deve mudar se o boato se confirmar
export const forecastChange = (pid) => Math.round(((game.forecast?.mods?.[pid]?.cost ?? 1) - 1) * 100)

// ---------- contratos com fornecedores ----------
export function contractTier(pid) {
  let t = -1
  CONTRACTS.forEach((c, i) => { if ((game.bought[pid] || 0) >= c.at) t = i })
  return t
}
export const nextContract = (pid) => CONTRACTS[contractTier(pid) + 1] || null
export const boxDiscount = (pid, size) => { const t = contractTier(pid); return t >= 0 ? CONTRACTS[t].sizes[size] || 0 : 0 }
export const boxSizes = (pid) => { const t = contractTier(pid); return [PACK, ...(t >= 0 ? Object.keys(CONTRACTS[t].sizes).map(Number) : [])] }

// ---------- compras ----------
// carrinho: "pid" = caixa padrão; "pid|24" = caixa maior do contrato
export const cartKey = (pid, size = PACK) => (size === PACK ? pid : `${pid}|${size}`)
export const parseCartKey = (k) => { const [pid, s] = k.split('|'); return { pid, size: Number(s) || PACK } }
export const boxCost = (pid, size = PACK) => cents(costOf(pid) * size * (1 - boxDiscount(pid, size)))
const cartItems = () => Object.entries(ui.cart).map(([k, n]) => ({ ...parseCartKey(k), n }))
export const cartTotal = () => cartItems().reduce((s, c) => s + c.n * boxCost(c.pid, c.size), 0)
export const cartBoxes = () => cartItems().reduce((s, c) => s + c.n, 0)
// tudo que vai ocupar a sala do estoque: o que já está lá, o que está na calçada e o que está a caminho
export const dockCount = () => game.boxes.filter((b) => b.state === 'dock' && !b.at).length
export const pendingBoxes = () => game.pending.reduce((s, o) => s + o.boxes, 0)
export const stockFree = () => stockCap() - stockCount() - dockCount() - pendingBoxes()
const NO_ROOM = 'Sem espaço no estoque para mais caixas. Amplie a sala do estoque no modo Construção'
export function cartAdd(pid, d, size = PACK) {
  const k = cartKey(pid, size)
  if (d > 0 && cartBoxes() + d > stockFree()) return toast(NO_ROOM, 'bad')
  const n = Math.max(0, Math.min(20, (ui.cart[k] || 0) + d))
  if (n) ui.cart[k] = n
  else delete ui.cart[k]
}
// no almoço o pedido chega na hora, com taxa de entrega expressa
export const isExpress = () => game.phase === 'lunch'
export const orderFee = () => (isExpress() ? Math.round(cartTotal() * EXPRESS_FEE * 100) / 100 : 0)
// compras acumulam para os contratos e destravam receitas
function recordPurchase(pid, units) {
  const before = contractTier(pid)
  game.bought[pid] = (game.bought[pid] || 0) + units
  const after = contractTier(pid)
  if (after > before) {
    const c = CONTRACTS[after]
    const deals = Object.entries(c.sizes).map(([s, k]) => `caixa de ${s} com ${Math.round(k * 100)}% off`).join(', ')
    toast(`🤝 Contrato ${c.name} com o fornecedor de ${PID[pid].name}: ${deals}`, 'good')
  }
}
export function placeOrder() {
  const base = cartTotal()
  if (!base) return true
  const fee = orderFee(), total = base + fee
  if (total > game.money) { toast('Sem caixa suficiente para esse pedido', 'bad'); return false }
  if (cartBoxes() > stockFree()) { toast(NO_ROOM, 'bad'); return false }
  game.money -= total
  const items = cartItems()
  for (const c of items) recordPurchase(c.pid, c.n * c.size)
  discoverRecipes()
  ui.cart = {}
  if (isExpress()) {
    for (const c of items) for (let i = 0; i < c.n; i++) game.boxes.push({ id: uid(), product: c.pid, count: c.size, state: 'dock', res: null, daysLeft: shelfLifeOf(c.pid) })
    toast(`Entrega expressa na calçada! Taxa de ${money(fee)}`, 'good')
    return true
  }
  for (const c of items) {
    const o = game.pending.find((o) => o.product === c.pid && (o.size || PACK) === c.size)
    if (o) o.boxes += c.n
    else game.pending.push({ product: c.pid, boxes: c.n, size: c.size })
  }
  toast('Pedido emitido! Chega amanhã cedo', 'good')
  return true
}

// ---------- preços: valem para todas as prateleiras do produto ----------
export const productPrice = (pid) => game.priceMemory[pid] ?? null
export function setPrice(pid, value) {
  const price = Math.max(0.1, Math.round(value * 100) / 100)
  if (!Number.isFinite(price)) return
  game.priceMemory[pid] = price
  for (const s of game.shelves) if (s.product === pid) s.price = price
}
export const stepPrice = (pid, d) => setPrice(pid, (productPrice(pid) ?? refOf(pid)) + d)
export function discardExpiredShelf(id) {
  const s = game.shelves.find((x) => x.id === id)
  if (!s || !s.count || !s.product) return
  syncShelfBatches(s)
  const expiredQty = s.batches.filter((b) => b.daysLeft <= 0).reduce((sum, b) => sum + b.count, 0) || s.count
  s.batches = s.batches.filter((b) => b.daysLeft > 0)
  syncShelfBatches(s)
  game.today.expired += expiredQty
  game.today.expiredValue += expiredQty * costOf(s.product)
  const name = PID[s.product]?.name || 'Produto'
  if (s.count <= 0) { s.product = null; s.price = null }
  toast(`${expiredQty}x ${name} vencido(s) descartado(s)`, 'info')
}
export function applyClearanceDiscount(id) {
  const s = game.shelves.find((x) => x.id === id)
  if (!s || !s.product) return
  const base = productPrice(s.product) ?? refOf(s.product)
  const disc = Math.max(0.2, Math.round(base * 0.7 * 100) / 100)
  setExpiryPrice(s.product, disc)
  toast(`Queima de estoque: ${PID[s.product].name} perto de vencer (≤2d) por ${money(disc)} (−30%)`, 'good')
}
export const expiryPriceOf = (pid) => game.expiryPriceMemory?.[pid] ?? null
export function setExpiryPrice(pid, value) {
  if (!game.expiryPriceMemory) game.expiryPriceMemory = {}
  if (value == null || value === '') {
    delete game.expiryPriceMemory[pid]
    for (const s of game.shelves) {
      if (s.product === pid && Array.isArray(s.batches)) {
        for (const b of s.batches) if (b.daysLeft <= 2) delete b.price
      }
    }
    return
  }
  const price = Math.max(0.1, Math.round(Number(value) * 100) / 100)
  if (!Number.isFinite(price)) return
  game.expiryPriceMemory[pid] = price
  for (const s of game.shelves) {
    if (s.product === pid && Array.isArray(s.batches)) {
      for (const b of s.batches) if (b.daysLeft <= 2) b.price = price
    }
  }
}
export const stepExpiryPrice = (pid, d) => {
  const cur = expiryPriceOf(pid) ?? productPrice(pid) ?? refOf(pid)
  setExpiryPrice(pid, cur + d)
}
export function setBatchPrice(shelfId, daysLeft, value) {
  const s = game.shelves.find((x) => x.id === shelfId)
  if (!s || !Array.isArray(s.batches)) return
  const price = Math.max(0.1, Math.round(Number(value) * 100) / 100)
  if (!Number.isFinite(price)) return
  for (const b of s.batches) if (b.daysLeft === daysLeft) b.price = price
  if (daysLeft <= 2 && s.product) {
    if (!game.expiryPriceMemory) game.expiryPriceMemory = {}
    game.expiryPriceMemory[s.product] = price
  }
}
export function batchPrice(s, b) {
  if (!s || !s.product) return null
  if (b?.price != null) return b.price
  if (modeMods().expiration && b && b.daysLeft > 0 && b.daysLeft <= 2 && game.expiryPriceMemory?.[s.product] != null) {
    return game.expiryPriceMemory[s.product]
  }
  return s.price ?? game.priceMemory[s.product] ?? null
}
export function effectiveShelfPrice(s) {
  if (!s || !s.product) return null
  const front = s.batches?.[0]
  return batchPrice(s, front)
}
// destaque: a prateleira chama mais atenção para o produto que está nela
export function upgradeShelf(id) {
  const s = game.shelves.find((x) => x.id === id)
  const next = s && SHELF_BOOST[(s.boost || 0) + 1]
  if (!next) return
  if (game.money < next.price) return toast('Caixa insuficiente', 'bad')
  game.money -= next.price
  s.boost = (s.boost || 0) + 1
  toast(`Prateleira com ${next.name.toLowerCase()}!`, 'good')
}
export function priceVerdict(pid) {
  const price = productPrice(pid)
  if (price == null) return { text: 'Sem preço', cls: 'none' }
  const r = price / refOf(pid)
  if (r < 0.9) return { text: 'Barato', cls: 'cheap' }
  if (r < 1.15) return { text: 'Justo', cls: 'fair' }
  return { text: 'Caro', cls: 'dear' }
}

// ---------- loja ----------
// a caixa vazia padrão não ocupa lugar na conta do estoque
export const stockCount = () => {
  // caixas soltas no chão também ocupam o limite: não dá para escapar dele largando caixas por aí
  const inside = game.boxes.filter((b) => b.state !== 'dock')
  return Math.max(0, inside.length - (inside.some((b) => b.state === 'empty') ? 1 : 0))
}
export const stockCap = () => stockRoom(game.plan).cap
// mais área, mais movimento: nos tamanhos de referência de cada tipo dá exatamente o número da tabela
function byArea(field, plan) {
  const a = planArea(plan), pts = LEVELS.map((L) => [L.cols * L.rows, L[field]])
  let i = 0
  while (i < pts.length - 2 && a > pts[i + 1][0]) i++
  const [a0, v0] = pts[i], [a1, v1] = pts[i + 1]
  return v0 + ((a - a0) * (v1 - v0)) / (a1 - a0)
}
export const customersPerDay = (plan = game.plan) => byArea('customers', plan) * regionMods().customers
export const maxCustomers = (plan = game.plan) => Math.round(byArea('maxCust', plan))
export const stockFull = () => stockCount() >= stockCap()
export const maxShelves = () => LEVELS[game.level].maxShelves
export const maxFreezers = () => LEVELS[game.level].maxFreezers
export const maxMeat = () => LEVELS[game.level].maxMeat || 4
export const maxProduce = () => LEVELS[game.level].maxProduce || 4
export const shelfCount = () => game.shelves.filter((s) => s.kind === 'shelf' || (!s.kind && !s.fridge)).length
export const freezerCount = () => game.shelves.filter((s) => s.kind === 'fridge' || (!s.kind && s.fridge)).length
export const meatCount = () => game.shelves.filter((s) => s.kind === 'meat').length
export const produceCount = () => new Set(game.shelves.filter((s) => s.kind === 'produce').map((s) => s.groupId || s.id)).size
export const decorCount = (type) => game.decor.filter((d) => d.type === type).length
export function sellDecor(type) {
  const list = game.decor.filter((d) => d.type === type)
  if (!list.length || !DECOR[type]?.price) return
  if (!isClosed()) return toast('Venda móveis com a loja fechada', 'bad')
  game.decor.splice(game.decor.indexOf(list[list.length - 1]), 1)
  const value = Math.floor(DECOR[type].price / 2)
  game.money += value
  hooks.refreshGrid()
  toast(`Vendeu ${DECOR[type].name} por ${money(value)}`, 'good')
}
export const emptyCount = () => game.boxes.filter((b) => b.state === 'empty').length
export function storeBox(id) {
  const b = game.boxes.find((x) => x.id === id)
  if (!b) return
  b.at = null
  if (ui.selectedBox === id) ui.selectedBox = null
}
export function trashBox(id) {
  const i = game.boxes.findIndex((b) => b.id === id && (b.state === 'empty' || b.state === 'open'))
  if (i < 0) return
  const [b] = game.boxes.splice(i, 1)
  if (ui.selectedBox === id) ui.selectedBox = null
  toast(b.state === 'empty' ? 'Caixa vazia jogada fora' : `Caixa com ${b.count} de ${PID[b.product].name} jogada fora`)
}
export function trashEmpties() {
  const n = emptyCount() - 1 // sempre sobra uma no estoque
  if (n <= 0) return
  let kept = false
  game.boxes = game.boxes.filter((b) => {
    if (b.state !== 'empty') return true
    if (!kept && !b.at) { kept = true; return true }
    return false
  })
  if (!game.boxes.some((b) => b.id === ui.selectedBox)) ui.selectedBox = null
  toast(n === 1 ? '1 caixa vazia jogada fora' : `${n} caixas vazias jogadas fora`)
}

function settle() {
  const lost = settleLayout(game.plan, game)
  if (lost.length) game.decor = game.decor.filter((d) => !lost.includes(d))
}
// o tipo de comércio libera mais área, móveis e a cafeteria; o espaço em si é comprado no modo construção
export function upgradeType() {
  const next = LEVELS[game.level + 1]
  if (!next) return
  if (!canExpand()) return toast('Mude o tipo do comércio antes de abrir ou depois do expediente', 'bad')
  if (game.money < next.cost) return toast('Caixa insuficiente', 'bad')
  game.money -= next.cost
  game.level++
  toast(`Agora o seu comércio é ${next.name}!`, 'good')
}
// salário de todos os contratados, inclusive de quem está de folga
export const wages = () => Math.round(game.team.reduce((s, m) => s + m.wage, 0) * modeMods().wageMult * regionMods().wageMult)

// ---------- regiões e filiais ----------
export const hasRegionBranch = (regionId) => game.region === regionId || (game.branches || []).some((b) => b.region === regionId)
export const allBranches = () => [
  { id: game.branchId, name: game.branchName, region: game.region, level: game.level, shelves: game.shelves, team: game.team, cafe: game.cafe, active: true },
  ...(game.branches || []).map((b) => ({ ...b, active: false })),
]
export function branchDailyProfit(b) {
  const rMods = (REGIONS[b.region] || REGIONS.residencial).mods
  const stocked = (b.shelves || []).filter((s) => s.product && s.count > 0 && s.price != null).length
  const teamWages = Math.round((b.team || []).reduce((s, m) => s + (m.wage || 30), 0) * modeMods().wageMult * rMods.wageMult)
  const gross = Math.round((75 + stocked * 24 + (b.level || 0) * 65 + (b.cafe ? 40 : 0)) * rMods.customers * rMods.willing)
  return gross - teamWages
}
export function changeMainRegion(regionId) {
  const reg = REGIONS[regionId]
  if (!reg || regionId === game.region) return
  if (game.day === 1 && game.phase === 'prep' && !game.branches.length) {
    game.region = regionId
    toast(`Região definida: ${reg.name} ${reg.emoji}`, 'good')
    return
  }
  if (!isClosed()) return toast('Mude de região com a loja fechada', 'bad')
  if (hasRegionBranch(regionId)) return toast('Você já possui uma loja nesta região', 'bad')
  const fee = 300
  if (game.money < fee) return toast(`Caixa insuficiente para mudança (${money(fee)})`, 'bad')
  game.money -= fee
  game.region = regionId
  toast(`Loja transferida para ${reg.name} ${reg.emoji}`, 'good')
}
export function buyBranch(regionId) {
  const reg = REGIONS[regionId]
  if (!reg) return
  if (!isClosed()) return toast('Abra filiais apenas com a loja fechada', 'bad')
  if (hasRegionBranch(regionId)) return toast('Já existe uma unidade nessa região', 'bad')
  if (game.money < reg.cost) return toast('Caixa insuficiente', 'bad')
  game.money -= reg.cost
  const plan = basePlan(0)
  const shelves = []
  for (const s of defaultShelves(plan)) {
    shelves.push({ id: uid(), x: s.x, z: s.z, rot: s.rot || 0, product: null, count: 0, price: null, kind: s.kind || 'shelf', fridge: false, boost: 0, wear: 0, broken: false, brokenT: 0, call: null, techAt: null, daysLeft: null, batches: [] })
  }
  const dp = defaultProduce(plan), groupId = 'produce_' + uid()
  for (const s of produceSlots(dp.x, dp.z, dp.rot, dp.style)) {
    shelves.push({ id: uid(), x: s.x, z: s.z, rot: s.rot || 0, groupId, slot: s.slot, style: s.style, level: s.level, reach: s.reach, grot: s.grot || 0, product: null, count: 0, price: null, kind: 'produce', fridge: false, boost: 0, wear: 0, broken: false, brokenT: 0, call: null, techAt: null, daysLeft: null, batches: [] })
  }
  const boxes = PRODUCTS.filter((p) => p.start).map((p) => ({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null, daysLeft: shelfLifeOf(p.id) }))
  game.branches.push({
    id: 'branch_' + uid(),
    name: `Filial ${reg.name}`,
    region: regionId,
    level: 0,
    plan,
    shelves,
    register: defaultRegister(plan),
    decor: defaultDecor(plan).map((d) => ({ id: uid(), ...d })),
    boxes,
    pending: [],
    team: [],
    cafe: null,
    doormat: null,
    dirt: [],
  })
  toast(`🏢 Nova filial inaugurada em ${reg.name}!`, 'good')
}
export function switchBranch(targetId) {
  if (!isClosed()) return toast('Troque de filial apenas com a loja fechada', 'bad')
  if (ui.editing || ui.build) return toast('Saia do modo layout/obra antes de trocar de filial', 'bad')
  if (targetId === game.branchId) return
  const idx = game.branches.findIndex((b) => b.id === targetId)
  if (idx < 0) return
  const snap = (v) => JSON.parse(JSON.stringify(v))
  const cur = {
    id: game.branchId, name: game.branchName, region: game.region, level: game.level,
    plan: snap(game.plan), shelves: snap(game.shelves), register: snap(game.register),
    decor: snap(game.decor), boxes: snap(game.boxes), pending: snap(game.pending),
    team: snap(game.team), cafe: snap(game.cafe), doormat: snap(game.doormat), dirt: snap(game.dirt),
  }
  const next = game.branches.splice(idx, 1, cur)[0]
  Object.assign(game, {
    branchId: next.id, branchName: next.name, region: next.region, level: next.level || 0,
    plan: next.plan, shelves: next.shelves || [], register: next.register || defaultRegister(next.plan),
    decor: next.decor || [], boxes: next.boxes || [], pending: next.pending || [],
    team: next.team || [], cafe: next.cafe || null, doormat: next.doormat || null, dirt: next.dirt || [],
  })
  game.shelves.forEach((s) => { s.id = uid(); s.techAt = null })
  game.boxes.forEach((b) => { b.id = uid(); b.res = null })
  game.decor.forEach((d) => { d.id = uid() })
  game.dirt.forEach((d) => { d.id = uid(); d.res = null })
  ui.selectedBox = null; ui.panelShelf = null; ui.panelCafe = false; ui.npc = null
  hooks.refreshGrid()
  toast(`📍 Gerenciando: ${game.branchName} (${regionOf().name})`, 'good')
}

// ---------- tapete de entrada ----------
export const cleanMatText = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, DOORMAT.maxText)
export function buyDoormat(text, color) {
  if (game.doormat) return setDoormat(text, color)
  if (game.money < DOORMAT.price) return toast('Caixa insuficiente', 'bad')
  game.money -= DOORMAT.price
  game.doormat = { text: cleanMatText(text) || 'Bem-vindo!', color: color || DOORMAT.colors[0] }
  toast(`Tapete de entrada instalado por ${money(DOORMAT.price)}. Menos sujeira entra na loja`, 'good')
}
export function setDoormat(text, color) {
  if (!game.doormat) return
  game.doormat = { text: cleanMatText(text) || game.doormat.text, color: color || game.doormat.color }
  toast('Tapete atualizado', 'good')
}

// ---------- save ----------
export const SAVE_KEY = 'lojinha-lofi-v1'
const KEY = SAVE_KEY
// versão do save: só cresce. Fica também numa chave própria, que sobrevive ao "recomeçar",
// para o jogo novo não perder para o save antigo guardado na nuvem
const REV_KEY = 'lojinha-lofi-rev'
const SAVES_INDEX_KEY = 'lojinha-lofi-saves-v1'
const ACTIVE_SAVE_KEY = 'lojinha-lofi-active-save'
const slotKey = (id) => 'lojinha-save-slot-' + id
export const savesList = reactive([])

function readSavesIndex() {
  try { return JSON.parse(localStorage.getItem(SAVES_INDEX_KEY)) || [] } catch (e) { return [] }
}
function writeSavesIndex(list) {
  savesList.splice(0, savesList.length, ...list)
  try { localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(list)) } catch (e) { /* ignore */ }
}
export function getActiveSaveId() {
  try { return localStorage.getItem(ACTIVE_SAVE_KEY) || '' } catch (e) { return '' }
}
function setActiveSaveId(id) {
  try { localStorage.setItem(ACTIVE_SAVE_KEY, id) } catch (e) { /* ignore */ }
}
export function refreshSavesList() {
  let list = readSavesIndex()
  const rawLegacy = localStorage.getItem(KEY)
  if (!list.length && rawLegacy) {
    try {
      const d = JSON.parse(rawLegacy)
      if (!d || d._deleted) { savesList.splice(0, savesList.length); return savesList }
      const id = 'save_main'
      localStorage.setItem(slotKey(id), rawLegacy)
      setActiveSaveId(id)
      list = [{
        id,
        playerName: d.playerName || settings.playerName || 'Lojista',
        shopName: d.shopName || d.branchName || settings.storeName || 'Lojinha Lofi',
        mode: d.mode || 'normal',
        day: d.day || 1,
        money: d.money ?? START_MONEY,
        rep: d.rep ?? 3,
        region: d.region || 'residencial',
        level: d.level || 0,
        updatedAt: Date.now(),
      }]
      writeSavesIndex(list)
    } catch (e) { /* ignore */ }
  } else {
    savesList.splice(0, savesList.length, ...list)
  }
  return savesList
}

let rev = 0
export const saveMeta = { locked: false } // travado quando o jogo foi aberto em outra aba ou aparelho
export function localRev() {
  let r = 0
  try { r = Number(localStorage.getItem(REV_KEY)) || 0 } catch (e) { /* ignore */ }
  try { r = Math.max(r, JSON.parse(localStorage.getItem(KEY))?._rev || 0) } catch (e) { /* ignore */ }
  return Math.max(r, rev)
}
// troca o save local por um mais novo (vindo da nuvem), antes do load()
export function replaceLocalSave(data, r) {
  localStorage.setItem(KEY, JSON.stringify({ ...data, _rev: r }))
  localStorage.setItem(REV_KEY, String(r))
}
let restarting = false // ao recomeçar, o salvamento automático não pode regravar o jogo antigo
export function save() {
  if (restarting || saveMeta.locked || window.__visiting || (ui.modal === 'start' && !getActiveSaveId())) return
  try {
    hooks.beforeSave()
    const d = JSON.parse(JSON.stringify(game))
    d.boxes.forEach((b) => (b.res = null))
    // móvel novo ainda na mão não foi comprado
    d.shelves = d.shelves.filter((s) => s.x >= 0)
    d.decor = d.decor.filter((o) => o.x >= 0)
    if (d.cafe && d.cafe.x < 0) d.cafe = null
    rev = Math.max(rev, Number(localStorage.getItem(REV_KEY)) || 0) + 1
    const json = JSON.stringify({ ...d, cart: ui.cart, log: ui.log, _rev: rev })
    localStorage.setItem(KEY, json)
    localStorage.setItem(REV_KEY, String(rev))
    let sid = getActiveSaveId()
    if (!sid) { sid = 'save_' + uid(); setActiveSaveId(sid) }
    localStorage.setItem(slotKey(sid), json)
    const list = readSavesIndex()
    const meta = {
      id: sid,
      playerName: game.playerName || settings.playerName || 'Lojista',
      shopName: game.shopName || game.branchName || settings.storeName || 'Lojinha Lofi',
      storeCode: settings.storeCode || '',
      mode: game.mode || 'normal',
      day: game.day || 1,
      money: game.money ?? 0,
      rep: game.rep ?? 3,
      region: game.region || 'residencial',
      level: game.level || 0,
      updatedAt: Date.now(),
    }
    const idx = list.findIndex((x) => x.id === sid)
    if (idx >= 0) list[idx] = meta; else list.unshift(meta)
    writeSavesIndex(list)
    hooks.afterSave(json, rev, game.day)
  } catch (e) { /* ignore */ }
}
export function load() {
  try {
    rev = localRev()
    refreshSavesList()
    const sid = getActiveSaveId()
    const slotRaw = sid ? localStorage.getItem(slotKey(sid)) : null
    const keyRaw = localStorage.getItem(KEY)
    let raw = keyRaw
    if (slotRaw && keyRaw) {
      try {
        const sr = JSON.parse(slotRaw)?._rev || 0
        const kr = JSON.parse(keyRaw)?._rev || 0
        if (sr >= kr) raw = slotRaw
      } catch (e) { raw = slotRaw }
    } else if (slotRaw) {
      raw = slotRaw
    }
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (!parsed || parsed._deleted) return false
    const { cart, log, _rev, ...d } = parsed
    // saves de versões anteriores não têm os campos novos: entram os valores padrão
    Object.assign(game, { market: noMarket(), forecast: null, nextRumorDay: RUMOR.firstDay, weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {}, plan: basePlan(d.level || 0), career: newCareer(), recipes: {}, orders: [], zapOn: true, team: [], candidates: [], pass: { claimed: {} }, goals: [], goalsDay: 0, dirt: [], doormat: null, mode: 'normal', pomodoro: newPomodoro(), region: 'residencial', branchId: 'main', branchName: 'Matriz', branches: [], lifetime: newLifetime(), bigGoals: { claimed: {} }, visitedPet: null, tipCount: 0, dayUnlocked: {}, expiryPriceMemory: {}, visitorLog: [] }, d, { speed: 1, paused: false })
    if (game.plan && game.plan.built == null) game.plan.built = true
    if (game.plan?.stock && !game.plan.stock.corner) game.plan.stock.corner = 'nw'
    game.shopStyle = { ...defaultShopStyle(), ...(d.shopStyle || {}) }
    game.visitorLog = Array.isArray(game.visitorLog) ? game.visitorLog.slice(0, 40) : []
    if (!game.dayUnlocked || !Object.keys(game.dayUnlocked).length) game.dayUnlocked = { ...game.unlocked }
    game.expiryPriceMemory = { ...(game.expiryPriceMemory || {}) }
    game.playerName = d.playerName || settings.playerName || 'Lojista'
    game.shopName = d.shopName || (d.branchId === 'main' ? d.branchName : null) || settings.storeName || 'Lojinha Lofi'
    if (game.branchId === 'main' && (!d.branchName || d.branchName === 'Matriz')) game.branchName = game.shopName
    settings.playerName = game.playerName
    settings.storeName = game.shopName
    game.pomodoro = { ...newPomodoro(), ...(game.pomodoro || {}) }
    game.lifetime = { ...newLifetime(), ...(game.lifetime || {}) }
    game.bigGoals = { claimed: { ...(game.bigGoals?.claimed || {}) } }
    game.branches = Array.isArray(game.branches) ? game.branches : []
    delete game.staff
    if (game.forecast && game.forecast.created == null) game.forecast = null // boato do sistema antigo
    if (!d.team && d.staff) { // saves antigos guardavam só quantos havia de cada cargo
      const taken = new Set()
      for (const [role, n] of Object.entries(d.staff)) for (let i = 0; i < n && STAFF[role]; i++) {
        const m = makePerson(role, { skill: 3, speed: 3, wage: STAFF[role].wage }, taken)
        taken.add(m.name); game.team.push(m)
      }
    }
    game.pass = { claimed: { ...(game.pass?.claimed || {}) } }
    game.dirt = (game.dirt || []).map((x) => ({ ...x, id: uid(), res: null }))
    game.today = { ...newStats(), ...game.today }
    game.career = { ...newCareer(), ...game.career, perks: { ...(game.career?.perks || {}) } }
    // saves antigos não contavam as compras: cada produto liberado conta como uma caixa
    if (!d.bought) game.bought = Object.fromEntries(Object.keys(game.unlocked).map((pid) => [pid, PACK]))
    discoverRecipes(false)
    // pedidos do Zap em andamento dependiam do repositor e do motoboy na tela: ficam só os concluídos
    game.orders = (game.orders || []).filter((o) => o.state === 'done' || o.state === 'refused')
    game.boxes.forEach((b) => { b.res = null; b.id = uid(); if (b.state !== 'empty' && b.product) syncShelfBatches(b); else { b.batches = []; b.daysLeft = null } })
    game.shelves = game.shelves.filter((s) => !(s.style === 'wall' && s.slot >= 2))
    // versões de teste converteram a prateleira da ponta em outro tipo: volta ao tipo e ao giro que ela tinha
    for (const s of game.shelves) {
      if (s.auto) { s.rot = s.rot0 || 0; if (s.var0) s.variant = s.var0; else delete s.variant }
      if (s.variant === 'corner') delete s.variant
      delete s.auto; delete s.rot0; delete s.var0; delete s.tall; delete s.mir
    } // a estante de parede antiga tinha 4 lugares; agora são 2
    game.shelves.forEach((s) => {
      s.id = uid()
      s.rot = s.rot || 0
      s.kind = s.kind || (s.fridge ? 'fridge' : 'shelf')
      s.fridge = (s.kind === 'fridge' || s.kind === 'meat' || !!s.fridge)
      s.boost = s.boost || 0
      s.wear = s.wear || 0
      s.broken = !!s.broken
      s.brokenT = s.brokenT || 0
      s.call = s.call || null
      s.techAt = null
      s.daysLeft = s.product && s.count > 0 ? (s.daysLeft ?? shelfLifeOf(s.product)) : null
      syncShelfBatches(s)
    })
    game.register = game.plan.built === false ? null : (d.register || defaultRegister(game.plan))
    game.decor = game.plan.built === false ? [] : (d.decor || defaultDecor(game.plan)).map((o) => ({ ...o, id: uid() }))
    if (game.plan.built !== false) {
      for (const u of usableDecor(game.plan)) if (!game.decor.some((o) => o.type === u.type)) game.decor.push({ ...u, id: uid() })
    }
    // freezers eram decoração e agora guardam produtos; saves bem antigos nem tinham freezer salvo
    const freezers = d.decor ? game.decor.filter((o) => o.type === 'freezer') : defaultFreezers(game.plan)
    game.decor = game.decor.filter((o) => DECOR[o.type])
    if (!d.decorV2) { // o que antes era parede fixa vira decoração da loja (já é do jogador)
      const cols = game.plan.cols, wall = [{ type: 'clock', x: cols - 2 }, { type: 'frame', x: 1, hue: 0 }, { type: 'frame', x: 5, hue: 1 }, ...(cols > 9 ? [{ type: 'frame', x: 9, hue: 2 }] : [])]
      for (const w of wall) game.decor.push({ id: uid(), z: 0, rot: 0, ...w })
    }
    game.decorV2 = true
    if (!game.shelves.some((s) => s.fridge)) for (const f of freezers) addShelf({ ...f, fridge: true })
    // saves de antes das regras de seção: prateleira vazia com produto que não vai mais nela fica livre; com itens, avisa para esvaziar
    let misplaced = 0
    for (const s of game.shelves) {
      if (!s.product || s.x < 0 || canStockProduct(s.product, s)) continue
      if (s.count === 0) { s.product = null; s.price = null } else misplaced++
    }
    if (misplaced) toast(`${misplaced === 1 ? '1 prateleira guarda' : `${misplaced} prateleiras guardam`} produto que agora vai em outro móvel: esvazie para o repositor voltar a repor`, 'bad')
    settle()
    ui.cart = cart || {}
    ui.log = (log || []).map((m) => ({ ...m, id: uid() }))
    if (game.phase === 'night' && game.summary) ui.modal = 'summary'
    hooks.refreshGrid()
    return true
  } catch (e) { return false }
}
export function wipeSave() {
  try { localStorage.removeItem(KEY) } catch (e) { /* ignore */ }
}

export function setPlayerName(raw, finalize = false) {
  let val = String(raw ?? '').slice(0, 20)
  if (finalize) val = val.trim() || 'Lojista'
  if (window.__visiting) {
    settings.playerName = val.trim() || 'Lojista'
    return
  }
  game.playerName = val
  settings.playerName = val.trim() || 'Lojista'
  if (finalize || val.trim()) save()
}

export function setShopName(raw, finalize = false) {
  let val = String(raw ?? '').slice(0, 24)
  if (finalize) val = val.trim() || 'Lojinha Lofi'
  if (window.__visiting) {
    settings.storeName = val.trim() || 'Lojinha Lofi'
    hooks.syncStoreName?.(settings.storeName)
    return
  }
  game.shopName = val
  settings.storeName = val.trim() || 'Lojinha Lofi'
  if (game.branchId === 'main') game.branchName = val
  hooks.syncStoreName?.(val.trim() || 'Lojinha Lofi')
  hooks.syncFacadeSign?.()
  if (finalize || val.trim()) save()
}

export function setShopStyle(patch) {
  if (window.__visiting) return
  game.shopStyle = { ...defaultShopStyle(), ...(game.shopStyle || {}), ...patch }
  hooks.rebuildShop?.()
  save()
}

export function cycleWallMode() {
  const order = ['full', 'transparent', 'none']
  const cur = game.shopStyle?.wallMode || 'full'
  const next = order[(order.indexOf(cur) + 1) % order.length]
  setShopStyle({ wallMode: next })
}

export function renameSaveSlot(sid, { playerName, shopName }) {
  const pName = String(playerName ?? '').trim().slice(0, 20) || 'Lojista'
  const sName = String(shopName ?? '').trim().slice(0, 24) || 'Lojinha Lofi'
  if (sid === getActiveSaveId() && !window.__visiting) {
    setPlayerName(pName, true)
    setShopName(sName, true)
    return true
  }
  try {
    const raw = localStorage.getItem(slotKey(sid))
    if (raw) {
      const data = JSON.parse(raw)
      data.playerName = pName
      data.shopName = sName
      if (data.branchId === 'main' || !data.branchId) data.branchName = sName
      localStorage.setItem(slotKey(sid), JSON.stringify(data))
    }
    const list = readSavesIndex()
    const item = list.find((x) => x.id === sid)
    if (item) {
      item.playerName = pName
      item.shopName = sName
      item.updatedAt = Date.now()
      writeSavesIndex(list)
    }
    return true
  } catch (e) { return false }
}

export function createNewSave({ playerName, shopName, mode }) {
  if (window.__visiting) return toast('Volte para sua loja antes de criar uma nova partida', 'bad')
  if (getActiveSaveId()) save()
  const sid = 'save_' + uid()
  setActiveSaveId(sid)
  newGame({ playerName, shopName, mode })
  hooks.resetEntities?.()
  hooks.refreshGrid?.()
  hooks.rebuildShop?.()
  hooks.setPlayerPos?.(4, (game.plan?.rows || 6) + 1, 0)
  hooks.syncStoreName?.(game.shopName)
  save()
  ui.modal = null
  toast(`🎉 Bem-vindo(a), ${game.playerName}! ${game.shopName} inaugurada no modo ${GAME_MODES[game.mode]?.name || game.mode}!`, 'good')
}

export function loadSaveSlot(sid) {
  if (window.__visiting) return toast('Volte para sua loja antes de trocar de partida', 'bad')
  const raw = localStorage.getItem(slotKey(sid))
  if (!raw) return false
  if (getActiveSaveId()) save()
  setActiveSaveId(sid)
  localStorage.setItem(KEY, raw)
  const ok = load()
  if (ok) {
    hooks.resetEntities?.()
    hooks.refreshGrid?.()
    hooks.rebuildShop?.()
    const saved = game.playerPos
    hooks.setPlayerPos?.(saved ? saved.x : 4, saved ? saved.z : (game.plan?.rows || 6) + 1, saved?.face || 0)
    hooks.syncStoreName?.(game.shopName)
    ui.modal = null
    toast(`📂 Partida carregada: ${game.shopName} (Dia ${game.day})`, 'good')
  }
  return ok
}

export function restartSaveSlot(sid = getActiveSaveId()) {
  if (window.__visiting) return toast('Volte para sua loja antes de recomeçar a partida', 'bad')
  const list = readSavesIndex()
  const meta = list.find((x) => x.id === sid)
  const pName = meta?.playerName || game.playerName || settings.playerName || 'Lojista'
  const sName = meta?.shopName || game.shopName || settings.storeName || 'Lojinha Lofi'
  const mode = meta?.mode || game.mode || 'normal'
  if (!confirm(`Recomeçar "${sName}" do Dia 1? O modo (${GAME_MODES[mode]?.name || mode}) e os nomes serão mantidos.`)) return false
  setActiveSaveId(sid || 'save_' + uid())
  newGame({ playerName: pName, shopName: sName, mode })
  hooks.resetEntities?.()
  hooks.refreshGrid?.()
  hooks.rebuildShop?.()
  hooks.setPlayerPos?.(4, (game.plan?.rows || 6) + 1, 0)
  hooks.syncStoreName?.(game.shopName)
  save()
  ui.modal = null
  toast(`🔄 Partida "${sName}" reiniciada do Dia 1!`, 'info')
  return true
}

export function deleteSaveSlot(sid) {
  const list = readSavesIndex()
  const target = list.find((x) => x.id === sid)
  if (!target) return
  if (!confirm(`Apagar permanentemente o save "${target.shopName}" (Dia ${target.day})?`)) return
  const nextList = list.filter((x) => x.id !== sid)
  try { localStorage.removeItem(slotKey(sid)) } catch (e) { /* ignore */ }
  writeSavesIndex(nextList)
  hooks.deleteOnlineStore?.(target.storeCode || (sid === getActiveSaveId() ? settings.storeCode : ''))
  if (getActiveSaveId() === sid) {
    if (nextList.length > 0) {
      loadSaveSlot(nextList[0].id)
      ui.modal = 'start'
    } else {
      setActiveSaveId('')
      wipeSave()
      rev = Math.max(rev, localRev()) + 1
      try { localStorage.setItem(REV_KEY, String(rev)) } catch (e) { /* ignore */ }
      hooks.clearCloudSave?.(rev)
      hooks.deleteOnlineStore?.('')
      ui.modal = 'start'
    }
  }
}

export function restartGame() {
  restartSaveSlot(getActiveSaveId())
}

export const stockInfo = (pid) => ({
  shelves: game.shelves.filter((s) => s.product === pid).reduce((n, s) => n + s.count, 0),
  boxes: game.boxes.filter((b) => b.product === pid).reduce((n, b) => n + b.count, 0),
  incoming: game.pending.filter((o) => o.product === pid).reduce((n, o) => n + o.boxes * (o.size || PACK), 0),
})
