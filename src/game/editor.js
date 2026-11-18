// Modo layout: pegar um móvel, escolher o lugar e soltar. Só com a loja fechada.
import { game, ui, hooks, toast, uid, money, isClosed, maxShelves, maxFreezers, maxMeat, maxProduce, shelfCount, freezerCount, meatCount, produceCount, decorCount } from './state.js'
import { isDecorUnlocked, decorUnlockHint } from './goals.js'
import { RESALE, SHELF_PRICE, WALL_SHELF_PRICE, FREEZER_PRICE, PRODUCE_PRICE, MEAT_PRICE, DECOR, CAFE } from './config.js'
import { checkLayout, dims, shelfAccess, cashierTile, queueTiles, queueFor, onFloor, produceSlots, isWallDecor, isCeilingDecor } from './layout.js'
import { unitOf, storable, stashShelf, stashDecor, stashCafe, unstash, clearAll } from './inventory.js'
import { startBuild, stopBuild, buildChanged } from './build.js'
export { produceSlots }

const COLOR = { ok: 0x7fd6a8, bad: 0xe0675d, access: 0xf2c25b, queue: 0x4f9fe0 }
// lugar do atendente e da fila, com nome em cada posição
export const checkoutGuide = (r, queue, color = COLOR.queue) => [
  { ...cashierTile(r), c: COLOR.access, o: 0.7, label: 'Atendente' },
  ...queue.map((t, i) => ({ x: t.x, z: t.z, c: color, o: 0.55, label: `Fila ${i + 1}` })),
]
const find = (kind, id) => (kind === 'shelf' ? game.shelves.find((s) => s.id === id) : kind === 'decor' ? game.decor.find((d) => d.id === id) : kind === 'cafe' ? game.cafe : game.register)

// modo de edição da loja: painel lateral com abas (móveis, decoração, inventário e construção)
export function startEdit(tab) {
  if (window.__visiting) return toast('Você está visitando outra loja', 'bad')
  if (!isClosed()) return toast('Só dá para mexer na loja com ela fechada', 'bad')
  ui.modal = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.panelArcade = null
  ui.selectedBox = null
  if (!ui.editing) { ui.editing = true; ui.held = null }
  if (game.plan.built === false) tab = 'build'
  setEditTab(tab || (ui.editTab === 'build' ? 'shelves' : ui.editTab) || 'shelves')
}
export function setEditTab(tab) {
  if (tab === ui.editTab && (tab !== 'build' || ui.build)) return
  if (tab === 'build') {
    deselectTool()
    if (!startBuild()) return
  } else if (ui.build) {
    if (game.plan.built === false) return toast('Construa a loja primeiro', 'bad')
    if (buildChanged()) return toast('Aplique ou descarte a obra antes de sair da construção', 'bad')
    stopBuild()
  }
  ui.editTab = tab
}
// false quando há uma obra sem aplicar: o jogador decide antes de sair
export function stopEdit() {
  if (ui.build && buildChanged()) { toast('Aplique ou descarte a obra antes de sair', 'bad'); return false }
  if (ui.build) stopBuild()
  if (ui.editTab === 'build') ui.editTab = 'shelves'
  ui.buyTool = null
  ui.invTool = null
  cancelHeld()
  ui.editing = false
  hooks.refreshGrid()
  return true
}

