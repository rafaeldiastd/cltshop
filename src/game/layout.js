import { LEVELS, DECOR } from './config.js'

// rot = para onde o item está virado: 0 = +z (rua), 1 = +x, 2 = -z (fundo), 3 = -x
export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]
const k = (x, z) => x + ',' + z
const step = (o, rot, n = 1) => ({ x: o.x + DIRS[rot % 4][0] * n, z: o.z + DIRS[rot % 4][1] * n })

// planta da loja, guardada no save: tamanho, posição da porta e tamanho da sala do estoque
export const basePlan = (level) => {
  const L = LEVELS[level]
  return { cols: L.cols, rows: L.rows, doorX: Math.floor(L.cols / 2), stock: { cols: L.stock.cols, rows: L.stock.rows } }
}
export const planKey = (p) => [p.cols, p.rows, p.doorX, p.stock.cols, p.stock.rows].join()
export const planArea = (p) => p.cols * p.rows
export const dims = (plan) => ({ cols: plan.cols, rows: plan.rows, doorX: plan.doorX })
export const doorTile = (plan) => { const d = dims(plan); return { x: d.doorX, z: d.rows } }
export const doorInside = (plan) => { const d = dims(plan); return { x: d.doorX, z: d.rows - 1 } }

// ---------- sala do estoque (canto do fundo, porta na parede direita) ----------
const STACK = 3 // caixas por lugar; o quadrado da porta fica livre
// salas grandes (últimas ampliações do Mercadinho) empilham mais alto: de 19 lugares úteis em diante a capacidade cresce 4,3 por lugar e chega a 100 caixas na sala máxima (6×5)
const STOCK_BIG = { from: 19, perTile: 4.3, max: 100 }
const stockCap = (tiles) => (tiles <= STOCK_BIG.from ? tiles * STACK : Math.min(STOCK_BIG.max, Math.round(STOCK_BIG.from * STACK + (tiles - STOCK_BIG.from) * STOCK_BIG.perTile)))
export const stockRoom = (plan) => {
  const { cols, rows } = plan.stock
  return { cols, rows, cap: stockCap(cols * rows - 1), wallX: cols - 0.5, wallZ: rows - 0.5, door: { x: cols - 1, z: rows - 1 }, doorOut: { x: cols, z: rows - 1 } }
}
export const inStock = (plan, x, z) => { const r = stockRoom(plan); return x < r.wallX && z < r.wallZ }
export const stockStand = (plan) => stockRoom(plan).door

// ---------- canto visual: a ponta de uma fileira, a 90° dela, ganha a forma de canto convexo ----------
// Só o desenho muda: a prateleira continua a mesma (tipo, giro, preço e acesso). S fica na ponta de uma fileira (vizinha N1, com a frente virada
// para um lado) e está virada ao longo dela. Devolve o giro da peça (a frente principal é a de N1) e se ela é espelhada (N1 do lado +x local).
const plainShelf = (n) => !!n && n.kind === 'shelf' && (!n.variant || n.variant === 'wall') && !n.fridge && n.groupId == null && n.x >= 0
const rot4 = (n) => (((n.rot || 0) % 4) + 4) % 4
export function elbowOf(s, at) {
  if (!plainShelf(s)) return null
  const r = rot4(s), fs = DIRS[r]
  for (const dd of DIRS) {
    if (!(fs[0] === dd[0] && fs[1] === dd[1]) && !(fs[0] === -dd[0] && fs[1] === -dd[1])) continue // S precisa estar virada ao longo da fileira
    const n = at.get(s.x + dd[0] + ',' + (s.z + dd[1]))
    if (!plainShelf(n) || n.variant !== s.variant) continue
    const c = rot4(n), lx = LOCAL_X[c]
    if (!((lx[0] === dd[0] && lx[1] === dd[1]) || (lx[0] === -dd[0] && lx[1] === -dd[1]))) continue // S não está na linha da fileira de N1
    return { rot: c, mir: lx[0] === dd[0] && lx[1] === dd[1] }
  }
  return null
}

// ---------- móveis ----------
const LOCAL_X = [[1, 0], [0, -1], [-1, 0], [0, 1]]
export const shelfAccess = (s) => step(s, s.rot || 0)
export const shelfPoint = (s) => { const [dx, dz] = DIRS[(s.rot || 0) % 4]; return { x: s.x + dx * 0.3, z: s.z + dz * 0.3 } }

