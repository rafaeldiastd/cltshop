<script setup>
import { computed } from 'vue'
import { game, ui, money } from '../game/state.js'
import { world } from '../game/world.js'
import { setMusic, startMusic } from '../game/audio.js'
import { DAY_SECONDS } from '../game/config.js'

const clock = computed(() => {
  if (game.phase === 'prep') return '08:30'
  if (game.phase === 'night') return '21:00'
  const h = 9 + (Math.min(game.clock, DAY_SECONDS) / DAY_SECONDS) * 12
  return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0')
})
const pct = computed(() => (game.phase === 'open' ? (game.clock / DAY_SECONDS) * 100 : game.phase === 'prep' ? 0 : 100))
const label = { prep: 'Preparação', open: 'Aberta', closing: 'Fechando', night: 'Noite' }
const stars = computed(() => '★'.repeat(Math.round(game.rep)) + '☆'.repeat(5 - Math.round(game.rep)))
const toggleMusic = () => { ui.musicOn = !ui.musicOn; setMusic(ui.musicOn); startMusic() }
</script>

<template>
  <div class="top">
    <div class="card pill">
      <b>Dia {{ game.day }}</b>
      <span class="clock">{{ clock }}</span>
      <span class="muted">{{ label[game.phase] }}</span>
    </div>
    <div class="card bar" title="Progresso do dia"><i :style="{ width: pct + '%' }" /></div>
    <div class="card pill"><b :class="game.money < 0 ? 'bad-t' : ''">{{ money(game.money) }}</b></div>
    <div class="card pill" title="Reputação"><span class="star">{{ stars }}</span></div>
    <div class="spacer" />
    <div v-if="game.phase === 'open' || game.phase === 'closing'" class="card pill speed">
      <button class="btn sm" :class="{ primary: game.paused }" @click="game.paused = !game.paused">{{ game.paused ? '▶' : '⏸' }}</button>
      <button class="btn sm" :class="{ primary: game.speed === 1 && !game.paused }" @click="game.speed = 1; game.paused = false">1×</button>
      <button class="btn sm" :class="{ primary: game.speed === 2 }" @click="game.speed = 2; game.paused = false">2×</button>
    </div>
    <button class="btn" @click="ui.modal = 'orders'">📦 Pedidos</button>
    <button class="btn" @click="ui.modal = 'shop'">🏪 Loja</button>
    <button class="btn" @click="toggleMusic">{{ ui.musicOn ? '🎵' : '🔇' }}</button>
  </div>
</template>

<style scoped>
.top { position: fixed; top: 10px; left: 10px; right: 10px; display: flex; gap: 8px; align-items: center; z-index: 10; flex-wrap: wrap; }
.pill { display: flex; gap: 10px; align-items: center; padding: 8px 14px; }
.clock { font-variant-numeric: tabular-nums; font-size: 1.25em; font-weight: 800; }
.bar { width: 160px; height: 14px; padding: 0; overflow: hidden; border-radius: 99px; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--mustard), var(--coral)); transition: width .3s; }
.star { color: #e6a21f; letter-spacing: 2px; }
.spacer { flex: 1; }
.speed { padding: 4px 6px; gap: 4px; }
</style>
