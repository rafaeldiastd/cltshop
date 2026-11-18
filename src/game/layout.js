import { LEVELS, DECOR } from './config.js'

// rot = para onde o item está virado: 0 = +z (rua), 1 = +x, 2 = -z (fundo), 3 = -x
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]
const k = (x, z) => x + ',' + z
const step = (o, rot, n = 1) => ({ x: o.x + DIRS[rot % 4][0] * n, z: o.z + DIRS[rot % 4][1] * n })

export const isGridPlan = (p) => !!(p && typeof p.cells === 'string' && p.edges)
export const edgeKey = (x, z, dir) => `${x},${z},${dir}` // dir: 'h' (borda norte de x,z) | 'v' (borda oeste de x,z)
export function edgeBetween(ax, az, bx, bz) {
  if (bx === ax + 1 && bz === az) return edgeKey(bx, bz, 'v')
  if (bx === ax - 1 && bz === az) return edgeKey(ax, az, 'v')
  if (bz === az + 1 && bx === ax) return edgeKey(bx, bz, 'h')
  if (bz === az - 1 && bx === ax) return edgeKey(ax, az, 'h')
  return null
}
export function planCell(plan, x, z) {
  if (!isGridPlan(plan)) return null
  if (x < 0 || z < 0 || x >= plan.cols || z >= plan.rows) return '.'
  return plan.cells[z * plan.cols + x] || '.'
}
export function setPlanCell(plan, x, z, ch) {
  if (x < 0 || z < 0 || x >= plan.cols || z >= plan.rows) return
  const i = z * plan.cols + x
  plan.cells = plan.cells.slice(0, i) + ch + plan.cells.slice(i + 1)
}
export function canCrossGridEdge(plan, ax, az, bx, bz) {
  const ek = edgeBetween(ax, az, bx, bz)
  if (!ek) return false
  const e = plan.edges?.[ek]
  return !e || e === 'door'
}

// Converte uma planta retangular clássica para o formato livre de grade (chão + paredes/janelas/portas)
export function planToGrid(plan, targetCols, targetRows) {
  if (isGridPlan(plan)) {
    const cols = Math.max(plan.cols, targetCols || plan.cols)
    const rows = Math.max(plan.rows, targetRows || plan.rows)
    if (cols === plan.cols && rows === plan.rows) return JSON.parse(JSON.stringify(plan))
    let cells = '.'.repeat(cols * rows)
    const copy = { ...plan, cols, rows, cells, edges: { ...plan.edges } }
    for (let z = 0; z < plan.rows; z++) {
      for (let x = 0; x < plan.cols; x++) setPlanCell(copy, x, z, planCell(plan, x, z))
    }
    return copy
  }
  const cols = Math.max(targetCols || 11, plan.cols || 9)
  const rows = Math.max(targetRows || 9, plan.rows || 7)
  let cells = '.'.repeat(cols * rows)
  const edges = {}
  const out = { ...plan, cols, rows, cells, edges, built: plan.built !== false }
  if (plan.built === false) return out
  const sr = stockRoom(plan)
  for (let z = 0; z < plan.rows; z++) {
    for (let x = 0; x < plan.cols; x++) {
      const isStk = x >= sr.x0 && x < sr.x1 && z >= sr.z0 && z < sr.z1
      setPlanCell(out, x, z, isStk ? 'k' : 's')
    }
  }
  // paredes externas + porta da frente
  for (let x = 0; x < plan.cols; x++) {
    edges[edgeKey(x, 0, 'h')] = x === 3 || x === 4 ? 'window' : 'wall'
    edges[edgeKey(x, plan.rows, 'h')] = x === plan.doorX ? 'door' : 'wall'
  }
  for (let z = 0; z < plan.rows; z++) {
    edges[edgeKey(0, z, 'v')] = 'wall'
    edges[edgeKey(plan.cols, z, 'v')] = 'wall'
  }
  // divisória do estoque
  for (let x = sr.x0; x < sr.x1; x++) {
    const hz = sr.corner?.startsWith('s') ? sr.z0 : sr.z1
    edges[edgeKey(x, hz, 'h')] = 'wall'
  }
  for (let z = sr.z0; z < sr.z1; z++) {
    const vx = sr.corner === 'ne' || sr.corner === 'se' ? sr.x0 : sr.x1
    edges[edgeKey(vx, z, 'v')] = z === sr.door.z ? 'door' : 'wall'
  }
  out.doorX = plan.doorX
  return out
}

