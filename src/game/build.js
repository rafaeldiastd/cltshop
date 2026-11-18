// Aba Construção do modo de edição: terreno em grade onde o jogador pinta piso da loja e do estoque, paredes, janelas e portas.
// A ferramenta Selecionar pega uma parede inteira (para empurrar ou puxar), o cômodo todo, ou uma porta/janela (para mover ou tirar).
// Tudo acontece num rascunho; só o que for acrescentado é cobrado, ao aplicar a obra.
import { game, ui, hooks, toast, canExpand, customersPerDay, regionMods, setupStarterStore, stockCount } from './state.js'
import { BUILD_TILES, LEVELS } from './config.js'
import {
  DIRS, isGridPlan, planToGrid, planCell, setPlanCell, edgeKey, edgeBetween,
  findMainDoors, stockRoom, planArea, doorInside, planKey, onFloor, isWallDecor,
} from './layout.js'
import { settleOrStore } from './inventory.js'

const cents = (n) => Math.round(n * 100) / 100
const isFloor = (ch) => ch === 's' || ch === 'k'
export const ROOM_NAME = { s: 'salão', k: 'estoque' }

function countDraft(plan) {
  let sales = 0, stock = 0, wall = 0, window = 0, door = 0
  if (isGridPlan(plan)) {
    for (let i = 0; i < plan.cells.length; i++) {
      if (plan.cells[i] === 's') sales++
      else if (plan.cells[i] === 'k') stock++
    }
    for (const v of Object.values(plan.edges || {})) {
      if (v === 'wall') wall++
      else if (v === 'window') window++
      else if (v === 'door') door++
    }
  }
  return { sales, stock, wall, window, door }
}

// abre a aba: o rascunho começa igual à loja (convertida para a grade do terreno inteiro)
export function startBuild() {
  if (!canExpand()) { toast('Construa antes de abrir ou depois do expediente', 'bad'); return false }
  const L = LEVELS[game.level]
  const draft = planToGrid(game.plan, L.maxCols, L.maxRows)
  const initial = game.plan.built === false
  const baseCounts = initial ? { sales: 0, stock: 0, wall: 0, window: 0, door: 0 } : countDraft(draft)
  Object.assign(ui, { modal: null, panelShelf: null, panelCafe: false, panelArcade: null, selectedBox: null })
  ui.build = {
    initial,
    tool: initial ? 'sales' : 'select', // select | sales | stock | wall | window | door | erase
    draft,
    baseCounts,
    startKey: planKey({ ...draft, built: true }),
    hover: null,
    history: [],
    sel: null, // { kind: 'run', run } | { kind: 'room', type, cells, runs } | { kind: 'opening', key, type }
    carry: null, // porta ou janela sendo levada para outra parede: { from, type }
  }
  return true
}
export function stopBuild() { ui.build = null; ui.buildArrows = [] }
export const buildChanged = () => !!ui.build && planKey({ ...ui.build.draft, built: true }) !== ui.build.startKey
// volta o rascunho para a loja como ela está
export function discardBuild() {
  if (!ui.build) return
  const { tool } = ui.build
  startBuild()
  if (ui.build && !ui.build.initial) ui.build.tool = tool
}

function pushHistory() {
  const b = ui.build
  if (!b) return
  const snap = { cells: b.draft.cells, edges: { ...b.draft.edges } }
  const last = b.history[b.history.length - 1]
  if (last && last.cells === snap.cells && JSON.stringify(last.edges) === JSON.stringify(snap.edges)) return
  b.history.push(snap)
  if (b.history.length > 60) b.history.shift()
}

export function beginBuildStroke() { pushHistory() }
export function canUndo() { return !!ui.build?.history?.length }
export function undoBuild() {
  const b = ui.build
  if (!b || !b.history.length) return false
  const prev = b.history.pop()
  b.draft.cells = prev.cells
  b.draft.edges = prev.edges
  b.sel = null; b.carry = null
  return true
}

export function setBuildTool(tool) {
  const b = ui.build
  if (!b) return
  b.tool = tool
  if (tool !== 'select') { b.sel = null; b.carry = null }
}

