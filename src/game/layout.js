import { LEVELS } from './config.js'

// rot = para onde o item está virado: 0 = +z (rua), 1 = +x, 2 = -z (fundo), 3 = -x
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]
const k = (x, z) => x + ',' + z
const step = (o, rot, n = 1) => ({ x: o.x + DIRS[rot % 4][0] * n, z: o.z + DIRS[rot % 4][1] * n })

export const dims = (lv) => {
  const L = LEVELS[lv]
  return { cols: L.cols, rows: L.rows, doorX: Math.floor(L.cols / 2) }
}
export const doorTile = (lv) => { const d = dims(lv); return { x: d.doorX, z: d.rows } }
export const doorInside = (lv) => { const d = dims(lv); return { x: d.doorX, z: d.rows - 1 } }

// ---------- sala do estoque (canto do fundo, porta na parede direita) ----------
export const stockRoom = (lv) => {
  const { cols, rows, cap } = LEVELS[lv].stock
  return { cols, rows, cap, wallX: cols - 0.5, wallZ: rows - 0.5, door: { x: cols - 1, z: rows - 1 }, doorOut: { x: cols, z: rows - 1 } }
}
export const inStock = (lv, x, z) => { const r = stockRoom(lv); return x < r.wallX && z < r.wallZ }
export const stockStand = (lv) => stockRoom(lv).door

// ---------- móveis ----------
export const shelfAccess = (s) => step(s, s.rot || 0)
export const shelfPoint = (s) => { const [dx, dz] = DIRS[(s.rot || 0) % 4]; return { x: s.x + dx * 0.3, z: s.z + dz * 0.3 } }
export const cashierTile = (r) => step(r, (r.rot || 0) + 2)
export const isUsable = (d) => d.type === 'computer' || d.type === 'radio'
export const onFloor = (lv, x, z) => { const { cols, rows } = dims(lv); return x >= 0 && z >= 0 && x < cols && z < rows && !inStock(lv, x, z) }

// a fila sai da frente do caixa e segue para um lado, para o outro ou reto, o que couber
export function queueFor(r, isFree) {
  const rot = r.rot || 0, first = step(r, rot)
  for (const dir of [rot + 1, rot + 3, rot]) {
    const line = [0, 1, 2, 3].map((i) => step(first, dir, i))
    if (line.every((t) => isFree(t.x, t.z))) return line
  }
  return null
}

function flood(lv, blocked, from) {
  const seen = new Set([k(from.x, from.z)]), todo = [from]
  while (todo.length) {
    const c = todo.pop()
    for (const [dx, dz] of DIRS) {
      const x = c.x + dx, z = c.z + dz, id = k(x, z)
      if (seen.has(id) || blocked.has(id) || !onFloor(lv, x, z)) continue
      seen.add(id); todo.push({ x, z })
    }
  }
  return seen
}

// null = layout válido; texto = motivo para recusar
export function checkLayout(lv, { shelves, register, decor }) {
  const blocked = new Set()
  for (const o of [...(register ? [register] : []), ...shelves, ...decor]) {
    if (!onFloor(lv, o.x, o.z)) return 'Aí fica fora da área da loja'
    if (blocked.has(k(o.x, o.z))) return 'Já tem outra coisa nesse lugar'
    blocked.add(k(o.x, o.z))
  }
  const entry = doorInside(lv), room = stockRoom(lv)
  if (blocked.has(k(entry.x, entry.z))) return 'Isso bloquearia a porta da loja'
  if (blocked.has(k(room.doorOut.x, room.doorOut.z))) return 'Isso bloquearia a porta do estoque'
  const reach = flood(lv, blocked, entry)
  const ok = (t) => reach.has(k(t.x, t.z))
  if (!ok(room.doorOut)) return 'Isso fecharia o caminho até o estoque'
  for (const s of shelves) if (!ok(shelfAccess(s))) return 'A frente da prateleira ficaria sem acesso'
  for (const d of decor) if (isUsable(d) && !DIRS.some(([dx, dz]) => ok({ x: d.x + dx, z: d.z + dz }))) return 'Isso deixaria o computador ou o rádio sem acesso'
  if (register) {
    if (!ok(cashierTile(register))) return 'Não sobra lugar atrás do caixa'
    if (!queueFor(register, queueSpot(lv, reach))) return 'Não sobra espaço para a fila do caixa'
  }
  return null
}
const queueSpot = (lv, reach) => { const e = doorInside(lv); return (x, z) => reach.has(k(x, z)) && !(x === e.x && z === e.z) }

