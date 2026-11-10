<script setup>
import { computed } from 'vue'
import { PhCloudSun, PhList, PhPause, PhPlay, PhSnowflake, PhStar, PhSun } from '@phosphor-icons/vue'
import { game, ui, money, clockText } from '../game/state.js'
import { DAY_SECONDS, WEATHER } from '../game/config.js'

const WEATHER_ICON = { hot: PhSun, mild: PhCloudSun, cold: PhSnowflake }

const clock = computed(() => clockText())
// em passos de 0,25%: assim a barra não refaz a tela a cada quadro
const pct = computed(() => (game.phase === 'open' || game.phase === 'lunch' ? Math.round((game.clock / DAY_SECONDS) * 400) / 4 : game.phase === 'prep' ? 0 : 100))
const label = { prep: 'Preparação', open: 'Aberta', lunch: 'Almoço', closing: 'Fechando', night: 'Noite' }
const stars = computed(() => Math.round(game.rep))
</script>

<template>
  <div class="daybar" role="progressbar" aria-label="Progresso do dia" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct + '%' }" /></div>
  <div class="top">
    <div class="card pill">
      <b>Dia {{ game.day }}</b>
      <span class="clock">{{ clock }}</span>
      <span class="muted">{{ label[game.phase] }}</span>
    </div>
    <div class="card pill"><b :class="game.money < 0 ? 'bad-t' : ''">{{ money(game.money) }}</b></div>
    <div class="card pill stars" :title="`Reputação: ${game.rep.toFixed(1)} de 5`">
      <PhStar v-for="n in 5" :key="n" :weight="n <= stars ? 'fill' : 'regular'" />
    </div>
    <div class="card pill" title="Clima: muda a procura por gelados"><component :is="WEATHER_ICON[game.weather]" weight="duotone" /> {{ WEATHER[game.weather].name }}</div>
    <div class="spacer" />
    <div v-if="game.phase === 'open' || game.phase === 'closing'" class="card pill speed">
      <button class="btn sm" :class="{ primary: game.paused }" :title="game.paused ? 'Continuar' : 'Pausar'" @click="game.paused = !game.paused"><PhPlay v-if="game.paused" weight="fill" /><PhPause v-else weight="fill" /></button>
      <button class="btn sm" :class="{ primary: game.speed === 1 && !game.paused }" @click="game.speed = 1; game.paused = false">1×</button>
      <button class="btn sm" :class="{ primary: game.speed === 2 }" @click="game.speed = 2; game.paused = false">2×</button>
    </div>
    <button v-if="!ui.editing" class="btn" title="Menu" @click="ui.modal = 'menu'"><PhList weight="bold" /> Menu</button>
  </div>
</template>

<style scoped>
.daybar { position: fixed; top: 0; left: 0; right: 0; height: 4px; z-index: 20; background: rgba(59, 47, 74, .25); }
.daybar i { display: block; height: 100%; background: linear-gradient(90deg, var(--mustard), var(--coral)); transition: width .3s; }
.top { position: fixed; top: 12px; left: 10px; right: 10px; display: flex; gap: 8px; align-items: center; z-index: 10; flex-wrap: wrap; }
.pill { display: flex; gap: 10px; align-items: center; padding: 8px 14px; }
.clock { font-variant-numeric: tabular-nums; font-size: 1.25em; font-weight: 800; }
.stars { color: #e6a21f; gap: 2px; font-size: 1.05em; }
.spacer { flex: 1; }
.speed { padding: 4px 6px; gap: 4px; }
</style>
