import { reactive, watch } from 'vue'
import { PRODUCTS, PID, LEVELS, STAFF, START_MONEY, PACK, DAY_SECONDS, DECOR, EVENTS, WEATHER, EXPRESS_FEE, CAFE_ID } from './config.js'
import { basePlan, planArea, stockRoom, defaultRegister, defaultShelves, defaultFreezers, defaultDecor, usableDecor, settleLayout } from './layout.js'

let _id = 1
export const uid = () => _id++
export const hooks = { refreshGrid: () => {}, beforeSave: () => {}, shiftActors: () => {} }

export const newStats = () => ({ revenue: 0, units: 0, cogs: 0, customers: 0, served: 0, sold: {}, oos: {}, price: {}, patience: 0, lostValue: 0, moods: {}, stolen: 0, stolenUnits: 0, caught: 0, cafeSales: 0, cafeRevenue: 0, lunchMissed: 0 })
const noMarket = () => ({ text: null, mods: {} })

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
  staff: { cashier: 0, stocker: 0, barista: 0 },
  today: newStats(),
  summary: null,
  playerPos: null,
  market: noMarket(),
  weather: 'mild',
  cafe: null,
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
  panelCafe: false,
  build: null, // obra sendo planejada: quantos quadrados cada parede anda
  buildArrows: [], // posição na tela dos controles de cada parede
  atRegister: false,
  theft: null, // balão do roubo em andamento: posição na tela e tempo restante
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
export const isClosed = () => game.phase === 'prep' || game.phase === 'night' || game.phase === 'lunch'
export const canExpand = () => game.phase === 'prep' || game.phase === 'night'
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
  const plan = basePlan(0)
  Object.assign(game, {
    day: 1, phase: 'prep', clock: 0, speed: 1, paused: false, money: START_MONEY, rep: 3, level: 0, plan,
    unlocked: Object.fromEntries(PRODUCTS.filter((p) => p.unlock === 0).map((p) => [p.id, true])),
    shelves: [], register: defaultRegister(plan), decor: defaultDecor(plan).map((d) => ({ id: uid(), ...d })),
    boxes: [], pending: [], priceMemory: {}, staff: { cashier: 0, stocker: 0, barista: 0 },
    today: newStats(), summary: null, playerPos: null, market: noMarket(), weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {},
  })
  ui.build = null
  ui.cart = {}
  ui.selectedBox = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.modal = null
  ui.log = []
  ui.toasts = []
  // prateleiras iniciais + caixas da primeira entrega
  for (const s of [...defaultShelves(plan), ...defaultFreezers(plan)]) addShelf(s)
  for (const p of PRODUCTS.filter((p) => p.unlock === 0)) game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null })
  toast('Bem-vindo à lojinha! A primeira entrega está na calçada')
  hooks.refreshGrid()
}

export function addShelf(spot) {
  game.shelves.push({ id: uid(), x: spot.x, z: spot.z, rot: spot.rot || 0, product: null, count: 0, price: null, fridge: !!spot.fridge })
  hooks.refreshGrid()
}

// ---------- mercado: custo, preço de referência e procura variam com o evento e o clima do dia ----------
const mod = (pid) => game.market?.mods?.[pid] || {}
const cents = (n) => Math.round(n * 100) / 100
export const costOf = (pid) => cents(PID[pid].cost * (mod(pid).cost ?? 1))
export const refOf = (pid) => cents(PID[pid].ref * (mod(pid).ref ?? 1))
export const demandOf = (pid) => PID[pid].demand * (mod(pid).demand ?? 1) * (PID[pid].cold && !PID[pid].steady ? WEATHER[game.weather]?.cold ?? 1 : 1)
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
export function rollMarket() {
  const pool = EVENTS.filter((e) => Object.keys(e.mods).some((pid) => game.unlocked[pid]))
  const e = pool.length && Math.random() < 0.85 ? pool[Math.floor(Math.random() * pool.length)] : null
  game.market = e ? { text: e.text, mods: e.mods } : noMarket()
  const w = Math.random()
  game.weather = w < 0.3 ? 'hot' : w < 0.8 ? 'mild' : 'cold'
  if (e) toast(`Notícia: ${e.text}`)
}

