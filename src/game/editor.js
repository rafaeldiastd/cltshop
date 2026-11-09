// Modo layout: pegar um móvel, escolher o lugar e soltar. Só com a loja fechada.
import { game, ui, hooks, toast, uid, money, isClosed, maxShelves } from './state.js'
import { SHELF_PRICE } from './config.js'
import { checkLayout, dims, shelfAccess, cashierTile, queueTiles } from './layout.js'

const COLOR = { ok: 0x7fd6a8, bad: 0xe0675d, access: 0xf2c25b, queue: 0x7fb8e0 }
const find = (kind, id) => (kind === 'shelf' ? game.shelves.find((s) => s.id === id) : kind === 'decor' ? game.decor.find((d) => d.id === id) : game.register)

export function startEdit() {
  if (!isClosed()) return toast('Só dá para mexer no layout com a loja fechada', 'bad')
  ui.modal = null
  ui.panelShelf = null
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
  if (h.kind === 'shelf') return { shelves: [...shelves, me], decor, register: game.register }
  if (h.kind === 'decor') return { shelves, decor: [...decor, me], register: game.register }
  return { shelves, decor, register: me }
}
function evaluate() {
  const h = ui.held
  const L = candidate(h)
  h.why = checkLayout(game.level, L)
  h.valid = !h.why
  h.preview = [{ x: h.x, z: h.z, c: h.valid ? COLOR.ok : COLOR.bad, o: 0.6 }]
  if (h.kind === 'shelf') h.preview.push({ ...shelfAccess(h), c: COLOR.access, o: 0.4 })
  if (h.kind === 'counter') {
    h.preview.push({ ...cashierTile(h), c: COLOR.access, o: 0.4 })
    if (h.valid) {
      const blocked = new Set([...L.shelves, ...L.decor, L.register].map((o) => o.x + ',' + o.z))
      for (const t of queueTiles(game.level, L.register, blocked) || []) h.preview.push({ ...t, c: COLOR.queue, o: 0.35 })
    }
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
  if (h.isNew && game.money < SHELF_PRICE) return toast('Caixa insuficiente', 'bad')
  if (h.isNew) game.money -= SHELF_PRICE
  Object.assign(find(h.kind, h.id), { x: h.x, z: h.z, rot: h.rot })
  if (h.isNew) toast(`Prateleira instalada por ${money(SHELF_PRICE)}`, 'good')
  ui.held = null
  hooks.refreshGrid()
}
export function cancelHeld() {
  const h = ui.held
  if (!h) return
  if (h.isNew) game.shelves.splice(game.shelves.findIndex((s) => s.id === h.id), 1)
  ui.held = null
}

export const canBuyShelf = () => isClosed() && game.money >= SHELF_PRICE && game.shelves.length < maxShelves()
export function buyShelf() {
  if (!isClosed()) return toast('Instale prateleiras com a loja fechada', 'bad')
  if (game.money < SHELF_PRICE) return toast('Caixa insuficiente', 'bad')
  if (game.shelves.length >= maxShelves()) return toast('Limite de prateleiras. Amplie a loja!', 'bad')
  if (!ui.editing) startEdit()
  cancelHeld()
  const { cols, rows } = dims(game.level)
  const shelf = { id: uid(), x: -99, z: -99, rot: 0, product: null, count: 0, price: null }
  game.shelves.push(shelf)
  ui.held = { kind: 'shelf', id: shelf.id, x: Math.floor(cols / 2), z: Math.floor(rows / 2), rot: 0, isNew: true }
  evaluate()
}
