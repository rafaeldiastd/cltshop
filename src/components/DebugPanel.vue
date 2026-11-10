<script setup>
import { game, ui, uid, money, upgradeType, rollMarket, refOf, gainXp, xpNext } from '../game/state.js'
import { makeRequest, postJobAd } from '../game/team.js'
import { makeGoals } from '../game/goals.js'
import { world } from '../game/world.js'
import { PRODUCTS, PACK, SHELF_CAP, DAY_SECONDS, LEVELS, LUNCH } from '../game/config.js'

const addMoney = (n) => { game.money += n }
const addRep = (d) => { game.rep = Math.max(1, Math.min(5, game.rep + d)) }
const unlocked = () => PRODUCTS.filter((p) => game.unlocked[p.id])

const unlockAll = () => { for (const p of PRODUCTS) game.unlocked[p.id] = true }
const deliver = () => { for (const p of unlocked()) game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null }) }
function fillShelves() {
  for (const s of game.shelves) {
    if (!s.product) s.product = unlocked().find((p) => p.either || !!p.cold === !!s.fridge)?.id ?? null
    if (!s.product) continue
    s.count = SHELF_CAP
    s.price = s.price ?? game.priceMemory[s.product] ?? refOf(s.product)
    game.priceMemory[s.product] = s.price
  }
}
const emptyShelves = () => { for (const s of game.shelves) s.count = 0 }
function levelUp() {
  if (!LEVELS[game.level + 1]) return
  const m = game.money
  game.money = 1e9
  upgradeType()
  game.money = m
}

const isOpen = () => game.phase === 'open'
const goTo = (hour) => { if (isOpen()) game.clock = ((hour - 9) / 12) * DAY_SECONDS }
function openShop() { ui.modal = null; world.openShop() }
function endDay() { if (isOpen()) game.clock = DAY_SECONDS; ui.modal = null }
function nextDay() { if (game.phase === 'night') world.startNextDay() }
const lunchAt = (LUNCH.start / DAY_SECONDS) * 12 + 9

const spawnCustomers = () => { for (let i = 0; i < 5; i++) world.spawnCustomer() }
const levelUpXp = () => gainXp(xpNext() - game.career.xp)
// sujeira em lugares aleatórios do salão
function makeDirt() {
  const types = ['mud', 'spill', 'crumbs']
  for (let i = 0; i < 8; i++) world.addDirt(Math.floor(Math.random() * world.d.cols), Math.floor(Math.random() * world.d.rows), types[i % 3])
}
const wearFreezers = () => { for (const s of game.shelves) if (s.fridge && !s.broken) s.wear = Math.min(99, (s.wear || 0) + 40) }
const breakFreezer = () => { const s = game.shelves.find((x) => x.fridge && !x.broken); if (s) world.breakFreezer(s) }
const tired = () => { for (const m of game.team) m.energy = 15 }
// um pedido novo para cada funcionário que ainda não tem
function requests() {
  for (const m of game.team) if (!m.request) m.request = makeRequest(m) || { type: 'dayoff', day: game.day }
}
function thief() { ui.modal = null; world.spawnThief() }
</script>

<template>
  <div class="debug">
    <section>
      <h3>Dinheiro <span class="muted">{{ money(game.money) }}</span></h3>
      <div class="row">
        <button class="btn sm" @click="addMoney(100)">+100</button>
        <button class="btn sm" @click="addMoney(1000)">+1.000</button>
        <button class="btn sm" @click="addMoney(10000)">+10.000</button>
        <button class="btn sm" @click="game.money = 0">Zerar</button>
      </div>
    </section>
    <section>
      <h3>Reputação <span class="muted">{{ game.rep.toFixed(1) }}</span></h3>
      <div class="row">
        <button class="btn sm" @click="addRep(-1)">−1</button>
        <button class="btn sm" @click="addRep(1)">+1</button>
        <button class="btn sm" @click="game.rep = 5">Máxima</button>
      </div>
    </section>
    <section>
      <h3>Loja e estoque</h3>
      <div class="row">
        <button class="btn sm" @click="unlockAll">Liberar fornecedores</button>
        <button class="btn sm" :disabled="!LEVELS[game.level + 1] || !['prep', 'night'].includes(game.phase)" @click="levelUp">Subir nível</button>
        <button class="btn sm" @click="deliver">Entregar 1 caixa de cada</button>
        <button class="btn sm" @click="fillShelves">Encher prateleiras</button>
        <button class="btn sm" @click="emptyShelves">Zerar prateleiras</button>
      </div>
    </section>
    <section>
      <h3>Dia <span class="muted">Dia {{ game.day }} · {{ game.phase }}</span></h3>
      <div class="row">
        <button class="btn sm" :disabled="game.phase !== 'prep'" @click="openShop">Abrir loja</button>
        <button class="btn sm" :disabled="!isOpen()" @click="goTo(lunchAt - 0.05)">Ir para 11:57</button>
        <button class="btn sm" :disabled="!isOpen()" @click="goTo(20.9)">Ir para 20:54</button>
        <button class="btn sm" :disabled="!isOpen()" @click="endDay">Terminar dia</button>
        <button class="btn sm" :disabled="game.phase !== 'night'" @click="nextDay">Próximo dia</button>
      </div>
    </section>
    <section>
      <h3>Experiência, equipe e manutenção <span class="muted">Nv {{ game.career.earned }} · {{ game.career.xp }}/{{ xpNext() }} XP</span></h3>
      <div class="row">
        <button class="btn sm" @click="gainXp(50)">+50 XP</button>
        <button class="btn sm" @click="levelUpXp">Subir 1 nível</button>
        <button class="btn sm" @click="makeGoals">Novas metas</button>
        <button class="btn sm" @click="postJobAd">Novos candidatos</button>
        <button class="btn sm" :disabled="!game.team.length" @click="requests">Pedidos da equipe</button>
        <button class="btn sm" :disabled="!game.team.length" @click="tired">Equipe cansada</button>
        <button class="btn sm" @click="makeDirt">Sujar a loja</button>
        <button class="btn sm" @click="wearFreezers">Gastar freezers (+40%)</button>
        <button class="btn sm" @click="breakFreezer">Quebrar um freezer</button>
      </div>
    </section>
    <section>
      <h3>Eventos</h3>
      <div class="row">
        <button class="btn sm" :disabled="!isOpen()" @click="spawnCustomers">5 clientes</button>
        <button class="btn sm" :disabled="!isOpen()" @click="thief">Ladrão agora</button>
        <button class="btn sm" @click="rollMarket">Sortear notícia e clima</button>
        <button class="btn sm" :class="{ primary: game.weather === 'hot' }" @click="game.weather = 'hot'">Calor</button>
        <button class="btn sm" :class="{ primary: game.weather === 'mild' }" @click="game.weather = 'mild'">Ameno</button>
        <button class="btn sm" :class="{ primary: game.weather === 'cold' }" @click="game.weather = 'cold'">Frio</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.debug { display: flex; flex-direction: column; gap: 10px; }
h3 { margin: 0 0 6px; font-size: 1em; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
