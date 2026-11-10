import { game, ui } from './state.js'
import { PID, DECOR } from './config.js'

const shelfOf = (id) => game.shelves.find((s) => s.id === id)
const boxOf = (id) => game.boxes.find((b) => b.id === id)
const shelfLabel = (s) => s.kind === 'meat' ? 'freezer de carnes' : s.kind === 'produce' ? 'banca de hortifruti' : s.fridge ? 'freezer' : 'prateleira'

export function hoverText(hit) {
  if (!hit || ui.modal) return null
  if (ui.editing) {
    if (ui.held) return ui.held.why || null
    if (hit.kind === 'shelf') {
      const s = shelfOf(hit.id)
      return s ? `Mover ${shelfLabel(s)}` : 'Mover móvel'
    }
    if (hit.kind === 'counter') return 'Mover caixa'
    if (hit.kind === 'cafe') return 'Mover cafeteria'
    if (hit.kind === 'decor') { const d = game.decor.find((x) => x.id === hit.id); return d ? `Mover ${DECOR[d.type].name}` : null }
    return null
  }
  if (hit.kind === 'box') {
    const b = boxOf(hit.id); if (!b) return null
    if (b.state === 'empty') return 'Pegar caixa vazia'
    const p = PID[b.product]
    if (b.state === 'dock') return `Receber caixa de ${p.name}`
    if (b.state === 'stock') return `Desembalar ${p.name}`
    return `Pegar caixa aberta (${b.count} ${p.name})`
  }
  if (hit.kind === 'dirt') return 'Limpar sujeira'
  if (hit.kind === 'shelf') {
    const s = shelfOf(hit.id); if (!s) return null
    const name = shelfLabel(s)
    if (s.broken && !ui.selectedBox) return s.call ? 'Motor quebrado: técnico chamado' : 'Motor quebrado: chamar técnico'
    const b = boxOf(ui.selectedBox)
    if (b?.state === 'empty') return s.count ? `Retirar ${PID[s.product].name} para a caixa` : `${name} sem itens`
    return b ? `Repor com ${PID[b.product].name}` : s.product ? `Preço de ${PID[s.product].name}` : `${name} vazia — configurar`
  }
  if (hit.kind === 'counter') return game.phase === 'open' || game.phase === 'closing' ? 'Atender no caixa' : 'Mudar layout da loja'
  if (hit.kind === 'pet') return 'Interagir com o pet'
  if (hit.kind === 'cafe') return 'Preços da cafeteria'
  if (hit.kind === 'door') return game.phase === 'prep' ? 'Abrir a loja' : game.phase === 'lunch' ? 'Reabrir a loja (13h)' : game.phase === 'open' ? 'Loja aberta' : 'Loja fechada'
  if (hit.kind === 'decor') {
    const d = game.decor.find((x) => x.id === hit.id)
    return d?.type === 'computer' ? 'Usar o computador' : d?.type === 'radio' ? 'Mexer no rádio' : null
  }
  return null
}
