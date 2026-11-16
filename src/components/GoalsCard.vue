<script setup>
import { computed, ref } from 'vue'
import { PhCheckCircle, PhCircle, PhTarget, PhXCircle, PhTrophy, PhGift } from '@phosphor-icons/vue'
import { game, money } from '../game/state.js'
import { goalProgress, bigGoalsList, bigGoalsPending, claimBigGoal } from '../game/goals.js'

const open = ref(false)
const tab = ref('daily')
const done = computed(() => game.goals.filter((g) => g.done).length)
const live = computed(() => game.phase === 'open' || game.phase === 'closing' || game.phase === 'lunch')
const rows = computed(() => game.goals.map((g) => ({ g, p: goalProgress(g) })))
const bigRows = computed(() => bigGoalsList())
const bigClaimed = computed(() => bigRows.value.filter((g) => g.claimed).length)
const bigPending = computed(() => bigGoalsPending())
const fmt = (p, n) => (p.money ? money(n) : n)
const rewardText = (r) => {
  const out = []
  if (r.money) out.push(money(r.money))
  if (r.xp) out.push(`+${r.xp} XP`)
  if (r.points) out.push(`+${r.points} Maestria`)
  return out.join(' · ')
}
</script>

<template>
  <div v-if="game.goals.length || bigRows.length" class="goals">
    <button class="card pill" :class="{ all: done === game.goals.length && game.goals.length > 0 }" :aria-expanded="open" title="Metas" @click="open = !open">
      <PhTarget weight="duotone" /> Metas <b>{{ done }}/{{ game.goals.length }}</b>
      <i v-if="bigPending" class="dot" title="Meta grande pronta para resgatar!" />
    </button>
    <div v-if="open" class="card drop" role="dialog" aria-label="Metas">
      <div class="tabs">
        <button class="btn sm" :class="{ primary: tab === 'daily' }" @click="tab = 'daily'">
          Do Dia ({{ done }}/{{ game.goals.length }})
        </button>
        <button class="btn sm" :class="{ primary: tab === 'big' }" @click="tab = 'big'">
          <PhTrophy weight="fill" /> Grandes ({{ bigClaimed }}/{{ bigRows.length }})
          <b v-if="bigPending" class="badge-mini">{{ bigPending }}</b>
        </button>
      </div>

      <template v-if="tab === 'daily'">
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
      </template>

      <div v-else class="big-list">
        <b class="title">Metas Grandes de Carreira</b>
        <div v-for="g in bigRows" :key="g.id" class="goal" :class="{ done: g.claimed, ready: g.ready }">
          <component :is="g.claimed ? PhCheckCircle : g.ready ? PhGift : PhTrophy" weight="fill" class="ico" />
          <div class="col">
            <span class="cat">{{ g.cat }}</span>
            <span class="text">{{ g.text }}</span>
            <div class="bar"><i :style="{ width: Math.min(100, (g.cur / g.target) * 100) + '%' }" /></div>
            <span class="muted small">{{ fmt(g, g.cur) }} de {{ fmt(g, g.target) }} · <b class="xp-inline">{{ rewardText(g.reward) }}</b></span>
          </div>
          <button v-if="g.ready" class="btn good sm" @click="claimBigGoal(g.id)">Resgatar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.goals { position: relative; }
.pill { position: relative; display: flex; gap: 8px; align-items: center; padding: 8px 14px; font: inherit; color: inherit; cursor: pointer; }
.pill:hover { box-shadow: inset 0 0 0 2px var(--teal), var(--shadow); }
.pill.all { background: #e3f4ec; }
.dot { position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 2px #fff; }
.drop { position: absolute; top: calc(100% + 6px); right: 0; width: min(360px, calc(100vw - 24px)); max-height: 70vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; z-index: 15; }
@media (max-width: 640px) { .drop { position: fixed; top: 116px; left: 12px; right: 12px; width: auto; } }
.tabs { display: flex; gap: 6px; }
.tabs .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 12px; }
.badge-mini { background: var(--mustard); color: var(--plum); border-radius: 99px; padding: 0 5px; font-size: 10px; }
.title { font-size: 1.05em; }
.small { font-size: 12px; margin: 0; }
.big-list { display: flex; flex-direction: column; gap: 8px; }
.goal { display: flex; gap: 8px; align-items: flex-start; }
.ico { font-size: 20px; color: var(--cream2); flex: none; margin-top: 1px; }
.goal.done .ico { color: var(--good); }
.goal.ready .ico { color: var(--mustard); }
.goal.failed .ico { color: var(--coral); }
.goal.done .text { text-decoration: line-through; opacity: .7; }
.col { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; font-size: 13px; }
.cat { font-size: 10px; font-weight: 800; text-transform: uppercase; opacity: .6; }
.bar { height: 6px; background: var(--cream2); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--teal); transition: width .3s; }
.xp { font-size: 12px; font-weight: 800; color: #a8740f; white-space: nowrap; }
.xp-inline { color: #a8740f; }
</style>
