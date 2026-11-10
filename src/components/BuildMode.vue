<script setup>
import { computed } from 'vue'
import { PhArrowDownLeft, PhArrowDownRight, PhArrowUpLeft, PhArrowUpRight, PhCheck, PhHammer, PhMinus } from '@phosphor-icons/vue'
import { game, ui, money } from '../game/state.js'
import { nudge, canGrow, gain, quote, confirmBuild, stopBuild, limitNote } from '../game/build.js'

const q = computed(() => quote())
const note = computed(() => (ui.build ? limitNote() : null))
// direções como aparecem na tela, com a câmera na diagonal
const ICON = { w: PhArrowUpLeft, e: PhArrowDownRight, n: PhArrowUpRight, s: PhArrowDownLeft, stockCols: PhArrowDownRight, stockRows: PhArrowDownLeft }
const NAME = { w: 'parede esquerda', e: 'parede direita', n: 'parede do fundo', s: 'parede da frente', stockCols: 'largura do estoque', stockRows: 'fundo do estoque' }
const isStock = (wall) => wall.startsWith('stock')
</script>

<template>
  <template v-if="ui.build && q">
    <div v-for="a in ui.buildArrows" :key="a.wall" class="wall" :style="{ left: a.x + 'px', top: a.y + 'px' }">
      <button v-if="ui.build[a.wall]" class="btn sm" :aria-label="`Recuar ${NAME[a.wall]}`" :title="`Recuar ${NAME[a.wall]}`" @click="nudge(a.wall, -1)"><PhMinus weight="bold" /></button>
      <button class="btn sm" :class="isStock(a.wall) ? 'stock' : 'good'" :disabled="!canGrow(a.wall)" :aria-label="`Avançar ${NAME[a.wall]}`" :title="canGrow(a.wall) ? `Avançar ${NAME[a.wall]}` : 'Limite deste tipo de comércio'" @click="nudge(a.wall, 1)">
        <component :is="ICON[a.wall]" weight="bold" /> +{{ gain(a.wall) }} m²
      </button>
    </div>

    <div class="card panel">
      <div class="status">
        <b><PhHammer weight="duotone" /> Modo construção <span class="muted">{{ money(q.rate) }}/m²</span></b>
        <span v-if="q.why" class="bad-t">{{ q.why }}</span>
        <span v-else-if="q.changed && game.money < q.total" class="bad-t">Caixa insuficiente</span>
        <span v-else-if="q.moved">{{ q.moved === 1 ? '1 móvel vai mudar de lugar' : `${q.moved} móveis vão mudar de lugar` }}</span>
        <span v-else-if="note">{{ note }}</span>
        <span v-else>Use os botões nas paredes para escolher a nova área</span>
      </div>
      <div class="facts">
        <span>Área <b>{{ q.area0 }}</b><template v-if="q.m2"> → <b class="good-t">{{ q.area1 }}</b></template> m²</span>
        <span>Estoque <b>{{ q.cap0 }}</b><template v-if="q.cap1 !== q.cap0"> → <b class="good-t">{{ q.cap1 }}</b></template> caixas</span>
        <span>Clientes/dia <b>{{ q.customers0 }}</b><template v-if="q.customers1 !== q.customers0"> → <b class="good-t">{{ q.customers1 }}</b></template></span>
      </div>
      <div class="row">
        <button class="btn" @click="stopBuild">Cancelar</button>
        <button class="btn primary" :disabled="!q.changed || !!q.why || game.money < q.total" @click="confirmBuild"><PhCheck weight="bold" /> Construir · {{ money(q.total) }}</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.wall { position: fixed; z-index: 9; display: flex; gap: 4px; transform: translate(-50%, -50%); white-space: nowrap; }
.stock { background: var(--mustard); }
.panel { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 10; width: min(92vw, 560px); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.status { display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 600; text-align: center; }
.facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; font-size: 13px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
</style>
