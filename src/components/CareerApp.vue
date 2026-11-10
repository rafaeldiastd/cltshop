<script setup>
import { computed } from 'vue'
import { PhGraduationCap, PhMedal, PhCheck, PhLock } from '@phosphor-icons/vue'
import { game, hasPerk, canBuyPerk, perkLocked, buyPerk, xpNext } from '../game/state.js'
import { CAREER } from '../game/config.js'

const career = computed(() => game.career)
const perks = CAREER
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhGraduationCap weight="duotone" /> Plano de Carreira</h2>
        <p class="muted">Ganhe experiência atendendo clientes e cumprindo as metas do dia. Cada nível dá um ponto de maestria para melhorias permanentes.</p>
      </div>
      <div class="points-badge">
        <PhMedal weight="fill" class="medal-ico" />
        <div class="badge-col">
          <span class="pts">{{ career.points }}</span>
          <span class="pts-lbl">{{ career.points === 1 ? 'Ponto disponível' : 'Pontos disponíveis' }}</span>
        </div>
      </div>
    </div>

    <div class="xp-bar-box">
      <div class="xp-info">
        <span>Nível {{ career.earned }} · cada nível dá 1 ponto e uma recompensa do passe</span>
        <b>{{ career.xp }} / {{ xpNext() }} XP</b>
      </div>
      <div class="xp-bar">
        <i :style="{ width: Math.min(100, (career.xp / xpNext()) * 100) + '%' }" />
      </div>
    </div>

    <div class="grid">
      <article
        v-for="p in perks"
        :key="p.id"
        class="card-perk"
        :class="{ owned: hasPerk(p.id), locked: perkLocked(p.id) && !hasPerk(p.id) }"
      >
        <div class="perk-top">
          <b>{{ p.name }}</b>
          <span v-if="hasPerk(p.id)" class="badge-owned"><PhCheck weight="bold" /> Ativo</span>
          <span v-else class="badge-cost">{{ p.cost }} {{ p.cost === 1 ? 'ponto' : 'pontos' }}</span>
        </div>
        <p class="desc">{{ p.desc }}</p>
        <div class="perk-foot">
          <span v-if="perkLocked(p.id) && !hasPerk(p.id)" class="req-text">
            <PhLock weight="fill" /> Requer: {{ perkLocked(p.id) }}
          </span>
          <button
            v-if="!hasPerk(p.id)"
            class="btn good sm"
            :disabled="!canBuyPerk(p.id)"
            @click="buyPerk(p.id)"
          >
            Aprender melhoria
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 12px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 2px 0 0; }
.points-badge { display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px 14px; border-radius: 12px; border: 2px solid var(--mustard); }
.medal-ico { font-size: 28px; color: var(--mustard); }
.badge-col { display: flex; flex-direction: column; }
.pts { font-size: 1.4em; font-weight: 800; line-height: 1; color: var(--plum); }
.pts-lbl { font-size: 11px; font-weight: 700; opacity: 0.7; }

.xp-bar-box { background: #fff; padding: 10px 14px; border-radius: 12px; display: flex; flex-direction: column; gap: 6px; }
.xp-info { display: flex; justify-content: space-between; font-size: 12px; }
.xp-bar { height: 8px; background: var(--cream2); border-radius: 99px; overflow: hidden; }
.xp-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--mustard)); transition: width 0.3s; }

.grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; align-content: start; padding-right: 4px; }
.card-perk { background: #fff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; border: 2px solid transparent; }
.card-perk.owned { border-color: var(--teal); background: #f3faf7; }
.card-perk.locked { opacity: 0.7; }
.perk-top { display: flex; justify-content: space-between; align-items: center; }
.badge-owned { background: var(--teal); color: #fff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px; display: inline-flex; align-items: center; gap: 4px; }
.badge-cost { background: var(--cream2); color: var(--plum); font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 99px; }
.desc { font-size: 13px; line-height: 1.35; flex: 1; color: #4a4055; }
.perk-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.req-text { font-size: 11px; font-weight: 700; color: var(--coral); display: flex; align-items: center; gap: 4px; }
</style>
