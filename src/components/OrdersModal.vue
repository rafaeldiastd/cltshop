<script setup>
import { computed } from 'vue'
import Modal from './Modal.vue'
import { game, ui, money, boxCost, cartAdd, cartTotal, placeOrder, unlockProduct, stockInfo } from '../game/state.js'
import { world } from '../game/world.js'
import { PRODUCTS, PACK } from '../game/config.js'

const open = computed(() => PRODUCTS.filter((p) => game.unlocked[p.id]))
const locked = computed(() => PRODUCTS.filter((p) => !game.unlocked[p.id]))
const missed = (id) => (game.summary?.oos?.[id] || 0)
const total = computed(() => cartTotal())
const confirm = () => placeOrder()
const sleep = () => { if (placeOrder()) { world.startNextDay() } }
const close = () => (ui.modal = null)
</script>
<template>
  <Modal title="📦 Pedidos para amanhã" wide @close="close">
    <p class="muted">Cada caixa traz {{ PACK }} unidades. O pedido é pago agora e chega na calçada amanhã cedo.</p>
    <div class="table">
      <div class="r h"><span>Produto</span><span>Caixa</span><span>Estoque</span><span>Ontem faltou</span><span>Pedido</span></div>
      <div v-for="p in open" :key="p.id" class="r">
        <span>{{ p.emoji }} <b>{{ p.name }}</b></span>
        <span>{{ money(boxCost(p.id)) }}</span>
        <span class="muted">{{ stockInfo(p.id).shelves }} prat. · {{ stockInfo(p.id).boxes }} cx. <b v-if="stockInfo(p.id).incoming" class="good-t">+{{ stockInfo(p.id).incoming }} a caminho</b></span>
        <span :class="missed(p.id) ? 'bad-t' : 'muted'">{{ missed(p.id) || '—' }}</span>
        <span class="step">
          <button class="btn sm" @click="cartAdd(p.id, -1)">−</button>
          <b>{{ ui.cart[p.id] || 0 }}</b>
          <button class="btn sm" @click="cartAdd(p.id, 1)">+</button>
        </span>
      </div>
    </div>
    <template v-if="locked.length">
      <h3>Novos fornecedores</h3>
      <div class="chips">
        <button v-for="p in locked" :key="p.id" class="btn sm" :disabled="game.money < p.unlock" @click="unlockProduct(p.id)">{{ p.emoji }} {{ p.name }} · {{ money(p.unlock) }}</button>
      </div>
    </template>
    <template #foot>
      <span>Total: <b :class="total > game.money ? 'bad-t' : ''">{{ money(total) }}</b> <span class="muted">/ caixa {{ money(game.money) }}</span></span>
      <button class="btn" :disabled="!total" @click="confirm">Emitir pedido</button>
      <button v-if="game.phase === 'night'" class="btn primary" @click="sleep">🌙 Confirmar e dormir</button>
      <button v-else class="btn" @click="close">Fechar</button>
    </template>
  </Modal>
</template>
<style scoped>
.table { display: flex; flex-direction: column; gap: 4px; }
.r { display: grid; grid-template-columns: 1.1fr .8fr 1.9fr .8fr 1fr; gap: 8px; align-items: center; padding: 5px 8px; border-radius: 10px; font-size: .95em; }
.r:nth-child(even) { background: rgba(246, 231, 207, .55); }
.r.h { font-weight: 800; font-size: .8em; opacity: .6; text-transform: uppercase; }
.step { display: flex; align-items: center; gap: 8px; justify-content: flex-end; } .step b { min-width: 18px; text-align: center; }
h3 { margin: 14px 0 6px; } .chips { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 640px) { .r { grid-template-columns: 1fr 1fr 1fr; } .r > :nth-child(3), .r > :nth-child(4) { display: none; } }
</style>