// planta da loja, guardada no save: tamanho, posição da porta e tamanho/canto da sala do estoque
export const basePlan = (level, built = true) => {
  const L = LEVELS[level]
  if (!built) {
    return {
      cols: L.maxCols, rows: L.maxRows, doorX: Math.floor(L.maxCols / 2),
      built: false, lotCols: L.maxCols, lotRows: L.maxRows,
      cells: '.'.repeat(L.maxCols * L.maxRows), edges: {},
      stock: { cols: 0, rows: 0, corner: 'nw' },
    }
  }
  return { cols: L.cols, rows: L.rows, doorX: Math.floor(L.cols / 2), built: true, lotCols: L.maxCols, lotRows: L.maxRows, stock: { cols: L.stock.cols, rows: L.stock.rows, corner: 'nw' } }
}

export function planKey(p) {
  if (isGridPlan(p)) {
    const ek = Object.entries(p.edges || {}).sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, v]) => id + ':' + v).join(';')
    return ['g', p.built === false ? 0 : 1, p.cols, p.rows, p.cells, ek].join('|')
  }
  return [p.built === false ? 0 : 1, p.cols, p.rows, p.doorX, p.stock?.cols || 0, p.stock?.rows || 0, p.stock?.corner || 'nw'].join()
}

export function planArea(p) {
  if (p.built === false) return 0
  if (isGridPlan(p)) {
    let n = 0
    for (let i = 0; i < p.cells.length; i++) if (p.cells[i] === 's' || p.cells[i] === 'k') n++
    return n
  }
  return p.cols * p.rows
}

export function findMainDoors(plan) {
  if (!isGridPlan(plan)) {
    const dx = plan.built === false ? Math.floor((plan.lotCols || 11) / 2) : plan.doorX
    const r = plan.built === false ? (plan.lotRows || 9) : plan.rows
    return [{ key: edgeKey(dx, r, 'h'), x: dx, z: r, dir: 'h', inX: dx, inZ: r - 1, outX: dx, outZ: r }]
  }
  const list = []
  for (const [ek, type] of Object.entries(plan.edges || {})) {
    if (type !== 'door') continue
    const [xs, zs, dir] = ek.split(',')
    const x = Number(xs), z = Number(zs)
    if (dir === 'h') {
      const a = planCell(plan, x, z - 1), b = planCell(plan, x, z)
      if ((a === 's' && b === '.') || (b === 's' && a === '.')) {
        const inZ = a === 's' ? z - 1 : z, outZ = a === 's' ? z : z - 1
        list.push({ key: ek, x, z, dir, inX: x, inZ, outX: x, outZ, front: z === plan.rows })
      }
    } else {
      const a = planCell(plan, x - 1, z), b = planCell(plan, x, z)
      if ((a === 's' && b === '.') || (b === 's' && a === '.')) {
        const inX = a === 's' ? x - 1 : x, outX = a === 's' ? x : x - 1
        list.push({ key: ek, x, z, dir, inX, inZ: z, outX, outZ: z, front: false })
      }
    }
  }
  list.sort((a, b) => (b.front ? 1 : 0) - (a.front ? 1 : 0) || b.z - a.z)
  return list
}

export const dims = (plan) => {
  const doors = isGridPlan(plan) ? findMainDoors(plan) : []
  const d0 = doors[0]
  return {
    cols: plan.built === false ? (plan.lotCols || plan.cols || 11) : plan.cols,
    rows: plan.built === false ? (plan.lotRows || plan.rows || 9) : plan.rows,
    doorX: d0 ? d0.x : (plan.built === false ? Math.floor((plan.lotCols || 11) / 2) : plan.doorX),
  }
}
export const doorTile = (plan) => {
  if (isGridPlan(plan)) {
    const d0 = findMainDoors(plan)[0]
    if (d0) return { x: d0.outX, z: d0.outZ }
  }
  const d = dims(plan)
  return { x: d.doorX, z: d.rows }
}
export const doorInside = (plan) => {
  if (isGridPlan(plan)) {
    const d0 = findMainDoors(plan)[0]
    if (d0) return { x: d0.inX, z: d0.inZ }
  }
  const d = dims(plan)
  return { x: d.doorX, z: d.rows - 1 }
}

