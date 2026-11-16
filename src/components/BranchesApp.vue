<script setup>
import { computed } from 'vue'
import { PhBuildings, PhCheckCircle, PhMapPin, PhPlusCircle, PhArrowsLeftRight } from '@phosphor-icons/vue'
import { game, money, isClosed, regionOf, allBranches, hasRegionBranch, branchDailyProfit, changeMainRegion, buyBranch, switchBranch } from '../game/state.js'
import { REGIONS } from '../game/config.js'

const curRegion = computed(() => regionOf())
const units = computed(() => allBranches())
const regionList = computed(() => Object.values(REGIONS))
const freeStartPick = computed(() => game.day === 1 && game.phase === 'prep' && !game.branches.length)
const stockedCount = (b) => (b.shelves || []).filter((s) => s.product && s.count > 0).length
</script>

<template>
  <div class="app">
    <div class="top-row">
      <h2><PhBuildings weight="duotone" /> Regiões & Filiais</h2>
      <span class="muted small">{{ isClosed() ? 'Loja fechada: pode abrir ou alternar unidades' : 'Feche a loja para gerenciar filiais' }}</span>
    </div>

    <div class="scroll">
      <section class="cur-card">
        <div class="cur-head">
          <span class="emoji">{{ curRegion.emoji }}</span>
          <div class="col">
            <b>{{ game.branchName }} · {{ curRegion.name }}</b>
            <span class="muted small">Unidade atualmente gerenciada</span>
          </div>
          <span v-if="freeStartPick" class="free-pill">Troca inicial grátis no Dia 1!</span>
        </div>
        <div class="mods">
          <span v-for="b in curRegion.buffs" :key="b" class="chip buff">+ {{ b }}</span>
          <span v-for="d in curRegion.debuffs" :key="d" class="chip debuff">− {{ d }}</span>
        </div>
      </section>

      <h3><PhMapPin weight="duotone" /> Suas Lojas ({{ units.length }})</h3>
      <div class="units">
        <article v-for="u in units" :key="u.id" class="unit" :class="{ active: u.active }">
          <div class="u-head">
            <span class="emoji">{{ regionOf(u.region).emoji }}</span>
            <div class="col">
              <b>{{ u.name }}</b>
              <span class="muted small">{{ regionOf(u.region).name }} · {{ stockedCount(u) }} prat. abastecidas · {{ (u.team || []).length }} equipe</span>
            </div>
            <span v-if="!u.active" class="profit" :class="branchDailyProfit(u) >= 0 ? 'good-t' : 'bad-t'">
              {{ branchDailyProfit(u) >= 0 ? '+' : '−' }}{{ money(Math.abs(branchDailyProfit(u))) }}/dia
            </span>
          </div>
          <button v-if="u.active" class="btn sm" disabled><PhCheckCircle weight="fill" /> Ativa agora</button>
          <button v-else class="btn good sm" :disabled="!isClosed()" @click="switchBranch(u.id)"><PhArrowsLeftRight weight="bold" /> Ir para esta loja</button>
        </article>
      </div>

      <h3>Abrir Filial ou Mudar de Região</h3>
      <div class="regions">
        <article v-for="r in regionList" :key="r.id" class="reg" :class="{ current: game.region === r.id }">
          <div class="reg-head">
            <span class="emoji">{{ r.emoji }}</span>
            <div class="col">
              <b>{{ r.name }}</b>
              <span class="muted small">Nova filial: {{ money(r.cost) }}</span>
            </div>
          </div>
          <div class="mods">
            <span v-for="b in r.buffs" :key="b" class="chip buff">+ {{ b }}</span>
            <span v-for="d in r.debuffs" :key="d" class="chip debuff">− {{ d }}</span>
          </div>
          <div class="reg-actions">
            <button
              v-if="game.region === r.id"
              class="btn sm"
              disabled
            >Unidade atual aqui</button>
            <template v-else>
              <button
                v-if="!hasRegionBranch(r.id)"
                class="btn sm"
                :disabled="(!freeStartPick && (!isClosed() || game.money < 300))"
                @click="changeMainRegion(r.id)"
              >
                {{ freeStartPick ? 'Escolher grátis' : 'Mudar para cá · R$ 300' }}
              </button>
              <button
                v-if="!hasRegionBranch(r.id)"
                class="btn good sm"
                :disabled="!isClosed() || game.money < r.cost"
                @click="buyBranch(r.id)"
              >
                <PhPlusCircle weight="bold" /> Abrir Filial · {{ money(r.cost) }}
              </button>
              <span v-else class="muted small">Filial já aberta nesta região</span>
            </template>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.top-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
h2 { margin: 0; font-size: 1.25em; display: flex; align-items: center; gap: 6px; }
h3 { margin: 12px 0 6px; font-size: 1em; display: flex; align-items: center; gap: 6px; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px; }
.cur-card { background: #fff; border-radius: 14px; padding: 10px 12px; border: 2px solid var(--teal); display: flex; flex-direction: column; gap: 8px; }
.cur-head { display: flex; align-items: center; gap: 10px; }
.emoji { font-size: 26px; line-height: 1; }
.col { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.small { font-size: 12px; }
.free-pill { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; }
.mods { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.chip.buff { background: #dcfce7; color: #166534; }
.chip.debuff { background: #fee2e2; color: #991b1b; }
.units { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
.unit { background: #fff; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; border: 2px solid var(--cream2); }
.unit.active { border-color: var(--teal); background: #f3faf7; }
.u-head { display: flex; align-items: center; gap: 8px; }
.profit { font-weight: 800; font-size: 12px; white-space: nowrap; }
.regions { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.reg { background: #fff; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; border: 2px solid var(--cream2); }
.reg.current { border-color: var(--mustard); }
.reg-head { display: flex; align-items: center; gap: 8px; }
.reg-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
</style>
