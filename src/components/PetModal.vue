<script setup>
import { computed } from 'vue'
import { PhHeart, PhCookie, PhX } from '@phosphor-icons/vue'
import { game, ui, money } from '../game/state.js'
import { world } from '../game/world.js'
import { PET, PETS } from '../game/config.js'

const pet = computed(() => world.pets[0])
const petName = computed(() => pet.value ? PETS[pet.value.species]?.name || 'Pet' : 'Pet')
const isHappy = computed(() => (pet.value?.happy || 0) > 0)
const close = () => { ui.petMenu = null }
</script>

<template>
  <div v-if="ui.petMenu" class="card pet-popup" :style="{ left: ui.petMenu.x + 'px', top: ui.petMenu.y + 'px' }">
    <div class="head">
      <b>🐾 {{ petName }}</b>
      <button class="btn sm close-btn" @click="close"><PhX weight="bold" /></button>
    </div>
    <div v-if="isHappy" class="happy-tag">
      ❤️ Animado! Acelerando os funcionários
    </div>
    <div class="actions">
      <button class="btn good" @click="world.cmdPet('pat')">
        <PhHeart weight="fill" /> Fazer carinho
      </button>
      <button class="btn primary" :disabled="game.money < PET.treatCost" @click="world.cmdPet('treat')">
        <PhCookie weight="fill" /> Dar petisco · {{ money(PET.treatCost) }}
      </button>
    </div>
    <p class="muted info">
      Quando o pet fica feliz, ele corre pela loja, motiva os funcionários a andarem 25% mais rápido e ocasionalmente encontra dinheiro ou itens esquecidos no chão!
    </p>
  </div>
</template>

<style scoped>
.pet-popup { position: fixed; z-index: 45; width: 260px; transform: translate(-50%, -110%); display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow); }
.head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.close-btn { padding: 2px 6px; }
.happy-tag { background: #ffe4e6; color: #e11d48; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-align: center; }
.actions { display: flex; flex-direction: column; gap: 6px; }
.actions .btn { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; }
.info { margin: 0; font-size: 11px; line-height: 1.3; }
</style>
