<script setup>
import { computed } from 'vue'
import { PhArrowsOut, PhCoffee, PhForkKnife, PhHammer, PhMinus, PhPackage, PhPlus, PhReceipt, PhSnowflake, PhStack, PhStorefront, PhTrash, PhUsers, PhWrench } from '@phosphor-icons/vue'
import { game, money, upgradeType, canExpand, maxCustomers, hire, fire, restartGame, wages, isClosed, stockCount, stockCap, cafePrice, maxShelves, maxFreezers, shelfCount, freezerCount, emptyCount, trashEmpties } from '../game/state.js'
import { buyShelf, canBuyShelf, buyFreezer, canBuyFreezer, buyCafe, canBuyCafe, startEdit } from '../game/editor.js'
import { startBuild, buildRate } from '../game/build.js'
import { planArea } from '../game/layout.js'
import { LEVELS, SHELF_PRICE, FREEZER_PRICE, STAFF, CAFE, CAFE_MENU } from '../game/config.js'

const STAFF_ICON = { cashier: PhReceipt, stocker: PhPackage, barista: PhCoffee }
const next = () => LEVELS[game.level + 1]
const type = computed(() => LEVELS[game.level])
const team = computed(() => Object.entries(STAFF).filter(([role]) => role !== 'barista' || game.cafe))
const cafeNote = computed(() => {
  if (game.level < CAFE.minLevel) return `Libera ao virar ${LEVELS[CAFE.minLevel].name}`
  if (game.cafe && !game.staff.barista) return 'Contrate um atendente para abrir'
  return `${CAFE_MENU.map((m) => `${m.name} ${money(cafePrice(m.id))}`).join(' · ')}${game.cafe ? ' (clique no balcão para mudar os preços)' : ''}`
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

      <h3><PhUsers weight="duotone" /> Equipe <span class="muted">salários/dia: {{ money(wages()) }}</span></h3>
      <section>
        <div v-for="[role, s] in team" :key="role" class="line">
          <component :is="STAFF_ICON[role]" class="ico" weight="duotone" />
          <div class="col"><b>{{ s.name }} × {{ game.staff[role] }}</b><span class="muted">{{ s.desc }} {{ money(s.wage) }}/dia</span></div>
          <div class="btns">
            <button class="btn sm" :disabled="!game.staff[role]" :aria-label="`Demitir ${s.name}`" @click="fire(role)"><PhMinus weight="bold" /></button>
            <button class="btn good" :disabled="game.staff[role] >= s.max || game.money < s.hire" @click="hire(role)"><PhPlus weight="bold" /> Contratar · {{ money(s.hire) }}</button>
          </div>
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
.btns { display: flex; gap: 6px; }
footer { display: flex; justify-content: flex-end; }
</style>
