// Modo construção: cada quadrado é 1 m². As paredes só andam para fora e o tipo de comércio limita até onde.
import { game, ui, hooks, toast, canExpand, customersPerDay } from './state.js'
import { BUILD, LEVELS } from './config.js'
import { checkLayout, settleLayout, stockRoom, planArea } from './layout.js'
import { stopEdit } from './editor.js'

const cents = (n) => Math.round(n * 100) / 100
const stockArea = (p) => p.stock.cols * p.stock.rows
const noWork = () => ({ w: 0, e: 0, n: 0, s: 0, stockCols: 0, stockRows: 0 })

export const buildRate = (area) => BUILD.base + BUILD.perM2 * (area - BUILD.from)
// somado m² a m²: construir aos poucos ou de uma vez custa o mesmo
export function floorCost(from, to) {
  let total = 0
  for (let a = from; a < to; a++) total += buildRate(a)
  return cents(total)
}

export function startBuild() {
  if (!canExpand()) return toast('Construa antes de abrir ou depois do expediente', 'bad')
  if (ui.editing) stopEdit()
  Object.assign(ui, { modal: null, panelShelf: null, panelCafe: false, selectedBox: null, build: noWork() })
}
export function stopBuild() { ui.build = null }

// planta depois da obra. Parede esquerda e do fundo renumeram os quadrados: a porta fica onde está
export function nextPlan(b = ui.build) {
  const p = game.plan
  return { cols: p.cols + b.w + b.e, rows: p.rows + b.n + b.s, doorX: p.doorX + b.w, stock: { cols: p.stock.cols + b.stockCols, rows: p.stock.rows + b.stockRows } }
}
export function canGrow(wall) {
  const L = LEVELS[game.level], p = nextPlan()
  if (wall === 'w' || wall === 'e') return p.cols < L.maxCols
  if (wall === 'n' || wall === 's') return p.rows < L.maxRows
  return wall === 'stockCols' ? p.stock.cols < L.stock.maxCols : p.stock.rows < L.stock.maxRows
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
  if (!b || (d > 0 && !canGrow(wall)) || (d < 0 && b[wall] <= 0)) return
  b[wall] += d
}
export function limitNote() {
  const L = LEVELS[game.level], next = LEVELS[game.level + 1], p = nextPlan()
  if (p.cols < L.maxCols || p.rows < L.maxRows) return null
  return next ? `Limite de ${L.name}: ${L.maxCols}×${L.maxRows}. Vire ${next.name} para crescer mais` : 'A loja já está no tamanho máximo'
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
  const at = (o) => ({ ...o, x: o.x + b.w, z: o.z + b.n })
  const L = { register: game.register && at(game.register), cafe: game.cafe && at(game.cafe), shelves: game.shelves.map(at), decor: game.decor.map(at) }
  const before = furniture(L).map((o) => o.x + ',' + o.z)
  const why = arrange(plan, L)
  const moved = furniture(L).filter((o, i) => o.x + ',' + o.z !== before[i]).length
  return {
    plan, why, moved, area0, area1, m2: area1 - area0, stockM2,
    changed: area1 > area0 || stockM2 > 0,
    rate: buildRate(area0),
    total: cents(floorCost(area0, area1) + stockM2 * buildRate(area1) * BUILD.stockFactor),
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
  const { w, n } = ui.build
  game.money -= q.total
  for (const o of furniture(game)) { o.x += w; o.z += n }
  for (const b of game.boxes) if (b.at) { b.at.x += w; b.at.z += n }
  hooks.shiftActors(w, n)
  game.plan = q.plan
  arrange(game.plan, game)
  ui.build = null
  hooks.refreshGrid()
  toast(`Obra concluída: agora são ${q.area1} m²`, 'good')
}
