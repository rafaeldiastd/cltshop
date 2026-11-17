<script setup>
import { computed } from 'vue'
import {
  PhPlay,
  PhTrophy,
  PhX,
  PhGlobe,
} from '@phosphor-icons/vue'
import { game, ui, money } from '../game/state.js'
import { mp, visitStore } from '../game/multiplayer.js'

const decor = computed(() => game.decor.find((d) => d.id === ui.panelArcade))

const meta = computed(() => {
  const t = decor.value?.type
  if (t === 'dance') {
    return {
      emoji: '💃',
      title: 'Máquina de Dança',
      mode: 'Ritmo Guitar Hero (Q W E R)',
      desc: 'Notas musicais descendo pelas 4 pistas! Acerte no tempo da barra.',
    }
  }
  if (t === 'pinball') {
    return {
      emoji: '🎱',
      title: 'Pinball Space',
      mode: 'Flippers & Bumpers (A / D)',
      desc: 'Rebata a bolinha espacial nos bumpers iluminados antes que ela caia!',
    }
  }
  return {
    emoji: '🕹️',
    title: 'Fliperama Clássico',
    mode: 'Reflexo Rápido (W A S D)',
    desc: 'Acerte as direções na hora certa para multiplicar seu combo até 5×!',
  }
})

const topRecord = computed(() => decor.value?.highScore || null)

const rankingList = computed(() => {
  const d = decor.value
  if (!d) return []
  const byKey = new Map()
  const raw = Array.isArray(d.scores) && d.scores.length ? d.scores : d.highScore ? [d.highScore] : []

  const onlineByCode = new Map()
  for (const s of mp.onlineStores) {
    onlineByCode.set(s.code, s)
  }

  for (const r of raw) {
    if (!r || !(r.score > 0)) continue
    const k = r.storeCode || r.holder || 'Visitante'
    const online = r.storeCode ? onlineByCode.get(r.storeCode) : null
    const cur = byKey.get(k)
    if (!cur || r.score > cur.score) {
      byKey.set(k, {
        key: k,
        holder: r.holder || online?.snapshot?.host?.name || 'Jogador',
        storeName: r.storeName || online?.storeName || '',
        storeCode: r.storeCode || '',
        score: r.score,
        live: !!online?.live,
      })
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
})

function playNow() {
  if (!decor.value) return
  ui.arcadeDecorId = decor.value.id
  ui.modal = 'arcade'
}

function goVisit(code) {
  if (!code || code === mp.myCode || code === mp.visiting?.code) return
  ui.panelArcade = null
  visitStore(code)
}

function close() {
  ui.panelArcade = null
}

function rankMedal(idx, score) {
  if (score <= 0) return `#${idx + 1}`
  if (idx === 0) return '🥇'
  if (idx === 1) return '🥈'
  if (idx === 2) return '🥉'
  return `#${idx + 1}`
}
</script>

<template>
  <div v-if="decor" class="card panel">
    <div class="head">
      <div class="title-wrap">
        <span class="big-ico">{{ meta.emoji }}</span>
        <div class="title-col">
          <b>{{ meta.title }}</b>
          <span class="mode-tag">{{ meta.mode }}</span>
        </div>
      </div>
      <button class="btn sm" aria-label="Fechar" @click="close"><PhX weight="bold" /></button>
    </div>

    <p class="desc muted">{{ meta.desc }}</p>

    <div class="top-card" :class="{ empty: !topRecord?.score }">
      <PhTrophy weight="fill" class="trophy-ico" />
      <div class="top-info">
        <span class="small muted">Top 1 Recorde da Máquina</span>
        <b v-if="topRecord?.score">{{ topRecord.holder }} — {{ topRecord.score }} pts</b>
        <b v-else>Sem recorde ainda</b>
      </div>
    </div>

    <button class="btn primary play-btn" @click="playNow">
      <PhPlay weight="fill" />
      <span>Jogar Agora {{ mp.visiting ? `(${money(5)})` : '(Grátis)' }}</span>
    </button>

    <section class="rank-sec">
      <div class="rank-head">
        <h4><PhTrophy weight="duotone" /> Ranking da Máquina ({{ rankingList.length }})</h4>
      </div>

      <div v-if="rankingList.length" class="rank-list">
        <div
          v-for="(entry, idx) in rankingList"
          :key="entry.key"
          class="rank-row"
          :class="{
            first: idx === 0 && entry.score > 0,
            me: entry.storeCode === mp.myCode,
          }"
        >
          <span class="pos">{{ rankMedal(idx, entry.score) }}</span>
          <div class="entry-info">
            <div class="entry-top">
              <b class="holder">{{ entry.holder }}</b>
              <span v-if="entry.live" class="live-dot" title="Online agora">●</span>
            </div>
            <div class="entry-sub">
              <span>{{ entry.storeName || (entry.storeCode ? `Loja #${entry.storeCode}` : 'Sem loja vinculada') }}</span>
              <b class="pts">{{ entry.score }} pts</b>
            </div>
          </div>
          <span v-if="entry.storeCode === mp.myCode" class="me-pill">Você</span>
          <span v-else-if="entry.storeCode && entry.storeCode === mp.visiting?.code" class="here-pill">Aqui</span>
          <button
            v-else-if="entry.storeCode"
            class="btn good sm visit-btn"
            :title="`Visitar loja de ${entry.holder}`"
            @click="goVisit(entry.storeCode)"
          >
            <PhGlobe weight="bold" />
            <span>Visitar</span>
          </button>
        </div>
      </div>
      <p v-else class="muted small">Ninguém jogou nesta máquina ainda. Seja o 1º a cravar seu nome!</p>
    </section>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 84px;
  top: 72px;
  width: 318px;
  max-height: calc(100vh - 92px);
  overflow-y: auto;
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.big-ico {
  font-size: 26px;
  line-height: 1;
}
.title-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title-col b {
  font-size: 1.02em;
  line-height: 1.1;
}
.mode-tag {
  font-size: 11px;
  font-weight: 800;
  color: var(--teal);
}
.desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
}
.small {
  font-size: 11.5px;
}
.top-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #fffbeb;
  border: 2px solid #f59e0b;
}
.top-card.empty {
  background: var(--cream2);
  border-color: rgba(59, 47, 74, 0.14);
}
.trophy-ico {
  font-size: 22px;
  color: #d97706;
  flex: none;
}
.top-card.empty .trophy-ico {
  color: var(--plum2);
  opacity: 0.45;
}
.top-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-size: 12.5px;
}
.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 9px 12px;
  font-size: 14px;
}
.rank-sec {
  border-top: 1px dashed rgba(59, 47, 74, 0.18);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rank-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.rank-head h4 {
  margin: 0;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  background: #fff;
  border: 1.5px solid var(--cream2);
}
.rank-row.first {
  background: #fffbeb;
  border-color: #fbbf24;
}
.rank-row.me {
  border-color: var(--teal);
}
.pos {
  width: 24px;
  text-align: center;
  font-weight: 900;
  font-size: 13px;
  flex: none;
}
.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.entry-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.holder {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.live-dot {
  color: #16a34a;
  font-size: 9px;
}
.entry-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--plum2);
}
.entry-sub span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pts {
  color: var(--plum);
  flex: none;
}
.visit-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  font-size: 11.5px;
  flex: none;
}
.me-pill,
.here-pill {
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--cream2);
  color: var(--plum2);
  flex: none;
}
.here-pill {
  background: #e0f2fe;
  color: #0369a1;
}
</style>
