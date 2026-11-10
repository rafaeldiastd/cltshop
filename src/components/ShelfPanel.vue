<script setup>
import { computed } from 'vue'
import { PhX } from '@phosphor-icons/vue'
import PriceStepper from './PriceStepper.vue'
import { game, ui, money, productPrice, setPrice, costOf, refOf } from '../game/state.js'
import { PRODUCTS, PID, SHELF_CAP } from '../game/config.js'
import { productThumb } from '../game/assets.js'

const shelf = computed(() => game.shelves.find((s) => s.id === ui.panelShelf))
const p = computed(() => shelf.value?.product && PID[shelf.value.product])
const price = computed(() => (p.value ? productPrice(p.value.id) : null))
const assign = (e) => {
  const s = shelf.value
  s.product = e.target.value || null
  s.price = s.product ? game.priceMemory[s.product] ?? null : null
}
</script>

<template>
  <div v-if="shelf" class="card panel">
    <div class="head">
      <template v-if="p"><img :src="productThumb(p.id)" alt="" /><b>{{ p.name }}</b></template>
      <b v-else>{{ shelf.fridge ? 'Freezer vazio' : 'Prateleira vazia' }}</b>
      <button class="btn sm" aria-label="Fechar" @click="ui.panelShelf = null"><PhX weight="bold" /></button>
    </div>
    <select v-if="shelf.count === 0" :value="shelf.product || ''" aria-label="Produto desta prateleira" @change="assign">
      <option value="">Escolher produto…</option>
      <option v-for="x in PRODUCTS.filter((x) => game.unlocked[x.id] && (x.either || !!x.cold === !!shelf.fridge))" :key="x.id" :value="x.id">{{ x.name }}</option>
    </select>
    <template v-if="p">
      <div class="fill"><i :style="{ width: (shelf.count / SHELF_CAP) * 100 + '%' }" /></div>
      <div class="muted">{{ shelf.count }} de {{ SHELF_CAP }} na prateleira</div>
      <PriceStepper :pid="p.id" />
      <div class="facts">
        <span>Custo <b>{{ money(costOf(p.id)) }}</b></span>
        <span>Mercado <b>{{ money(refOf(p.id)) }}</b></span>
        <span v-if="price != null">Margem <b :class="price - costOf(p.id) >= 0 ? 'good-t' : 'bad-t'">{{ money(price - costOf(p.id)) }}</b></span>
      </div>
      <button class="btn sm" @click="setPrice(p.id, refOf(p.id))">Usar preço de mercado</button>
      <p class="muted note">O preço vale para todas as prateleiras de {{ p.name }}. Para tirar itens daqui, pegue uma caixa vazia no estoque e clique nesta prateleira.</p>
    </template>
    <p v-else class="muted note">Escolha um produto ou reponha com uma caixa.</p>
  </div>
</template>

<style scoped>
.panel { position: fixed; right: 12px; top: 72px; width: 320px; z-index: 12; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; align-items: center; gap: 8px; font-size: 1.15em; }
.head img { width: 40px; height: 40px; }
.head button { margin-left: auto; }
.fill { height: 8px; background: #e6d6bd; border-radius: 99px; overflow: hidden; }
.fill i { display: block; height: 100%; background: var(--teal); transition: width .2s; }
.facts { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.note { margin: 0; }
select { padding: 7px; border-radius: 10px; border: 2px solid var(--cream2); background: #fff; font: inherit; }
</style>
