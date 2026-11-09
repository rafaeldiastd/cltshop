import { LEVELS } from './config.js'

export const dims = (lv) => {
  const L = LEVELS[lv]
  return { cols: L.cols, rows: L.rows, doorX: Math.floor(L.cols / 2) }
}
export const counterTiles = (lv) => { const d = dims(lv); return [{ x: d.doorX + 1, z: d.rows - 2 }, { x: d.doorX + 2, z: d.rows - 2 }] }
export const cashierTile = (lv) => { const d = dims(lv); return { x: d.doorX + 1, z: d.rows - 3 } }
export const queueTiles = (lv) => { const d = dims(lv); return [0, 1, 2, 3].map((i) => ({ x: d.doorX + 1 + i, z: d.rows - 1 })) }
export const doorTile = (lv) => { const d = dims(lv); return { x: d.doorX, z: d.rows } }
export const doorInside = (lv) => { const d = dims(lv); return { x: d.doorX, z: d.rows - 1 } }
export const shelfAccess = (s) => ({ x: s.x, z: s.z + 1 })
export const stockStand = { x: 2, z: 2 }

// posição 3D de cada caixa (dock na calçada, estoque no canto)
export function boxSlots(boxes, lv) {
  const d = dims(lv)
  const out = new Map()
  let iDock = 0, iRoom = 0
  for (const b of boxes) {
    if (b.state === 'dock') {
      const i = iDock++
      out.set(b.id, { x: d.doorX - 1.4 - (i % 4) * 0.75, y: Math.floor(i / 8) * 0.42, z: d.rows + 1.0 + (Math.floor(i / 4) % 2) * 0.75 })
    } else {
      const i = iRoom++
      out.set(b.id, { x: 0.1 + (i % 3) * 0.82, y: Math.floor(i / 9) * 0.42, z: 0.1 + (Math.floor(i / 3) % 3) * 0.82 })
    }
  }
  return out
}

// bancadas decorativas (freezers) na parede direita: bloqueiam a passagem
export const decorTiles = (lv) => {
  const d = dims(lv), out = []
  for (let z = 2; z <= d.rows - 4; z++) out.push({ x: d.cols - 1, z })
  out.push({ x: 0, z: d.rows - 3 })
  return out
}
