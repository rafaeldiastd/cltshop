import { reactive, watch } from 'vue'
import { PRODUCTS, PID, LEVELS, STAFF, START_MONEY, PACK, DAY_SECONDS } from './config.js'
import { stockRoom, defaultRegister, defaultShelves, defaultDecor, usableDecor, settleLayout } from './layout.js'

let _id = 1
export const uid = () => _id++
export const hooks = { refreshGrid: () => {}, beforeSave: () => {} }

export const newStats = () => ({ revenue: 0, units: 0, cogs: 0, customers: 0, served: 0, sold: {}, oos: {}, price: {}, patience: 0, lostValue: 0, moods: {} })

export const game = reactive({
  day: 1,
  phase: 'prep', // prep | open | closing | night
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
  staff: { cashier: 0, stocker: 0 },
  today: newStats(),
  summary: null,
  playerPos: null,
})

export const ui = reactive({
  modal: null, // summary | computer | menu
  computerApp: 'products', // products | store
  selectedBox: null,
  panelShelf: null,
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
  atRegister: false,
})

// preferências ficam fora do save: sobrevivem a um "Novo jogo"
const SETTINGS_KEY = 'lojinha-lofi-settings'
function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch (e) { return {} }
}
export const settings = reactive({ character: 0, hat: 'none', hatColor: '#ef8a77', pet: 'cat', musicOn: true, sfxOn: true, volume: 0.8, playlist: null, ...readSettings() })
watch(settings, () => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch (e) { /* ignore */ }
})

export const money = (n) => 'R$ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
export const isClosed = () => game.phase === 'prep' || game.phase === 'night'
export function clockText() {
  if (game.phase === 'prep') return '08:30'
  if (game.phase === 'night') return '21:00'
  const h = 9 + (Math.min(game.clock, DAY_SECONDS) / DAY_SECONDS) * 12
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

export function newGame() {
  Object.assign(game, {
    day: 1, phase: 'prep', clock: 0, speed: 1, paused: false, money: START_MONEY, rep: 3, level: 0,
    unlocked: Object.fromEntries(PRODUCTS.filter((p) => p.unlock === 0).map((p) => [p.id, true])),
    shelves: [], register: defaultRegister(0), decor: defaultDecor(0).map((d) => ({ id: uid(), ...d })),
    boxes: [], pending: [], priceMemory: {}, staff: { cashier: 0, stocker: 0 },
    today: newStats(), summary: null, playerPos: null,
  })
  ui.cart = {}
  ui.selectedBox = null
  ui.panelShelf = null
  ui.modal = null
  ui.log = []
  ui.toasts = []
  // prateleiras iniciais + caixas da primeira entrega
  for (const s of defaultShelves(0)) addShelf(s)
  for (const p of PRODUCTS.filter((p) => p.unlock === 0)) game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null })
  toast('Bem-vindo à lojinha! A primeira entrega está na calçada')
  hooks.refreshGrid()
}

export function addShelf(spot) {
  game.shelves.push({ id: uid(), x: spot.x, z: spot.z, rot: spot.rot || 0, product: null, count: 0, price: null })
  hooks.refreshGrid()
}

// ---------- compras ----------
export const boxCost = (pid) => PID[pid].cost * PACK
export const cartTotal = () => Object.entries(ui.cart).reduce((s, [pid, n]) => s + n * boxCost(pid), 0)
export function cartAdd(pid, d) {
  const n = Math.max(0, Math.min(20, (ui.cart[pid] || 0) + d))
  if (n) ui.cart[pid] = n
  else delete ui.cart[pid]
}
export function placeOrder() {
  const total = cartTotal()
  if (!total) return true
  if (total > game.money) { toast('Sem caixa suficiente para esse pedido', 'bad'); return false }
  game.money -= total
  for (const [pid, n] of Object.entries(ui.cart)) {
    const o = game.pending.find((o) => o.product === pid)
    if (o) o.boxes += n
    else game.pending.push({ product: pid, boxes: n })
  }
  ui.cart = {}
  toast('Pedido emitido! Chega amanhã cedo', 'good')
  return true
}
export function unlockProduct(pid) {
  const p = PID[pid]
  if (game.money < p.unlock) return toast('Caixa insuficiente', 'bad')
  game.money -= p.unlock
  game.unlocked[pid] = true
  toast(`Novo fornecedor: ${p.name}`, 'good')
}

// ---------- preços: valem para todas as prateleiras do produto ----------
export const productPrice = (pid) => game.priceMemory[pid] ?? null
export function setPrice(pid, value) {
  const price = Math.max(0.1, Math.round(value * 100) / 100)
  if (!Number.isFinite(price)) return
  game.priceMemory[pid] = price
  for (const s of game.shelves) if (s.product === pid) s.price = price
}
export const stepPrice = (pid, d) => setPrice(pid, (productPrice(pid) ?? PID[pid].ref) + d)
export function priceVerdict(pid) {
  const price = productPrice(pid)
  if (price == null) return { text: 'Sem preço', cls: 'none' }
  const r = price / PID[pid].ref
  if (r < 0.9) return { text: 'Barato', cls: 'cheap' }
  if (r < 1.15) return { text: 'Justo', cls: 'fair' }
  return { text: 'Caro', cls: 'dear' }
}

