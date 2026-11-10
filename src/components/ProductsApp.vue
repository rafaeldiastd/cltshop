<script setup>
import { computed } from 'vue'
import { PhLockKey, PhMinus, PhMoonStars, PhNewspaper, PhPlus, PhShoppingCart, PhSnowflake, PhTruck, PhHandshake, PhTrendUp, PhTrendDown, PhPackage } from '@phosphor-icons/vue'
import { game, ui, money, boxCost, cartAdd, cartTotal, placeOrder, passLevelOf, passClaimable, claimPass, stockInfo, costOf, costChange, isExpress, orderFee, stockCount, stockCap, stockFree, dockCount, pendingBoxes, cartBoxes, contractTier, nextContract, boxSizes, boxDiscount, cartKey, forecastChange, rumorDays } from '../game/state.js'
import { world } from '../game/world.js'
import { productThumb } from '../game/assets.js'
import { PRODUCTS, PACK, CONTRACTS, RUMOR } from '../game/config.js'

const open = computed(() => PRODUCTS.filter((p) => game.unlocked[p.id]))
// fornecedores novos vêm do passe, na ordem dos níveis
const locked = computed(() => PRODUCTS.filter((p) => !game.unlocked[p.id] && passLevelOf(p.id)).sort((a, b) => passLevelOf(a.id) - passLevelOf(b.id)))
const total = computed(() => cartTotal() + orderFee())
const missed = (id) => game.summary?.oos?.[id] || 0
const sold = (id) => game.summary?.sold?.[id] || 0
const sleep = () => { if (placeOrder()) world.startNextDay() }
</script>

<template>
  <div class="app">
    <div class="top-row">
      <h2><PhShoppingCart weight="duotone" /> Compras & Atacado</h2>
      <div class="stock-badge" :class="{ 'stock-alert': stockFree() <= 3 }">
        <PhPackage weight="bold" />
        <span>Estoque: <b>{{ stockCount() + dockCount() + pendingBoxes() + cartBoxes() }} / {{ stockCap() }}</b> caixas</span>
        <span class="stock-free">({{ Math.max(0, stockFree() - cartBoxes()) }} livres)</span>
      </div>
    </div>

    <div class="news-stack">
      <div v-if="game.market.text" class="news">
        <PhNewspaper weight="duotone" />
        <span><b>Hoje no Mercado:</b> {{ game.market.text }}</span>
      </div>
      <div v-if="game.forecast && game.forecast.text" class="forecast-box">
        <PhTrendUp weight="bold" class="trend-ico" />
        <span><b>Boato · {{ Math.round(RUMOR.chance * 100) }}% de chance {{ rumorDays() <= 1 ? 'amanhã' : `em ${rumorDays()} dias` }}:</b> {{ game.forecast.text }}</span>
      </div>
    </div>

    <div class="scroll">
      <div class="prod head">
        <span /><span>Produto & Contrato</span><span>Estoque & Mercado</span><span class="r">Pedir caixas</span>
      </div>
      <article v-for="p in open" :key="p.id" class="prod">
        <img :src="productThumb(p.id)" alt="" />
        <div class="col">
          <div class="p-title">
            <b>{{ p.name }} <PhSnowflake v-if="p.cold" class="cold" weight="bold" /></b>
            <span v-if="contractTier(p.id) >= 0" class="badge-contract">
              <PhHandshake weight="fill" /> {{ CONTRACTS[contractTier(p.id)].name }}
            </span>
          </div>
          <span class="muted">
            custo unitário {{ money(costOf(p.id)) }}
            <b v-if="costChange(p.id)" :class="costChange(p.id) > 0 ? 'bad-t' : 'good-t'">
              {{ costChange(p.id) > 0 ? '+' : '' }}{{ costChange(p.id) }}%
            </b>
            <span v-if="forecastChange(p.id)" class="fore-tag" :class="forecastChange(p.id) > 0 ? 'fore-up' : 'fore-down'">
              Boato: {{ forecastChange(p.id) > 0 ? 'pode subir +' : 'pode cair ' }}{{ forecastChange(p.id) }}%
            </span>
          </span>
          <span v-if="nextContract(p.id)" class="micro-text">
            Compre mais {{ nextContract(p.id).at - (game.bought[p.id] || 0) }} un para virar {{ nextContract(p.id).name }}
          </span>
        </div>

        <div class="col">
          <span><b>{{ stockInfo(p.id).shelves }}</b> na prateleira · <b>{{ stockInfo(p.id).boxes }}</b> em caixas</span>
          <span v-if="stockInfo(p.id).incoming" class="good-t small"><PhTruck weight="fill" /> +{{ stockInfo(p.id).incoming }} a caminho</span>
          <span v-else-if="missed(p.id)" class="bad-t small">faltou {{ missed(p.id) }} no último dia</span>
          <span v-else-if="sold(p.id)" class="muted small">vendeu {{ sold(p.id) }} no último dia</span>
        </div>

        <div class="order-col">
          <div v-for="size in boxSizes(p.id)" :key="size" class="order-tier">
            <span class="size-lbl">
              Cx {{ size }} un
              <b v-if="boxDiscount(p.id, size)" class="disc-tag">-{{ Math.round(boxDiscount(p.id, size) * 100) }}%</b>
            </span>
            <div class="order-controls">
              <button class="btn sm" :aria-label="`Menos caixas`" @click="cartAdd(p.id, -1, size)"><PhMinus weight="bold" /></button>
              <b>{{ ui.cart[cartKey(p.id, size)] || 0 }}</b>
              <button class="btn sm" :aria-label="`Mais caixas`" @click="cartAdd(p.id, 1, size)"><PhPlus weight="bold" /></button>
            </div>
            <span class="muted small">{{ money(boxCost(p.id, size)) }}</span>
          </div>
        </div>
      </article>

      <template v-if="locked.length">
        <h3>Novos fornecedores <span class="muted small">liberados pelo passe, com experiência</span></h3>
        <div class="suppliers">
          <button v-for="p in locked" :key="p.id" class="sup" :class="{ ready: passClaimable(passLevelOf(p.id)) }" :disabled="!passClaimable(passLevelOf(p.id))" @click="claimPass(passLevelOf(p.id))">
            <img :src="productThumb(p.id)" alt="" />
            <span class="col"><b>{{ p.name }} <PhSnowflake v-if="p.cold" class="cold" weight="bold" /></b><span class="small"><PhLockKey weight="fill" /> {{ passClaimable(passLevelOf(p.id)) ? 'Resgatar agora' : `Nível ${passLevelOf(p.id)} do passe` }}</span></span>
          </button>
        </div>
      </template>
    </div>

    <footer>
      <span class="muted">{{ isExpress() ? `Entrega expressa: chega agora na calçada com taxa de 30%. Limite de caixas baseado na sala de estoque.` : `Chega na calçada amanhã cedo. Limite de caixas baseado no espaço da sala do estoque.` }}</span>
      <span class="sum"><span v-if="orderFee()" class="muted">Taxa {{ money(orderFee()) }} · </span>Total <b :class="total > game.money ? 'bad-t' : ''">{{ money(total) }}</b></span>
      <button class="btn" :disabled="!total" @click="placeOrder">Emitir pedido</button>
      <button v-if="game.phase === 'night'" class="btn primary" @click="sleep"><PhMoonStars weight="fill" /> Confirmar e dormir</button>
    </footer>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.top-row { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 12px 0 6px; font-size: 1em; }
