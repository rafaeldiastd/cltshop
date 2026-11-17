// Modo construção: cada quadrado é 1 m². No modo normal e hardcore, o dia 1 começa só com o terreno.
// Depois de pronta, permite expandir, encolher, trocar o canto do estoque e mover a porta (com a loja fechada).
import { game, ui, hooks, toast, canExpand, customersPerDay, regionMods, setupStarterStore, stockCount } from './state.js'
import { BUILD, BUILD_MODES, LEVELS } from './config.js'
import { checkLayout, settleLayout, stockRoom, planArea, doorInside, inStock, onFloor } from './layout.js'
import { stopEdit } from './editor.js'

const cents = (n) => Math.round(n * 100) / 100
const stockArea = (p) => (p.stock?.cols || 0) * (p.stock?.rows || 0)
const noWork = () => ({
  initial: false, w: 0, e: 0, n: 0, s: 0,
  stockCols: 0, stockRows: 0,
  corner: game.plan.stock?.corner || 'nw',
  doorShift: 0,
})

export function buildRate(area) {
  if (game.mode === 'lofi') return BUILD.base + BUILD.perM2 * (area - BUILD.from)
  const cfg = BUILD_MODES[game.mode] || BUILD_MODES.normal
  return cfg.base + cfg.perM2 * Math.max(0, area - cfg.from)
}

// somado m² a m²: construir aos poucos ou de uma vez custa o mesmo
export function floorCost(from, to) {
  if (to <= from) return 0
  let total = 0
  if (from === 0 && game.mode !== 'lofi') {
    const cfg = BUILD_MODES[game.mode] || BUILD_MODES.normal
    const baseArea = cfg.minCols * cfg.minRows
    for (let a = 0; a < to; a++) total += a < baseArea ? cfg.initRate : buildRate(a)
    return cents(total)
  }
  for (let a = from; a < to; a++) total += buildRate(a)
  return cents(total)
}

export function startBuild() {
  if (!canExpand()) return toast('Construa antes de abrir ou depois do expediente', 'bad')
  if (ui.editing) stopEdit()
  const initial = game.plan.built === false
  const build = initial
    ? { initial: true, cols: 6, rows: 5, stockCols: 3, stockRows: 2, corner: 'nw', doorShift: 0, w: 0, e: 0, n: 0, s: 0 }
    : noWork()
  Object.assign(ui, { modal: null, panelShelf: null, panelCafe: false, panelArcade: null, selectedBox: null, build })
}
export function stopBuild() { ui.build = null }

export function setStockCorner(corner) {
  if (!ui.build) return
  ui.build.corner = corner
}

export function nudgeDoor(d) {
  const b = ui.build
  if (!b) return
  const p = nextPlan(b)
  const nextX = p.doorX + d
  if (nextX < 1 || nextX > p.cols - 2) return
  b.doorShift = (b.doorShift || 0) + d
}

// planta depois da obra. Parede esquerda e do fundo renumeram os quadrados: a porta fica onde está + doorShift
export function nextPlan(b = ui.build) {
  const p = game.plan
  if (b?.initial) {
    const baseDoor = Math.floor(b.cols / 2)
    const doorX = Math.max(1, Math.min(b.cols - 2, baseDoor + (b.doorShift || 0)))
    return {
      cols: b.cols,
      rows: b.rows,
      doorX,
      built: true,
      lotCols: p.lotCols || LEVELS[game.level].maxCols,
      lotRows: p.lotRows || LEVELS[game.level].maxRows,
      stock: { cols: b.stockCols, rows: b.stockRows, corner: b.corner || 'nw' },
    }
  }
  const cols = p.cols + b.w + b.e
  const rows = p.rows + b.n + b.s
  const doorX = Math.max(1, Math.min(cols - 2, p.doorX + b.w + (b.doorShift || 0)))
  return {
    ...p,
    built: true,
    cols,
    rows,
    doorX,
    stock: {
      cols: p.stock.cols + b.stockCols,
      rows: p.stock.rows + b.stockRows,
      corner: b.corner || p.stock?.corner || 'nw',
    },
  }
}

export function canGrow(wall) {
  const L = LEVELS[game.level], b = ui.build, p = nextPlan()
  if (!b) return false
  if (wall === 'w' || wall === 'e') return p.cols < L.maxCols
  if (wall === 'n' || wall === 's') return p.rows < L.maxRows
  return wall === 'stockCols' ? p.stock.cols < L.stock.maxCols : p.stock.rows < L.stock.maxRows
}

export function canShrink(wall) {
  const b = ui.build
  if (!b) return false
  const p = nextPlan(b)
  const cfg = BUILD_MODES.normal
  if (wall === 'w' || wall === 'e') return p.cols > cfg.minCols
  if (wall === 'n' || wall === 's') return p.rows > cfg.minRows
  if (wall === 'stockCols') return p.stock.cols > cfg.minStockCols
  if (wall === 'stockRows') return p.stock.rows > cfg.minStockRows
  return false
}

// quantos m² um passo dessa parede acrescenta
export function gain(wall) {
  const p = nextPlan()
  if (wall === 'w' || wall === 'e') return p.rows
  if (wall === 'n' || wall === 's') return p.cols
  return wall === 'stockCols' ? p.stock.rows : p.stock.cols
}

export function nudge(wall, d) {
  const b = ui.build
  if (!b || (d > 0 && !canGrow(wall)) || (d < 0 && !canShrink(wall))) return
  if (b.initial) {
    if (wall === 'e' || wall === 'w') b.cols += d
    else if (wall === 's' || wall === 'n') b.rows += d
    else if (wall === 'stockCols') b.stockCols += d
    else if (wall === 'stockRows') b.stockRows += d
    return
  }
  b[wall] += d
}