export function paintCell(x, z, mode = null) {
  const b = ui.build
  if (!b) return false
  const t = mode || b.tool
  const d = b.draft
  if (x < 0 || z < 0 || x >= d.cols || z >= d.rows) return false
  const cur = planCell(d, x, z)
  if (t === 'erase') {
    if (cur === '.') return false
    setPlanCell(d, x, z, '.')
    return true
  }
  const ch = t === 'stock' ? 'k' : 's'
  if (cur === ch) return false
  setPlanCell(d, x, z, ch)
  return true
}

export function paintEdge(x, z, dir, mode = null) {
  const b = ui.build
  if (!b) return false
  const t = mode || b.tool
  const d = b.draft
  if (dir === 'h' && (x < 0 || x >= d.cols || z < 0 || z > d.rows)) return false
  if (dir === 'v' && (x < 0 || x > d.cols || z < 0 || z >= d.rows)) return false
  const ek = edgeKey(x, z, dir)
  if (t === 'erase') {
    if (!d.edges[ek]) return false
    delete d.edges[ek]
    return true
  }
  if (d.edges[ek] === t) return false
  d.edges[ek] = t
  return true
}

// ---------- paredes inteiras e cômodos ----------
// run = trecho reto e contínuo de bordas: dir 'h' (bordas (i, line, h)) ou 'v' (bordas (line, i, v)), de i = a até b
export const runKeys = (run) => {
  const out = []
  for (let i = run.a; i <= run.b; i++) out.push(run.dir === 'h' ? edgeKey(i, run.line, 'h') : edgeKey(run.line, i, 'v'))
  return out
}
// a parede inteira que passa por uma borda: estende para os dois lados enquanto houver parede, janela ou porta na mesma linha
export function runAt(d, key) {
  if (!d.edges[key]) return null
  const [xs, zs, dir] = key.split(',')
  const x = Number(xs), z = Number(zs)
  const line = dir === 'h' ? z : x
  let a = dir === 'h' ? x : z, b = a
  const has = (i) => d.edges[dir === 'h' ? edgeKey(i, line, 'h') : edgeKey(line, i, 'v')]
  while (has(a - 1)) a--
  while (has(b + 1)) b++
  return { dir, line, a, b }
}
// as duas fileiras de quadrados de cada lado de uma linha: lado − (antes da linha) e lado + (depois)
const sideCell = (d, run, i, side) => (run.dir === 'h' ? planCell(d, i, side < 0 ? run.line - 1 : run.line) : planCell(d, side < 0 ? run.line - 1 : run.line, i))

// cômodo = quadrados do mesmo tipo ligados sem parede, janela ou porta no meio
export function roomAt(d, x, z) {
  const t = planCell(d, x, z)
  if (!isFloor(t)) return null
  const seen = new Set([x + ',' + z]), todo = [[x, z]], cells = []
  while (todo.length) {
    const [cx, cz] = todo.pop()
    cells.push({ x: cx, z: cz })
    for (const [dx, dz] of DIRS) {
      const nx = cx + dx, nz = cz + dz, id = nx + ',' + nz
      if (seen.has(id) || planCell(d, nx, nz) !== t || d.edges[edgeBetween(cx, cz, nx, nz)]) continue
      seen.add(id); todo.push([nx, nz])
    }
  }
  return { type: t, cells, runs: boundaryRuns(d, cells) }
}
// os lados do cômodo, cada um como um trecho reto de parede; out = para que lado a parede anda quando o cômodo cresce
function boundaryRuns(d, cells) {
  const inR = new Set(cells.map((c) => c.x + ',' + c.z))
  const lines = new Map() // "dir|line|out" -> índices
  const add = (dir, line, out, i, key, nx, nz) => {
    if (inR.has(nx + ',' + nz) || !d.edges[key]) return
    const id = dir + '|' + line + '|' + out
    if (!lines.has(id)) lines.set(id, [])
    lines.get(id).push(i)
  }
  for (const { x, z } of cells) {
    add('h', z, -1, x, edgeKey(x, z, 'h'), x, z - 1)
    add('h', z + 1, 1, x, edgeKey(x, z + 1, 'h'), x, z + 1)
    add('v', x, -1, z, edgeKey(x, z, 'v'), x - 1, z)
    add('v', x + 1, 1, z, edgeKey(x + 1, z, 'v'), x + 1, z)
  }
  const runs = []
  for (const [id, idx] of lines) {
    const [dir, line, out] = id.split('|')
    idx.sort((p, q) => p - q)
    let a = idx[0]
    for (let j = 1; j <= idx.length; j++) {
      if (j < idx.length && idx[j] === idx[j - 1] + 1) continue
      runs.push({ dir, line: Number(line), a, b: idx[j - 1], out: Number(out) })
      a = idx[j]
    }
  }
  return runs
}

