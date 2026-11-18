<script setup>
import { computed } from 'vue'
import { PhArchive, PhArrowClockwise, PhArrowLineDown, PhChartBar, PhDoorOpen, PhMoonStars, PhSignOut, PhTrash, PhWrench, PhCoins, PhX, PhHammer, PhBoxArrowDown } from '@phosphor-icons/vue'
import { game, ui, money, trashBox, storeBox, emptyCount, isClosed } from '../game/state.js'
import { world } from '../game/world.js'
import { PID } from '../game/config.js'
import { sellInfo, sellHeld, rotateHeld, toggleProduceStyle, deselectTool, heldShelf, SHELF_TYPES, startEdit, storeHeld, canStoreHeld } from '../game/editor.js'
import { keyInfo } from '../game/inventory.js'
const shelfInHand = computed(() => heldShelf())
const sell = computed(() => sellInfo())
const canStore = computed(() => canStoreHeld())
const invName = computed(() => (ui.invTool ? keyInfo(ui.invTool).name : null))

const needsOrderFirst = computed(() => Object.keys(ui.cart).length > 0)
const next = () => { if (needsOrderFirst.value) { ui.computerApp = 'products'; ui.modal = 'computer' } else world.startNextDay() }
const inHand = computed(() => game.boxes.find((b) => b.id === ui.selectedBox && (b.state === 'empty' || b.state === 'open')))
const filled = computed(() => inHand.value?.state === 'open')
// a última caixa vazia não sai: outra apareceria no lugar
const canTrash = computed(() => filled.value || emptyCount() > 1)
</script>

<template>
  <div v-if="!ui.build" class="bottom" :class="{ editing: ui.editing }">
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

    <div v-if="ui.editing && (ui.held || ui.buyTool)" class="card edit">
      <div class="status">
        <span v-if="ui.held?.why" class="bad-t">{{ ui.held.why }}</span>
        <span v-else-if="ui.held?.fromInv">{{ invName }} do inventário: clique no chão para colocar (de graça)</span>
        <span v-else-if="ui.buyTool">Clique no chão para comprar e posicionar. O móvel continua na mão: desmarque para parar</span>
        <span v-else-if="sell?.full">Posicione, guarde no inventário ou esvazie o móvel para poder vendê-lo</span>
        <span v-else-if="ui.held">Clique no chão para posicionar</span>
      </div>
      <div class="row">
        <template v-if="ui.held">
          <button v-if="shelfInHand" class="btn" @click="toggleProduceStyle">
            Tipo: {{ SHELF_TYPES[shelfInHand.variant || 'std'].name }} <kbd>M</kbd>
          </button>
          <button v-if="ui.held.kind === 'produceGroup' && ui.held.isNew && !ui.held.fromInv" class="btn" @click="toggleProduceStyle">
            Formato: {{ ui.held.style === 'wall' ? 'Parede 2×1' : 'Ilha 2×2' }} <kbd>M</kbd>
          </button>
          <button class="btn" @click="rotateHeld"><PhArrowClockwise weight="bold" /> Girar <kbd>R</kbd></button>
          <button v-if="canStore" class="btn good" title="Tira da loja e guarda; volta depois sem pagar" @click="storeHeld"><PhBoxArrowDown weight="bold" /> Guardar <kbd>I</kbd></button>
          <button v-if="sell" class="btn" :disabled="sell.full" :title="sell.full ? 'Esvazie antes de vender' : ''" @click="sellHeld"><PhCoins weight="bold" /> Vender · {{ money(sell.price) }} <kbd>Del</kbd></button>
        </template>
        <button class="btn" @click="deselectTool"><PhX weight="bold" /> {{ ui.buyTool || ui.invTool ? 'Desmarcar' : 'Cancelar' }} <kbd>Esc</kbd></button>
      </div>
    </div>

    <div v-else-if="ui.editing" />

    <div v-else class="row">
      <button v-if="game.plan.built === false && !ui.modal" class="btn primary big" @click="startEdit('build')"><PhWrench weight="bold" /> Construir Loja &amp; Estoque</button>
      <button v-if="game.plan.built !== false && isClosed() && !ui.modal && !ui.atRegister" class="btn" title="Móveis, decoração, inventário e construção" @click="startEdit()"><PhHammer weight="bold" /> Editar loja</button>
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
/* com o menu lateral do modo de edição aberto, a barra centraliza no espaço que sobra */
.bottom.editing { left: calc(352px + (100vw - 352px) / 2); width: min(calc(100vw - 376px), 560px); }
@media (max-width: 720px) { .bottom.editing { left: 50%; width: calc(100vw - 16px); bottom: calc(46vh + 16px); } }
.prompt { background: var(--plum); color: var(--cream); padding: 8px 16px; border-radius: 14px; font-weight: 800; box-shadow: var(--shadow); pointer-events: none; }
.row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.big { font-size: 1.15em; padding: 12px 26px; }
.prog { min-width: 260px; font-weight: 700; }
.pb { height: 10px; background: #e6d6bd; border-radius: 99px; overflow: hidden; margin-top: 6px; }
.pb i { display: block; height: 100%; background: var(--teal); }
.edit { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.status { display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 600; text-align: center; }
</style>
