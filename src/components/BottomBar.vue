<script setup>
import { computed } from 'vue'
import { game, ui } from '../game/state.js'
import { world } from '../game/world.js'
import { PID } from '../game/config.js'

const hint = computed(() => {
  const b = game.boxes
  if (ui.placing) return 'Clique no espaço verde para posicionar a prateleira (Esc cancela)'
  if (game.phase === 'prep') {
    if (b.some((x) => x.state === 'dock')) return '🚚 Chegou entrega! Clique nas caixas na calçada para RECEBER'
    if (b.some((x) => x.state === 'stock')) return '📦 Clique nas caixas do estoque para DESEMBALAR'
    if (b.some((x) => x.state === 'open')) return '🗃️ Clique numa caixa aberta para pegá-la, depois numa prateleira para REPOR'
    if (game.shelves.some((s) => s.product && s.price == null)) return '🏷️ Clique numa prateleira para definir o PREÇO'
    return '☀️ Tudo pronto! Quando quiser, abra a loja.'
  }
  if (game.phase === 'open' || game.phase === 'closing') {
    if (world.queue.length && !world.player.cashiering && !game.staff.cashier) return '🧾 Tem gente na fila! Clique no balcão para atender'
    const empty = game.shelves.find((s) => s.product && s.count === 0)
    if (empty) return `⚠️ ${PID[empty.product].name} acabou! Reponha com as caixas do estoque`
    const unp = game.shelves.find((s) => s.product && s.price == null)
    if (unp) return '🏷️ Tem prateleira sem preço — clientes ignoram'
    return ''
  }
  return '🌙 Faça os pedidos de amanhã e vá dormir'
})
const needsOrderFirst = computed(() => Object.keys(ui.cart).length > 0)
const next = () => { if (needsOrderFirst.value) { ui.modal = 'orders' } else world.startNextDay() }
</script>

<template>
  <div class="bottom">
    <div v-if="ui.action" class="card prog">
      {{ ui.action.label }}…
      <div class="pb"><i :style="{ width: ui.action.p * 100 + '%' }" /></div>
    </div>
    <div v-if="hint" class="card hint">{{ hint }}</div>
    <div class="row">
      <button v-if="ui.placing" class="btn" @click="ui.placing = false">Cancelar</button>
      <button v-if="game.phase === 'prep'" class="btn primary big" @click="world.openShop()">☀️ Abrir a loja</button>
      <button v-if="game.phase === 'open'" class="btn" @click="world.closeEarly()">Fechar mais cedo</button>
      <button v-if="game.phase === 'night' && !ui.modal" class="btn primary big" @click="next">🌙 Próximo dia</button>
      <button v-if="game.phase === 'night' && !ui.modal" class="btn" @click="ui.modal = 'summary'">📊 Resumo</button>
    </div>
  </div>
  <div class="toasts">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.msg }}</div>
  </div>
</template>

<style scoped>
.bottom { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 10; width: min(92vw, 720px); }
.hint { font-weight: 700; text-align: center; }
.row { display: flex; gap: 10px; }
.big { font-size: 1.15em; padding: 12px 26px; }
.prog { min-width: 260px; font-weight: 700; }
.pb { height: 10px; background: #e6d6bd; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.pb i { display: block; height: 100%; background: var(--teal); }
.toasts { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; z-index: 40; pointer-events: none; }
.toast { background: var(--plum); color: var(--cream); padding: 8px 16px; border-radius: 12px; font-weight: 700; box-shadow: var(--shadow); animation: pop .25s ease-out; }
.toast.good { background: #3f7f63; } .toast.bad { background: #b24b43; }
@keyframes pop { from { transform: translateY(-8px) scale(.95); opacity: 0 } }
</style>
