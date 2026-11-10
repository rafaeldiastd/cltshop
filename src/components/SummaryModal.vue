<script setup>
import { computed } from 'vue'
import { PhMoonStars, PhNewspaper, PhPackage, PhStar } from '@phosphor-icons/vue'
import Modal from './Modal.vue'
import { game, ui, money } from '../game/state.js'
import { MOODS, WEATHER } from '../game/config.js'
import { productThumb } from '../game/assets.js'
const s = computed(() => game.summary)
const rows = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1])
const lostUnits = computed(() => rows(s.value.oos))
const orders = () => { ui.computerApp = 'products'; ui.modal = 'computer' }
</script>
<template>
  <Modal :title="`Fim do dia ${s.day}`" :icon="PhMoonStars">
    <div class="grid">
      <div>Vendas</div><b>{{ money(s.revenue) }}</b>
      <template v-if="s.cafeSales"><div class="muted">Da cafeteria ({{ s.cafeSales }} pedidos)</div><span>{{ money(s.cafeRevenue) }}</span></template>
      <div class="muted">Custo dos produtos vendidos</div><span>− {{ money(s.cogs) }}</span>
      <div class="muted">Salários</div><span>− {{ money(s.wages) }}</span>
      <template v-if="s.stolen"><div class="muted">Roubos ({{ s.stolenUnits }} itens)</div><span class="bad-t">− {{ money(s.stolen) }}</span></template>
      <div><b>Lucro do dia</b></div><b :class="s.profit >= 0 ? 'good-t' : 'bad-t'">{{ money(s.profit) }}</b>
      <div class="muted">Caixa agora</div><span>{{ money(game.money) }}</span>
    </div>
    <p class="muted">{{ s.served }} clientes atendidos de {{ s.customers }} · {{ s.units }} itens vendidos · reputação {{ s.rep.toFixed(1) }} <PhStar weight="fill" /></p>
    <p v-if="s.lunchMissed" class="bad-t caught">{{ s.lunchMissed === 1 ? '1 cliente encontrou' : `${s.lunchMissed} clientes encontraram` }} a loja fechada no almoço</p>
    <p v-if="s.caught" class="good-t caught">{{ s.caught === 1 ? '1 roubo evitado' : `${s.caught} roubos evitados` }}</p>
    <div class="news"><PhNewspaper weight="duotone" /> <span>{{ game.market.text || 'Sem novidades no mercado' }}. Amanhã: {{ WEATHER[game.weather].name.toLowerCase() }}.</span></div>
    <h3>Mais vendidos</h3>
    <div class="chips"><span v-for="[id, n] in rows(s.sold)" :key="id" class="chip"><img :src="productThumb(id)" alt="" /> {{ n }}</span><span v-if="!rows(s.sold).length" class="muted">nada hoje…</span></div>
    <template v-if="rows(s.moods).length">
      <h3>Como os clientes se sentiram</h3>
      <div class="chips"><span v-for="[id, n] in rows(s.moods)" :key="id" class="chip" :title="MOODS[id].text">{{ MOODS[id].emoji }} {{ n }}</span></div>
    </template>
    <template v-if="lostUnits.length || rows(s.price).length || s.patience">
      <h3>Vendas perdidas ({{ money(s.lostValue) }})</h3>
      <div class="chips">
        <span v-for="[id, n] in lostUnits" :key="'o' + id" class="chip bad"><img :src="productThumb(id)" alt="" /> faltou ×{{ n }}</span>
        <span v-for="[id, n] in rows(s.price)" :key="'p' + id" class="chip"><img :src="productThumb(id)" alt="" /> caro ×{{ n }}</span>
        <span v-if="s.patience" class="chip">😤 {{ s.patience }} desistiram da fila</span>
      </div>
    </template>
    <template #foot>
      <button class="btn primary" @click="orders"><PhPackage weight="fill" /> Fazer pedidos de amanhã</button>
    </template>
  </Modal>
</template>
<style scoped>
.grid { display: grid; grid-template-columns: 1fr auto; gap: 6px 18px; font-size: 1.05em; }
.grid > :nth-child(even) { text-align: right; }
h3 { margin: 14px 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 4px; background: var(--cream2); padding: 3px 10px; border-radius: 99px; font-weight: 700; }
.chip img { width: 22px; height: 22px; }
.chip.bad { background: #f4c3bd; }
.caught { margin: 0 0 8px; font-weight: 700; }
.news { display: flex; gap: 8px; align-items: center; background: var(--mustard); border-radius: 10px; padding: 7px 12px; font-weight: 700; font-size: 14px; }
</style>