function candidate(h) {
  if (h.kind === 'produceGroup') {
    const remaining = game.shelves.filter((s) => s.groupId !== h.groupId)
    const slots = produceSlots(h.x, h.z, h.rot, h.style || 'island')
    const updated = slots.map((s) => ({
      x: s.x,
      z: s.z,
      rot: s.rot,
      kind: 'produce',
      fridge: false,
      groupId: h.groupId,
      style: s.style,
    }))
    return { shelves: [...remaining, ...updated], decor: game.decor, register: game.register, cafe: game.cafe }
  }
  const real = h.kind === 'shelf' ? find('shelf', h.id) : null
  const me = { x: h.x, z: h.z, rot: h.rot, type: h.kind === 'decor' ? find('decor', h.id)?.type : undefined, ...(real ? { kind: real.kind, fridge: real.fridge, variant: real.variant, groupId: real.groupId } : {}) }
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
  if (h.kind === 'produceGroup') {
    const slots = produceSlots(h.x, h.z, h.rot, h.style || 'island')
    h.preview = slots.map((s) => ({ x: s.x, z: s.z, c: h.valid ? COLOR.ok : COLOR.bad, o: 0.6 }))
    // onde o cliente fica: uma seta apontando para o lugar do expositor
    slots.forEach((s) => h.preview.push({ ...shelfAccess(s), c: COLOR.access, o: 0.4, arrow: [s.x, s.z] }))
    return
  }
  h.preview = [{ x: h.x, z: h.z, c: h.valid ? COLOR.ok : COLOR.bad, o: 0.6 }]
  if (h.kind === 'shelf') h.preview.push({ ...shelfAccess({ ...h, variant: find('shelf', h.id)?.variant }), c: COLOR.access, o: 0.5, arrow: [h.x, h.z] })
  if (h.kind === 'cafe') h.preview.push({ ...shelfAccess(h), c: COLOR.queue, o: 0.55, label: 'Cliente' }, { ...cashierTile(h), c: COLOR.access, o: 0.7, label: 'Atendente' })
  if (h.kind === 'counter') {
    const floorDecor = L.decor.filter((d) => !isWallDecor(d) && !isCeilingDecor(d)) // parede e teto não tomam o lugar da fila
    const blocked = new Set([...L.shelves, ...floorDecor, L.register, ...(L.cafe ? [L.cafe] : [])].map((o) => o.x + ',' + o.z))
    // mesmo num lugar inválido mostra (em vermelho) onde a fila ficaria
    const queue = (h.valid && queueTiles(game.plan, L.register, blocked)) || queueFor(h, (x, z) => onFloor(game.plan, x, z)) || []
    h.preview.push(...checkoutGuide(h, queue, h.valid ? COLOR.queue : COLOR.bad))
  }
}