// limpa as bordas em volta de uns quadrados: parede no meio do nada some; piso encostado no lado de fora sem parede ganha uma
function tidyEdges(d, cells) {
  for (const { x, z } of cells) {
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz
      const ek = edgeBetween(x, z, nx, nz)
      const A = planCell(d, x, z), B = planCell(d, nx, nz)
      if (A === '.' && B === '.') delete d.edges[ek]
      else if ((A === '.') !== (B === '.') && !d.edges[ek]) d.edges[ek] = 'wall'
    }
  }
}

// anda com um trecho de parede um quadrado (delta = +1 para o lado +, −1 para o lado −). O lado de onde a parede sai cresce:
// a fileira que ela varre vira do tipo desse lado, e as paredes que chegavam nela (laterais e divisórias) acompanham.
// Portas e janelas do trecho vão junto.
export function moveRun(d, run, delta) {
  const H = run.dir === 'h', L = run.line, NL = L + delta
  const max = H ? d.rows : d.cols
  if (NL < 0 || NL > max) return 'A parede chegou no limite do terreno'
  const row = delta > 0 ? L : L - 1
  const grow = delta > 0 ? L - 1 : L
  const cellAt = (i, r) => (H ? planCell(d, i, r) : planCell(d, r, i))
  const setAt = (i, r, ch) => (H ? setPlanCell(d, i, r, ch) : setPlanCell(d, r, i, ch))
  const along = (i, l) => (H ? edgeKey(i, l, 'h') : edgeKey(l, i, 'v'))
  const across = (i, r) => (H ? edgeKey(i, r, 'v') : edgeKey(r, i, 'h'))
  const kinds = []
  for (let i = run.a; i <= run.b; i++) kinds.push(d.edges[along(i, L)])
  if (!kinds.some(Boolean)) return 'Não tem parede aí'
  const growing = []
  for (let i = run.a; i <= run.b; i++) growing.push(cellAt(i, grow))
  if (growing.every((c) => c === '.') && [...Array(run.b - run.a + 1).keys()].every((j) => cellAt(run.a + j, row) === '.')) return 'Essa parede não encosta em nenhum cômodo'
  for (let i = run.a; i <= run.b; i++) setAt(i, row, cellAt(i, grow))
  for (let i = run.a; i <= run.b + 1; i++) {
    if (d.edges[across(i, grow)]) d.edges[across(i, row)] = 'wall'
    else delete d.edges[across(i, row)]
  }
  for (let i = run.a; i <= run.b; i++) delete d.edges[along(i, L)]
  kinds.forEach((k, j) => { if (k) d.edges[along(run.a + j, NL)] = k })
  const touched = []
  for (const r of [grow, row, row + delta]) for (let i = run.a - 1; i <= run.b + 1; i++) touched.push(H ? { x: i, z: r } : { x: r, z: i })
  tidyEdges(d, touched)
  return null
}

// ---------- ferramenta Selecionar ----------
export function selectAt(hv) {
  const b = ui.build
  if (!b) return
  const d = b.draft
  if (b.carry) return placeCarry(hv)
  if (!hv) { b.sel = null; return }
  if (hv.kind === 'edge') {
    const key = edgeKey(hv.x, hv.z, hv.dir), kind = d.edges[key]
    if (kind === 'door' || kind === 'window') { b.sel = { kind: 'opening', key, type: kind }; return }
    if (kind === 'wall') { const run = runAt(d, key); b.sel = run ? { kind: 'run', run } : null; return }
  }
  if (hv.kind === 'cell') {
    const room = roomAt(d, hv.x, hv.z)
    b.sel = room ? { kind: 'room', ...room } : null
    return
  }
  b.sel = null
}
export const clearSelection = () => { if (ui.build) { ui.build.sel = null; ui.build.carry = null } }

