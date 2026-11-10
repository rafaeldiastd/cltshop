<script setup>
import { computed } from 'vue'
import { PhLockKey, PhMinus, PhMoonStars, PhNewspaper, PhPlus, PhShoppingCart, PhSnowflake, PhTruck } from '@phosphor-icons/vue'
import { game, ui, money, boxCost, cartAdd, cartTotal, placeOrder, unlockProduct, stockInfo, costOf, costChange, isExpress, orderFee } from '../game/state.js'
import { world } from '../game/world.js'
import { productThumb } from '../game/assets.js'
import { PRODUCTS, PACK } from '../game/config.js'

const open = computed(() => PRODUCTS.filter((p) => game.unlocked[p.id]))
const locked = computed(() => PRODUCTS.filter((p) => !game.unlocked[p.id]))
const total = computed(() => cartTotal() + orderFee())
const missed = (id) => game.summary?.oos?.[id] || 0
const sold = (id) => game.summary?.sold?.[id] || 0
const sleep = () => { if (placeOrder()) world.startNextDay() }
</script>

<template>
  <div class="app">
    <h2><PhShoppingCart weight="duotone" /> Compras</h2>
    <div v-if="game.market.text" class="news"><PhNewspaper weight="duotone" /> {{ game.market.text }}</div>

    <div class="scroll">
      <div class="prod head">
        <span /><span>Produto</span><span>Estoque</span><span class="r">Pedir caixas</span>
      </div>
      <article v-for="p in open" :key="p.id" class="prod">
        <img :src="productThumb(p.id)" alt="" />
        <div class="col">
          <b>{{ p.name }} <PhSnowflake v-if="p.cold" class="cold" weight="bold" /></b>
          <span class="muted">custo {{ money(costOf(p.id)) }} por unidade <b v-if="costChange(p.id)" :class="costChange(p.id) > 0 ? 'bad-t' : 'good-t'">{{ costChange(p.id) > 0 ? '+' : '' }}{{ costChange(p.id) }}%</b></span>
        </div>
        <div class="col">
          <span><b>{{ stockInfo(p.id).shelves }}</b> na prateleira · <b>{{ stockInfo(p.id).boxes }}</b> em caixas</span>
          <span v-if="stockInfo(p.id).incoming" class="good-t small"><PhTruck weight="fill" /> +{{ stockInfo(p.id).incoming }} a caminho</span>
          <span v-else-if="missed(p.id)" class="bad-t small">faltou {{ missed(p.id) }} no último dia</span>
          <span v-else-if="sold(p.id)" class="muted small">vendeu {{ sold(p.id) }} no último dia</span>
        </div>
        <div class="order">
          <button class="btn sm" :aria-label="`Menos caixas de ${p.name}`" @click="cartAdd(p.id, -1)"><PhMinus weight="bold" /></button>
          <b>{{ ui.cart[p.id] || 0 }}</b>
          <button class="btn sm" :aria-label="`Mais caixas de ${p.name}`" @click="cartAdd(p.id, 1)"><PhPlus weight="bold" /></button>
          <span class="muted small">{{ money(boxCost(p.id)) }}</span>
        </div>
      </article>

      <template v-if="locked.length">
        <h3>Novos fornecedores</h3>
        <div class="suppliers">
          <button v-for="p in locked" :key="p.id" class="sup" :disabled="game.money < p.unlock" @click="unlockProduct(p.id)">
            <img :src="productThumb(p.id)" alt="" />
            <span class="col"><b>{{ p.name }} <PhSnowflake v-if="p.cold" class="cold" weight="bold" /></b><span class="small"><PhLockKey weight="fill" /> {{ money(p.unlock) }}</span></span>
          </button>
        </div>
      </template>
    </div>

    <footer>
      <span class="muted">{{ isExpress() ? `Entrega expressa: cada caixa traz ${PACK} unidades e chega agora na calçada, com taxa de 30%.` : `Cada caixa traz ${PACK} unidades e chega na calçada amanhã cedo.` }}</span>
      <span class="sum"><span v-if="orderFee()" class="muted">Taxa {{ money(orderFee()) }} · </span>Total <b :class="total > game.money ? 'bad-t' : ''">{{ money(total) }}</b></span>
      <button class="btn" :disabled="!total" @click="placeOrder">Emitir pedido</button>
      <button v-if="game.phase === 'night'" class="btn primary" @click="sleep"><PhMoonStars weight="fill" /> Confirmar e dormir</button>
    </footer>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 14px 0 6px; font-size: 1em; }
.news { display: flex; gap: 8px; align-items: center; background: var(--mustard); border-radius: 10px; padding: 6px 12px; font-size: 14px; font-weight: 700; }
.cold { color: #4d8fc4; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
.prod { display: grid; grid-template-columns: 44px minmax(150px, 1fr) minmax(220px, 1.5fr) 158px; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 6px 10px; font-size: 14px; }
.prod.head { background: none; padding: 0 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; opacity: .55; }
.prod img { width: 44px; height: 44px; }
.col { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.small { font-size: 12px; }
.r { text-align: right; }
.order { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.order b { min-width: 20px; text-align: center; font-variant-numeric: tabular-nums; }
.order .small { min-width: 58px; text-align: right; }
.suppliers { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.sup { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 12px; padding: 6px 10px; text-align: left; }
.sup img { width: 36px; height: 36px; }
.sup:disabled { opacity: .5; cursor: not-allowed; } .sup:not(:disabled):hover { box-shadow: inset 0 0 0 2px var(--teal); }
footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
footer .muted { flex: 1; min-width: 160px; }
.sum b { font-size: 1.15em; font-variant-numeric: tabular-nums; }
@media (max-width: 760px) {
  .prod { grid-template-columns: 44px 1fr auto; }
  .prod.head, .prod > .col:nth-of-type(2) { display: none; }
}
</style>