// expositor de hortifruti: ilha 2×2 com 4 lugares ou estante de parede 2×1 com 2 lugares, cada um com seu produto; (x, z) é o canto de menor x e z
// island = pirâmide 2×2 com 4 frentes (cada lugar olha para fora, em cata-vento); wall = estante de parede 2×1 com 2 lugares
const PRODUCE_BASE = {
  island: [
    { slot: 0, dx: 0, dz: 0, face: 2 }, { slot: 1, dx: 1, dz: 0, face: 1 },
    { slot: 2, dx: 1, dz: 1, face: 0 }, { slot: 3, dx: 0, dz: 1, face: 3 },
  ],
  wall: [{ slot: 0, dx: 0, dz: 0, face: 0 }, { slot: 1, dx: 1, dz: 0, face: 0 }], // 2×1, os dois olhando para a frente
}
// girar o expositor em 90° (rot + 1) leva o ponto (dx, dz) para (dz, 1 − dx), do mesmo jeito que gira para onde o móvel olha;
// depois o conjunto é encostado no canto de menor x e z, que é a âncora (x, z), em qualquer giro
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
// a prateleira encostada nas costas desta, virada para o lado oposto
export function backPartner(s, shelves) {
  const rot = s.rot || 0, [dx, dz] = DIRS[(rot + 2) % 4]
  return shelves.find((o) => o !== s && !o.fridge && o.x === s.x + dx && o.z === s.z + dz && (o.rot || 0) % 4 === (rot + 2) % 4)
}
export const isUsable = (d) => d.type === 'computer' || d.type === 'radio'
export const onFloor = (plan, x, z) => { const { cols, rows } = dims(plan); return x >= 0 && z >= 0 && x < cols && z < rows && !inStock(plan, x, z) }

// a fila sai da frente do caixa e segue para um lado, para o outro ou reto, o que couber
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
      seen.add(id); todo.push({ x, z })
    }
  }
  return seen
}

// null = layout válido; texto = motivo para recusar
export const isWallDecor = (d) => !!DECOR[d.type]?.wall
export function checkLayout(plan, { shelves, register, decor, cafe }) {
  // decoração de parede não ocupa o chão: só precisa estar na parede do fundo e num lugar livre
  const wall = decor.filter(isWallDecor), seen = new Set()
  decor = decor.filter((d) => !isWallDecor(d))
  for (const w of wall) {
    if (w.x < 0 || w.x >= plan.cols) return 'A parede não vai até aí'
    if (seen.has(w.x)) return 'Já tem outra decoração de parede aí'
    seen.add(w.x)
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

// fila do caixa considerando só o que já está bloqueado
export function queueTiles(plan, register, blocked) {
  const reach = flood(plan, blocked, doorInside(plan))
  return queueFor(register, queueSpot(plan, reach))
}

// Reacomoda o que ficou em lugar inválido (loja ampliada ou save antigo): cada item vai para a vaga válida mais próxima.
// Devolve os itens decorativos que não couberam em lugar nenhum.
export function settleLayout(plan, { shelves, register, decor, cafe }) {
  const cur = { register: null, cafe: null, shelves: [], decor: [] }
  const { cols, rows } = dims(plan)
  const single = (list) => list === 'register' || list === 'cafe'
  const fits = (list, c) => !checkLayout(plan, single(list) ? { ...cur, [list]: c } : { ...cur, [list]: [...cur[list], c] })
  // as prateleiras levam o tipo junto: o canto automático depende de reconhecer as vizinhas
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
// a maçã é produto inicial: a loja já começa com um expositor de hortifruti em ilha
export const defaultProduce = (plan) => ({ x: Math.floor(plan.cols / 2), z: 2, rot: 0, style: 'island' })
export const defaultFreezers = (plan) => [2, 3].map((z) => ({ x: dims(plan).cols - 1, z, rot: 3, fridge: true }))
// o jogo começa sem decoração: só o computador e o rádio, que são usados
export const defaultDecor = (plan) => usableDecor(plan)
export const usableDecor = (plan) => [
  { type: 'computer', x: dims(plan).cols - 2, z: 0, rot: 0 },
  { type: 'radio', x: 0, z: stockRoom(plan).rows, rot: 1 },
]

// posição 3D de cada caixa (dock na calçada, resto empilhado na sala do estoque)
export function boxSlots(boxes, plan) {
  const d = dims(plan), room = stockRoom(plan)
  const spots = []
  for (let z = 0; z < room.rows; z++) for (let x = 0; x < room.cols; x++) if (x !== room.door.x || z !== room.door.z) spots.push({ x, z })
  const out = new Map()
  let iDock = 0
  const inRoom = []
  for (const b of boxes) {
    if (b.at) out.set(b.id, { x: b.at.x, y: 0, z: b.at.z }) // solta no chão pelo jogador
    else if (b.state === 'dock') {
      const i = iDock++
      out.set(b.id, { x: d.doorX - 1.4 - (i % 4) * 0.75, y: Math.floor(i / 8) * 0.42, z: d.rows + 1.0 + (Math.floor(i / 4) % 2) * 0.75 })
    } else inRoom.push(b)
  }
  // estoque: cada coluna junta caixas do mesmo produto (pão com pão, tomate com tomate)
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
  // não cabe uma coluna por produto: junta as sobras (do mesmo produto, lado a lado) e, no limite, mistura
  if (cols.length > spots.length) {
    cols = [...full]
    const flat = rest.flat()
    for (let i = 0; i < flat.length; i += H) cols.push(flat.slice(i, i + H))
  }
  if (cols.length > spots.length) { cols = []; for (let i = 0; i < inRoom.length; i++) { (cols[i % spots.length] ||= []).push(inRoom[i]) } }
  cols.forEach((col, ci) => col.forEach((b, k) => out.set(b.id, { x: spots[ci].x, y: k * 0.42, z: spots[ci].z })))
  return out
}
