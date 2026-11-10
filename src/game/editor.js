// Modo layout: pegar um móvel, escolher o lugar e soltar. Só com a loja fechada.
import { game, ui, hooks, toast, uid, money, isClosed, maxShelves, maxFreezers, shelfCount, freezerCount, decorCount } from './state.js'
import { SHELF_PRICE, FREEZER_PRICE, DECOR, CAFE } from './config.js'
import { checkLayout, dims, shelfAccess, cashierTile, queueTiles, queueFor, onFloor } from './layout.js'

const COLOR = { ok: 0x7fd6a8, bad: 0xe0675d, access: 0xf2c25b, queue: 0x4f9fe0 }
// lugar do atendente e da fila, com nome em cada posição
export const checkoutGuide = (r, queue, color = COLOR.queue) => [
  { ...cashierTile(r), c: COLOR.access, o: 0.7, label: 'Atendente' },
  ...queue.map((t, i) => ({ x: t.x, z: t.z, c: color, o: 0.55, label: `Fila ${i + 1}` })),
]
const find = (kind, id) => (kind === 'shelf' ? game.shelves.find((s) => s.id === id) : kind === 'decor' ? game.decor.find((d) => d.id === id) : kind === 'cafe' ? game.cafe : game.register)

export function startEdit() {
  if (!isClosed()) return toast('Só dá para mexer no layout com a loja fechada', 'bad')
  ui.modal = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.selectedBox = null
  ui.editing = true
  ui.held = null
}
export function stopEdit() {
  cancelHeld()
  ui.editing = false
  hooks.refreshGrid()
}

function candidate(h) {
  const me = { x: h.x, z: h.z, rot: h.rot, type: h.kind === 'decor' ? find('decor', h.id)?.type : undefined }
  const shelves = game.shelves.filter((s) => !(h.kind === 'shelf' && s.id === h.id))
  const decor = game.decor.filter((d) => !(h.kind === 'decor' && d.id === h.id))
  const cafe = h.kind === 'cafe' ? me : game.cafe
  if (h.kind === 'shelf') return { shelves: [...shelves, me], decor, register: game.register, cafe }
  if (h.kind === 'decor') return { shelves, decor: [...decor, me], register: game.register, cafe }
  if (h.kind === 'cafe') return { shelves, decor, register: game.register, cafe }
  return { shelves, decor, register: me, cafe }
}
function evaluate() {
  const h = ui.held
  const L = candidate(h)
  h.why = checkLayout(game.plan, L)
  h.valid = !h.why
  h.preview = [{ x: h.x, z: h.z, c: h.valid ? COLOR.ok : COLOR.bad, o: 0.6 }]
  if (h.kind === 'shelf') h.preview.push({ ...shelfAccess(h), c: COLOR.access, o: 0.4 })
  if (h.kind === 'cafe') h.preview.push({ ...shelfAccess(h), c: COLOR.queue, o: 0.55, label: 'Cliente' }, { ...cashierTile(h), c: COLOR.access, o: 0.7, label: 'Atendente' })
  if (h.kind === 'counter') {
    const blocked = new Set([...L.shelves, ...L.decor, L.register, ...(L.cafe ? [L.cafe] : [])].map((o) => o.x + ',' + o.z))
    // mesmo num lugar inválido mostra (em vermelho) onde a fila ficaria
    const queue = (h.valid && queueTiles(game.plan, L.register, blocked)) || queueFor(h, (x, z) => onFloor(game.plan, x, z)) || []
    h.preview.push(...checkoutGuide(h, queue, h.valid ? COLOR.queue : COLOR.bad))
  }
}

export function pickUp(kind, id) {
  const o = find(kind, id)
  if (!o) return
  ui.held = { kind, id, x: o.x, z: o.z, rot: o.rot || 0, isNew: false }
  evaluate()
}
export function moveHeld(x, z) {
  const h = ui.held
  if (!h) return
  x = Math.round(x); z = Math.round(z)
  if (x === h.x && z === h.z) return
  h.x = x; h.z = z
  evaluate()
}
export function rotateHeld() {
  const h = ui.held
  if (!h) return
  h.rot = (h.rot + 1) % 4
  evaluate()
}
export function dropHeld() {
  const h = ui.held
  if (!h) return
  if (!h.valid) return toast(h.why, 'bad')
  if (h.isNew && game.money < h.price) return toast('Caixa insuficiente', 'bad')
  if (h.isNew) game.money -= h.price
  Object.assign(find(h.kind, h.id), { x: h.x, z: h.z, rot: h.rot })
  if (h.isNew) toast(`Comprado por ${money(h.price)}`, 'good')
  ui.held = null
  hooks.refreshGrid()
}
export function cancelHeld() {
  const h = ui.held
  if (!h) return
  if (h.isNew && h.kind === 'cafe') game.cafe = null
  else if (h.isNew) {
    const list = h.kind === 'shelf' ? game.shelves : game.decor
    list.splice(list.findIndex((o) => o.id === h.id), 1)
  }
  ui.held = null
}

// item novo fica na mão e só é cobrado ao ser colocado no lugar
function holdNew(kind, item, price) {
  if (!ui.editing) startEdit()
  cancelHeld()
  const { cols, rows } = dims(game.plan)
  if (kind === 'cafe') game.cafe = item
  else (kind === 'shelf' ? game.shelves : game.decor).push(item)
  ui.held = { kind, id: item.id, x: Math.floor(cols / 2), z: Math.floor(rows / 2), rot: 0, isNew: true, price }
  evaluate()
}
const newShelf = (fridge) => ({ id: uid(), x: -99, z: -99, rot: 0, product: null, count: 0, price: null, fridge })

export const canBuyShelf = () => isClosed() && game.money >= SHELF_PRICE && shelfCount() < maxShelves()
export function buyShelf() {
  if (!canBuyShelf()) return toast(isClosed() ? 'Sem caixa ou sem espaço para outra prateleira' : 'Instale móveis com a loja fechada', 'bad')
  holdNew('shelf', newShelf(false), SHELF_PRICE)
}
export const canBuyFreezer = () => isClosed() && game.money >= FREEZER_PRICE && freezerCount() < maxFreezers()
export function buyFreezer() {
  if (!canBuyFreezer()) return toast(isClosed() ? 'Sem caixa ou sem espaço para outro freezer' : 'Instale móveis com a loja fechada', 'bad')
  holdNew('shelf', newShelf(true), FREEZER_PRICE)
}
export const canBuyCafe = () => isClosed() && !game.cafe && game.level >= CAFE.minLevel && game.money >= CAFE.price
export function buyCafe() {
  if (!canBuyCafe()) return toast('Ainda não dá para instalar a cafeteria', 'bad')
  holdNew('cafe', { id: uid(), x: -99, z: -99, rot: 0 }, CAFE.price)
}
export const decorMaxed = (type) => !!DECOR[type].max && decorCount(type) >= DECOR[type].max
export const canBuyDecor = (type) => isClosed() && game.money >= DECOR[type].price && !decorMaxed(type)
export function buyDecor(type) {
  if (!canBuyDecor(type)) return toast(!isClosed() ? 'Compre decoração com a loja fechada' : decorMaxed(type) ? 'Você já tem esse item' : 'Caixa insuficiente', 'bad')
  holdNew('decor', { id: uid(), type, x: -99, z: -99, rot: 0 }, DECOR[type].price)
}
