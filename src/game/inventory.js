// Inventário: móveis e decorações que o jogador já pagou e tirou da loja. Voltam para o lugar sem custo.
// Prateleiras e freezers vão com o que têm dentro (o produto continua vencendo normalmente).
import { game, hooks, toast, money, emptyInventory } from './state.js'
import { DECOR, RESALE, SHELF_PRICE, WALL_SHELF_PRICE, FREEZER_PRICE, PRODUCE_PRICE, MEAT_PRICE, CAFE } from './config.js'
import { checkLayout, settleLayout } from './layout.js'

export const inv = () => game.inventory || (game.inventory = emptyInventory())
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// cada tipo guardado tem uma chave: é ela que agrupa a lista do inventário (3× Prateleira padrão…)
export const shelfKey = (s) => (s.kind === 'produce' ? 'produce:' + (s.style === 'wall' ? 'wall' : 'island')
  : s.kind === 'meat' ? 'meat'
  : s.kind === 'fridge' || s.fridge ? 'fridge'
  : 'shelf:' + (s.variant === 'wall' ? 'wall' : 'std'))
export const KEY_INFO = {
  'shelf:std': { name: 'Prateleira padrão', price: SHELF_PRICE, thumb: 'shelf:std' },
  'shelf:wall': { name: 'Prateleira de parede', price: WALL_SHELF_PRICE, thumb: 'shelf:wall' },
  fridge: { name: 'Freezer', price: FREEZER_PRICE, thumb: 'fridge' },
  meat: { name: 'Freezer de carnes', price: MEAT_PRICE, thumb: 'meat' },
  'produce:island': { name: 'Expositor ilha 2×2', price: PRODUCE_PRICE, thumb: 'produce:island' },
  'produce:wall': { name: 'Expositor de parede 2×1', price: PRODUCE_PRICE, thumb: 'produce:wall' },
  cafe: { name: 'Cafeteria', price: CAFE.price, thumb: null },
}
export const keyInfo = (key) => {
  if (key.startsWith('decor:')) { const t = key.slice(6), d = DECOR[t]; return { name: cap(d?.name || t), price: d?.price || 0, decor: t } }
  return KEY_INFO[key] || { name: key, price: 0 }
}
export const resaleOf = (price) => Math.floor(price * RESALE)
// o que pode ir para o inventário: tudo o que se compra; caixa, computador e rádio são da loja e só mudam de lugar
export const storable = (kind, o) => kind === 'shelf' || kind === 'produceGroup' || kind === 'cafe' || (kind === 'decor' && !!DECOR[o?.type]?.price)

// unidades guardadas: uma prateleira, um expositor inteiro (os lugares do grupo), uma decoração ou a cafeteria
export function invUnits() {
  const I = inv(), units = [], groups = new Map()
  for (const s of I.shelves) {
    if (s.kind === 'produce' && s.groupId) {
      let u = groups.get(s.groupId)
      if (!u) { u = { key: shelfKey(s), kind: 'produceGroup', groupId: s.groupId, items: [] }; groups.set(s.groupId, u); units.push(u) }
      u.items.push(s)
    } else units.push({ key: shelfKey(s), kind: 'shelf', items: [s] })
  }
  for (const d of I.decor) units.push({ key: 'decor:' + d.type, kind: 'decor', items: [d] })
  if (I.cafe) units.push({ key: 'cafe', kind: 'cafe', items: [I.cafe] })
  for (const u of units) u.full = u.items.some((s) => s.count > 0)
  return units
}
export function invGroups() {
  const map = new Map()
  for (const u of invUnits()) {
    let g = map.get(u.key)
    if (!g) { g = { key: u.key, kind: u.kind, ...keyInfo(u.key), count: 0, full: 0 }; map.set(u.key, g) }
    g.count++
    if (u.full) g.full++
  }
  return [...map.values()]
}
export const invTotal = () => invUnits().length
// prefere a unidade vazia (para vender) ou a cheia (para recolocar, que é onde está o produto)
export const unitOf = (key, prefer = 'any') => {
  const list = invUnits().filter((u) => u.key === key)
  if (prefer === 'empty') return list.find((u) => !u.full) || null
  if (prefer === 'full') return list.find((u) => u.full) || list[0] || null
  return list[0] || null
}