// o que cada seta faz, para a dica: quantos m² o lado de cada cômodo ganha ou perde
function moveTip(d, run, delta) {
  const grow = delta > 0 ? -1 : 1 // o lado que cresce é o oposto ao movimento
  let gain = 0, lose = 0, gType = null, lType = null
  for (let i = run.a; i <= run.b; i++) {
    const g = sideCell(d, run, i, grow), l = sideCell(d, run, i, -grow)
    if (isFloor(g) && l !== g) { gain++; gType = g }
    if (isFloor(l) && l !== g) { lose++; lType = l }
  }
  if (gain && !lose) return `Expandir ${ROOM_NAME[gType]} (+${gain} m²)`
  if (lose && !gain) return `Recuar ${ROOM_NAME[lType]} (−${lose} m²)`
  if (gain && lose) return `${ROOM_NAME[gType]} +${gain} m², ${ROOM_NAME[lType]} −${lose} m²`
  return 'Mover parede'
}
// setas da seleção: posição no mundo (meio da parede, um pouco para o lado do movimento) e o movimento de cada uma
export function selHandles() {
  const b = ui.build
  if (!b?.sel || b.carry) return []
  const d = b.draft, out = []
  const mk = (id, run, delta) => {
    const mid = (run.a + run.b) / 2, off = 0.75 * delta
    const wx = run.dir === 'h' ? mid : run.line - 0.5 + off
    const wz = run.dir === 'h' ? run.line - 0.5 + off : mid
    out.push({ id, run, delta, wx, wz, nx: run.dir === 'h' ? 0 : delta, nz: run.dir === 'h' ? delta : 0, tip: moveTip(d, run, delta) })
  }
  if (b.sel.kind === 'run') { mk('p', b.sel.run, 1); mk('m', b.sel.run, -1) }
  else if (b.sel.kind === 'room') b.sel.runs.forEach((r, i) => { mk('o' + i, r, r.out); mk('i' + i, r, -r.out) })
  return out
}
export function moveSelection(handle) {
  const b = ui.build
  if (!b?.sel || !handle) return
  const d = b.draft, sel = b.sel
  pushHistory()
  const before = { cells: d.cells, edges: { ...d.edges } }
  const why = moveRun(d, handle.run, handle.delta)
  if (why) { b.history.pop(); d.cells = before.cells; d.edges = before.edges; return toast(why, 'bad') }
  if (sel.kind === 'run') {
    const r = handle.run, NL = r.line + handle.delta
    let key = null
    for (let i = r.a; i <= r.b && !key; i++) { const k = r.dir === 'h' ? edgeKey(i, NL, 'h') : edgeKey(NL, i, 'v'); if (d.edges[k]) key = k }
    const run = key && runAt(d, key)
    b.sel = run ? { kind: 'run', run } : null
  } else {
    const seed = sel.cells.find((c) => planCell(d, c.x, c.z) === sel.type)
    const room = seed && roomAt(d, seed.x, seed.z)
    b.sel = room ? { kind: 'room', ...room } : null
  }
}
export const moveSelectionById = (id) => moveSelection(selHandles().find((h) => h.id === id))
// Esc na aba Construção: solta o que estiver na mão, depois a seleção, depois volta para Selecionar; com nada pendente, sai da aba
export function buildEscape() {
  const b = ui.build
  if (!b) return 'none'
  if (b.carry) { b.carry = null; return 'done' }
  if (b.sel) { b.sel = null; return 'done' }
  if (!b.initial && b.tool !== 'select') { setBuildTool('select'); return 'done' }
  return buildChanged() ? 'pending' : 'leave'
}
// derruba a parede selecionada inteira (com as portas e janelas dela)
export function demolishRun() {
  const b = ui.build
  if (b?.sel?.kind !== 'run') return
  pushHistory()
  for (const k of runKeys(b.sel.run)) delete b.draft.edges[k]
  b.sel = null
}
// demole o cômodo: o piso some; as paredes que davam para ele ficam só onde ainda separam outro cômodo do lado de fora
export function demolishRoom() {
  const b = ui.build
  if (b?.sel?.kind !== 'room') return
  pushHistory()
  const d = b.draft
  for (const c of b.sel.cells) setPlanCell(d, c.x, c.z, '.')
  tidyEdges(d, b.sel.cells)
  b.sel = null
}
// troca o piso do cômodo inteiro (salão ↔ estoque)
export function setRoomType(type) {
  const b = ui.build
  if (b?.sel?.kind !== 'room' || b.sel.type === type) return
  pushHistory()
  for (const c of b.sel.cells) setPlanCell(b.draft, c.x, c.z, type)
  const room = roomAt(b.draft, b.sel.cells[0].x, b.sel.cells[0].z)
  b.sel = room ? { kind: 'room', ...room } : null
}
// porta/janela selecionada: tirar (vira parede), trocar de tipo ou levar para outra parede
export function removeOpening() {
  const b = ui.build
  if (b?.sel?.kind !== 'opening') return
  pushHistory()
  b.draft.edges[b.sel.key] = 'wall'
  const run = runAt(b.draft, b.sel.key)
  b.sel = run ? { kind: 'run', run } : null
}
export function swapOpening() {
  const b = ui.build
  if (b?.sel?.kind !== 'opening') return
  pushHistory()
  const type = b.sel.type === 'door' ? 'window' : 'door'
  b.draft.edges[b.sel.key] = type
  b.sel = { ...b.sel, type }
}
export function startCarry() {
  const b = ui.build
  if (b?.sel?.kind !== 'opening') return
  b.carry = { from: b.sel.key, type: b.sel.type }
}
function placeCarry(hv) {
  const b = ui.build, d = b.draft, c = b.carry
  if (!hv || hv.kind !== 'edge') return toast(`Clique numa parede para pôr a ${c.type === 'door' ? 'porta' : 'janela'}`, 'bad')
  const key = edgeKey(hv.x, hv.z, hv.dir)
  if (key === c.from) { b.carry = null; return }
  if (d.edges[key] !== 'wall') return toast(`A ${c.type === 'door' ? 'porta' : 'janela'} só vai numa parede`, 'bad')
  pushHistory()
  d.edges[c.from] = 'wall'
  d.edges[key] = c.type
  b.carry = null
  b.sel = { kind: 'opening', key, type: c.type }
}
// tecla Delete com algo selecionado
export function deleteSelection() {
  const s = ui.build?.sel
  if (!s) return
  if (s.kind === 'opening') removeOpening()
  else if (s.kind === 'run') demolishRun()
  else if (s.kind === 'room') demolishRoom()
}

