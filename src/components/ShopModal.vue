<script setup>
import Modal from './Modal.vue'
import { game, ui, money, startPlacing, freeSlots, expand, hire, fire, wipeSave, newGame, wages } from '../game/state.js'
import { LEVELS, SHELF_PRICE, STAFF } from '../game/config.js'
const next = () => LEVELS[game.level + 1]
const close = () => (ui.modal = null)
const restart = () => { if (confirm('Começar um novo jogo? O progresso salvo será apagado.')) { wipeSave(); newGame(); location.reload() } }
</script>
<template>
  <Modal title="🏪 Sua loja" @close="close">
    <h3>Espaço</h3>
    <div class="line"><span><b>{{ LEVELS[game.level].name }}</b> <span class="muted">{{ LEVELS[game.level].cols }}×{{ LEVELS[game.level].rows }} · até {{ LEVELS[game.level].maxCust }} clientes</span></span>
      <button v-if="next()" class="btn good" :disabled="game.money < next().cost" @click="expand">Ampliar p/ {{ next().name }} · {{ money(next().cost) }}</button>
      <span v-else class="muted">nível máximo</span></div>
    <div class="line"><span>🪵 Prateleiras: <b>{{ game.shelves.length }}</b> <span class="muted">({{ freeSlots().length }} lugares livres)</span></span>
      <button class="btn good" :disabled="game.money < SHELF_PRICE || !freeSlots().length" @click="startPlacing">Comprar · {{ money(SHELF_PRICE) }}</button></div>
    <h3>Equipe <span class="muted">(salários/dia: {{ money(wages()) }})</span></h3>
    <div v-for="(s, role) in STAFF" :key="role" class="line">
      <span>{{ s.emoji }} <b>{{ s.name }}</b> × {{ game.staff[role] }}<br /><span class="muted">{{ s.desc }} {{ money(s.wage) }}/dia</span></span>
      <span class="btns">
        <button class="btn sm" :disabled="!game.staff[role]" @click="fire(role)">−</button>
        <button class="btn good" :disabled="game.staff[role] >= s.max || game.money < s.hire" @click="hire(role)">Contratar · {{ money(s.hire) }}</button>
      </span>
    </div>
    <template #foot>
      <button class="btn sm" @click="restart">Novo jogo</button>
      <button class="btn primary" @click="close">Fechar</button>
    </template>
  </Modal>
</template>
<style scoped>
h3 { margin: 14px 0 6px; }
.line { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px dashed rgba(59, 47, 74, .15); }
.btns { display: flex; gap: 6px; }
</style>
