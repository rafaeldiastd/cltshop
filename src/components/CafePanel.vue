<script setup>
import { computed } from 'vue'
import { PhCoffee, PhNewspaper, PhX } from '@phosphor-icons/vue'
import PriceStepper from './PriceStepper.vue'
import { game, ui, money, cafePrice, cafeCost, cafeRef, cafeCostChange, setCafePrice, cafeMenu } from '../game/state.js'
import { onDuty } from '../game/team.js'

const open = computed(() => ui.panelCafe && game.cafe)
const menu = computed(() => cafeMenu())
const useMarket = () => { for (const m of menu.value) setCafePrice(m.id, cafeRef(m.id)) }
</script>

<template>
  <div v-if="open" class="card panel">
    <div class="head">
      <b><PhCoffee weight="duotone" /> Cardápio da Cafeteria</b>
      <button class="btn sm" aria-label="Fechar" @click="ui.panelCafe = false"><PhX weight="bold" /></button>
    </div>
    <p v-if="!onDuty('barista')" class="muted note">Contrate um atendente no computador para abrir.</p>
    <p v-if="game.market.text" class="news"><PhNewspaper weight="duotone" /> {{ game.market.text }}</p>
    <div v-if="!menu.length" class="muted note">Nenhuma receita descoberta ainda! Compre ingredientes no atacado para liberar clássicos no minilivro de receitas.</div>
    <div v-for="m in menu" :key="m.id" class="item">
      <b>{{ m.name }}</b>
      <PriceStepper :cafe="m.id" />
      <div class="facts">
        <span>Custo <b>{{ money(cafeCost(m.id)) }}</b> <b v-if="cafeCostChange(m.id)" :class="cafeCostChange(m.id) > 0 ? 'bad-t' : 'good-t'">{{ cafeCostChange(m.id) > 0 ? '+' : '' }}{{ cafeCostChange(m.id) }}%</b></span>
        <span>Mercado <b>{{ money(cafeRef(m.id)) }}</b></span>
        <span>Margem <b :class="cafePrice(m.id) - cafeCost(m.id) >= 0 ? 'good-t' : 'bad-t'">{{ money(cafePrice(m.id) - cafeCost(m.id)) }}</b></span>
      </div>
    </div>
    <button v-if="menu.length" class="btn sm" @click="useMarket">Usar preço de mercado em tudo</button>
  </div>
</template>

<style scoped>
.panel { position: fixed; right: 12px; top: 72px; width: 340px; max-height: calc(100vh - 92px); overflow-y: auto; z-index: 12; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 1.1em; }
.item { display: flex; flex-direction: column; gap: 3px; padding-bottom: 6px; border-bottom: 1px dashed rgba(59, 47, 74, .15); }
.facts { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; }
.note { margin: 0; }
.news { display: flex; gap: 6px; align-items: center; margin: 0; background: var(--mustard); border-radius: 9px; padding: 5px 9px; font-size: 13px; font-weight: 700; }
</style>