// Contorna automaticamente o piso pintado com paredes, divisória do estoque e portas se ainda não houver
export function autoWrapWalls() {
  const b = ui.build
  if (!b) return
  const d = b.draft
  const hasAnyCell = d.cells.includes('s') || d.cells.includes('k')
  if (!hasAnyCell) return toast('Pinte primeiro o chão da loja e do estoque!', 'bad')
  pushHistory()

  // bordas horizontais e verticais entre células diferentes (s/k vs .) ou entre s e k
  for (let z = 0; z <= d.rows; z++) {
    for (let x = 0; x < d.cols; x++) {
      const a = planCell(d, x, z - 1), c = planCell(d, x, z)
      if (a !== c) {
        const ek = edgeKey(x, z, 'h')
        if (!d.edges[ek]) d.edges[ek] = 'wall'
      }
    }
  }
  for (let x = 0; x <= d.cols; x++) {
    for (let z = 0; z < d.rows; z++) {
      const a = planCell(d, x - 1, z), c = planCell(d, x, z)
      if (a !== c) {
        const ek = edgeKey(x, z, 'v')
        if (!d.edges[ek]) d.edges[ek] = 'wall'
      }
    }
  }

  // se não há porta de entrada ainda, coloca uma na borda mais à frente do salão ('s' -> '.')
  if (!findMainDoors(d).length) {
    let best = null
    for (let z = d.rows; z >= 0 && !best; z--) {
      for (let x = 0; x < d.cols; x++) {
        const a = planCell(d, x, z - 1), c = planCell(d, x, z)
        if ((a === 's' && c === '.') || (c === 's' && a === '.')) {
          best = edgeKey(x, z, 'h')
          if (x >= Math.floor(d.cols / 2) - 1) break
        }
      }
    }
    if (!best) {
      for (let x = 0; x <= d.cols && !best; x++) {
        for (let z = d.rows - 1; z >= 0 && !best; z--) {
          const a = planCell(d, x - 1, z), c = planCell(d, x, z)
          if ((a === 's' && c === '.') || (c === 's' && a === '.')) best = edgeKey(x, z, 'v')
        }
      }
    }
    if (best) d.edges[best] = 'door'
  }

  // se há estoque ('k') e nenhuma ligação aberta/porta entre 's' e 'k', coloca uma porta de estoque
  let hasStockLink = false
  let fallbackEdge = null
  for (let z = 0; z < d.rows; z++) {
    for (let x = 0; x < d.cols; x++) {
      if (planCell(d, x, z) !== 'k') continue
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz
        if (planCell(d, nx, nz) !== 's') continue
        const ek = edgeBetween(x, z, nx, nz)
        if (!d.edges[ek] || d.edges[ek] === 'door') hasStockLink = true
        else if (!fallbackEdge) fallbackEdge = ek
      }
    }
  }
  if (!hasStockLink && fallbackEdge) d.edges[fallbackEdge] = 'door'
  b.sel = null
  toast('Paredes e portas aplicadas em volta do piso', 'good')
}

