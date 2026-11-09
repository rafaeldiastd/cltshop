<script setup>
import { computed } from 'vue'
import Modal from './Modal.vue'
import { game, ui, money } from '../game/state.js'
import { PID } from '../game/config.js'
const s = computed(() => game.summary)
const rows = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1])
const lostUnits = computed(() => rows(s.value.oos))
</script>
<template>
  <Modal :title="`🌙 Fim do dia ${s.day}`">
    <div class="grid">
      <div>Vendas</div><b>{{ money(s.revenue) }}</b>
      <div class="muted">Custo dos produtos vendidos</div><span>− {{ money(s.cogs) }}</span>
      <div class="muted">Salários</div><span>− {{ money(s.wages) }}</span>
      <div><b>Lucro do dia</b></div><b :class="s.profit >= 0 ? 'good-t' : 'bad-t'">{{ money(s.profit) }}</b>
      <div class="muted">Caixa agora</div><span>{{ money(game.money) }}</span>
    </div>
    <p class="muted">{{ s.served }} clientes atendidos de {{ s.customers }} · {{ s.units }} itens vendidos · reputação {{ s.rep.toFixed(1) }} ★</p>
    <h3>Mais vendidos</h3>
    <div class="chips"><span v-for="[id, n] in rows(s.sold)" :key="id" class="chip">{{ PID[id].emoji }} {{ n }}</span><span v-if="!rows(s.sold).length" class="muted">nada hoje…</span></div>
    <template v-if="lostUnits.length || rows(s.price).length || s.patience">
      <h3>Vendas perdidas ({{ money(s.lostValue) }})</h3>
      <div class="chips">
        <span v-for="[id, n] in lostUnits" :key="'o' + id" class="chip bad">{{ PID[id].emoji }} faltou ×{{ n }}</span>
        <span v-for="[id, n] in rows(s.price)" :key="'p' + id" class="chip">{{ PID[id].emoji }} caro ×{{ n }}</span>
        <span v-if="s.patience" class="chip">😤 {{ s.patience }} desistiram da fila</span>
      </div>
    </template>
    <template #foot>
      <button class="btn primary" @click="ui.modal = 'orders'">📦 Fazer pedidos de amanhã</button>
    </template>
  </Modal>
</template>
<style scoped>
.grid { display: grid; grid-template-columns: 1fr auto; gap: 6px 18px; font-size: 1.05em; }
.grid > :nth-child(even) { text-align: right; }
h3 { margin: 14px 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--cream2); padding: 4px 10px; border-radius: 99px; font-weight: 700; }
.chip.bad { background: #f4c3bd; }
</style>