// ---------- sala do estoque ----------
const STACK = 3
const STOCK_BIG = { from: 19, perTile: 4.3, max: 100 }
const stockCap = (tiles) => (tiles <= 0 ? 0 : tiles <= STOCK_BIG.from ? tiles * STACK : Math.min(STOCK_BIG.max, Math.round(STOCK_BIG.from * STACK + (tiles - STOCK_BIG.from) * STOCK_BIG.perTile)))

export function stockRoom(plan) {
  if (isGridPlan(plan)) {
    if (plan.built === false) {
      return { cols: 0, rows: 0, x0: 0, z0: 0, x1: 0, z1: 0, corner: 'nw', cap: 0, wallX: -1, wallZ: -1, door: { x: -1, z: -1 }, doorOut: { x: 0, z: 0 }, tiles: [] }
    }
    const tiles = []
    for (let z = 0; z < plan.rows; z++) for (let x = 0; x < plan.cols; x++) if (planCell(plan, x, z) === 'k') tiles.push({ x, z })
    // encontra porta entre estoque ('k') e salão ('s')
    let door = tiles[0] || { x: 0, z: 0 }, doorOut = door
    for (let z = 0; z < plan.rows; z++) {
      for (let x = 0; x < plan.cols; x++) {
        if (planCell(plan, x, z) !== 'k') continue
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz
          if (planCell(plan, nx, nz) === 's' && canCrossGridEdge(plan, x, z, nx, nz)) {
            door = { x, z }; doorOut = { x: nx, z: nz }; break
          }
        }
        if (doorOut !== door) break
      }
      if (doorOut !== door) break
    }
    const xs = tiles.map((t) => t.x), zs = tiles.map((t) => t.z)
    const x0 = xs.length ? Math.min(...xs) : 0, x1 = xs.length ? Math.max(...xs) + 1 : 0
    const z0 = zs.length ? Math.min(...zs) : 0, z1 = zs.length ? Math.max(...zs) + 1 : 0
    return {
      cols: x1 - x0, rows: z1 - z0, x0, z0, x1, z1, corner: 'custom',
      cap: stockCap(Math.max(0, tiles.length - 1)),
      wallX: -99, wallZ: -99, door, doorOut, tiles,
    }
  }
  if (plan.built === false || !plan.stock?.cols || !plan.stock?.rows) {
    return { cols: 0, rows: 0, x0: 0, z0: 0, x1: 0, z1: 0, corner: 'nw', cap: 0, wallX: -1, wallZ: -1, door: { x: -1, z: -1 }, doorOut: { x: 0, z: 0 } }
  }
  const sc = plan.stock.cols, sr = plan.stock.rows
  const corner = plan.stock.corner || 'nw'
  const east = corner === 'ne' || corner === 'se'
  const south = corner === 'sw' || corner === 'se'
  const x0 = east ? plan.cols - sc : 0
  const z0 = south ? plan.rows - sr : 0
  const x1 = x0 + sc, z1 = z0 + sr
  const doorX = east ? x0 : x1 - 1
  const doorZ = south ? z0 : z1 - 1
  const doorOut = { x: east ? x0 - 1 : x1, z: doorZ }
  return {
    cols: sc, rows: sr, x0, z0, x1, z1, corner,
    cap: stockCap(sc * sr - 1),
    wallX: east ? x0 - 0.5 : x1 - 0.5,
    wallZ: south ? z0 - 0.5 : z1 - 0.5,
    door: { x: doorX, z: doorZ },
    doorOut,
  }
}

export const inStock = (plan, x, z) => {
  if (plan.built === false) return false
  if (isGridPlan(plan)) return planCell(plan, Math.round(x), Math.round(z)) === 'k'
  const r = stockRoom(plan)
  return x >= r.x0 - 0.5 && x < r.x1 - 0.5 && z >= r.z0 - 0.5 && z < r.z1 - 0.5
}
export const stockStand = (plan) => stockRoom(plan).door