export function clearDraft() {
  const b = ui.build
  if (!b) return
  pushHistory()
  b.draft.cells = '.'.repeat(b.draft.cols * b.draft.rows)
  b.draft.edges = {}
  b.sel = null; b.carry = null
}

// Preenche um modelo inicial compacto e válido (salão + estoque + paredes + janelas + portas) para agilizar a construção
export function applyStarterTemplate() {
  const b = ui.build
  if (!b) return
  const d = b.draft
  pushHistory()
  d.cells = '.'.repeat(d.cols * d.rows)
  d.edges = {}

  const sw = Math.min(d.cols, 6), sh = Math.min(d.rows - 2, 4)
  const kw = Math.min(d.cols, 3), kh = 2
  const sx0 = Math.max(0, Math.floor((d.cols - sw) / 2))
  const sz0 = Math.max(0, d.rows - sh - 1)
  const kz0 = Math.max(0, sz0 - kh)
  const kx0 = sx0 + Math.max(0, sw - kw)

  for (let z = sz0; z < sz0 + sh; z++) {
    for (let x = sx0; x < sx0 + sw; x++) setPlanCell(d, x, z, 's')
  }
  for (let z = kz0; z < sz0; z++) {
    for (let x = kx0; x < kx0 + kw; x++) setPlanCell(d, x, z, 'k')
  }

  for (let z = 0; z <= d.rows; z++) {
    for (let x = 0; x < d.cols; x++) {
      if (planCell(d, x, z - 1) !== planCell(d, x, z)) d.edges[edgeKey(x, z, 'h')] = 'wall'
    }
  }
  for (let x = 0; x <= d.cols; x++) {
    for (let z = 0; z < d.rows; z++) {
      if (planCell(d, x - 1, z) !== planCell(d, x, z)) d.edges[edgeKey(x, z, 'v')] = 'wall'
    }
  }

  const doorX = sx0 + Math.floor(sw / 2)
  const frontZ = sz0 + sh
  d.edges[edgeKey(doorX, frontZ, 'h')] = 'door'
  if (sw >= 4) {
    d.edges[edgeKey(sx0 + 1, frontZ, 'h')] = 'window'
    d.edges[edgeKey(sx0 + sw - 2, frontZ, 'h')] = 'window'
  }
  d.edges[edgeKey(kx0 + Math.floor(kw / 2), sz0, 'h')] = 'door'
  b.sel = null
  toast('Modelo base aplicado: agora é só personalizar', 'good')
}

function stockConnected(plan) {
  const visited = new Set()
  const entry = doorInside(plan)
  const todo = [entry]
  visited.add(entry.x + ',' + entry.z)
  while (todo.length) {
    const c = todo.pop()
    for (const [dx, dz] of DIRS) {
      const nx = c.x + dx, nz = c.z + dz
      const ch = planCell(plan, nx, nz)
      if (ch !== 's' && ch !== 'k') continue
      const ek = edgeBetween(c.x, c.z, nx, nz)
      const e = plan.edges?.[ek]
      if (e === 'wall' || e === 'window') continue
      const key = nx + ',' + nz
      if (!visited.has(key)) { visited.add(key); todo.push({ x: nx, z: nz }) }
    }
  }
  for (let z = 0; z < plan.rows; z++) {
    for (let x = 0; x < plan.cols; x++) {
      if (planCell(plan, x, z) === 'k' && !visited.has(x + ',' + z)) return false
    }
  }
  return true
}
// piso encostado no lado de fora sem parede, janela ou porta
function openToStreet(plan) {
  for (let z = 0; z < plan.rows; z++) for (let x = 0; x < plan.cols; x++) {
    if (!isFloor(planCell(plan, x, z))) continue
    for (const [dx, dz] of DIRS) if (planCell(plan, x + dx, z + dz) === '.' && !plan.edges[edgeBetween(x, z, x + dx, z + dz)]) return true
  }
  return false
}