const off = (o) => { o.x = -99; o.z = -99 }
// tira da loja e guarda (sem checar nada): o chamador já decidiu que pode
export function stashShelf(s) {
  const i = game.shelves.indexOf(s)
  if (i >= 0) game.shelves.splice(i, 1)
  off(s); s.techAt = null
  if (!inv().shelves.includes(s)) inv().shelves.push(s)
}
export function stashDecor(d) {
  const i = game.decor.indexOf(d)
  if (i >= 0) game.decor.splice(i, 1)
  off(d)
  if (!inv().decor.includes(d)) inv().decor.push(d)
}
export function stashCafe() {
  if (!game.cafe) return
  off(game.cafe)
  inv().cafe = game.cafe
  game.cafe = null
}
// tira do inventário o que acabou de ser colocado na loja
export function unstash(kind, ref) {
  const I = inv()
  if (kind === 'produceGroup') I.shelves = I.shelves.filter((s) => s.groupId !== ref)
  else if (kind === 'shelf') I.shelves = I.shelves.filter((s) => s.id !== ref)
  else if (kind === 'decor') I.decor = I.decor.filter((d) => d.id !== ref)
  else if (kind === 'cafe') I.cafe = null
}

// "Limpar tudo": todos os móveis e decorações compráveis vão para o inventário; caixa, computador e rádio ficam
export function clearAll() {
  let n = 0
  const groups = new Set()
  for (const s of [...game.shelves]) {
    if (s.x < 0) continue
    if (s.groupId) { if (!groups.has(s.groupId)) { groups.add(s.groupId); n++ } } else n++
    stashShelf(s)
  }
  for (const d of [...game.decor]) if (d.x >= 0 && storable('decor', d)) { stashDecor(d); n++ }
  if (game.cafe && game.cafe.x >= 0) { stashCafe(); n++ }
  hooks.refreshGrid()
  return n
}

// vende uma unidade guardada pela metade do preço; com produto dentro não dá (como na loja)
export function sellFromInv(key) {
  const u = unitOf(key, 'empty')
  if (!u) return toast(unitOf(key) ? 'Esvazie antes de vender: coloque na loja e tire os produtos' : 'Nada disso no inventário', 'bad')
  const value = resaleOf(keyInfo(key).price)
  if (u.kind === 'produceGroup') unstash('produceGroup', u.groupId)
  else unstash(u.kind, u.items[0].id)
  game.money += value
  toast(`${keyInfo(key).name} vendido por ${money(value)}`, 'good')
}

// depois de uma obra: cada móvel fica onde está ou vai para o lugar livre mais perto; o que não couber vai para o inventário
export function settleOrStore(plan) {
  const groupOf = (s) => (s.groupId ? game.shelves.filter((o) => o.groupId === s.groupId) : [s])
  let stored = 0
  // tentativas: guarda o móvel que impede a arrumação e tenta de novo, até a planta ficar válida
  for (let guard = 0; guard < 200; guard++) {
    const lost = settleLayout(plan, game)
    for (const d of lost) { if (storable('decor', d)) { stashDecor(d); stored++ } }
    const why = checkLayout(plan, game)
    if (!why) break
    const bad = firstBad(plan)
    if (!bad) break
    if (bad.list === 'shelf') { for (const s of groupOf(bad.o)) stashShelf(s); stored++ }
    else if (bad.list === 'decor') { if (storable('decor', bad.o)) { stashDecor(bad.o); stored++ } else break }
    else if (bad.list === 'cafe') { stashCafe(); stored++ }
    else break
  }
  return stored
}
// o primeiro móvel (de trás para frente: os últimos instalados saem antes) que, sozinho, deixa a planta inválida
function firstBad(plan) {
  const base = { register: game.register, cafe: null, shelves: [], decor: [] }
  const ok = (L) => !checkLayout(plan, L)
  if (game.cafe && !ok({ ...base, cafe: game.cafe })) return { list: 'cafe', o: game.cafe }
  const keep = { ...base, cafe: game.cafe }
  for (const s of game.shelves) {
    const next = { ...keep, shelves: [...keep.shelves, s] }
    if (!ok(next)) return { list: 'shelf', o: s }
    keep.shelves.push(s)
  }
  for (const d of game.decor) {
    const next = { ...keep, decor: [...keep.decor, d] }
    if (!ok(next)) return { list: 'decor', o: d }
    keep.decor.push(d)
  }
  return null
}
