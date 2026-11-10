<script setup>
import { computed } from 'vue'
import { PhHandCoins, PhBatteryHigh, PhBatteryLow, PhBatteryMedium, PhCheck, PhMegaphone, PhSmiley, PhSmileyMeh, PhSmileySad, PhUserPlus, PhUsersThree, PhX, PhUserMinus, PhCalendarX, PhTrendUp } from '@phosphor-icons/vue'
import { game, money, wages } from '../game/state.js'
import { STAFF, TEAM, levelXp, SKILL_SPEED, WALK_SPEED } from '../game/config.js'
import { memberRole, hireCandidate, hireBlock, fireMember, severance, postJobAd, answerRequest, requestText, pendingRequests, isOff, isTired, underpaid, fairWage, giveRaise, raiseCost, overloaded, wageScore, energyDrain, pctText } from '../game/team.js'
import { personThumb } from '../game/assets.js'

const team = computed(() => [...game.team].sort((a, b) => Object.keys(STAFF).indexOf(a.role) - Object.keys(STAFF).indexOf(b.role)))
const asking = computed(() => pendingRequests())
const mood = (m) => (m.morale >= 60 ? PhSmiley : m.morale >= 35 ? PhSmileyMeh : PhSmileySad)
const moodText = (m) => (m.morale >= 60 ? 'Satisfeit' : m.morale >= 35 ? 'Neutr' : 'Insatisfeit') + (m.g === 'f' ? 'a' : 'o')
const battery = (m) => (m.energy >= 60 ? PhBatteryHigh : m.energy >= 30 ? PhBatteryMedium : PhBatteryLow)
// quanto o salário pedido está acima ou abaixo do justo para o que a pessoa sabe fazer
// o que cada ponto significa: competência = velocidade nas tarefas, velocidade = andar; cansaço = gasto de energia
const skillTxt = (n) => `${pctText(SKILL_SPEED[n - 1])} nas tarefas`
const walkTxt = (n) => `anda ${pctText(WALK_SPEED[n - 1])}`
const drainTxt = (m) => { const d = energyDrain(m); return d < 0.8 ? 'cansa pouco' : d > 1.25 ? 'cansa rápido' : 'cansa normal' }
// carga de ontem x salário: equilibrado, bem pago ou sobrecarregado
const loadInfo = (m) => (m.lastLoad == null ? null : overloaded(m) ? { text: m.lastLoad >= 0.5 ? 'sobrecarregado' : 'mal pago', cls: 'bad' } : wageScore(m) > 1.12 ? { text: 'bem pago', cls: 'ok' } : { text: 'equilibrado', cls: 'mid' })
const deal = (c) => {
  const r = c.wage / fairWage(c.role, c.skill, c.speed)
  return r < 0.95 ? { text: 'pechincha', cls: 'good-t' } : r > 1.07 ? { text: 'pede acima', cls: 'bad-t' } : null
}
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhUsersThree weight="duotone" /> Equipe</h2>
        <p class="muted">Salários/dia: <b>{{ money(wages()) }}</b> · funcionários ganham nível trabalhando, cansam ao longo do expediente e descansam no almoço.</p>
      </div>
    </div>

    <div class="scroll">
      <template v-if="asking.length">
        <h3>Pedidos da equipe</h3>
        <div v-for="m in asking" :key="'r' + m.id" class="req">
          <img v-if="personThumb(m.g, m.look)" :src="personThumb(m.g, m.look)" alt="" class="face sm" />
          <div class="col"><b>{{ m.name }}</b><span>{{ requestText(m) }}</span><span class="muted small">Responda em até {{ TEAM.requestDays }} dias</span></div>
          <div class="btns">
            <button class="btn sm" @click="answerRequest(m.id, false)"><PhX weight="bold" /> Recusar</button>
            <button class="btn good sm" :disabled="m.request.cost && game.money < m.request.cost" @click="answerRequest(m.id, true)"><PhCheck weight="bold" /> Aceitar{{ m.request.cost ? ` · ${money(m.request.cost)}` : '' }}</button>
          </div>
        </div>
      </template>

      <h3>Contratados <span class="muted small">{{ game.team.length }}</span></h3>
      <p v-if="!team.length" class="muted">Ninguém na equipe ainda. Escolha alguém no catálogo abaixo.</p>
      <div class="cards">
        <article v-for="m in team" :key="m.id" class="person" :class="{ off: isOff(m) }">
          <div class="top">
            <img v-if="personThumb(m.g, m.look)" :src="personThumb(m.g, m.look)" alt="" class="face" />
            <div class="col">
              <b>{{ m.name }}</b>
              <span class="muted small">{{ memberRole(m) }} · nível {{ m.level }}</span>
              <span v-if="isOff(m)" class="pill warn"><PhCalendarX weight="bold" /> De folga hoje</span>
            </div>
          </div>
          <div class="stat"><span>Competência</span><span class="dots"><i v-for="n in 5" :key="n" :class="{ on: n <= m.skill }" /></span></div>
          <div class="stat"><span>Velocidade</span><span class="dots"><i v-for="n in 5" :key="n" :class="{ on: n <= m.speed }" /></span></div>
          <div class="stat"><span>Experiência</span><span class="mini"><i :style="{ width: (m.xp / levelXp(m.level)) * 100 + '%' }" /></span></div>
          <div class="stat"><span><component :is="battery(m)" weight="bold" /> Energia</span><span class="mini" :class="{ low: isTired(m) }"><i :style="{ width: m.energy + '%' }" /></span></div>
          <div class="stat"><span><component :is="mood(m)" weight="bold" /> {{ moodText(m) }}</span><span class="mini mood"><i :style="{ width: m.morale + '%' }" /></span></div>
          <div class="stat" :title="'Quanto ficou ocupado no último expediente, comparado ao que ganha por dia'">
            <span>Carga</span>
            <span v-if="loadInfo(m)" class="chip" :class="loadInfo(m).cls">{{ loadInfo(m).text }}</span>
          </div>
          <button class="btn sm good raise" :title="'Aumenta o salário diário e anima a pessoa'" @click="giveRaise(m.id)"><PhHandCoins weight="bold" /> Dar aumento · +{{ money(raiseCost(m)) }}/dia</button>
          <div class="foot">
            <span><b>{{ money(m.wage) }}</b>/dia <span v-if="underpaid(m)" class="bad-t small" title="Subiu de nível e ganha abaixo do justo"><PhTrendUp weight="bold" /> abaixo do justo</span></span>
            <button class="btn sm" :title="`Rescisão de ${money(severance(m))}`" @click="fireMember(m.id)"><PhUserMinus weight="bold" /> Demitir · {{ money(severance(m)) }}</button>
          </div>
        </article>
      </div>

      <div class="cand-head">
        <h3>Catálogo de candidatos</h3>
        <button class="btn sm" :disabled="game.money < TEAM.adCost" @click="postJobAd"><PhMegaphone weight="bold" /> Novo anúncio · {{ money(TEAM.adCost) }}</button>
      </div>
      <p class="muted small">Todo dia chegam {{ TEAM.newPerDay }} candidatos novos. </p>
      <div class="cards">
        <article v-for="c in game.candidates" :key="c.id" class="person cand">
          <div class="top">
            <img v-if="personThumb(c.g, c.look)" :src="personThumb(c.g, c.look)" alt="" class="face" />
            <div class="col">
              <b>{{ c.name }}</b>
              <span class="muted small">{{ memberRole(c) }}</span>
            </div>
          </div>
          <div class="stat"><span>Competência</span><span class="dots"><i v-for="n in 5" :key="n" :class="{ on: n <= c.skill }" /></span></div>
          <div class="stat"><span>Velocidade</span><span class="dots"><i v-for="n in 5" :key="n" :class="{ on: n <= c.speed }" /></span></div>
          <div class="foot">
            <span>pede <b>{{ money(c.wage) }}</b>/dia <span v-if="deal(c)" class="small" :class="deal(c).cls">{{ deal(c).text }}</span></span>
          </div>
          <button class="btn good sm" :disabled="!!hireBlock(c)" :title="hireBlock(c) || ''" @click="hireCandidate(c.id)"><PhUserPlus weight="bold" /> {{ hireBlock(c) && hireBlock(c) !== 'Caixa insuficiente' ? hireBlock(c) : `Contratar · ${money(STAFF[c.role].hire)}` }}</button>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 12px 0 6px; font-size: 1em; }