// ---------- canto visual: a ponta de uma fileira, a 90° dela, ganha a forma de canto convexo ----------
const plainShelf = (n) => !!n && n.kind === 'shelf' && (!n.variant || n.variant === 'wall') && !n.fridge && n.groupId == null && n.x >= 0
const rot4 = (n) => (((n.rot || 0) % 4) + 4) % 4
export function elbowOf(s, at) {
  if (!plainShelf(s)) return null
  const r = rot4(s), fs = DIRS[r]
  for (const dd of DIRS) {
    if (!(fs[0] === dd[0] && fs[1] === dd[1]) && !(fs[0] === -dd[0] && fs[1] === -dd[1])) continue
    const n = at.get(s.x + dd[0] + ',' + (s.z + dd[1]))
    if (!plainShelf(n) || n.variant !== s.variant) continue
    const c = rot4(n), lx = LOCAL_X[c]
    if (!((lx[0] === dd[0] && lx[1] === dd[1]) || (lx[0] === -dd[0] && lx[1] === -dd[1]))) continue
    return { rot: c, mir: lx[0] === dd[0] && lx[1] === dd[1] }
  }
  return null
}

// ---------- móveis ----------
const LOCAL_X = [[1, 0], [0, -1], [-1, 0], [0, 1]]
export const shelfAccess = (s) => step(s, s.rot || 0)
export const shelfPoint = (s) => { const [dx, dz] = DIRS[(s.rot || 0) % 4]; return { x: s.x + dx * 0.3, z: s.z + dz * 0.3 } }

const PRODUCE_BASE = {
  island: [
    { slot: 0, dx: 0, dz: 0, face: 2 }, { slot: 1, dx: 1, dz: 0, face: 1 },
    { slot: 2, dx: 1, dz: 1, face: 0 }, { slot: 3, dx: 0, dz: 1, face: 3 },
  ],
  wall: [{ slot: 0, dx: 0, dz: 0, face: 0 }, { slot: 1, dx: 1, dz: 0, face: 0 }],
}
export function produceSlots(x, z, rot = 0, style = 'island') {
  const st = style === 'wall' ? 'wall' : 'island', r = ((rot % 4) + 4) % 4
  const cells = PRODUCE_BASE[st].map((b) => {
    let dx = b.dx, dz = b.dz
    for (let i = 0; i < r; i++) [dx, dz] = [dz, 1 - dx]
    return { b, dx, dz }
  })
  const mx = Math.min(...cells.map((c) => c.dx)), mz = Math.min(...cells.map((c) => c.dz))
  return cells.map(({ b, dx, dz }) => ({ slot: b.slot, style: st, x: x + dx - mx, z: z + dz - mz, rot: (b.face + r) % 4, grot: r }))
}
export const cashierTile = (r) => step(r, (r.rot || 0) + 2)
export function backPartner(s, shelves) {
  const rot = s.rot || 0, [dx, dz] = DIRS[(rot + 2) % 4]
  return shelves.find((o) => o !== s && !o.fridge && o.x === s.x + dx && o.z === s.z + dz && (o.rot || 0) % 4 === (rot + 2) % 4)
}
export const isUsable = (d) => d.type === 'computer' || d.type === 'radio'
export const isArcade = (d) => !!d && (d.type === 'arcade' || d.type === 'pinball' || d.type === 'dance')
export const onFloor = (plan, x, z) => {
  if (plan.built === false) return false
  if (isGridPlan(plan)) return planCell(plan, x, z) === 's'
  const { cols, rows } = dims(plan)
  return x >= 0 && z >= 0 && x < cols && z < rows && !inStock(plan, x, z)
}

export function queueFor(r, isFree) {
  const rot = r.rot || 0, first = step(r, rot)
  for (const dir of [rot + 1, rot + 3, rot]) {
    const line = [0, 1, 2, 3].map((i) => step(first, dir, i))
    if (line.every((t) => isFree(t.x, t.z))) return line
  }
  return null
}

function flood(plan, blocked, from) {
  const seen = new Set([k(from.x, from.z)]), todo = [from]
  while (todo.length) {
    const c = todo.pop()
    for (const [dx, dz] of DIRS) {
      const x = c.x + dx, z = c.z + dz, id = k(x, z)
      if (seen.has(id) || blocked.has(id) || !onFloor(plan, x, z)) continue
      if (isGridPlan(plan) && !canCrossGridEdge(plan, c.x, c.z, x, z)) continue
      seen.add(id); todo.push({ x, z })
    }
  }
  return seen
}

