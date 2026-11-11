// Save na nuvem (Supabase). O localStorage continua sendo o save principal: a nuvem recebe cópias
// e só é lida ao abrir o jogo, quando tem uma versão mais nova que a local.
// Regras (ver supabase/migrations/001_saves.sql): a versão (rev) só cresce e só a sessão ativa grava.
import { reactive } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { hooks, saveMeta, localRev, replaceLocalSave, save, game, toast } from './state.js'

const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY
const sb = URL_ && KEY_ ? createClient(URL_, KEY_) : null

const SESSION = crypto.randomUUID()
const TAB_KEY = 'lojinha-lofi-tab' // a aba que abre por último avisa as outras por aqui
const OK_KEY = 'lojinha-lofi-cloud-ok'
const EVERY = 30000 // sem pressa: no máximo um envio a cada 30 s
const URGENT = 800 // depois de gastar dinheiro: envia logo
const KEEPALIVE_MAX = 60000 // o navegador limita o corpo de um envio feito ao fechar a página

// status: off (sem Supabase configurado), connecting, online, offline. locked: null, 'other' ou 'ahead'
export const cloud = reactive({ status: sb ? 'connecting' : 'off', locked: null })

let token = null, claimed = false, started = false
let pending = null, inflight = false, timer = 0, lastPush = 0, retry = 0

sb?.auth.onAuthStateChange((_e, s) => { token = s?.access_token || null })

function lock(reason) {
  if (saveMeta.locked) return
  saveMeta.locked = true
  cloud.locked = reason
  game.paused = true
}

async function connect() {
  let { data: { session } } = await sb.auth.getSession()
  if (!session) {
    const r = await sb.auth.signInAnonymously()
    if (r.error) throw r.error
    session = r.data.session
  }
  token = session.access_token
  const { data, error } = await sb.rpc('claim_session', { p_session: SESSION })
  if (error) throw error
  return data?.[0] || null
}

function onClaim(row) {
  claimed = true
  cloud.status = 'online'
  const r = Number(row?.rev) || 0
  if (r > localRev() && row?.data) {
    // a nuvem está à frente (outro aparelho jogou): antes de começar, ela vira o save local;
    // com o jogo já rodando (conexão demorou), para tudo e pede para recarregar
    if (!started) replaceLocalSave(row.data, r)
    else lock('ahead')
    return
  }
  if (started) save()
}

function fail() {
  cloud.status = 'offline'
  clearTimeout(retry)
  retry = setTimeout(() => connect().then(onClaim).catch(fail), EVERY)
}

// Chamado antes do load(): espera a nuvem por até 4 s. Sem resposta, o jogo abre com o save local
// e a conexão continua tentando por trás.
export function startCloud() {
  addEventListener('storage', (e) => { if (e.key === TAB_KEY && e.newValue !== SESSION) lock('other') })
  try { localStorage.setItem(TAB_KEY, SESSION) } catch (e) { /* ignore */ }
  if (!sb) return Promise.resolve()
  const p = connect().then(onClaim).catch(fail)
  return Promise.race([p, new Promise((r) => setTimeout(r, 4000))])
}
export function cloudStarted() {
  started = true
  if (claimed) save() // primeiro envio já na abertura
}

hooks.afterSave = (json, rev, day) => {
  if (!sb) return
  pending = { json, rev, day }
  if (!lastPush) schedule(0)
  else if (!timer) schedule(Math.max(0, lastPush + EVERY - Date.now()))
}
function schedule(ms) {
  clearTimeout(timer)
  timer = setTimeout(() => { timer = 0; flush(false) }, ms)
}

function post(p, keepalive) {
  const body = `{"p_session":"${SESSION}","p_rev":${p.rev},"p_day":${p.day | 0},"p_data":${p.json}}`
  return fetch(`${URL_}/rest/v1/rpc/save_game`, {
    method: 'POST',
    keepalive: keepalive && body.length < KEEPALIVE_MAX,
    headers: { 'Content-Type': 'application/json', apikey: KEY_, Authorization: `Bearer ${token}` },
    body,
  }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
}

function flush(keepalive) {
  if (!claimed || !pending || saveMeta.locked || !token) return
  if (inflight && !keepalive) return
  const p = pending
  pending = null
  inflight = true
  post(p, keepalive)
    .then((res) => {
      lastPush = Date.now()
      cloud.status = 'online'
      if (res === 'other_session') { lock('other'); return }
      try {
        if (!localStorage.getItem(OK_KEY)) { localStorage.setItem(OK_KEY, '1'); toast('Progresso salvo na nuvem', 'good') }
      } catch (e) { /* ignore */ }
    })
    .catch(async (status) => {
      if (!pending || pending.rev < p.rev) pending = p // o que não foi volta para a fila
      cloud.status = 'offline'
      if (status === 401) { const { data } = await sb.auth.getSession(); token = data.session?.access_token || null }
      schedule(15000)
    })
    .finally(() => { inflight = false; if (pending && !timer && !saveMeta.locked) schedule(EVERY) })
}

// Depois de gastar dinheiro (compra, contratação, obra…): grava já, para o F5 não desfazer.
let soon = 0
export function saveSoon() {
  clearTimeout(soon)
  soon = setTimeout(() => {
    save()
    if (pending) schedule(URGENT)
  }, 300)
}
// Ao fechar ou esconder a aba: grava e envia na hora (com keepalive, que sobrevive ao fechamento).
export function saveOnExit() {
  save()
  flush(true)
}
