<script setup>
import { computed, ref } from 'vue'
import { PhCloudSun, PhList, PhLock, PhPause, PhPlay, PhSnowflake, PhStar, PhSun, PhTicket, PhGlobe, PhTimer } from '@phosphor-icons/vue'
import { game, ui, money, clockText, xpNext, passPending, daySeconds, regionOf } from '../game/state.js'
import { mp } from '../game/multiplayer.js'
import GoalsCard from './GoalsCard.vue'
import { WEATHER, GAME_MODES, POMODORO_PRESETS } from '../game/config.js'

const WEATHER_ICON = { hot: PhSun, mild: PhCloudSun, cold: PhSnowflake }

const clock = computed(() => clockText())
const dur = computed(() => daySeconds())
// em passos de 0,25%: assim a barra não refaz a tela a cada quadro
const pct = computed(() => (game.phase === 'open' || game.phase === 'lunch' ? Math.round((game.clock / dur.value) * 400) / 4 : game.phase === 'prep' ? 0 : 100))
const label = { prep: 'Preparação', open: 'Aberta', lunch: 'Almoço', closing: 'Fechando', night: 'Noite' }
const stars = computed(() => Math.round(game.rep))
const xpPct = computed(() => Math.round(Math.min(1, game.career.xp / xpNext()) * 100))
const curMode = computed(() => GAME_MODES[game.mode] || GAME_MODES.normal)
const curRegion = computed(() => regionOf())
const modeOpen = ref(false)
const applyPreset = (p) => {
  game.pomodoro.focusMin = p.focus
  game.pomodoro.breakMin = p.break
}
const openPass = () => { ui.computerApp = 'pass'; ui.modal = 'computer' }
const openBranches = () => { ui.computerApp = 'branches'; ui.modal = 'computer' }
const openStartMenu = () => { modeOpen.value = false; ui.modal = 'start' }
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
    <button class="card pill btn-pill" title="Região e filiais" @click="openBranches">
      <span>{{ curRegion.emoji }}</span> <b>{{ game.branchName }}</b>
    </button>
    <button class="card pill lvl" :class="{ ready: passPending() }" :title="`Nível ${game.career.earned}: ${game.career.xp}/${xpNext()} XP${passPending() ? ' · recompensa do passe para resgatar' : ''}`" @click="openPass">
      <PhTicket weight="duotone" /> <b>Nv {{ game.career.earned }}</b>
      <span class="xpbar"><i :style="{ width: xpPct + '%' }" /></span>
      <i v-if="passPending()" class="dot" />
    </button>
    <GoalsCard />

    <div class="mode-wrap">
      <button class="card pill btn-pill" :class="{ lofi: game.mode === 'lofi', hardcore: game.mode === 'hardcore' }" title="Modo de jogo e Partida" @click="modeOpen = !modeOpen">
        <span>{{ curMode.emoji }}</span> <b>{{ curMode.name }}</b>
        <span v-if="game.mode === 'lofi'" class="pomo-tag"><PhTimer weight="bold" /> {{ game.pomodoro?.focusMin || 25 }}m</span>
      </button>
      <div v-if="modeOpen" class="card mode-drop" role="dialog" aria-label="Modo de jogo">
        <b>Modo de Jogo</b>
        <div class="mode-locked">
          <div class="mode-head">
            <span>{{ curMode.emoji }} <b>{{ curMode.name }}</b></span>
            <span class="lock-pill"><PhLock weight="bold" /> Fixo no save</span>
          </div>
          <small>{{ curMode.desc }}</small>
          <small class="muted">👤 {{ game.playerName || 'Lojista' }} · 🏪 {{ game.shopName || game.branchName }}</small>
          <small class="muted">Para jogar outro modo, crie uma nova partida no menu inicial.</small>
        </div>

        <div v-if="game.mode === 'lofi'" class="pomo-box">
          <div class="pomo-head">
            <b>🍅 Controle Pomodoro</b>
            <span class="muted">{{ game.pomodoro?.sessions || 0 }} sessões</span>
          </div>
          <div class="presets">
            <button
              v-for="pr in POMODORO_PRESETS"
              :key="pr.label"
              class="btn sm"
              :class="{ primary: game.pomodoro.focusMin === pr.focus && game.pomodoro.breakMin === pr.break }"
              @click="applyPreset(pr)"
            >{{ pr.label }}</button>
          </div>
          <div class="pomo-inputs">
            <label>Foco (min)<input v-model.number="game.pomodoro.focusMin" type="number" min="1" max="120" /></label>
            <label>Pausa (min)<input v-model.number="game.pomodoro.breakMin" type="number" min="1" max="60" /></label>
          </div>
          <label class="chk"><input v-model="game.pomodoro.autoPilot" type="checkbox" /> Piloto automático (caixa, limpeza e reposição)</label>
          <label class="chk"><input v-model="game.pomodoro.autoRestock" type="checkbox" /> Compra automática de reposição à noite</label>
          <label class="chk"><input v-model="game.pomodoro.autoCycle" type="checkbox" /> Avançar dias e pausas automaticamente</label>
        </div>

        <button class="btn sm primary" @click="openStartMenu">📂 Menu de Partidas / Trocar Save</button>
      </div>
    </div>

    <div class="spacer" />
    <div v-if="game.phase === 'open' || game.phase === 'closing'" class="card pill speed">
      <button class="btn sm" :class="{ primary: game.paused }" :title="game.paused ? 'Continuar' : 'Pausar'" @click="game.paused = !game.paused"><PhPlay v-if="game.paused" weight="fill" /><PhPause v-else weight="fill" /></button>
      <button class="btn sm" :class="{ primary: game.speed === 1 && !game.paused }" @click="game.speed = 1; game.paused = false">1×</button>
      <button class="btn sm" :class="{ primary: game.speed === 2 }" @click="game.speed = 2; game.paused = false">2×</button>
    </div>
    <button v-if="!ui.editing && !mp.visiting" class="btn mp-btn" title="Multiplayer e visitas em outras lojas" @click="ui.modal = 'multiplayer'">
      <PhGlobe weight="duotone" /> Online
      <b v-if="mp.visitors.length" class="v-badge">{{ mp.visitors.length }}</b>
    </button>
    <button v-if="!ui.editing" class="btn" title="Menu" @click="ui.modal = 'menu'"><PhList weight="bold" /> Menu</button>
  </div>