export const isWallDecor = (d) => !!DECOR[d.type]?.wall
export const isCeilingDecor = (d) => !!DECOR[d.type]?.ceiling
export function checkLayout(plan, { shelves, register, decor, cafe }) {
  const wall = decor.filter(isWallDecor), ceiling = decor.filter(isCeilingDecor), seen = new Set()
  decor = decor.filter((d) => !isWallDecor(d) && !isCeilingDecor(d))
  for (const w of wall) {
    if (w.x < 0 || w.x >= plan.cols) return 'A parede não vai até aí'
    if (seen.has(w.x)) return 'Já tem outra decoração de parede aí'
    seen.add(w.x)
  }
  // luminária no teto: só precisa estar sobre o piso da loja e não dividir o lugar com outra
  seen.clear()
  for (const c of ceiling) {
    if (!onFloor(plan, c.x, c.z)) return 'Aí fica fora da área da loja'
    if (seen.has(k(c.x, c.z))) return 'Já tem outra luminária aí'
    seen.add(k(c.x, c.z))
  }
  const blocked = new Set()
  for (const o of [...(register ? [register] : []), ...(cafe ? [cafe] : []), ...shelves, ...decor]) {
    if (!onFloor(plan, o.x, o.z)) return 'Aí fica fora da área da loja'
    if (blocked.has(k(o.x, o.z))) return 'Já tem outra coisa nesse lugar'
    blocked.add(k(o.x, o.z))
  }
  const entry = doorInside(plan), room = stockRoom(plan)
  if (blocked.has(k(entry.x, entry.z))) return 'Isso bloquearia a porta da loja'
  if (blocked.has(k(room.doorOut.x, room.doorOut.z))) return 'Isso bloquearia a porta do estoque'
  const reach = flood(plan, blocked, entry)
  const ok = (t) => reach.has(k(t.x, t.z))
  if (!ok(room.doorOut)) return 'Isso fecharia o caminho até o estoque'
  for (const s of shelves) if (!ok(shelfAccess(s))) return 'A frente da prateleira ficaria sem acesso'
  for (const d of decor) if (isUsable(d) && !DIRS.some(([dx, dz]) => ok({ x: d.x + dx, z: d.z + dz }))) return 'Isso deixaria o computador ou o rádio sem acesso'
  if (cafe) {
    if (!ok(shelfAccess(cafe))) return 'A frente da cafeteria ficaria sem acesso'
    if (!ok(cashierTile(cafe))) return 'Não sobra lugar atrás da cafeteria'
  }
  if (register) {
    if (!ok(cashierTile(register))) return 'Não sobra lugar atrás do caixa'
    if (!queueFor(register, queueSpot(plan, reach))) return 'Não sobra espaço para a fila do caixa'
  }
  return null
}
const queueSpot = (plan, reach) => { const e = doorInside(plan); return (x, z) => reach.has(k(x, z)) && !(x === e.x && z === e.z) }

export function queueTiles(plan, register, blocked) {
  const reach = flood(plan, blocked, doorInside(plan))
  return queueFor(register, queueSpot(plan, reach))
}

export function settleLayout(plan, { shelves, register, decor, cafe }) {
  const cur = { register: null, cafe: null, shelves: [], decor: [] }
  const { cols, rows } = dims(plan)
  const single = (list) => list === 'register' || list === 'cafe'
  const fits = (list, c) => !checkLayout(plan, single(list) ? { ...cur, [list]: c } : { ...cur, [list]: [...cur[list], c] })
  const extra = (o) => (o.kind ? { kind: o.kind, fridge: o.fridge, groupId: o.groupId, variant: o.variant } : { variant: o.variant })
  const settle = (list, o) => {
    const rot0 = o.rot || 0
    let spot = fits(list, { x: o.x, z: o.z, rot: rot0, type: o.type, ...extra(o) }) ? { x: o.x, z: o.z, rot: rot0 } : null
    if (!spot) {
      const tiles = []
      for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) tiles.push({ x, z, d: Math.hypot(x - o.x, z - o.z) })
      tiles.sort((a, b) => a.d - b.d)
      search: for (const t of tiles) for (let r = 0; r < 4; r++) {
        const c = { x: t.x, z: t.z, rot: (rot0 + r) % 4 }
        if (fits(list, { ...c, type: o.type, ...extra(o) })) { spot = c; break search }
      }
    }
    if (!spot) return false
    Object.assign(o, spot)
    if (single(list)) cur[list] = o
    else cur[list].push(o)
    return true
  }
  if (register) settle('register', register)
  if (cafe) settle('cafe', cafe)
  for (const s of shelves) settle('shelves', s)
  return decor.filter((d) => !settle('decor', d))
}