export function pickUp(kind, id) {
  if (kind === 'shelf') {
    const o = find('shelf', id)
    if (!o) return
    if (o.groupId) {
      const members = game.shelves.filter((s) => s.groupId === o.groupId)
      const minX = Math.min(...members.map((m) => m.x))
      const minZ = Math.min(...members.map((m) => m.z))
      const style = members[0]?.style || 'island'
      const rot = members[0]?.grot || 0
      ui.held = { kind: 'produceGroup', groupId: o.groupId, style, x: minX, z: minZ, rot, isNew: false }
      evaluate()
      return
    }
  }
  const o = find(kind, id)
  if (!o) return
  ui.held = { kind, id, x: o.x, z: o.z, rot: o.rot || 0, isNew: false }
  evaluate()
}
export function moveHeld(x, z) {
  const h = ui.held
  if (!h) return
  x = Math.round(x); z = Math.round(z)
  if (h.kind === 'decor' && DECOR[find('decor', h.id)?.type]?.wall) z = 0 // decoração de parede só anda ao longo da parede do fundo
  if (x === h.x && z === h.z) return
  h.x = x; h.z = z
  evaluate()
}
export function rotateHeld(dir = 1) {
  const h = ui.held
  if (!h) return
  h.rot = (h.rot + (dir < 0 ? 3 : 1)) % 4
  evaluate()
}
// gira no lugar um móvel já instalado (sob o mouse): pega, gira e solta; se não couber, volta como estava
export function rotateAt(hit, dir = 1) {
  if (!hit || !['shelf', 'decor', 'cafe', 'counter'].includes(hit.kind)) return
  pickUp(hit.kind, hit.id)
  const h = ui.held
  if (!h) return
  let why = null
  for (let i = 0; i < 3; i++) { // pula os giros em que a frente bateria numa parede ou noutro móvel
    rotateHeld(dir)
    if (h.valid) break
    why ||= h.why
  }
  if (h.valid) dropHeld()
  else { toast(`Esse móvel não gira aqui: ${why || 'sem espaço na frente'}`, 'bad'); cancelHeld() }
}
// a prateleira nova na mão troca de tipo (padrão, parede, canto); o preço acompanha
export const PRODUCE_TYPES = { island: { name: 'Ilha 2×2', price: PRODUCE_PRICE, desc: '4 lugares, pirâmide com 4 frentes' }, wall: { name: 'Parede 2×1', price: PRODUCE_PRICE, desc: '2 lugares, encostado na parede' } }
// escolhe o tipo da prateleira (ou o formato do expositor) direto da lista: vale para o móvel na mão e para os próximos
export function setShelfType(type) {
  ui.shelfType = type
  const shelf = heldShelf()
  if (!shelf) return
  if (type === 'std') delete shelf.variant; else shelf.variant = type
  ui.held.price = SHELF_TYPES[type].price
  evaluate()
}
export function setProduceStyle(style) {
  ui.produceStyle = style
  if (ui.held?.kind === 'produceGroup' && ui.held.isNew && ui.held.style !== style) toggleProduceStyle()
}
// ---------- venda: prateleira, freezer ou expositor já instalado volta por metade do preço, se estiver vazio ----------
const resaleOf = (price) => Math.floor(price * RESALE)
export function sellInfo() {
  const h = ui.held
  if (!h || h.isNew) return null
  if (h.kind === 'produceGroup') {
    const members = game.shelves.filter((s) => s.groupId === h.groupId)
    return { price: resaleOf(PRODUCE_PRICE), full: members.some((s) => s.count > 0), members }
  }
  if (h.kind === 'decor') {
    const d = find('decor', h.id), p = d && DECOR[d.type]?.price
    return p ? { price: resaleOf(p), full: false, members: [d], list: 'decor' } : null
  }
  if (h.kind !== 'shelf') return null
  const s = find('shelf', h.id)
  if (!s) return null
  const base = s.kind === 'meat' ? MEAT_PRICE : s.kind === 'fridge' ? FREEZER_PRICE : SHELF_TYPES[s.variant === 'wall' ? 'wall' : 'std'].price
  return { price: resaleOf(base), full: s.count > 0, members: [s] }
}
export function sellHeld() {
  const info = sellInfo()
  if (!info) return
  if (info.full) return toast('Esvazie antes de vender: tire os produtos com uma caixa vazia', 'bad')
  const list = info.list === 'decor' ? game.decor : game.shelves
  for (const m of info.members) list.splice(list.indexOf(m), 1)
  game.money += info.price
  ui.held = null
  hooks.refreshGrid()
  toast(`Vendido por ${money(info.price)}`, 'good')
}
// vende o móvel sob o mouse (tecla Delete)
export function sellAt(hit) {
  if (!hit || (hit.kind !== 'shelf' && hit.kind !== 'decor')) return
  pickUp(hit.kind, hit.id)
  sellHeld()
  if (ui.held) cancelHeld() // não vendeu (tem produto): o móvel volta como estava
}
export const heldShelf = () => (ui.held?.kind === 'shelf' && ui.held.isNew && !ui.held.fromInv ? game.shelves.find((x) => x.id === ui.held.id && x.kind === 'shelf') : null)
export function toggleProduceStyle() {
  const h = ui.held
  const shelf = heldShelf()
  if (shelf) {
    const next = SHELF_ORDER[(SHELF_ORDER.indexOf(shelf.variant || 'std') + 1) % SHELF_ORDER.length]
    ui.shelfType = next
    if (next === 'std') delete shelf.variant; else shelf.variant = next
    h.price = SHELF_TYPES[next].price
    toast(`Prateleira: ${SHELF_TYPES[next].name} · ${money(h.price)}`, 'good')
    evaluate()
    return
  }
  if (!h || h.kind !== 'produceGroup') return
  if (h.fromInv) return toast('O expositor guardado volta com o formato que tinha', 'bad')
  if (!h.isNew) return toast('O formato só muda ao comprar: o expositor já instalado mantém o seu', 'bad')
  h.style = h.style === 'wall' ? 'island' : 'wall'
  ui.produceStyle = h.style
  // a ilha tem 4 lugares e a estante de parede 2: refaz os lugares do expositor ainda na mão
  for (let i = game.shelves.length - 1; i >= 0; i--) if (game.shelves[i].groupId === h.groupId) game.shelves.splice(i, 1)
  game.shelves.push(...produceMembers(h.groupId, h.style))
  toast(`Estilo do hortifruti: ${h.style === 'wall' ? 'Estante de Parede' : 'Ilha Piramidal'}`, 'good')
  evaluate()
}
export function dropHeld() {
  const h = ui.held
  if (!h) return
  if (!h.valid) return toast(h.why, 'bad')
  if (h.isNew && game.money < h.price) return toast('Caixa insuficiente', 'bad')
  if (h.isNew) game.money -= h.price
  if (h.kind === 'produceGroup') {
    const slots = produceSlots(h.x, h.z, h.rot, h.style || 'island')
    for (const s of slots) {
      const obj = game.shelves.find((x) => x.groupId === h.groupId && x.slot === s.slot)
      if (obj) Object.assign(obj, { x: s.x, z: s.z, rot: s.rot, style: s.style, level: s.level, reach: s.reach, grot: s.grot })
    }
    if (h.fromInv) unstash('produceGroup', h.groupId)
    else if (h.isNew) toast(`Expositor de hortifruti instalado por ${money(h.price)}`, 'good')
    ui.held = null
    hooks.refreshGrid()
    keepBuying(h)
    return
  }
  const obj = find(h.kind, h.id)
  Object.assign(obj, { x: h.x, z: h.z, rot: h.rot })
  if (h.fromInv) unstash(h.kind, h.id)
  else if (h.isNew) toast(`Comprado por ${money(h.price)}`, 'good')
  ui.held = null
  hooks.refreshGrid()
  keepBuying(h)
}

