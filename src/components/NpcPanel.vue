<script setup>
import { computed } from 'vue'
import { PhUser, PhX, PhMagnifyingGlass, PhShoppingCart, PhSmiley, PhSmileyWink, PhSmileyMeh, PhSmileySad, PhSmileyXEyes, PhStar, PhWallet } from '@phosphor-icons/vue'
import { ui, money } from '../game/state.js'
import { personThumb } from '../game/assets.js'

const info = computed(() => (ui.npc && ui.npcInfo ? ui.npcInfo : null))
const close = () => { ui.npc = null; ui.npcInfo = null }
const qty = (i) => (i.qty > 1 ? `${i.qty}× ` : '')
// humor pela satisfação: quanto mais contente, mais sorridente
const mood = (m) => (m >= 75 ? { icon: PhSmileyWink, label: 'Muito contente' }
  : m >= 50 ? { icon: PhSmiley, label: 'Contente' }
  : m >= 30 ? { icon: PhSmileyMeh, label: 'Desanimado' }
  : m >= 15 ? { icon: PhSmileySad, label: 'Chateado' }
  : { icon: PhSmileyXEyes, label: 'Revoltado' })
</script>

<template>
  <div v-if="info" class="card panel">
    <div class="head">
      <b><PhUser weight="duotone" /> {{ info.kind === 'staff' ? info.name : `${info.name}, ${info.age} anos` }}</b>
      <button class="btn sm" aria-label="Fechar" @click="close"><PhX weight="bold" /></button>
    </div>
    <div v-if="info.kind === 'staff'" class="team-card">
      <img v-if="personThumb(info.g, info.look)" :src="personThumb(info.g, info.look)" alt="" class="portrait" />
      <div class="team-info">
        <div class="sub">{{ info.roleLabel }}</div>
        <div class="mood"><component :is="mood(info.morale).icon" weight="fill" /> {{ mood(info.morale).label }}</div>
        <div class="energy">
          <span>Energia {{ info.energy }}%</span>
          <div class="bar"><div class="fill" :class="{ low: info.energy < 30 }" :style="{ width: info.energy + '%' }" /></div>
        </div>
      </div>
    </div>
    <div class="status">{{ info.status }}</div>

    <template v-if="info.kind === 'customer'">
      <section v-if="info.emotions.length">
        <h4>Sentiu</h4>
        <ul class="emo">
          <li v-for="(e, n) in info.emotions" :key="'e' + n"><span class="emoji">{{ e.emoji }}</span> {{ e.text }}</li>
        </ul>
      </section>

      <section>
        <h4><PhMagnifyingGlass weight="duotone" /> Veio buscar</h4>
        <p v-if="!info.came.length" class="muted">Só olhar.</p>
        <ul v-else>
          <li v-for="(i, n) in info.came" :key="'v' + n">{{ qty(i) }}{{ i.name }}</li>
        </ul>
      </section>

      <section v-if="info.unseen.length">
        <h4><PhMagnifyingGlass weight="duotone" /> Não viu</h4>
        <ul>
          <li v-for="(m, n) in info.unseen" :key="'u' + n">{{ m }}</li>
        </ul>
      </section>

      <section v-if="info.missing.length">
        <h4><PhSmiley weight="duotone" /> Faltou</h4>
        <ul>
          <li v-for="(m, n) in info.missing" :key="'f' + n" class="bad-t">{{ m }}</li>
        </ul>
      </section>

      <section v-if="info.pricey.length">
        <h4><PhWallet weight="duotone" /> Achou caro</h4>
        <ul>
          <li v-for="(p, n) in info.pricey" :key="'p' + n">
            {{ p.name }} <span class="right">{{ money(p.price) }}</span>
            <div v-if="p.willing != null" class="muted small">queria pagar até {{ money(p.willing) }}</div>
          </li>
        </ul>
      </section>

      <section>
        <h4><PhShoppingCart weight="duotone" /> Comprou</h4>
        <p v-if="!info.bought.length" class="muted">Nada ainda.</p>
        <ul v-else>
          <li v-for="(b, n) in info.bought" :key="'b' + n">{{ qty(b) }}{{ b.name }} <span class="right">{{ money(b.total) }}</span></li>
        </ul>
        <div v-if="info.bought.length" class="total">Total <b>{{ money(info.total) }}</b></div>
      </section>
    </template>

    <template v-else>
      <section>
        <h4><PhStar weight="duotone" /> Habilidades</h4>
        <ul>
          <li>Competência <b>{{ info.skill }}/5</b></li>
          <li>Velocidade <b>{{ info.speed }}/5</b></li>
          <li>Nível {{ info.level }} <span class="right">{{ info.xp }}% do próximo</span></li>
        </ul>
      </section>

      <section>
        <h4><PhSmiley weight="duotone" /> Hoje</h4>
        <ul>
          <li>Ocupação <b>{{ info.busy }}%</b> do expediente</li>
          <li>Satisfação <b>{{ info.morale }}%</b></li>
        </ul>
      </section>

      <section>
        <h4><PhWallet weight="duotone" /> Salário</h4>
        <ul>
          <li>Recebe <b>{{ money(info.wage) }}/dia</b></li>
          <li>Justo para o cargo <b>{{ money(info.fair) }}/dia</b></li>
          <li v-if="info.hiredDay">Na equipe desde o dia {{ info.hiredDay }}</li>
        </ul>
      </section>

      <section v-if="info.request">
        <h4>Pedido</h4>
        <p>{{ info.request }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel { position: fixed; right: 84px; top: 72px; width: 300px; max-height: calc(100vh - 92px); overflow-y: auto; z-index: 12; display: flex; flex-direction: column; gap: 8px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 1.05em; }
.sub { font-size: 13px; font-weight: 700; }
.team-card { display: flex; gap: 10px; align-items: center; }
.portrait { width: 68px; height: 68px; border-radius: 50%; flex: none; background: var(--cream); border: 2px solid var(--plum); object-fit: cover; }
.team-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mood { display: flex; gap: 6px; align-items: center; font-size: 13px; font-weight: 700; }
.mood :deep(svg) { width: 20px; height: 20px; }
.energy { display: flex; flex-direction: column; gap: 3px; }
.energy span { font-size: 12px; font-weight: 700; }
.bar { height: 10px; border-radius: 6px; background: rgba(59, 47, 74, .15); overflow: hidden; }
.fill { height: 100%; background: #6fb3a8; transition: width .3s; }
.fill.low { background: #ef8a77; }
.status { font-size: 12px; font-weight: 700; align-self: flex-start; background: var(--mustard); border-radius: 9px; padding: 3px 9px; }
section { border-bottom: 1px dashed rgba(59, 47, 74, .15); padding-bottom: 6px; }
h4 { display: flex; align-items: center; gap: 6px; margin: 4px 0; font-size: 13px; }
ul { margin: 0; padding-left: 22px; font-size: 13px; }
p { margin: 0; font-size: 13px; }
.right { float: right; font-weight: 700; }
.emo { list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 3px; }
.emoji { display: inline-block; width: 22px; text-align: center; }
.total { display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px; }
</style>