// ---------- loja ----------
export const stockCount = () => game.boxes.filter((b) => b.state !== 'dock' && !b.at).length
export const stockCap = () => stockRoom(game.level).cap
export const stockFull = () => stockCount() >= stockCap()
export const maxShelves = () => LEVELS[game.level].maxShelves
export const emptyCount = () => game.boxes.filter((b) => b.state === 'empty').length
export function storeBox(id) {
  const b = game.boxes.find((x) => x.id === id)
  if (!b) return
  if (b.at && stockFull()) return toast('Estoque cheio! Jogue fora caixas vazias para abrir espaço', 'bad')
  b.at = null
  if (ui.selectedBox === id) ui.selectedBox = null
}
export function trashBox(id) {
  const i = game.boxes.findIndex((b) => b.id === id && b.state === 'empty')
  if (i < 0) return
  game.boxes.splice(i, 1)
  if (ui.selectedBox === id) ui.selectedBox = null
  toast('Caixa vazia jogada fora')
}
export function trashEmpties() {
  const n = emptyCount()
  if (!n) return
  game.boxes = game.boxes.filter((b) => b.state !== 'empty')
  if (!game.boxes.some((b) => b.id === ui.selectedBox)) ui.selectedBox = null
  toast(n === 1 ? '1 caixa vazia jogada fora' : `${n} caixas vazias jogadas fora`)
}

function settle() {
  const lost = settleLayout(game.level, game)
  if (lost.length) game.decor = game.decor.filter((d) => !lost.includes(d))
}
export function expand() {
  const before = LEVELS[game.level], next = LEVELS[game.level + 1]
  if (!next) return
  if (!isClosed()) return toast('Amplie a loja quando ela estiver fechada', 'bad')
  if (game.money < next.cost) return toast('Caixa insuficiente', 'bad')
  game.money -= next.cost
  game.level++
  // o que está perto da parede direita ou da frente acompanha a parede
  const dx = next.cols - before.cols, dz = next.rows - before.rows
  for (const o of [game.register, ...game.shelves, ...game.decor]) {
    if (o.x >= before.cols / 2) o.x += dx
    if (o.z >= before.rows / 2) o.z += dz
  }
  const z = Math.ceil(before.rows / 2)
  for (const i of [0, 1]) game.decor.push({ id: uid(), type: 'freezer', x: next.cols - 1, z: z + i, rot: 3 })
  settle()
  hooks.refreshGrid()
  toast(`Loja ampliada: ${next.name}!`, 'good')
}
export function hire(role) {
  const s = STAFF[role]
  if (game.staff[role] >= s.max) return
  if (game.money < s.hire) return toast('Caixa insuficiente', 'bad')
  game.money -= s.hire
  game.staff[role]++
  toast(`${s.name} contratado`, 'good')
}
export function fire(role) {
  if (game.staff[role] > 0) game.staff[role]--
}
export const wages = () => Object.entries(game.staff).reduce((s, [r, n]) => s + n * STAFF[r].wage, 0)

// ---------- save ----------
const KEY = 'lojinha-lofi-v1'
export function save() {
  try {
    hooks.beforeSave()
    const d = JSON.parse(JSON.stringify(game))
    d.boxes.forEach((b) => (b.res = null))
    d.shelves = d.shelves.filter((s) => s.x >= 0) // prateleira nova ainda na mão não foi comprada
    localStorage.setItem(KEY, JSON.stringify({ ...d, cart: ui.cart, log: ui.log }))
  } catch (e) { /* ignore */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const { cart, log, ...d } = JSON.parse(raw)
    Object.assign(game, d, { speed: 1, paused: false })
    game.today.moods = game.today.moods || {}
    game.boxes.forEach((b) => { b.res = null; b.id = uid() })
    game.shelves.forEach((s) => { s.id = uid(); s.rot = s.rot || 0 })
    game.register = game.register || defaultRegister(game.level)
    game.decor = (game.decor || defaultDecor(game.level)).map((o) => ({ ...o, id: uid() }))
    for (const d of usableDecor(game.level)) if (!game.decor.some((o) => o.type === d.type)) game.decor.push({ ...d, id: uid() })
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

export const stockInfo = (pid) => ({
  shelves: game.shelves.filter((s) => s.product === pid).reduce((n, s) => n + s.count, 0),
  boxes: game.boxes.filter((b) => b.product === pid).reduce((n, b) => n + b.count, 0),
  incoming: (game.pending.find((o) => o.product === pid)?.boxes || 0) * PACK,
})
