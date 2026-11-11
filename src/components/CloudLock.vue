<script setup>
import { PhCloudSlash } from '@phosphor-icons/vue'
import { cloud } from '../game/cloud.js'
const reload = () => location.reload()
</script>

<template>
  <div v-if="cloud.locked" class="cloud-lock">
    <div class="card">
      <PhCloudSlash :size="40" weight="duotone" />
      <h2 v-if="cloud.locked === 'ahead'">Sua loja avançou em outro aparelho</h2>
      <h2 v-else>Sua loja foi aberta em outro lugar</h2>
      <p v-if="cloud.locked === 'ahead'">Esta janela está com uma versão antiga do jogo. Recarregue para continuar de onde parou.</p>
      <p v-else>Para não misturar o progresso, só uma aba ou aparelho joga por vez. Esta janela parou de salvar.</p>
      <button class="btn" @click="reload">{{ cloud.locked === 'ahead' ? 'Recarregar' : 'Jogar aqui' }}</button>
    </div>
  </div>
</template>

<style scoped>
.cloud-lock { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(30, 24, 20, 0.55); backdrop-filter: blur(3px); }
.card { max-width: 360px; margin: 16px; padding: 24px; border-radius: 16px; background: var(--cream); color: var(--plum); text-align: center; display: grid; gap: 10px; justify-items: center; box-shadow: var(--shadow); }
h2 { margin: 0; font-size: 1.15rem; }
p { margin: 0; opacity: 0.8; line-height: 1.4; }
</style>