// ---------- ferramenta de compra: o móvel escolhido continua na mão a cada clique, até desmarcar ----------
export const TOOLS = {
  shelf: { name: 'Prateleira', price: SHELF_PRICE, can: () => canBuyShelf(), buy: () => buyShelf() },
  produce: { name: 'Expositor', price: PRODUCE_PRICE, can: () => canBuyProduceStand(), buy: () => buyProduceStand(ui.produceStyle) },
  fridge: { name: 'Freezer', price: FREEZER_PRICE, can: () => canBuyFreezer(), buy: () => buyFreezer() },
  meat: { name: 'Freezer de carne', price: MEAT_PRICE, can: () => canBuyMeatStand(), buy: () => buyMeatStand() },
}
function keepBuying(h) {
  if (h.fromInv) { // recolocando do inventário: pega o próximo do mesmo tipo, até acabar
    if (ui.invTool && ui.editing && unitOf(ui.invTool)) takeFromInv(ui.invTool)
    else ui.invTool = null
    return
  }
  if (!h.isNew || !ui.buyTool || !ui.editing) return
  const t = TOOLS[ui.buyTool]
  if (!t.can()) { toast(`${t.name}: sem caixa ou no limite do seu comércio. Ferramenta desligada`, 'bad'); ui.buyTool = null; return }
  t.buy()
}
export function selectTool(tool) {
  if (ui.buyTool === tool) return deselectTool()
  ui.invTool = null
  if (ui.held?.isNew) { ui.buyTool = null; cancelHeld() }
  else if (ui.held) cancelHeld()
  ui.buyTool = tool
  const t = TOOLS[tool]
  if (!t.can()) { ui.buyTool = null; return toast(`${t.name}: sem caixa ou no limite do seu comércio`, 'bad') }
  t.buy()
}
export function deselectTool() {
  ui.buyTool = null
  ui.invTool = null
  cancelHeld()
}

