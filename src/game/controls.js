import { game, ui, placeShelf } from './state.js'
import { world } from './world.js'
import { PID } from './config.js'
import { startMusic } from './audio.js'

const shelfOf = (id) => game.shelves.find((s) => s.id === id)
const boxOf = (id) => game.boxes.find((b) => b.id === id)

export function onClick(hit) {
  startMusic()
  if (ui.modal || !hit) return
  if (ui.placing) {
    if (hit.kind === 'slot') placeShelf(hit.slot)
    return
  }
  if (hit.kind === 'box') { const b = boxOf(hit.id); b && world.cmdBox(b) }
  else if (hit.kind === 'shelf') { const s = shelfOf(hit.id); s && world.cmdShelf(s) }
  else if (hit.kind === 'counter') world.cmdServe()
  else if (hit.kind === 'floor') { ui.panelShelf = null; world.cmdMove(hit.x, hit.z) }
}

export { hoverText } from './texts.js'
