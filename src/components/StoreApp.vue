<script setup>
import { computed } from 'vue'
import { PhArrowsOut, PhCoffee, PhForkKnife, PhHammer, PhPackage, PhSnowflake, PhStack, PhStorefront, PhTrash, PhUsers, PhWrench, PhToolbox, PhKnife, PhPlant } from '@phosphor-icons/vue'
import { game, ui, money, upgradeType, canExpand, maxCustomers, restartGame, wages, isClosed, stockCount, stockCap, cafePrice, maxShelves, maxFreezers, maxMeat, maxProduce, shelfCount, freezerCount, meatCount, produceCount, emptyCount, trashEmpties, cafeMenu } from '../game/state.js'
import { onDuty, pendingRequests } from '../game/team.js'
import { world } from '../game/world.js'
import { buyShelf, canBuyShelf, buyFreezer, canBuyFreezer, buyMeatStand, canBuyMeatStand, buyProduceStand, canBuyProduceStand, buyCafe, canBuyCafe, startEdit } from '../game/editor.js'
import { startBuild, buildRate } from '../game/build.js'
import { planArea } from '../game/layout.js'
import { LEVELS, SHELF_PRICE, FREEZER_PRICE, PRODUCE_PRICE, MEAT_PRICE, CAFE, FREEZER } from '../game/config.js'

const next = () => LEVELS[game.level + 1]
const type = computed(() => LEVELS[game.level])
// freezers que pedem técnico: quebrados ou com o motor gasto, ainda sem chamado
const needService = computed(() => game.shelves.filter((s) => s.fridge && !s.call && (s.broken || (s.wear || 0) >= FREEZER.warn)))
const serviceTotal = computed(() => needService.value.reduce((n, s) => n + world.serviceCost(s), 0))
const freezerNote = computed(() => {
  const broken = game.shelves.filter((s) => s.fridge && s.broken).length
  const called = game.shelves.filter((s) => s.fridge && s.call).length
  const parts = []
  if (broken) parts.push(`${broken} quebrado${broken > 1 ? 's' : ''}`)
  if (needService.value.length - broken > 0) parts.push(`${needService.value.length - broken} pedindo revisão`)
  if (called) parts.push(`técnico chamado para ${called}`)
  return parts.join(' · ') || 'todos com o motor em dia'
})
const openTeam = () => { ui.computerApp = 'team' }
const cafeNote = computed(() => {
  if (game.level < CAFE.minLevel) return `Libera ao virar ${LEVELS[CAFE.minLevel].name}`
  if (game.cafe && !onDuty('barista')) return 'Contrate um atendente para abrir'
  const list = cafeMenu()
  if (!list.length) return 'Nenhuma receita descoberta ainda (compre ingredientes no atacado)'
  return `${list.map((m) => `${m.name} ${money(cafePrice(m.id))}`).join(' · ')}${game.cafe ? ' (clique no balcão para mudar os preços)' : ''}`
})
</script>

