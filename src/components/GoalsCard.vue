<script setup>
import { computed, ref } from 'vue'
import { PhCheckCircle, PhCircle, PhTarget, PhXCircle } from '@phosphor-icons/vue'
import { game, money } from '../game/state.js'
import { goalProgress } from '../game/goals.js'

const open = ref(false)
const done = computed(() => game.goals.filter((g) => g.done).length)
const live = computed(() => game.phase === 'open' || game.phase === 'closing' || game.phase === 'lunch')
const rows = computed(() => game.goals.map((g) => ({ g, p: goalProgress(g) })))
const fmt = (p, n) => (p.money ? money(n) : n)
</script>

<template>
  <div v-if="game.goals.length" class="goals">
    <button class="card pill" :class="{ all: done === game.goals.length }" :aria-expanded="open" title="Metas do dia" @click="open = !open">
      <PhTarget weight="duotone" /> Metas <b>{{ done }}/{{ game.goals.length }}</b>
    </button>
    <div v-if="open" class="card drop" role="dialog" aria-label="Metas do dia">
      <b class="title">Metas do dia {{ game.goalsDay }}</b>
      <p v-if="!live && game.phase === 'prep'" class="muted small">Contam a partir da abertura da loja.</p>
      <div v-for="(r, i) in rows" :key="i" class="goal" :class="{ done: r.g.done, failed: r.g.failed }">
        <component :is="r.g.done ? PhCheckCircle : r.g.failed ? PhXCircle : PhCircle" weight="fill" class="ico" />
        <div class="col">
          <span class="text">{{ r.g.text }}</span>
          <template v-if="!r.p.final">
            <div class="bar"><i :style="{ width: (r.p.cur / r.p.target) * 100 + '%' }" /></div>
            <span class="muted small">{{ fmt(r.p, r.p.cur) }} de {{ fmt(r.p, r.p.target) }}</span>
          </template>
          <span v-else class="muted small">{{ r.g.done ? 'Cumprida' : r.g.failed ? 'Não deu desta vez' : 'Vale até o fim do expediente' }}</span>
        </div>
        <span class="xp">+{{ r.g.xp }} XP</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goals { position: relative; }
.pill { display: flex; gap: 8px; align-items: center; padding: 8px 14px; font: inherit; color: inherit; cursor: pointer; }
.pill:hover { box-shadow: inset 0 0 0 2px var(--teal), var(--shadow); }
.pill.all { background: #e3f4ec; }
.drop { position: absolute; top: calc(100% + 6px); right: 0; width: min(320px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 8px; z-index: 15; }
@media (max-width: 640px) { .drop { position: fixed; top: 116px; left: 12px; right: 12px; width: auto; } }
.title { font-size: 1.05em; }
.small { font-size: 12px; margin: 0; }
.goal { display: flex; gap: 8px; align-items: flex-start; }
.ico { font-size: 20px; color: var(--cream2); flex: none; margin-top: 1px; }
.goal.done .ico { color: var(--good); }
.goal.failed .ico { color: var(--coral); }
.goal.done .text { text-decoration: line-through; opacity: .7; }
.col { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: 14px; }
.bar { height: 6px; background: var(--cream2); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--teal); transition: width .3s; }
.xp { font-size: 12px; font-weight: 800; color: #a8740f; white-space: nowrap; }
</style>
