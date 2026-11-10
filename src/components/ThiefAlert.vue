<script setup>
import { ui } from '../game/state.js'
import { world } from '../game/world.js'
</script>

<template>
  <button
    v-if="ui.theft"
    class="theft"
    :style="{ left: ui.theft.x + 'px', top: ui.theft.y + 'px', '--left': ui.theft.left }"
    title="Clique para impedir o roubo"
    aria-label="Impedir o roubo"
    @click="world.stopTheft()"
  ><span>🚨</span></button>
</template>

<style scoped>
.theft { position: fixed; z-index: 60; /* o jogo não pausa com telas abertas: o alarme fica por cima delas */ width: 64px; height: 64px; padding: 5px; border-radius: 50%; transform: translate(-50%, -100%); background: conic-gradient(var(--bad) calc(var(--left) * 360deg), rgba(255, 244, 224, .7) 0); box-shadow: var(--shadow); animation: thump .45s ease-in-out infinite alternate; }
.theft span { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: var(--cream); font-size: 28px; }
@keyframes thump { to { scale: 1.12; } }
</style>