// ---------- compras ----------
export const boxCost = (pid) => costOf(pid) * PACK
export const cartTotal = () => Object.entries(ui.cart).reduce((s, [pid, n]) => s + n * boxCost(pid), 0)
export function cartAdd(pid, d) {
  const n = Math.max(0, Math.min(20, (ui.cart[pid] || 0) + d))
  if (n) ui.cart[pid] = n
  else delete ui.cart[pid]
}
// no almoço o pedido chega na hora, com taxa de entrega expressa
export const isExpress = () => game.phase === 'lunch'
export const orderFee = () => (isExpress() ? Math.round(cartTotal() * EXPRESS_FEE * 100) / 100 : 0)
export function placeOrder() {
  const base = cartTotal()
  if (!base) return true
  const fee = orderFee(), total = base + fee
  if (total > game.money) { toast('Sem caixa suficiente para esse pedido', 'bad'); return false }
  game.money -= total
  if (isExpress()) {
    for (const [pid, n] of Object.entries(ui.cart)) for (let i = 0; i < n; i++) game.boxes.push({ id: uid(), product: pid, count: PACK, state: 'dock', res: null })
    ui.cart = {}
    toast(`Entrega expressa na calçada! Taxa de ${money(fee)}`, 'good')
    return true
  }
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
export const stepPrice = (pid, d) => setPrice(pid, (productPrice(pid) ?? refOf(pid)) + d)
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
  const inside = game.boxes.filter((b) => b.state !== 'dock' && !b.at)
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
export const customersPerDay = (plan = game.plan) => byArea('customers', plan)
export const maxCustomers = (plan = game.plan) => Math.round(byArea('maxCust', plan))
export const stockFull = () => stockCount() >= stockCap()
export const maxShelves = () => LEVELS[game.level].maxShelves
export const maxFreezers = () => LEVELS[game.level].maxFreezers
export const shelfCount = () => game.shelves.filter((s) => !s.fridge).length
export const freezerCount = () => game.shelves.filter((s) => s.fridge).length
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
  if (b.at && stockFull()) return toast('Estoque cheio! Jogue fora caixas vazias para abrir espaço', 'bad')
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
export function hire(role) {
  const s = STAFF[role]
  if (game.staff[role] >= s.max) return
  if (role === 'barista' && !game.cafe) return toast('Instale a cafeteria primeiro', 'bad')
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
let restarting = false // ao recomeçar, o salvamento automático não pode regravar o jogo antigo
export function save() {
  if (restarting) return
  try {
    hooks.beforeSave()
    const d = JSON.parse(JSON.stringify(game))
    d.boxes.forEach((b) => (b.res = null))
    // móvel novo ainda na mão não foi comprado
    d.shelves = d.shelves.filter((s) => s.x >= 0)
    d.decor = d.decor.filter((o) => o.x >= 0)
    if (d.cafe && d.cafe.x < 0) d.cafe = null
    localStorage.setItem(KEY, JSON.stringify({ ...d, cart: ui.cart, log: ui.log }))
  } catch (e) { /* ignore */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const { cart, log, ...d } = JSON.parse(raw)
    // saves de versões anteriores não têm os campos novos: entram os valores padrão
    Object.assign(game, { market: noMarket(), weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {}, plan: basePlan(d.level || 0) }, d, { speed: 1, paused: false })
    game.today = { ...newStats(), ...game.today }
    game.staff = { cashier: 0, stocker: 0, barista: 0, ...game.staff }
    game.boxes.forEach((b) => { b.res = null; b.id = uid() })
    game.shelves.forEach((s) => { s.id = uid(); s.rot = s.rot || 0; s.fridge = !!s.fridge })
    game.register = d.register || defaultRegister(game.plan)
    game.decor = (d.decor || defaultDecor(game.plan)).map((o) => ({ ...o, id: uid() }))
    for (const u of usableDecor(game.plan)) if (!game.decor.some((o) => o.type === u.type)) game.decor.push({ ...u, id: uid() })
    // freezers eram decoração e agora guardam produtos; saves bem antigos nem tinham freezer salvo
    const freezers = d.decor ? game.decor.filter((o) => o.type === 'freezer') : defaultFreezers(game.plan)
    game.decor = game.decor.filter((o) => DECOR[o.type])
    if (!game.shelves.some((s) => s.fridge)) for (const f of freezers) addShelf({ ...f, fridge: true })
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
// personagem, pet e música ficam nas preferências e não são apagados
export function restartGame() {
  if (!confirm('Recomeçar do zero? Todo o progresso salvo será apagado.')) return
  restarting = true
  wipeSave()
  location.reload()
}

export const stockInfo = (pid) => ({
  shelves: game.shelves.filter((s) => s.product === pid).reduce((n, s) => n + s.count, 0),
  boxes: game.boxes.filter((b) => b.product === pid).reduce((n, b) => n + b.count, 0),
  incoming: (game.pending.find((o) => o.product === pid)?.boxes || 0) * PACK,
})
