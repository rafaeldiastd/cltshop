<script setup>
import { PhPaintBrush, PhPottedPlant } from '@phosphor-icons/vue'
import { money, isClosed, decorCount, sellDecor } from '../game/state.js'
import { buyDecor, canBuyDecor } from '../game/editor.js'
import { decorThumb } from '../game/assets.js'
import { DECOR } from '../game/config.js'

const items = Object.entries(DECOR).filter(([, d]) => d.price)
const resale = (d) => Math.floor(d.price / 2)
</script>

<template>
  <div class="app">
    <h2><PhPaintBrush weight="duotone" /> Decoração</h2>
    <p class="muted">{{ isClosed() ? 'Depois de comprar, escolha o lugar na loja. A revenda paga metade do preço.' : 'Compra e venda só com a loja fechada.' }}</p>
    <div class="grid">
      <article v-for="[type, d] in items" :key="type" class="item">
        <img v-if="decorThumb(type)" :src="decorThumb(type)" alt="" />
        <PhPottedPlant v-else class="fallback" weight="duotone" />
        <b class="name">{{ d.name }}</b>
        <span class="muted">{{ decorCount(type) }} na loja</span>
        <button class="btn good sm" :disabled="!canBuyDecor(type)" @click="buyDecor(type)">Comprar · {{ money(d.price) }}</button>
        <button class="btn sm" :disabled="!isClosed() || !decorCount(type)" @click="sellDecor(type)">Vender · {{ money(resale(d)) }}</button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 0; }
.grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; align-content: start; padding-right: 4px; }
.item { display: flex; flex-direction: column; align-items: center; gap: 4px; background: #fff; border-radius: 12px; padding: 10px; text-align: center; }
.item img { width: 64px; height: 64px; }
.fallback { font-size: 64px; color: var(--good); }
.name { text-transform: capitalize; }
.item .btn { width: 100%; }
</style>