<template>
  <div class="app">
    <h2><PhStorefront weight="duotone" /> Minha loja</h2>
    <div class="scroll">
      <section>
        <div class="line">
          <PhArrowsOut class="ico" weight="duotone" />
          <div class="col"><b>{{ type.name }}</b><span class="muted">{{ game.plan.cols }}×{{ game.plan.rows }} · {{ planArea(game.plan) }} m² · até {{ maxCustomers() }} clientes ao mesmo tempo</span></div>
          <button v-if="next()" class="btn good" :disabled="game.money < next().cost || !canExpand()" @click="upgradeType">Virar {{ next().name }} · {{ money(next().cost) }}</button>
          <span v-else class="muted">nível máximo</span>
        </div>
        <div class="line">
          <PhHammer class="ico" weight="duotone" />
          <div class="col"><b>Construção</b><span class="muted">{{ money(buildRate(planArea(game.plan))) }}/m² · {{ type.name }} vai até {{ type.maxCols }}×{{ type.maxRows }}, com estoque até {{ type.stock.maxCols }}×{{ type.stock.maxRows }}</span></div>
          <button class="btn good" :disabled="!canExpand()" @click="startBuild">Construir</button>
        </div>
        <div class="line">
          <PhPackage class="ico" weight="duotone" />
          <div class="col"><b>Estoque: {{ stockCount() }}/{{ stockCap() }} caixas</b><span class="muted">{{ emptyCount() }} vazia(s) guardada(s)</span></div>
          <button class="btn" :disabled="emptyCount() <= 1" @click="trashEmpties"><PhTrash weight="bold" /> Jogar vazias fora</button>
        </div>
        <div class="line">
          <PhStack class="ico" weight="duotone" />
          <div class="col"><b>Prateleiras: {{ shelfCount() }}/{{ maxShelves() }}</b><span class="muted">{{ isClosed() ? 'escolha o lugar depois de comprar' : 'só com a loja fechada' }}</span></div>
          <button class="btn good" :disabled="!canBuyShelf()" @click="buyShelf">Comprar · {{ money(SHELF_PRICE) }}</button>
        </div>
        <div class="line">
          <PhSnowflake class="ico" weight="duotone" />
          <div class="col"><b>Freezers: {{ freezerCount() }}/{{ maxFreezers() }}</b><span class="muted">guardam os produtos gelados</span></div>
          <button class="btn good" :disabled="!canBuyFreezer()" @click="buyFreezer">Comprar · {{ money(FREEZER_PRICE) }}</button>
        </div>
        <div class="line">
          <PhPlant class="ico" weight="duotone" />
          <div class="col"><b>Banca de Hortifruti (Ilha Pirâmide 2×2): {{ produceCount() }}/{{ maxProduce() }}</b><span class="muted">ilha central mais alta no meio estilo pirâmide (4 produtos)</span></div>
          <button class="btn good" :disabled="!canBuyProduceStand()" @click="buyProduceStand('island')">Comprar · {{ money(PRODUCE_PRICE) }}</button>
        </div>
        <div class="line">
          <PhPlant class="ico" weight="duotone" />
          <div class="col"><b>Expositor de Hortifruti (Parede 2×2): {{ produceCount() }}/{{ maxProduce() }}</b><span class="muted">estante alta de parede (2 em cima e 2 embaixo)</span></div>
          <button class="btn good" :disabled="!canBuyProduceStand()" @click="buyProduceStand('wall')">Comprar · {{ money(PRODUCE_PRICE) }}</button>
        </div>
        <div class="line">
          <PhKnife class="ico" weight="duotone" />
          <div class="col"><b>Freezers verticais de carnes: {{ meatCount() }}/{{ maxMeat() }}</b><span class="muted">armário refrigerado alto com porta de vidro para carnes</span></div>
          <button class="btn good" :disabled="!canBuyMeatStand()" @click="buyMeatStand">Comprar · {{ money(MEAT_PRICE) }}</button>
        </div>
        <div class="line">
          <PhToolbox class="ico" weight="duotone" />
          <div class="col"><b>Manutenção dos freezers</b><span class="muted">{{ freezerNote }}</span></div>
          <button class="btn good" :disabled="!needService.length" @click="world.callTechAll()">Chamar técnico{{ needService.length ? ` · ${money(serviceTotal)}` : '' }}</button>
        </div>
        <div class="line">
          <PhForkKnife class="ico" weight="duotone" />
          <div class="col"><b>Pausa para almoço</b><span class="muted">Fecha às 12h e volta às 13h. Dá para mudar móveis e pedir com entrega expressa, mas clientes encontram a porta fechada.</span></div>
          <button class="btn" :class="{ good: game.lunchOn }" :aria-pressed="game.lunchOn" @click="game.lunchOn = !game.lunchOn">{{ game.lunchOn ? 'Ligada' : 'Desligada' }}</button>
        </div>
        <div class="line">
          <PhCoffee class="ico" weight="duotone" />
          <div class="col"><b>Cafeteria</b><span class="muted">{{ cafeNote }}</span></div>
          <button v-if="!game.cafe" class="btn good" :disabled="!canBuyCafe()" @click="buyCafe">Instalar · {{ money(CAFE.price) }}</button>
          <span v-else class="muted">instalada</span>
        </div>
        <div class="line">
          <PhWrench class="ico" weight="duotone" />
          <div class="col"><b>Layout</b><span class="muted">{{ isClosed() ? 'mude móveis, caixa, computador e rádio de lugar' : 'só com a loja fechada' }}</span></div>
          <button class="btn" :disabled="!isClosed()" @click="startEdit">Mudar layout</button>
        </div>
      </section>

      <h3><PhUsers weight="duotone" /> Equipe</h3>
      <section>
        <div class="line">
          <PhUsers class="ico" weight="duotone" />
          <div class="col"><b>{{ game.team.length }} {{ game.team.length === 1 ? 'pessoa' : 'pessoas' }} · {{ money(wages()) }}/dia</b><span class="muted">{{ pendingRequests().length ? `${pendingRequests().length} pedido(s) esperando resposta` : 'contrate pelo catálogo de candidatos' }}</span></div>
          <button class="btn good" @click="openTeam">Abrir equipe</button>
        </div>
      </section>
    </div>
    <footer><button class="btn sm" @click="restartGame">Novo jogo</button></footer>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 14px 0 6px; font-size: 1em; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
section { display: flex; flex-direction: column; gap: 6px; }
.line { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 12px; padding: 8px 12px; }
.ico { font-size: 26px; color: var(--plum2); }
.col { flex: 1; display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
footer { display: flex; justify-content: flex-end; }
</style>
