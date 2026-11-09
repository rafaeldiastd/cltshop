import { reactive } from 'vue'
import { PRODUCTS, PID, LEVELS, SHELF_SLOTS, SHELF_PRICE, STAFF, START_MONEY, PACK } from './config.js'

let _id = 1
export const uid = () => _id++
export const hooks = { refreshGrid: () => {} }

export const newStats = () => ({ revenue: 0, units: 0, cogs: 0, customers: 0, served: 0, sold: {}, oos: {}, price: {}, patience: 0, lostValue: 0 })

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
  boxes: [],
  pending: [],
  priceMemory: {},
  staff: { cashier: 0, stocker: 0 },
  today: newStats(),
  summary: null,
})

export const ui = reactive({
  modal: null, // summary | orders | shop
  selectedBox: null,
  panelShelf: null,
  hover: null,
  mouse: { x: 0, y: 0 },
  toasts: [],
  action: null,
  placing: false,
  cart: {},
  musicOn: true,
  ready: false,
  prompt: null,
})

export const money = (n) => 'R$ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')

export function toast(msg, kind = 'info') {
  const t = { id: uid(), msg, kind }
  ui.toasts.push(t)
  setTimeout(() => {
    const i = ui.toasts.findIndex((x) => x.id === t.id)
    if (i >= 0) ui.toasts.splice(i, 1)
  }, 3600)
}

export function newGame() {
  Object.assign(game, {
    day: 1, phase: 'prep', clock: 0, speed: 1, paused: false, money: START_MONEY, rep: 3, level: 0,
    unlocked: Object.fromEntries(PRODUCTS.filter((p) => p.unlock === 0).map((p) => [p.id, true])),
    shelves: [], boxes: [], pending: [], priceMemory: {}, staff: { cashier: 0, stocker: 0 },
    today: newStats(), summary: null,
  })
  ui.cart = {}
  ui.selectedBox = null
  ui.panelShelf = null
  ui.modal = null
  // prateleiras iniciais + caixas da primeira entrega
  for (const s of SHELF_SLOTS.filter((s) => s.level === 0).slice(0, 3)) addShelf(s)
  for (const p of PRODUCTS.filter((p) => p.unlock === 0)) game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null })
  hooks.refreshGrid()
}

export function addShelf(slot) {
  game.shelves.push({ id: uid(), x: slot.x, z: slot.z, product: null, count: 0, price: null })
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
  toast('Pedido emitido! Chega amanhã cedo 🚚', 'good')
  return true
}
export function unlockProduct(pid) {
  const p = PID[pid]
  if (game.money < p.unlock) return toast('Caixa insuficiente', 'bad')
  game.money -= p.unlock
  game.unlocked[pid] = true
  toast(`Novo fornecedor: ${p.name} ${p.emoji}`, 'good')
}

// ---------- loja ----------
export const freeSlots = () => SHELF_SLOTS.filter((s) => s.level <= game.level && !game.shelves.some((h) => h.x === s.x && h.z === s.z))
export function startPlacing() {
  if (game.money < SHELF_PRICE) return toast('Caixa insuficiente', 'bad')
  if (!freeSlots().length) return toast('Sem espaço livre. Expanda a loja!', 'bad')
  ui.modal = null
  ui.placing = true
}
export function placeShelf(slot) {
  if (game.money < SHELF_PRICE) return
  game.money -= SHELF_PRICE
  addShelf(slot)
  ui.placing = false
  toast('Prateleira instalada 🪵', 'good')
}
export function expand() {
  const next = LEVELS[game.level + 1]
  if (!next) return
  if (game.money < next.cost) return toast('Caixa insuficiente', 'bad')
  game.money -= next.cost
  game.level++
  hooks.refreshGrid()
  toast(`Loja ampliada: ${next.name}! 🎉`, 'good')
}
export function hire(role) {
  const s = STAFF[role]
  if (game.staff[role] >= s.max) return
  if (game.money < s.hire) return toast('Caixa insuficiente', 'bad')
  game.money -= s.hire
  game.staff[role]++
  toast(`${s.name} contratado 🙌`, 'good')
}
export function fire(role) {
  if (game.staff[role] > 0) game.staff[role]--
}
export const wages = () => Object.entries(game.staff).reduce((s, [r, n]) => s + n * STAFF[r].wage, 0)

// ---------- save ----------
const KEY = 'lojinha-lofi-v1'
export function save() {
  try {
    const d = JSON.parse(JSON.stringify(game))
    d.boxes.forEach((b) => (b.res = null))
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch (e) { /* ignore */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const d = JSON.parse(raw)
    if (d.phase !== 'prep') return false
    Object.assign(game, d, { speed: 1, paused: false })
    game.boxes.forEach((b) => { b.res = null; b.id = uid() })
    game.shelves.forEach((s) => (s.id = uid()))
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
