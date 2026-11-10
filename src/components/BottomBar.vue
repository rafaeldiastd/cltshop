<script setup>
import { computed } from 'vue'
import { PhArchive, PhArrowClockwise, PhArrowLineDown, PhChartBar, PhCheck, PhDoorOpen, PhMoonStars, PhSignOut, PhTrash, PhWrench, PhStack, PhCoins, PhCarrot, PhSnowflake, PhCow, PhX } from '@phosphor-icons/vue'
import { game, ui, money, trashBox, storeBox, emptyCount, shelfCount, produceCount, freezerCount, meatCount, maxShelves, maxProduce, maxFreezers, maxMeat } from '../game/state.js'
import { world } from '../game/world.js'
import { PID } from '../game/config.js'
import { sellInfo, sellHeld, rotateHeld, stopEdit, toggleProduceStyle, TOOLS, selectTool, deselectTool, heldShelf, shelfPriceOf, SHELF_TYPES, PRODUCE_TYPES, setShelfType, setProduceStyle } from '../game/editor.js'
import { buildThumb } from '../game/thumbs.js'
const shelfInHand = computed(() => heldShelf())
const sell = computed(() => sellInfo())
// tipo atual: o do móvel na mão ou o que vale para o próximo
const shelfType = computed(() => (shelfInHand.value ? shelfInHand.value.variant || 'std' : ui.shelfType))
const produceStyle = computed(() => (ui.held?.kind === 'produceGroup' && ui.held.isNew ? ui.held.style : ui.produceStyle))
const THUMB = { shelf: () => 'shelf:' + shelfType.value, produce: () => 'produce:' + produceStyle.value, fridge: () => 'fridge', meat: () => 'meat' }
// lista de tipos do móvel escolhido, estilo catálogo: miniatura, nome e preço
const typeList = computed(() => {
  if (ui.buyTool === 'shelf') return Object.entries(SHELF_TYPES).map(([id, t]) => ({ id, name: t.name, price: t.price, desc: t.desc, thumb: buildThumb('shelf:' + id), on: shelfType.value === id, pick: () => setShelfType(id) }))
  if (ui.buyTool === 'produce') return Object.entries(PRODUCE_TYPES).map(([id, t]) => ({ id, name: t.name, price: t.price, desc: t.desc, thumb: buildThumb('produce:' + id), on: produceStyle.value === id, pick: () => setProduceStyle(id) }))
  return null
})

