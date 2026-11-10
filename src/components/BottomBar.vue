<script setup>
import { computed } from 'vue'
import { PhArchive, PhArrowClockwise, PhArrowLineDown, PhChartBar, PhCheck, PhDoorOpen, PhMoonStars, PhPlus, PhSignOut, PhTrash, PhWrench } from '@phosphor-icons/vue'
import { game, ui, money, trashBox, storeBox, emptyCount } from '../game/state.js'
import { world } from '../game/world.js'
import { SHELF_PRICE, PID } from '../game/config.js'
import { rotateHeld, cancelHeld, stopEdit, buyShelf, canBuyShelf } from '../game/editor.js'

const needsOrderFirst = computed(() => Object.keys(ui.cart).length > 0)
const next = () => { if (needsOrderFirst.value) { ui.computerApp = 'products'; ui.modal = 'computer' } else world.startNextDay() }
const inHand = computed(() => game.boxes.find((b) => b.id === ui.selectedBox && (b.state === 'empty' || b.state === 'open')))
const filled = computed(() => inHand.value?.state === 'open')
// a última caixa vazia não sai: outra apareceria no lugar
const canTrash = computed(() => filled.value || emptyCount() > 1)
</script>

<template>
  <div v-if="!ui.build" class="bottom">
    <div v-if="ui.action" class="card prog">
      {{ ui.action.label }}…
      <div class="pb"><i :style="{ width: ui.action.p * 100 + '%' }" /></div>
    </div>
    <div v-if="ui.prompt && !ui.editing" class="prompt"><kbd>E</kbd> {{ ui.prompt }}</div>

    <div v-if="inHand && !ui.editing" class="card edit">
      <div class="status">
        <b>{{ filled ? `Caixa na mão: ${inHand.count} de ${PID[inHand.product].name}` : 'Caixa vazia na mão' }}</b>
        <span>{{ filled ? 'Clique numa prateleira para repor' : 'Clique numa prateleira para retirar itens' }}</span>
      </div>
      <div class="row">
        <button class="btn" @click="world.drop()"><PhArrowLineDown weight="bold" /> Soltar aqui <kbd>Q</kbd></button>
        <button class="btn good" @click="storeBox(inHand.id)"><PhArchive weight="bold" /> Guardar no estoque</button>
        <button v-if="canTrash" class="btn" @click="trashBox(inHand.id)"><PhTrash weight="bold" /> {{ filled ? `Jogar fora (perde ${inHand.count})` : 'Jogar fora' }}</button>
      </div>
    </div>

    <div v-if="ui.editing" class="card edit">
      <div class="status">
        <b><PhWrench weight="duotone" /> Layout da loja</b>
        <span v-if="!ui.held">Clique em um móvel para mudar de lugar</span>
        <span v-else-if="ui.held.why" class="bad-t">{{ ui.held.why }}</span>
        <span v-else>Clique no chão para posicionar</span>
      </div>
      <div class="row">
        <template v-if="ui.held">
          <button class="btn" @click="rotateHeld"><PhArrowClockwise weight="bold" /> Girar <kbd>R</kbd></button>
          <button class="btn" @click="cancelHeld">Cancelar</button>
        </template>
        <button v-else class="btn good" :disabled="!canBuyShelf()" @click="buyShelf"><PhPlus weight="bold" /> Prateleira · {{ money(SHELF_PRICE) }}</button>
        <button class="btn primary" @click="stopEdit"><PhCheck weight="bold" /> Concluir</button>
      </div>
    </div>

    <div v-else class="row">
      <button v-if="ui.atRegister" class="btn primary" @click="world.leaveRegister()"><PhSignOut weight="bold" /> Sair do caixa</button>
      <button v-if="game.phase === 'lunch' && !ui.modal" class="btn primary big" @click="world.endLunch()"><PhDoorOpen weight="fill" /> Reabrir a loja (13h)</button>
      <button v-if="game.phase === 'open'" class="btn" @click="world.closeEarly()">Fechar mais cedo</button>
      <button v-if="game.phase === 'night' && !ui.modal" class="btn primary big" @click="next"><PhMoonStars weight="fill" /> Próximo dia</button>
      <button v-if="game.phase === 'night' && !ui.modal" class="btn" @click="ui.modal = 'summary'"><PhChartBar weight="bold" /> Resumo</button>
    </div>
  </div>
</template>

<style scoped>
.bottom { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; z-index: 10; width: min(92vw, 560px); pointer-events: none; }
.bottom > * { pointer-events: auto; }
.prompt { background: var(--plum); color: var(--cream); padding: 8px 16px; border-radius: 14px; font-weight: 800; box-shadow: var(--shadow); pointer-events: none; }
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.big { font-size: 1.15em; padding: 12px 26px; }
.prog { min-width: 260px; font-weight: 700; }
.pb { height: 10px; background: #e6d6bd; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.pb i { display: block; height: 100%; background: var(--teal); }
.edit { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.status { display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 600; text-align: center; }
</style>
