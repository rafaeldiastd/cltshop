<script setup>
import { computed } from 'vue'
import { PhCheck, PhCoins, PhGift, PhLock, PhSnowflake, PhTicket } from '@phosphor-icons/vue'
import { game, money, xpNext, passLevel, passClaimed, passClaimable, passPending, claimPass, claimAllPass } from '../game/state.js'
import { PASS, PID } from '../game/config.js'
import { productThumb } from '../game/assets.js'

const level = computed(() => passLevel())
const tiers = computed(() => PASS.map((r, i) => ({ ...r, level: i + 1 })))
const pct = computed(() => Math.min(100, (game.career.xp / xpNext()) * 100))
const state = (t) => (passClaimed(t.level) ? 'claimed' : passClaimable(t.level) ? 'ready' : t.level === level.value + 1 ? 'next' : 'locked')
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhTicket weight="duotone" /> Passe da Lojinha</h2>
        <p class="muted">Cada nível de experiência libera uma recompensa: novos fornecedores e bônus no caixa. Experiência vem de clientes atendidos, entregas e metas do dia.</p>
      </div>
      <button class="btn primary" :disabled="!passPending()" @click="claimAllPass"><PhGift weight="fill" /> Resgatar {{ passPending() ? `(${passPending()})` : 'tudo' }}</button>
    </div>

    <div class="xp">
      <div class="lv"><span>Nível</span><b>{{ level }}</b></div>
      <div class="bar-col">
        <div class="info"><span>Próximo nível</span><b>{{ game.career.xp }} / {{ xpNext() }} XP</b></div>
        <div class="bar"><i :style="{ width: pct + '%' }" /></div>
      </div>
    </div>

    <div class="track">
      <article v-for="t in tiers" :key="t.level" class="tier" :class="state(t)">
        <span class="num">Nível {{ t.level }}</span>
        <img v-if="t.product" :src="productThumb(t.product)" alt="" />
        <b v-if="t.product" class="name">{{ PID[t.product].name }} <PhSnowflake v-if="PID[t.product].cold" class="cold" weight="bold" /></b>
        <span v-if="t.product" class="muted small">{{ game.unlocked[t.product] && !passClaimed(t.level) ? 'fornecedor já liberado' : 'novo fornecedor' }}</span>
        <span v-if="t.money" class="bonus"><PhCoins weight="fill" /> + {{ money(t.money) }}</span>
        <button v-if="state(t) === 'ready'" class="btn good sm" @click="claimPass(t.level)">Resgatar</button>
        <span v-else-if="state(t) === 'claimed'" class="tag ok"><PhCheck weight="bold" /> Resgatado</span>
        <span v-else class="tag"><PhLock weight="fill" /> {{ state(t) === 'next' ? 'Próximo' : 'Bloqueado' }}</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 12px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 2px 0 0; max-width: 560px; }
.xp { display: flex; gap: 12px; align-items: center; background: #fff; border-radius: 12px; padding: 10px 14px; }
.lv { display: flex; flex-direction: column; align-items: center; background: var(--plum); color: var(--cream); border-radius: 12px; padding: 4px 14px; line-height: 1.1; }
.lv span { font-size: 11px; font-weight: 700; opacity: .8; }
.lv b { font-size: 1.6em; }
.bar-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.info { display: flex; justify-content: space-between; font-size: 12px; }
.bar { height: 10px; background: var(--cream2); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--mustard)); transition: width .3s; }
.track { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-content: start; padding-right: 4px; }
.tier { display: flex; flex-direction: column; align-items: center; gap: 4px; background: #fff; border-radius: 12px; padding: 10px; text-align: center; border: 2px solid transparent; }
.tier img { width: 56px; height: 56px; }
.tier.locked { opacity: .55; }
.tier.next { border-color: var(--cream2); }
.tier.ready { border-color: var(--mustard); background: #fffaf0; }
.tier.claimed { border-color: var(--teal); background: #f3faf7; }
.num { font-size: 11px; font-weight: 800; text-transform: uppercase; opacity: .6; }
.name { display: inline-flex; align-items: center; gap: 4px; }
.cold { color: #4d8fc4; }
.small { font-size: 12px; }
.bonus { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #a8740f; font-size: 13px; }
.tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; opacity: .75; }
.tag.ok { color: var(--good); opacity: 1; }
.tier .btn { width: 100%; }
</style>