// móveis à venda no modo layout; limite = quanto o tipo de comércio permite
const TOOL_LIST = computed(() => [
  { id: 'shelf', icon: PhStack, count: shelfCount(), max: maxShelves() },
  { id: 'produce', icon: PhCarrot, count: produceCount(), max: maxProduce() },
  { id: 'fridge', icon: PhSnowflake, count: freezerCount(), max: maxFreezers() },
  { id: 'meat', icon: PhCow, count: meatCount(), max: maxMeat() },
].map((t) => ({ ...t, ...TOOLS[t.id], thumb: buildThumb(THUMB[t.id]()), price: t.id === 'shelf' ? shelfPriceOf() : TOOLS[t.id].price, on: ui.buyTool === t.id, ok: TOOLS[t.id].can() || ui.buyTool === t.id })))

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
        <span v-if="ui.held?.why" class="bad-t">{{ ui.held.why }}</span>
        <span v-else-if="ui.buyTool">Clique no chão para comprar e posicionar. O móvel continua ativo: desmarque para parar</span>
        <span v-else-if="sell?.full">Posicione, ou esvazie o móvel (tire os produtos) para poder vendê-lo</span>
        <span v-else-if="ui.held">Clique no chão para posicionar{{ sell ? ' ou venda por metade do preço' : '' }}</span>
        <span v-else>Clique em um móvel para mudar de lugar, <kbd>R</kbd> gira o móvel sob o mouse, ou escolha um para comprar</span>
      </div>
      <div v-if="typeList" class="types" role="listbox" aria-label="Tipos">
        <button v-for="t in typeList" :key="t.id" class="type" :class="{ on: t.on }" role="option" :aria-selected="t.on" @click="t.pick">
          <img v-if="t.thumb" :src="t.thumb" alt="" />
          <span class="tn"><b>{{ t.name }}</b><span class="muted">{{ t.desc }}</span></span>
          <span class="tp">{{ money(t.price) }}</span>
        </button>
      </div>
      <div class="tools" role="toolbar" aria-label="Comprar móveis">
        <button v-for="t in TOOL_LIST" :key="t.id" class="tool" :class="{ on: t.on }" :disabled="!t.ok" :aria-pressed="t.on" @click="selectTool(t.id)">
          <img v-if="t.thumb" :src="t.thumb" class="tth" alt="" />
          <component :is="t.icon" v-else weight="duotone" class="ti" />
          <b>{{ t.name }}</b>
          <span class="muted">{{ money(t.price) }} · {{ t.count }}/{{ t.max }}</span>
        </button>
      </div>
      <div class="row">
        <template v-if="ui.held">
          <button v-if="shelfInHand" class="btn" @click="toggleProduceStyle">
            Tipo: {{ SHELF_TYPES[shelfInHand.variant || 'std'].name }} <kbd>M</kbd>
          </button>
          <button v-if="ui.held.kind === 'produceGroup' && ui.held.isNew" class="btn" @click="toggleProduceStyle">
            Formato: {{ ui.held.style === 'wall' ? 'Parede 2×1' : 'Ilha 2×2' }} <kbd>M</kbd>
          </button>
          <button class="btn" @click="rotateHeld"><PhArrowClockwise weight="bold" /> Girar <kbd>R</kbd> <span class="muted">(⇧ inverte)</span></button>
          <button v-if="sell" class="btn" :disabled="sell.full" :title="sell.full ? 'Esvazie antes de vender' : ''" @click="sellHeld"><PhCoins weight="bold" /> Vender · {{ money(sell.price) }} <kbd>Del</kbd></button>
          <button class="btn" @click="deselectTool"><PhX weight="bold" /> {{ ui.buyTool ? 'Desmarcar' : 'Cancelar' }} <kbd>Esc</kbd></button>
        </template>
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
.tools { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.tool { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 112px; padding: 6px 10px; border-radius: 12px; background: #fff; border: 2px solid var(--cream2); font-size: 13px; line-height: 1.25; }
.tool .ti { font-size: 24px; color: var(--plum2); }
.tool .tth { width: 52px; height: 52px; object-fit: contain; }
.types { display: flex; flex-direction: column; gap: 3px; width: min(340px, 100%); padding: 5px; border-radius: 14px; background: rgba(255, 255, 255, .6); }
.type { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 2px; border-radius: 10px; background: #fff; border: 2px solid transparent; text-align: left; }
.type img { width: 38px; height: 38px; object-fit: contain; flex: none; background: var(--cream2); border-radius: 8px; }
.type .tn { flex: 1; display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.type .tn .muted { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.type .tp { font-weight: 800; font-size: 13px; font-variant-numeric: tabular-nums; }
.type:hover { border-color: var(--teal); }
.type.on { background: var(--teal); border-color: var(--plum); color: #fff; }
.type.on .muted { color: #fff; opacity: .85; }
.type.on img { background: rgba(255, 255, 255, .25); }
.tool .muted { font-size: 11px; }
.tool:hover:not(:disabled) { border-color: var(--teal); }
.tool.on { background: var(--teal); border-color: var(--plum); color: #fff; }
.tool.on .ti, .tool.on .muted { color: #fff; }
.tool:disabled { opacity: .45; cursor: not-allowed; }
.status { display: flex; flex-direction: column; align-items: center; font-size: 14px; font-weight: 600; text-align: center; }
</style>