// ---------- inventário ----------
// pega um item do inventário (de graça: já foi pago); ele segue o mouse até o lugar, como um móvel novo
export function takeFromInv(key) {
  if (!isClosed()) return toast('Mexa na loja com ela fechada', 'bad')
  const u = unitOf(key, 'full')
  if (!u) { ui.invTool = null; return }
  if (!ui.editing) startEdit()
  if (ui.build) return
  ui.buyTool = null
  cancelHeld()
  ui.invTool = key
  const { cols, rows } = dims(game.plan)
  const o = u.items[0], mid = { x: Math.floor(cols / 2), z: Math.floor(rows / 2) }
  if (u.kind === 'produceGroup') {
    game.shelves.push(...u.items)
    ui.held = { kind: 'produceGroup', groupId: u.groupId, style: o.style || 'island', x: Math.max(0, mid.x - 1), z: Math.max(0, mid.z - 1), rot: o.grot || 0, isNew: true, fromInv: true, price: 0 }
  } else if (u.kind === 'cafe') {
    game.cafe = o
    ui.held = { kind: 'cafe', id: o.id, ...mid, rot: o.rot || 0, isNew: true, fromInv: true, price: 0 }
  } else {
    (u.kind === 'shelf' ? game.shelves : game.decor).push(o)
    const wall = u.kind === 'decor' && DECOR[o.type]?.wall
    ui.held = { kind: u.kind, id: o.id, x: mid.x, z: wall ? 0 : mid.z, rot: o.rot || 0, isNew: true, fromInv: true, price: 0 }
  }
  evaluate()
}
const heldObj = (h) => (h.kind === 'produceGroup' ? game.shelves.find((s) => s.groupId === h.groupId) : find(h.kind, h.id))
export const canStoreHeld = () => { const h = ui.held; return !!h && !h.isNew && h.kind !== 'counter' && storable(h.kind, heldObj(h)) }
// guarda no inventário o móvel na mão: sai da loja e pode voltar depois sem pagar de novo
export function storeHeld() {
  const h = ui.held
  if (!h) return
  if (h.isNew) { deselectTool(); return } // ainda não foi pago (ou já é do inventário): só larga
  if (!canStoreHeld()) return toast('Esse item é da loja: só muda de lugar', 'bad')
  const o = heldObj(h)
  ui.held = null
  if (h.kind === 'produceGroup') for (const s of game.shelves.filter((s) => s.groupId === h.groupId)) stashShelf(s)
  else if (h.kind === 'shelf') stashShelf(o)
  else if (h.kind === 'decor') stashDecor(o)
  else if (h.kind === 'cafe') stashCafe()
  hooks.refreshGrid()
  toast('Guardado no inventário', 'good')
}
// guarda o móvel sob o mouse (tecla I)
export function storeAt(hit) {
  if (!hit || !['shelf', 'decor', 'cafe'].includes(hit.kind)) return
  pickUp(hit.kind, hit.id)
  if (ui.held) storeHeld()
  if (ui.held) cancelHeld()
}
export function clearStore() {
  deselectTool()
  const n = clearAll()
  toast(n ? `${n === 1 ? '1 item guardado' : `${n} itens guardados`} no inventário: recoloque de graça quando quiser` : 'Nada para guardar', n ? 'good' : 'info')
}
export function cancelHeld() {
  const h = ui.held
  if (!h) return
  // vindo do inventário, o item só sai da loja: ele continua guardado
  if (h.isNew && h.kind === 'produceGroup') {
    const list = game.shelves
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].groupId === h.groupId) list.splice(i, 1)
    }
  } else if (h.isNew && h.kind === 'cafe') game.cafe = null
  else if (h.isNew) {
    const list = h.kind === 'shelf' ? game.shelves : game.decor
    list.splice(list.findIndex((o) => o.id === h.id), 1)
  }
  ui.held = null
}

// item novo fica na mão e só é cobrado ao ser colocado no lugar
function holdNew(kind, item, price) {
  ui.modal = null
  if (!ui.editing) startEdit(kind === 'decor' ? 'decor' : 'shelves')
  if (ui.build) setEditTab(kind === 'decor' ? 'decor' : 'shelves')
  if (ui.build) return
  cancelHeld()
  const { cols, rows } = dims(game.plan)
  if (kind === 'cafe') game.cafe = item
  else (kind === 'shelf' ? game.shelves : game.decor).push(item)
  ui.held = { kind, id: item.id, x: Math.floor(cols / 2), z: kind === 'decor' && DECOR[item.type]?.wall ? 0 : Math.floor(rows / 2), rot: 0, isNew: true, price }
  evaluate()
}
// variant: prateleira comum (sem variant), alta de parede ('wall') ou curva de canto ('corner')
const newShelf = (kind = 'shelf', variant) => {
  const fridge = kind === 'fridge' || kind === 'meat'
  return { id: uid(), x: -99, z: -99, rot: 0, product: null, count: 0, price: null, kind, fridge, ...(variant ? { variant } : {}) }
}