function validateGridPlan(plan, counts) {
  if (counts.sales < BUILD_TILES.minSales) return `Pinte pelo menos ${BUILD_TILES.minSales} m² de piso da loja (atual: ${counts.sales} m²)`
  if (counts.stock < BUILD_TILES.minStock) return `Pinte pelo menos ${BUILD_TILES.minStock} m² de estoque (atual: ${counts.stock} m²)`
  if (!findMainDoors(plan).length) return 'Coloque pelo menos 1 porta ligando a rua ao salão'
  if (!stockConnected(plan)) return 'Ligue todo o estoque ao salão com uma porta (ou sem parede no meio)'
  if (openToStreet(plan)) return 'Falta parede entre o piso e o lado de fora (use Auto-paredes)'
  const room = stockRoom(plan)
  if (plan.built !== false && room.cap < stockCount()) return `O estoque tem ${stockCount()} caixas e o novo estoque só guarda ${room.cap}`
  return null
}

export function quote() {
  const b = ui.build
  if (!b) return null
  const plan = { ...b.draft, built: true }
  const counts = countDraft(plan)
  const base = b.baseCounts
  const mult = (regionMods().buildCost || 1) * (game.mode === 'hardcore' ? 1.25 : 1)
  const addS = Math.max(0, counts.sales - base.sales)
  const addK = Math.max(0, counts.stock - base.stock)
  const addW = Math.max(0, counts.wall - base.wall)
  const addWin = Math.max(0, counts.window - base.window)
  const addD = Math.max(0, counts.door - base.door)
  const total = cents((
    addS * BUILD_TILES.sales +
    addK * BUILD_TILES.stock +
    addW * BUILD_TILES.wall +
    addWin * BUILD_TILES.window +
    addD * BUILD_TILES.door
  ) * mult)

  const why = validateGridPlan(plan, counts)
  // móveis que ficariam fora do piso novo: vão para o lugar livre mais perto, ou para o inventário se não couberem
  let moved = 0
  if (!b.initial) {
    const items = [game.register, game.cafe, ...game.shelves, ...game.decor].filter((o) => o && o.x >= 0 && !isWallDecor(o))
    moved = items.filter((o) => !onFloor(plan, o.x, o.z)).length
  }
  const doorOk = findMainDoors(plan).length > 0
  const stockLinkOk = counts.stock > 0 && stockConnected(plan)

  return {
    plan,
    counts,
    checks: {
      salesOk: counts.sales >= BUILD_TILES.minSales,
      stockOk: counts.stock >= BUILD_TILES.minStock,
      doorOk,
      stockLinkOk,
    },
    affordable: game.money >= total,
    why,
    moved,
    initial: b.initial,
    area0: planArea(game.plan),
    area1: counts.sales + counts.stock,
    cap1: stockRoom(plan).cap,
    customers1: Math.max(0, Math.round(customersPerDay(plan))),
    total,
    changed: b.initial ? counts.sales + counts.stock > 0 : buildChanged(),
  }
}

export function confirmBuild() {
  const q = quote()
  if (!q) return
  if (q.why) return toast(q.why, 'bad')
  if (!q.changed) return
  if (game.money < q.total) return toast('Caixa insuficiente', 'bad')
  game.money -= q.total
  game.plan = q.plan
  if (q.initial) {
    setupStarterStore(game.plan)
    stopBuild()
    ui.editTab = 'shelves'
    toast(`Loja de ${q.area1} m² construída! Arrume os móveis; a primeira entrega está na calçada`, 'good')
  } else {
    const stored = settleOrStore(game.plan)
    toast(`Reforma concluída: ${q.area1} m²${stored ? ` · ${stored === 1 ? '1 item foi' : `${stored} itens foram`} para o inventário` : ''}`, 'good')
    const tool = ui.build?.tool
    startBuild() // o rascunho recomeça da loja nova: dá para seguir construindo
    if (ui.build && tool) ui.build.tool = tool
  }
  hooks.refreshGrid()
  hooks.rebuildShop?.()
}
