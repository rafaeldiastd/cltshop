<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { PhArchive, PhCheckCircle, PhInfo, PhMoonStars, PhPackage, PhReceipt, PhSun, PhTag, PhTruck, PhWarning, PhWarningCircle } from '@phosphor-icons/vue'
import { game, ui, stockFull } from '../game/state.js'
import { onDuty } from '../game/team.js'
import { world } from '../game/world.js'
import { PID } from '../game/config.js'

const KIND_ICON = { good: PhCheckCircle, bad: PhWarningCircle, info: PhInfo }
const HINT_MS = 8000

// dica do próximo passo: aparece quando muda e some depois de um tempo, como as notificações
const hint = computed(() => {
  const b = game.boxes
  if (ui.editing) return null
  if (game.phase === 'prep') {
    if (b.some((x) => x.state === 'stock')) return { icon: PhPackage, text: 'Entre no estoque e clique nas caixas para DESEMBALAR' }
    if (b.some((x) => x.state === 'dock')) return stockFull() ? { icon: PhPackage, text: 'Estoque cheio! Desembale, reponha ou jogue fora caixas vazias' } : { icon: PhTruck, text: 'Chegou entrega! Clique nas caixas na calçada para RECEBER' }
    if (b.some((x) => x.state === 'open')) return { icon: PhArchive, text: 'Clique numa caixa aberta para pegá-la, depois numa prateleira para REPOR' }
    if (game.shelves.some((s) => s.product && s.price == null)) return { icon: PhTag, text: 'Clique numa prateleira para definir o PREÇO' }
    return { icon: PhSun, text: 'Tudo pronto! Vá até a porta para abrir a loja' }
  }
  if (game.phase === 'open' || game.phase === 'closing') {
    if (world.queue.length && !world.player.cashiering && !onDuty('cashier')) return { icon: PhReceipt, text: 'Tem gente na fila! Clique no caixa para atender' }
    const empty = game.shelves.find((s) => s.product && s.count === 0)
    if (empty) return { icon: PhWarning, text: `${PID[empty.product].name} acabou! Reponha com as caixas do estoque` }
    const unp = game.shelves.find((s) => s.product && s.price == null)
    if (unp) return { icon: PhTag, text: 'Tem prateleira sem preço — clientes ignoram' }
    return null
  }
  if (game.phase === 'lunch') return { icon: PhSun, text: 'Hora do almoço: ajuste os móveis, faça pedidos expressos e reabra pela porta' }
  return { icon: PhMoonStars, text: 'Faça os pedidos de amanhã no computador e vá dormir' }
})
const hintVisible = ref(false)
let timer = 0
watch(() => hint.value?.text, (text) => {
  clearTimeout(timer)
  hintVisible.value = !!text
  if (text) timer = setTimeout(() => (hintVisible.value = false), HINT_MS)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="stack">
    <TransitionGroup name="toast">
      <div v-if="hint && hintVisible" key="hint" class="hint"><component :is="hint.icon" weight="duotone" /> {{ hint.text }}</div>
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind" role="status">
        <component :is="KIND_ICON[t.kind] || PhInfo" weight="fill" /> <span>{{ t.msg }}<b v-if="t.count > 1"> ×{{ t.count }}</b></span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.stack { position: fixed; left: 12px; top: 72px; width: min(300px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 6px; z-index: 9; pointer-events: none; }
.hint, .toast { display: flex; gap: 8px; align-items: flex-start; border-radius: 12px; font-weight: 700; line-height: 1.3; box-shadow: var(--shadow); }
.hint svg, .toast svg { font-size: 18px; margin-top: 1px; }
.hint { background: var(--mustard); padding: 7px 12px; font-size: 13px; }
.toast { background: var(--plum); color: var(--cream); padding: 8px 12px; font-size: 14px; }
.toast.good { background: #3f7f63; } .toast.bad { background: #b24b43; }
.toast-enter-active, .toast-leave-active, .toast-move { transition: transform .25s ease, opacity .25s ease; }
.toast-enter-from, .toast-leave-to { transform: translateX(-16px); opacity: 0; }
.toast-leave-active { position: absolute; width: 100%; }
@media (max-width: 640px) { .stack { top: 116px; } }
</style>
