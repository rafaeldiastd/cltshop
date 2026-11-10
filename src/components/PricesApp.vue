<script setup>
import { computed } from 'vue'
import { PhTag, PhCoffee, PhSnowflake, PhArrowCounterClockwise } from '@phosphor-icons/vue'
import PriceStepper from './PriceStepper.vue'
import { game, money, costOf, refOf, productPrice, setPrice, stockInfo, costChange, cafeMenu, cafePrice, cafeCost, cafeRef, cafeCostChange, setCafePrice } from '../game/state.js'
import { PRODUCTS } from '../game/config.js'
import { productThumb } from '../game/assets.js'

const SECTIONS = [['produce', 'Hortifruti'], ['bakery', 'Padaria'], ['grocery', 'Mercearia'], ['meat', 'Carnes'], ['drink', 'Bebidas']]
const groups = computed(() => SECTIONS.map(([id, name]) => ({ id, name, items: PRODUCTS.filter((p) => p.section === id && game.unlocked[p.id]) })).filter((g) => g.items.length))
const menu = computed(() => (game.cafe ? cafeMenu() : []))
const margin = (pid) => (productPrice(pid) == null ? null : productPrice(pid) - costOf(pid))
const pct = (pid) => (productPrice(pid) == null ? null : Math.round((productPrice(pid) / costOf(pid) - 1) * 100))

// ações em lote: cada uma vale para todos os produtos liberados (e o cardápio da cafeteria, se houver)
const allProducts = () => PRODUCTS.filter((p) => game.unlocked[p.id])
const toMarket = () => { for (const p of allProducts()) setPrice(p.id, refOf(p.id)); for (const m of menu.value) setCafePrice(m.id, cafeRef(m.id)) }
const markup = (k) => { for (const p of allProducts()) setPrice(p.id, (productPrice(p.id) ?? refOf(p.id)) * k); for (const m of menu.value) setCafePrice(m.id, cafePrice(m.id) * k) }
const fillMissing = () => { for (const p of allProducts()) if (productPrice(p.id) == null) setPrice(p.id, refOf(p.id)) }
const missing = computed(() => allProducts().filter((p) => productPrice(p.id) == null).length)
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhTag weight="duotone" /> Preços</h2>
        <p class="muted">O preço vale para todas as prateleiras do produto. Compare com o custo e com o preço de mercado do dia.</p>
      </div>
      <div class="bulk">
        <button v-if="missing" class="btn sm primary" @click="fillMissing">Definir {{ missing }} sem preço</button>
        <button class="btn sm" @click="toMarket"><PhArrowCounterClockwise weight="bold" /> Tudo no preço de mercado</button>
        <button class="btn sm" title="Diminuir todos os preços em 5%" @click="markup(0.95)">−5% em tudo</button>
        <button class="btn sm" title="Aumentar todos os preços em 5%" @click="markup(1.05)">+5% em tudo</button>
      </div>
    </div>

    <div class="scroll">
      <p v-if="game.market.text" class="news">{{ game.market.text }}</p>
      <template v-for="g in groups" :key="g.id">
        <h3>{{ g.name }}</h3>
        <article v-for="p in g.items" :key="p.id" class="row">
          <img :src="productThumb(p.id)" alt="" />
          <div class="name">
            <b>{{ p.name }} <PhSnowflake v-if="p.cold" class="cold" weight="bold" /></b>
            <span class="muted small">{{ stockInfo(p.id).shelves }} na prateleira · {{ stockInfo(p.id).boxes }} em caixas</span>
          </div>
          <div class="facts">
            <span>Custo <b>{{ money(costOf(p.id)) }}</b> <b v-if="costChange(p.id)" :class="costChange(p.id) > 0 ? 'bad-t' : 'good-t'">{{ costChange(p.id) > 0 ? '+' : '' }}{{ costChange(p.id) }}%</b></span>
            <button class="mkt" title="Usar o preço de mercado" @click="setPrice(p.id, refOf(p.id))">Mercado <b>{{ money(refOf(p.id)) }}</b></button>
          </div>
          <PriceStepper :pid="p.id" fast class="step" />
          <div class="mar" :class="margin(p.id) == null ? '' : margin(p.id) >= 0 ? 'good-t' : 'bad-t'">
            <template v-if="margin(p.id) != null"><b>{{ money(margin(p.id)) }}</b><span class="small">{{ pct(p.id) > 0 ? '+' : '' }}{{ pct(p.id) }}%</span></template>
            <span v-else class="muted">—</span>
          </div>
        </article>
      </template>

      <template v-if="menu.length">
        <h3><PhCoffee weight="duotone" /> Cafeteria</h3>
        <article v-for="m in menu" :key="m.id" class="row">
          <span class="ico"><PhCoffee weight="duotone" /></span>
          <div class="name"><b>{{ m.name }}</b><span class="muted small">{{ m.desc }}</span></div>
          <div class="facts">
            <span>Custo <b>{{ money(cafeCost(m.id)) }}</b> <b v-if="cafeCostChange(m.id)" :class="cafeCostChange(m.id) > 0 ? 'bad-t' : 'good-t'">{{ cafeCostChange(m.id) > 0 ? '+' : '' }}{{ cafeCostChange(m.id) }}%</b></span>
            <button class="mkt" @click="setCafePrice(m.id, cafeRef(m.id))">Mercado <b>{{ money(cafeRef(m.id)) }}</b></button>
          </div>
          <PriceStepper :cafe="m.id" fast class="step" />
          <div class="mar" :class="cafePrice(m.id) - cafeCost(m.id) >= 0 ? 'good-t' : 'bad-t'"><b>{{ money(cafePrice(m.id) - cafeCost(m.id)) }}</b></div>
        </article>
      </template>
      <p v-if="!groups.length" class="muted">Nenhum produto liberado ainda.</p>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 12px 0 6px; font-size: 1em; display: flex; align-items: center; gap: 6px; }
p { margin: 2px 0; }
.bulk { display: flex; gap: 6px; flex-wrap: wrap; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 5px; }
.news { background: var(--mustard); border-radius: 10px; padding: 5px 12px; font-size: 13px; font-weight: 700; }
.row { display: grid; grid-template-columns: 40px minmax(120px, 1fr) 140px minmax(240px, 300px) 86px; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 6px 10px; font-size: 14px; }
.row img { width: 38px; height: 38px; }
.ico { font-size: 30px; color: var(--plum2); display: grid; place-items: center; }
.name { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.small { font-size: 12px; }
.cold { color: #4d8fc4; }
.facts { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.mkt { background: none; text-align: left; padding: 0; font: inherit; color: inherit; text-decoration: underline dotted; cursor: pointer; }
.mkt:hover { color: var(--teal); }
.mar { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .row { grid-template-columns: 40px 1fr auto; } .facts, .step { grid-column: 2 / -1; } .mar { grid-column: 3; grid-row: 1; } }
</style>
