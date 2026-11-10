import { game, ui } from './state.js'
import { world } from './world.js'
import { startMusic } from './audio.js'
import { pickUp, moveHeld, dropHeld, startEdit } from './editor.js'

const shelfOf = (id) => game.shelves.find((s) => s.id === id)
const boxOf = (id) => game.boxes.find((b) => b.id === id)

export function onClick(hit) {
  startMusic()
  if (ui.modal || !hit) return
  if (ui.editing) {
    if (ui.held) { if (hit.kind === 'floor') { moveHeld(hit.x, hit.z); dropHeld() } }
    else if (hit.kind === 'shelf' || hit.kind === 'counter' || hit.kind === 'decor' || hit.kind === 'cafe') pickUp(hit.kind, hit.id)
    return
  }
  if (hit.kind === 'box') { const b = boxOf(hit.id); b && world.cmdBox(b) }
  else if (hit.kind === 'shelf') { const s = shelfOf(hit.id); s && world.cmdShelf(s) }
  else if (hit.kind === 'counter') { if (game.phase === 'open' || game.phase === 'closing') world.cmdServe(); else startEdit() }
  else if (hit.kind === 'door') world.cmdDoor()
  else if (hit.kind === 'pet') world.openPetMenu()
  else if (hit.kind === 'dirt') world.cmdClean(game.dirt.find((d) => d.id === hit.id))
  else if (hit.kind === 'cafe') world.openCafePanel()
  else if (hit.kind === 'decor') { const d = game.decor.find((x) => x.id === hit.id); d && world.cmdUse(d) }
  else if (hit.kind === 'floor') { ui.panelShelf = null; ui.panelCafe = false; world.cmdMove(hit.x, hit.z) }
}

export { hoverText } from './texts.js'