export const defaultRegister = (plan) => { const d = dims(plan); return { x: d.doorX + 1, z: d.rows - 2, rot: 0 } }
export const defaultShelves = (plan) => [0, 1, 2].map((i) => ({ x: stockRoom(plan).cols + i, z: 0, rot: 0 }))
export const defaultProduce = (plan) => ({ x: Math.floor(plan.cols / 2), z: 2, rot: 0, style: 'island' })
export const defaultFreezers = (plan) => [2, 3].map((z) => ({ x: dims(plan).cols - 1, z, rot: 3, fridge: true }))
export const defaultDecor = (plan) => [...usableDecor(plan), ...defaultPendants(plan)]
export const usableDecor = (plan) => [
  { type: 'computer', x: dims(plan).cols - 2, z: 0, rot: 0 },
  { type: 'radio', x: 0, z: stockRoom(plan).rows, rot: 1 },
]
// duas luminárias de brinde no salão: a um quarto e a três quartos do lado mais comprido, cada uma no piso mais perto disso
export function defaultPendants(plan) {
  const { cols, rows } = dims(plan), cells = []
  for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) if (onFloor(plan, x, z)) cells.push({ x, z })
  if (!cells.length) return []
  const xs = cells.map((c) => c.x), zs = cells.map((c) => c.z)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wide = x1 - x0 >= z1 - z0
  const targets = [0.25, 0.75].map((f) => (wide ? { x: x0 + (x1 - x0) * f, z: cz } : { x: cx, z: z0 + (z1 - z0) * f }))
  const out = []
  for (const t of targets) {
    const best = cells.filter((c) => !out.some((o) => o.x === c.x && o.z === c.z))
      .sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0]
    if (best) out.push({ type: 'pendant', x: best.x, z: best.z, rot: 0 })
  }
  return out
}

export function boxSlots(boxes, plan) {
  const d = dims(plan), room = stockRoom(plan)
  const spots = []
  if (Array.isArray(room.tiles) && room.tiles.length) {
    for (const t of room.tiles) if (t.x !== room.door.x || t.z !== room.door.z) spots.push(t)
    if (!spots.length) spots.push(room.tiles[0])
  } else {
    for (let z = room.z0; z < room.z1; z++) for (let x = room.x0; x < room.x1; x++) if (x !== room.door.x || z !== room.door.z) spots.push({ x, z })
  }
  const out = new Map()
  let iDock = 0
  const inRoom = []
  for (const b of boxes) {
    if (b.at) out.set(b.id, { x: b.at.x, y: 0, z: b.at.z })
    else if (b.state === 'dock') {
      const i = iDock++
      out.set(b.id, { x: d.doorX - 1.4 - (i % 4) * 0.75, y: Math.floor(i / 8) * 0.42, z: d.rows + 1.0 + (Math.floor(i / 4) % 2) * 0.75 })
    } else inRoom.push(b)
  }
  if (!spots.length) {
    inRoom.forEach((b) => {
      const i = iDock++
      out.set(b.id, { x: d.doorX - 1.4 - (i % 4) * 0.75, y: Math.floor(i / 8) * 0.42, z: d.rows + 1.0 + (Math.floor(i / 4) % 2) * 0.75 })
    })
    return out
  }
  const byProduct = new Map()
  for (const b of inRoom) { if (!byProduct.has(b.product)) byProduct.set(b.product, []); byProduct.get(b.product).push(b) }
  const H = Math.max(STACK, Math.ceil(inRoom.length / spots.length))
  const full = [], rest = []
  for (const list of byProduct.values()) {
    let i = 0
    for (; i + H <= list.length; i += H) full.push(list.slice(i, i + H))
    if (i < list.length) rest.push(list.slice(i))
  }
  let cols = [...full, ...rest]
  if (cols.length > spots.length) {
    cols = [...full]
    const flat = rest.flat()
    for (let i = 0; i < flat.length; i += H) cols.push(flat.slice(i, i + H))
  }
  if (cols.length > spots.length) { cols = []; for (let i = 0; i < inRoom.length; i++) { (cols[i % spots.length] ||= []).push(inRoom[i]) } }
  cols.forEach((col, ci) => col.forEach((b, k) => out.set(b.id, { x: spots[ci].x, y: k * 0.42, z: spots[ci].z })))
  return out
}
