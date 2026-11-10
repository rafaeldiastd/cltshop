<script setup>
import { computed } from 'vue'
import { PhWhatsappLogo, PhMotorcycle, PhPackage, PhCheckCircle, PhClock } from '@phosphor-icons/vue'
import { game, money } from '../game/state.js'
import { onDuty } from '../game/team.js'
import { PID } from '../game/config.js'

const courierCount = computed(() => onDuty('courier'))
const orders = computed(() => game.orders)

const STATUS_TEXT = {
  waiting: 'Aguardando separação',
  packing: 'Repositor separando',
  ready: 'Pronto para entrega',
  delivering: 'Motoboy na rota',
  done: 'Entregue com sucesso',
  refused: 'Cancelado'
}
const STATUS_CLASS = {
  waiting: 'status-wait',
  packing: 'status-pack',
  ready: 'status-ready',
  delivering: 'status-deliv',
  done: 'status-done',
  refused: 'status-bad'
}
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhWhatsappLogo weight="duotone" class="zap-ico" /> Zap da Lojinha (Delivery)</h2>
        <p class="muted">Clientes do bairro fazem pedidos online. Seu repositor embala e o motoboy entrega de moto sem ocupar a fila da loja!</p>
      </div>
      <div class="status-box">
        <label class="toggle-wrap">
          <input type="checkbox" v-model="game.zapOn" />
          <span>Receber pedidos</span>
        </label>
      </div>
    </div>

    <div v-if="courierCount === 0" class="alert-box">
      <PhMotorcycle weight="duotone" class="big-ico" />
      <div>
        <b>Você ainda não tem um Motoboy contratado!</b>
        <p class="muted">Contrate um motoboy na aba <b>Loja → Equipe</b> para começar a realizar as entregas pela cidade.</p>
      </div>
    </div>

    <div class="scroll">
      <div v-if="orders.length === 0" class="empty-state">
        <PhClock weight="duotone" class="empty-ico" />
        <span>Nenhum pedido recebido ainda hoje. Conforme a loja fica aberta, novos pedidos chegam pelo Zap!</span>
      </div>

      <article v-for="o in orders" :key="o.id" class="order-card">
        <div class="order-head">
          <b>{{ o.name }}</b>
          <span class="order-time">{{ o.time }}</span>
          <span class="badge" :class="STATUS_CLASS[o.state]">{{ STATUS_TEXT[o.state] }}</span>
          <b class="order-val">{{ money(o.total) }}</b>
        </div>
        <div class="order-items">
          <span v-for="(it, i) in o.items" :key="i" class="item-chip">
            {{ it.qty }}× {{ PID[it.pid]?.name || it.pid }}
          </span>
          <span class="fee-chip">+ Taxa de entrega R$ 4,00</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
h2 { margin: 0; font-size: 1.25em; display: flex; align-items: center; gap: 6px; }
p { margin: 2px 0 0; }
.zap-ico { color: #25d366; font-size: 26px; }

.toggle-wrap { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; cursor: pointer; background: #fff; padding: 6px 12px; border-radius: 10px; }
.alert-box { display: flex; align-items: center; gap: 12px; background: #fff0d4; padding: 10px 14px; border-radius: 12px; border: 1px solid #ffd285; }
.big-ico { font-size: 34px; color: var(--plum); }

.scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 180px; opacity: 0.7; text-align: center; }
.empty-ico { font-size: 40px; }

.order-card { background: #fff; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.order-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.order-time { font-size: 12px; opacity: 0.6; }
.order-val { margin-left: auto; font-variant-numeric: tabular-nums; }
.badge { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px; }
.status-wait { background: #fdf1d0; color: #8a6500; }
.status-pack { background: #e0f2fe; color: #0369a1; }
.status-ready { background: #dcfce7; color: #15803d; }
.status-deliv { background: #fae8ff; color: #86198f; }
.status-done { background: #f3f4f6; color: #4b5563; }
.status-bad { background: #fee2e2; color: #b91c1c; }

.order-items { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; }
.item-chip { background: var(--cream2); padding: 2px 8px; border-radius: 6px; font-weight: 600; }
.fee-chip { opacity: 0.7; padding: 2px 4px; }
</style>