// fila do caixa considerando só o que já está bloqueado
export function queueTiles(lv, register, blocked) {
  const reach = flood(lv, blocked, doorInside(lv))
  return queueFor(register, queueSpot(lv, reach))
}

// Reacomoda o que ficou em lugar inválido (loja ampliada ou save antigo): cada item vai para a vaga válida mais próxima.
// Devolve os itens decorativos que não couberam em lugar nenhum.
export function settleLayout(lv, { shelves, register, decor }) {
  const cur = { register: null, shelves: [], decor: [] }
  const { cols, rows } = dims(lv)
  const fits = (list, c) => !checkLayout(lv, list === 'register' ? { ...cur, register: c } : { ...cur, [list]: [...cur[list], c] })
  const settle = (list, o) => {
    const rot0 = o.rot || 0
    let spot = fits(list, { x: o.x, z: o.z, rot: rot0, type: o.type }) ? { x: o.x, z: o.z, rot: rot0 } : null
    if (!spot) {
      const tiles = []
      for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) tiles.push({ x, z, d: Math.hypot(x - o.x, z - o.z) })
      tiles.sort((a, b) => a.d - b.d)
      search: for (const t of tiles) for (let r = 0; r < 4; r++) {
        const c = { x: t.x, z: t.z, rot: (rot0 + r) % 4 }
        if (fits(list, { ...c, type: o.type })) { spot = c; break search }
      }
    }
    if (!spot) return false
    Object.assign(o, spot)
    if (list === 'register') cur.register = o
    else cur[list].push(o)
    return true
  }
  if (register) settle('register', register)
  for (const s of shelves) settle('shelves', s)
  return decor.filter((d) => !settle('decor', d))
}

export const defaultRegister = (lv) => { const d = dims(lv); return { x: d.doorX + 1, z: d.rows - 2, rot: 0 } }
export const defaultShelves = (lv) => [0, 1, 2].map((i) => ({ x: stockRoom(lv).cols + i, z: 0, rot: 0 }))
export const defaultFreezers = (lv) => [2, 3].map((z) => ({ x: dims(lv).cols - 1, z, rot: 3, fridge: true }))
export const defaultDecor = (lv) => {
  const d = dims(lv), out = stockRoom(lv).doorOut
  return [
    { type: 'gacha', x: 0, z: d.rows - 3, rot: 1 },
    { type: 'plant', x: d.cols - 1, z: 1, rot: 0 },
    { type: 'plant', x: 0, z: d.rows - 1, rot: 0 },
    { type: 'plant', x: d.cols - 1, z: d.rows - 2, rot: 0 },
    { type: 'cart', x: d.doorX - 2, z: d.rows - 1, rot: 0 },
    { type: 'truck', x: out.x, z: out.z + 1, rot: 0 },
    ...usableDecor(lv),
  ]
}
export const usableDecor = (lv) => [
  { type: 'computer', x: dims(lv).cols - 2, z: 0, rot: 0 },
  { type: 'radio', x: 0, z: stockRoom(lv).rows, rot: 1 },
]

// posição 3D de cada caixa (dock na calçada, resto empilhado na sala do estoque)
export function boxSlots(boxes, lv) {
  const d = dims(lv), room = stockRoom(lv)
  const spots = []
  for (let z = 0; z < room.rows; z++) for (let x = 0; x < room.cols; x++) if (x !== room.door.x || z !== room.door.z) spots.push({ x, z })
  const out = new Map()
  let iDock = 0, iRoom = 0
  for (const b of boxes) {
    if (b.at) out.set(b.id, { x: b.at.x, y: 0, z: b.at.z }) // solta no chão pelo jogador
    else if (b.state === 'dock') {
      const i = iDock++
      out.set(b.id, { x: d.doorX - 1.4 - (i % 4) * 0.75, y: Math.floor(i / 8) * 0.42, z: d.rows + 1.0 + (Math.floor(i / 4) % 2) * 0.75 })
    } else {
      const i = iRoom++, s = spots[i % spots.length]
      out.set(b.id, { x: s.x, y: Math.floor(i / spots.length) * 0.42, z: s.z })
    }
  }
  return out
}
