<script setup>
import { computed } from 'vue'
import { game, ui, money } from '../game/state.js'
import { PRODUCTS, PID, SHELF_CAP } from '../game/config.js'

const shelf = computed(() => game.shelves.find((s) => s.id === ui.panelShelf))
const p = computed(() => shelf.value?.product && PID[shelf.value.product])
const step = (d) => {
  const s = shelf.value
  const base = s.price ?? p.value.ref
  s.price = Math.max(0.1, Math.round((base + d) * 100) / 100)
  game.priceMemory[s.product] = s.price
}
const suggest = () => { shelf.value.price = p.value.ref; game.priceMemory[shelf.value.product] = p.value.ref }
const applyAll = () => { for (const s of game.shelves) if (s.product === shelf.value.product) s.price = shelf.value.price }
const assign = (e) => {
  const s = shelf.value
  s.product = e.target.value || null
  s.price = s.product ? game.priceMemory[s.product] ?? null : null
}
const verdict = computed(() => {
  const r = shelf.value?.price / p.value.ref
  if (shelf.value?.price == null) return { t: 'Sem preço — ninguém compra', c: 'bad-t' }
  if (r < 0.9) return { t: 'Barato: vende bem, margem baixa', c: 'good-t' }
  if (r < 1.15) return { t: 'Preço justo', c: '' }
  return { t: 'Caro: vende menos', c: 'bad-t' }
})
</script>

<template>
  <div v-if="shelf" class="card panel">
    <div class="head"><b>Prateleira</b><button class="btn sm" @click="ui.panelShelf = null">✕</button></div>
    <template v-if="shelf.count === 0">
      <label class="muted">Produto desta prateleira</label>
      <select :value="shelf.product || ''" @change="assign">
        <option value="">— vazia —</option>
        <option v-for="x in PRODUCTS.filter((x) => game.unlocked[x.id])" :key="x.id" :value="x.id">{{ x.emoji }} {{ x.name }}</option>
      </select>
    </template>
    <template v-if="p">
      <div class="big">{{ p.emoji }} {{ p.name }} <span class="muted">{{ shelf.count }}/{{ SHELF_CAP }}</span></div>
      <div class="muted">Custo {{ money(p.cost) }} · mercado ~{{ money(p.ref) }}</div>
      <div class="price">
        <button class="btn sm" @click="step(-0.5)">−.50</button>
        <button class="btn sm" @click="step(-0.1)">−.10</button>
        <b>{{ shelf.price == null ? '—' : money(shelf.price) }}</b>
        <button class="btn sm" @click="step(0.1)">+.10</button>
        <button class="btn sm" @click="step(0.5)">+.50</button>
      </div>
      <div :class="verdict.c">{{ verdict.t }}</div>
      <div v-if="shelf.price != null" class="muted">Margem: {{ money(shelf.price - p.cost) }} / un.</div>
      <div class="row">
        <button class="btn sm" @click="suggest">Preço de mercado</button>
        <button class="btn sm" :disabled="shelf.price == null" @click="applyAll">Aplicar a todas</button>
      </div>
    </template>
    <div v-else class="muted">Escolha um produto ou reponha com uma caixa.</div>
  </div>
</template>

<style scoped>
.panel { position: fixed; right: 12px; top: 74px; width: 310px; z-index: 12; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; justify-content: space-between; align-items: center; }
.big { font-size: 1.3em; font-weight: 800; }
.price { display: flex; gap: 4px; align-items: center; justify-content: space-between; }
.price b { font-size: 1.1em; min-width: 72px; text-align: center; }
.row { display: flex; gap: 6px; }
select { padding: 7px; border-radius: 10px; border: 2px solid var(--cream2); background: #fff; font: inherit; }
</style>