.stock-badge { background: #fff; border: 2px solid var(--teal); padding: 5px 12px; border-radius: 10px; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.stock-alert { border-color: var(--coral); background: #fff2f0; }
.stock-free { opacity: 0.7; font-size: 11px; }

.news-stack { display: flex; flex-direction: column; gap: 4px; }
.news { display: flex; gap: 8px; align-items: center; background: var(--mustard); border-radius: 10px; padding: 5px 12px; font-size: 13px; font-weight: 700; }
.forecast-box { display: flex; gap: 8px; align-items: center; background: #e0f2fe; color: #0284c7; border-radius: 10px; padding: 5px 12px; font-size: 13px; font-weight: 700; }
.trend-ico { font-size: 18px; }

.cold { color: #4d8fc4; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
.prod { display: grid; grid-template-columns: 44px minmax(180px, 1.2fr) minmax(180px, 1fr) 210px; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 8px 10px; font-size: 14px; }
.prod.head { background: none; padding: 0 10px; font-size: 11px; font-weight: 800; text-transform: uppercase; opacity: .55; }
.prod img { width: 44px; height: 44px; }
.col { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.p-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.badge-contract { background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 99px; display: inline-flex; align-items: center; gap: 3px; }
.fore-tag { font-size: 11px; font-weight: 800; padding: 1px 4px; border-radius: 4px; margin-left: 6px; }
.fore-up { background: #fee2e2; color: #b91c1c; }
.fore-down { background: #dcfce7; color: #15803d; }
.micro-text { font-size: 11px; opacity: 0.7; }
.small { font-size: 12px; }
.r { text-align: right; }

.order-col { display: flex; flex-direction: column; gap: 4px; }
.order-tier { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.size-lbl { font-size: 11px; font-weight: 700; min-width: 65px; display: flex; align-items: center; gap: 2px; }
.disc-tag { color: #16a34a; font-size: 10px; }
.order-controls { display: flex; align-items: center; gap: 4px; }
.order-controls b { min-width: 18px; text-align: center; font-variant-numeric: tabular-nums; }
.order-tier .small { min-width: 56px; text-align: right; }

.suppliers { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.sup { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 12px; padding: 6px 10px; text-align: left; }
.sup img { width: 36px; height: 36px; }
.sup:disabled { opacity: .5; cursor: not-allowed; } .sup.ready { box-shadow: inset 0 0 0 2px var(--mustard); } .sup:not(:disabled):hover { box-shadow: inset 0 0 0 2px var(--teal); }
footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
footer .muted { flex: 1; min-width: 160px; }
.sum b { font-size: 1.15em; font-variant-numeric: tabular-nums; }
@media (max-width: 760px) {
  .prod { grid-template-columns: 44px 1fr auto; }
  .prod.head, .prod > .col:nth-of-type(2) { display: none; }
}
</style>
