<script setup>
import { computed } from 'vue'
import { PhArrowDownLeft, PhArrowDownRight, PhArrowUpLeft, PhArrowUpRight, PhCheck, PhHammer, PhMinus, PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import { game, ui, money } from '../game/state.js'
import { nudge, canGrow, canShrink, gain, quote, confirmBuild, stopBuild, limitNote, setStockCorner, nudgeDoor } from '../game/build.js'

const q = computed(() => quote())
const note = computed(() => (ui.build ? limitNote() : null))
// direções como aparecem na tela, com a câmera na diagonal
const ICON = { w: PhArrowUpLeft, e: PhArrowDownRight, n: PhArrowUpRight, s: PhArrowDownLeft, stockCols: PhArrowDownRight, stockRows: PhArrowDownLeft }
const NAME = { w: 'parede esquerda', e: 'parede direita', n: 'parede do fundo', s: 'parede da frente', stockCols: 'largura do estoque', stockRows: 'fundo do estoque' }
const isStock = (wall) => wall.startsWith('stock')
const CORNERS = [
  { id: 'nw', label: '↖ Fundo Esq' },
  { id: 'ne', label: '↗ Fundo Dir' },
  { id: 'sw', label: '↙ Frente Esq' },
  { id: 'se', label: '↘ Frente Dir' },
]
</script>

<template>
  <template v-if="ui.build && q">
    <div v-for="a in ui.buildArrows" :key="a.wall" class="wall" :style="{ left: a.x + 'px', top: a.y + 'px' }">
      <button v-if="canShrink(a.wall)" class="btn sm" :aria-label="`Recuar ${NAME[a.wall]}`" :title="`Recuar ${NAME[a.wall]}`" @click="nudge(a.wall, -1)"><PhMinus weight="bold" /></button>
      <button class="btn sm" :class="isStock(a.wall) ? 'stock' : 'good'" :disabled="!canGrow(a.wall)" :aria-label="`Avançar ${NAME[a.wall]}`" :title="canGrow(a.wall) ? `Avançar ${NAME[a.wall]}` : 'Limite deste tipo de comércio'" @click="nudge(a.wall, 1)">
        <component :is="ICON[a.wall]" weight="bold" /> +{{ gain(a.wall) }} m²
      </button>
    </div>

    <div class="card panel">
      <div class="status">
        <b><PhHammer weight="duotone" /> {{ q.initial ? 'Construir Loja & Estoque (Dia 1)' : 'Modo construção' }} <span class="muted">{{ money(q.rate) }}/m²</span></b>
        <span v-if="q.why" class="bad-t">{{ q.why }}</span>
        <span v-else-if="q.changed && game.money < q.total" class="bad-t">Caixa insuficiente</span>
        <span v-else-if="q.moved">{{ q.moved === 1 ? '1 móvel vai mudar de lugar' : `${q.moved} móveis vão mudar de lugar` }}</span>
        <span v-else-if="note">{{ note }}</span>
        <span v-else class="muted">Mín: loja 6×5 · estoque 2×2 (≥6 m²) · salão livre ≥20 m²</span>
      </div>

      <div class="corner-row">
        <span class="muted">Estoque:</span>
        <button
          v-for="c in CORNERS"
          :key="c.id"
          class="btn sm"
          :class="{ primary: ui.build.corner === c.id }"
          @click="setStockCorner(c.id)"
        >
          {{ c.label }}
        </button>
        <span class="muted door-sep">Porta:</span>
        <button class="btn sm" :disabled="q.plan.doorX <= 1" title="Mover porta para a esquerda" @click="nudgeDoor(-1)"><PhCaretLeft weight="bold" /></button>
        <b>{{ q.plan.doorX + 1 }}/{{ q.plan.cols }}</b>
        <button class="btn sm" :disabled="q.plan.doorX >= q.plan.cols - 2" title="Mover porta para a direita" @click="nudgeDoor(1)"><PhCaretRight weight="bold" /></button>
      </div>

      <div class="facts">
        <span>Loja <b>{{ q.plan.cols }}×{{ q.plan.rows }}</b> ({{ q.area1 }} m²)</span>
        <span>Estoque <b>{{ q.plan.stock.cols }}×{{ q.plan.stock.rows }}</b> ({{ q.cap1 }} caixas)</span>
        <span>Clientes/dia <b>{{ q.customers1 }}</b></span>
      </div>
      <div class="row">
        <button class="btn" @click="stopBuild">Cancelar</button>
        <button class="btn primary" :disabled="!q.changed || !!q.why || game.money < q.total" @click="confirmBuild"><PhCheck weight="bold" /> {{ q.total > 0 ? `Construir · ${money(q.total)}` : 'Aplicar reforma (Grátis)' }}</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.wall { position: fixed; z-index: 9; display: flex; gap: 4px; transform: translate(-50%, -50%); white-space: nowrap; }
.stock { background: var(--mustard); }
.panel { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 10; width: min(94vw, 640px); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.status { display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 600; text-align: center; }
.corner-row { display: flex; align-items: center; justify-content: center; gap: 5px; flex-wrap: wrap; font-size: 12px; }
.door-sep { margin-left: 6px; }
.facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; font-size: 13px; }
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
</style>