</template>

<style scoped>
.daybar { position: fixed; top: 0; left: 0; right: 0; height: 4px; z-index: 20; background: rgba(59, 47, 74, .25); }
.daybar i { display: block; height: 100%; background: linear-gradient(90deg, var(--mustard), var(--coral)); transition: width .3s; }
.top { position: fixed; top: 12px; left: 10px; right: 10px; display: flex; gap: 8px; align-items: center; z-index: 10; flex-wrap: wrap; }
.pill { display: flex; gap: 8px; align-items: center; padding: 8px 12px; }
.btn-pill { font: inherit; color: inherit; cursor: pointer; }
.btn-pill:hover { box-shadow: inset 0 0 0 2px var(--teal), var(--shadow); }
.btn-pill.lofi { background: #e0f2fe; }
.btn-pill.hardcore { background: #fee2e2; color: #7f1d1d; }
.pomo-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 800; color: #0369a1; }
.mode-wrap { position: relative; }
.mode-drop { position: absolute; top: calc(100% + 6px); left: 0; width: min(340px, calc(100vw - 24px)); z-index: 20; display: flex; flex-direction: column; gap: 8px; max-height: 75vh; overflow-y: auto; }
.mode-locked { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 10px; border-radius: 10px; background: #fff; border: 2px solid var(--cream2); }
.mode-locked small { font-size: 11.5px; opacity: .82; line-height: 1.3; }
.mode-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lock-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: var(--cream2); color: var(--plum); }
.pomo-box { background: #fff; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; border: 1.5px solid var(--cream2); }
.pomo-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.presets { display: flex; flex-wrap: wrap; gap: 4px; }
.pomo-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; font-weight: 700; }
.pomo-inputs label { display: flex; flex-direction: column; gap: 2px; }
.pomo-inputs input { padding: 4px 8px; border-radius: 8px; border: 2px solid var(--cream2); font: inherit; }
.chk { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
.clock { font-variant-numeric: tabular-nums; font-size: 1.25em; font-weight: 800; }
.stars { color: #e6a21f; gap: 2px; font-size: 1.05em; }
.spacer { flex: 1; }
.speed { padding: 4px 6px; gap: 4px; }
.lvl { position: relative; font: inherit; color: inherit; cursor: pointer; gap: 6px; }
.lvl:hover { box-shadow: inset 0 0 0 2px var(--teal), var(--shadow); }
.xpbar { width: 54px; height: 6px; border-radius: 99px; background: var(--cream2); overflow: hidden; }
.xpbar i { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--mustard)); }
.dot { position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 2px #fff; }
.mp-btn { position: relative; display: inline-flex; align-items: center; gap: 5px; }
.v-badge { background: var(--teal); color: #fff; border-radius: 99px; padding: 1px 6px; font-size: 11px; }
</style>