p { margin: 2px 0; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.small { font-size: 12px; }
.req { display: flex; align-items: center; gap: 10px; background: #fffaf0; border: 2px solid var(--mustard); border-radius: 12px; padding: 8px 12px; margin-bottom: 6px; font-size: 14px; }
.col { flex: 1; display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.person { background: #fff; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; font-size: 13px; }
.person.off { opacity: .7; }
.top { display: flex; gap: 10px; align-items: center; }
.face { width: 48px; height: 48px; border-radius: 10px; background: var(--cream2); flex: none; }
.face.sm { width: 38px; height: 38px; }
.pill { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800; border-radius: 99px; padding: 1px 8px; width: fit-content; }
.pill.warn { background: #fde7c2; color: #8a5a00; }
.stat { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.stat > span:first-child { display: inline-flex; align-items: center; gap: 4px; }
.dots { display: inline-flex; gap: 3px; }
.dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--cream2); }
.dots i.on { background: var(--teal); }
.mini { width: 80px; height: 7px; background: var(--cream2); border-radius: 99px; overflow: hidden; }
.mini i { display: block; height: 100%; background: var(--teal); }
.mini.low i { background: var(--coral); }
.mini.mood i { background: var(--mustard); }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.cand .btn { width: 100%; }
.hint { font-style: normal; font-size: 11px; opacity: .65; margin-left: 4px; }
.raise { width: 100%; }
.chip { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 99px; background: var(--cream2); }
.chip.bad { background: #f4c3bd; color: #8a2e26; } .chip.ok { background: #d9efdf; color: #245c43; }
.cand-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
</style>