export const canBuyShelf = () => isClosed() && game.money >= shelfPriceOf() && shelfCount() < maxShelves()
export function buyShelf() {
  if (!canBuyShelf()) return toast(isClosed() ? 'Sem caixa ou sem espaço para outra prateleira' : 'Instale móveis com a loja fechada', 'bad')
  holdNew('shelf', newShelf('shelf', ui.shelfType === 'std' ? undefined : ui.shelfType), shelfPriceOf())
}
// tipos de prateleira: comum e alta de parede; o canto não se compra, forma-se sozinho quando prateleiras se encontram em 90°
export const SHELF_TYPES = {
  std: { name: 'Padrão', price: SHELF_PRICE, desc: 'Baixa, de 3 andares. Duas em 90° viram canto sozinhas' },
  wall: { name: 'Parede', price: WALL_SHELF_PRICE, desc: 'Alta, com painel de fundo e cimalha' },
}
const SHELF_ORDER = ['std', 'wall']
export const shelfPriceOf = (type = ui.shelfType) => SHELF_TYPES[type].price
export const canBuyFreezer = () => isClosed() && game.money >= FREEZER_PRICE && freezerCount() < maxFreezers()
export function buyFreezer() {
  if (!canBuyFreezer()) return toast(isClosed() ? 'Sem caixa ou sem espaço para outro freezer' : 'Instale móveis com a loja fechada', 'bad')
  holdNew('shelf', newShelf('fridge'), FREEZER_PRICE)
}
export const canBuyMeatStand = () => isClosed() && game.money >= MEAT_PRICE && meatCount() < maxMeat()
export function buyMeatStand() {
  if (!canBuyMeatStand()) return toast(isClosed() ? 'Sem caixa ou limite atingido para freezer de carnes' : 'Instale móveis com a loja fechada', 'bad')
  holdNew('shelf', newShelf('meat'), MEAT_PRICE)
}
// lugares do expositor: 4 na ilha, 2 na estante de parede; cada um guarda um produto
const produceMembers = (groupId, style) => (style === 'wall' ? [0, 1] : [0, 1, 2, 3]).map((slot) => ({
  id: uid(), groupId, slot, style, x: -99, z: -99, rot: 0, grot: 0,
  product: null, count: 0, price: null, kind: 'produce', fridge: false, boost: 0, wear: 0, broken: false, brokenT: 0, call: null, techAt: null,
}))
export const canBuyProduceStand = () => isClosed() && game.money >= PRODUCE_PRICE && produceCount() < maxProduce()
export function buyProduceStand(style = 'island') {
  if (!canBuyProduceStand()) return toast(isClosed() ? 'Sem caixa ou limite atingido para banca de hortifruti' : 'Instale móveis com a loja fechada', 'bad')
  ui.modal = null
  if (!ui.editing) startEdit('shelves')
  if (ui.build) setEditTab('shelves')
  if (ui.build) return
  cancelHeld()
  const { cols, rows } = dims(game.plan)
  const groupId = 'produce_' + uid()
  const groupShelves = produceMembers(groupId, style)
  game.shelves.push(...groupShelves)
  ui.held = {
    kind: 'produceGroup',
    groupId,
    style,
    x: Math.max(0, Math.floor(cols / 2) - 1),
    z: Math.max(0, Math.floor(rows / 2) - 1),
    rot: 0,
    isNew: true,
    price: PRODUCE_PRICE,
  }
  evaluate()
}
export const canBuyCafe = () => isClosed() && !game.cafe && game.level >= CAFE.minLevel && game.money >= CAFE.price
export function buyCafe() {
  if (!canBuyCafe()) return toast('Ainda não dá para instalar a cafeteria', 'bad')
  holdNew('cafe', { id: uid(), x: -99, z: -99, rot: 0 }, CAFE.price)
}
export const decorMaxed = (type) => !!DECOR[type].max && decorCount(type) >= DECOR[type].max
export const canBuyDecor = (type) => isClosed() && isDecorUnlocked(type) && game.money >= DECOR[type].price && !decorMaxed(type)
export function buyDecor(type) {
  if (!isDecorUnlocked(type)) return toast(`🔒 Desbloqueie cumprindo a meta: ${decorUnlockHint(type)}`, 'bad')
  if (!canBuyDecor(type)) return toast(!isClosed() ? 'Compre decoração com a loja fechada' : decorMaxed(type) ? 'Você já tem esse item' : 'Caixa insuficiente', 'bad')
  holdNew('decor', { id: uid(), type, x: -99, z: -99, rot: 0, ...(type === 'frame' ? { hue: Math.floor(Math.random() * 3) } : {}) }, DECOR[type].price)
}
