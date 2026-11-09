import { game, ui } from './state.js'
import { PID } from './config.js'

const shelfOf = (id) => game.shelves.find((s) => s.id === id)
const boxOf = (id) => game.boxes.find((b) => b.id === id)

export function hoverText(hit) {
  if (!hit || ui.modal) return null
  if (ui.placing) return hit.kind === 'slot' ? 'Posicionar prateleira aqui' : null
  if (hit.kind === 'box') {
    const b = boxOf(hit.id); if (!b) return null
    const p = PID[b.product]
    if (b.state === 'dock') return `Receber caixa de ${p.name} ${p.emoji}`
    if (b.state === 'stock') return `Desembalar ${p.name} ${p.emoji}`
    return `Pegar caixa aberta (${b.count} ${p.name})`
  }
  if (hit.kind === 'shelf') {
    const s = shelfOf(hit.id); if (!s) return null
    const b = boxOf(ui.selectedBox)
    return b ? `Repor com ${PID[b.product].name}` : s.product ? `Preço de ${PID[s.product].name}` : 'Prateleira vazia — configurar'
  }
  if (hit.kind === 'counter') return game.phase === 'open' || game.phase === 'closing' ? 'Atender no caixa' : 'Balcão'
  return null
}