export function limitNote() {
  const L = LEVELS[game.level], next = LEVELS[game.level + 1], p = nextPlan()
  if (p.cols < L.maxCols || p.rows < L.maxRows) return null
  return next ? `Limite de ${L.name}: ${L.maxCols}×${L.maxRows}. Vire ${next.name} para crescer mais` : 'A loja já está no tamanho máximo'
}

function validatePlan(plan) {
  const cfg = BUILD_MODES[game.mode] || BUILD_MODES.normal
  const area = planArea(plan), sArea = stockArea(plan)
  if (plan.cols < cfg.minCols || plan.rows < cfg.minRows) return `Loja mínima: ${cfg.minCols}×${cfg.minRows} (30 m²)`
  if (plan.stock.cols < cfg.minStockCols || plan.stock.rows < cfg.minStockRows || sArea < cfg.minStockArea) {
    return `Estoque mínimo: ${cfg.minStockCols}×${cfg.minStockRows} e ao menos ${cfg.minStockArea} m²`
  }
  if (area - sArea < cfg.minSalesArea) return `Deixe pelo menos ${cfg.minSalesArea} m² livres para o salão de vendas`
  const entry = doorInside(plan)
  if (inStock(plan, entry.x, entry.z)) return 'O estoque não pode bloquear a porta de entrada'
  const room = stockRoom(plan)
  if (!onFloor(plan, room.doorOut.x, room.doorOut.z)) return 'A porta do estoque precisa abrir para o salão'
  if (plan.built !== false && room.cap < stockCount()) return `Estoque atual tem ${stockCount()} caixas (capacidade mínima ${room.cap})`
  return null
}

const furniture = (L) => [L.register, L.cafe, ...L.shelves, ...L.decor].filter(Boolean)
// acomoda os móveis na planta nova; só mexe em quem ficaria em lugar inválido
function arrange(plan, L) {
  if (!checkLayout(plan, L)) return null
  const lost = settleLayout(plan, L)
  return lost.length ? 'Os móveis não cabem nessa planta' : checkLayout(plan, L)
}

export function quote() {
  const b = ui.build
  if (!b) return null
  const from = game.plan, plan = nextPlan(b), area0 = planArea(from), area1 = planArea(plan), stockM2 = stockArea(plan) - stockArea(from)
  const mult = regionMods().buildCost || 1
  if (b.initial) {
    const why = validatePlan(plan)
    const cfg = BUILD_MODES[game.mode] || BUILD_MODES.normal
    const extraStock = Math.max(0, stockArea(plan) - cfg.minStockArea)
    const total = cents((floorCost(0, area1) + extraStock * cfg.initRate) * mult)
    return {
      plan, why, moved: 0, area0: 0, area1, m2: area1, stockM2: stockArea(plan),
      changed: true, initial: true,
      rate: cents(buildRate(Math.max(30, area1)) * mult),
      total,
      cap0: 0, cap1: stockRoom(plan).cap,
      customers0: 0, customers1: Math.round(customersPerDay(plan)),
    }
  }
  const at = (o) => ({ ...o, x: o.x + b.w, z: o.z + b.n })
  const L = { register: game.register && at(game.register), cafe: game.cafe && at(game.cafe), shelves: game.shelves.map(at), decor: game.decor.map(at) }
  const before = furniture(L).map((o) => o.x + ',' + o.z)
  const why = validatePlan(plan) || arrange(plan, L)
  const moved = furniture(L).filter((o, i) => o.x + ',' + o.z !== before[i]).length
  const cornerChanged = (from.stock?.corner || 'nw') !== (plan.stock?.corner || 'nw')
  const doorChanged = from.doorX !== plan.doorX + b.w
  const changed = plan.cols !== from.cols || plan.rows !== from.rows || stockM2 !== 0 || cornerChanged || doorChanged
  const addFloor = floorCost(area0, area1)
  const addStock = stockM2 > 0 ? stockM2 * buildRate(Math.max(area0, area1)) * BUILD.stockFactor : 0
  return {
    plan, why, moved, area0, area1, m2: area1 - area0, stockM2,
    changed, initial: false,
    rate: cents(buildRate(area0) * mult),
    total: cents((addFloor + addStock) * mult),
    cap0: stockRoom(from).cap, cap1: stockRoom(plan).cap,
    customers0: Math.round(customersPerDay(from)), customers1: Math.round(customersPerDay(plan)),
  }
}

export function confirmBuild() {
  const q = quote()
  if (!q) return
  if (!q.changed) return stopBuild()
  if (q.why) return toast(q.why, 'bad')
  if (game.money < q.total) return toast('Caixa insuficiente', 'bad')
  if (q.initial) {
    game.money -= q.total
    game.plan = q.plan
    setupStarterStore(game.plan)
    ui.build = null
    hooks.refreshGrid()
    hooks.rebuildShop?.()
    toast(`🎉 Loja (${q.area1} m²) e estoque construídos! Sua primeira entrega está na calçada`, 'good')
    return
  }
  const { w, n } = ui.build
  game.money -= q.total
  for (const o of furniture(game)) { o.x += w; o.z += n }
  for (const b of game.boxes) if (b.at) { b.at.x += w; b.at.z += n }
  for (const d of game.dirt) { d.x += w; d.z += n }
  hooks.shiftActors(w, n)
  game.plan = q.plan
  arrange(game.plan, game)
  ui.build = null
  hooks.refreshGrid()
  toast(`Obra concluída: agora são ${q.area1} m²`, 'good')
}
