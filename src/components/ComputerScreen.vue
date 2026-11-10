<script setup>
import { PhPaintBrush, PhPower, PhShoppingCart, PhStorefront, PhGraduationCap, PhWhatsappLogo, PhBookOpen, PhTicket, PhUsersThree, PhTag } from '@phosphor-icons/vue'
import ProductsApp from './ProductsApp.vue'
import StoreApp from './StoreApp.vue'
import DecorApp from './DecorApp.vue'
import CareerApp from './CareerApp.vue'
import DeliveryApp from './DeliveryApp.vue'
import RecipesApp from './RecipesApp.vue'
import PassApp from './PassApp.vue'
import PricesApp from './PricesApp.vue'
import TeamApp from './TeamApp.vue'
import { computed } from 'vue'
import { game, ui, money, clockText, passPending } from '../game/state.js'
import { pendingRequests } from '../game/team.js'

const clock = computed(() => clockText())

const APPS = [
  { id: 'products', label: 'Compras', icon: PhShoppingCart },
  { id: 'prices', label: 'Preços', icon: PhTag },
  { id: 'store', label: 'Loja', icon: PhStorefront },
  { id: 'team', label: 'Equipe', icon: PhUsersThree },
  { id: 'pass', label: 'Passe', icon: PhTicket },
  { id: 'career', label: 'Carreira', icon: PhGraduationCap },
  { id: 'delivery', label: 'Zap Delivery', icon: PhWhatsappLogo },
  { id: 'recipes', label: 'Receitas', icon: PhBookOpen },
  { id: 'decor', label: 'Decoração', icon: PhPaintBrush },
]
const close = () => (ui.modal = null)
// bolinha de aviso no ícone: recompensa para resgatar ou pedido da equipe
const badge = (id) => (id === 'pass' ? passPending() : id === 'team' ? pendingRequests().length : 0)
</script>

<template>
  <div class="room">
    <div class="monitor" role="dialog" aria-label="Computador da loja">
      <div class="screen">
        <div class="os">
          <b>LojaOS</b>
          <span class="muted-l">Dia {{ game.day }} · {{ clock }}</span>
          <b class="cash">{{ money(game.money) }}</b>
          <button class="off" title="Desligar o computador" @click="close"><PhPower weight="bold" /> Sair</button>
        </div>
        <div class="desk">
          <nav>
            <button v-for="a in APPS" :key="a.id" class="app-ico" :class="{ on: ui.computerApp === a.id }" :aria-current="ui.computerApp === a.id" @click="ui.computerApp = a.id">
              <component :is="a.icon" weight="duotone" /><span>{{ a.label }}</span>
              <i v-if="badge(a.id)" class="badge">{{ badge(a.id) }}</i>
            </button>
          </nav>
          <main class="win">
            <ProductsApp v-if="ui.computerApp === 'products'" />
            <PricesApp v-else-if="ui.computerApp === 'prices'" />
            <StoreApp v-else-if="ui.computerApp === 'store'" />
            <TeamApp v-else-if="ui.computerApp === 'team'" />
            <PassApp v-else-if="ui.computerApp === 'pass'" />
            <CareerApp v-else-if="ui.computerApp === 'career'" />
            <DeliveryApp v-else-if="ui.computerApp === 'delivery'" />
            <RecipesApp v-else-if="ui.computerApp === 'recipes'" />
            <DecorApp v-else />
          </main>
        </div>
      </div>
      <div class="brand" />
    </div>
    <div class="neck" />
    <div class="foot" />
  </div>
</template>

<style scoped>
.room { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(30, 20, 45, .7); backdrop-filter: blur(4px); padding: 10px; }
.monitor { width: min(1280px, calc(100vw - 32px)); height: min(760px, calc(100vh - 54px)); background: #2a2333; border-radius: 18px; padding: 12px 12px 6px; display: flex; flex-direction: column; box-shadow: 0 20px 55px rgba(0, 0, 0, .5); }
.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; background: linear-gradient(145deg, #5b4a6e, #3b2f4a); border-radius: 8px; overflow: hidden; color: var(--cream); }
.brand { height: 8px; margin: 3px auto 0; width: 44px; border-radius: 4px; background: #4a4055; flex: none; }
.neck { width: 90px; height: 18px; background: #2a2333; }
.foot { width: 220px; height: 8px; background: #2a2333; border-radius: 8px 8px 0 0; }
.os { display: flex; align-items: center; gap: 14px; padding: 7px 12px; background: rgba(0, 0, 0, .28); font-size: 14px; }
.muted-l { opacity: .75; font-variant-numeric: tabular-nums; }
.cash { margin-left: auto; font-variant-numeric: tabular-nums; }
.off { background: var(--coral); color: #fff; font-weight: 800; border-radius: 8px; padding: 4px 10px; }
.desk { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 10px; }
nav { flex: none; display: flex; flex-direction: column; gap: 3px; width: 78px; }
.app-ico { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 3px; border-radius: 10px; background: none; color: var(--cream); font-size: 11.5px; font-weight: 700; line-height: 1.15; text-align: center; }
.app-ico svg { font-size: 24px; }
.app-ico:hover { background: rgba(255, 255, 255, .1); }
.app-ico.on { background: rgba(255, 255, 255, .2); }
.badge { position: absolute; top: 2px; right: 6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: var(--coral); color: #fff; font: 800 11px/18px system-ui; font-style: normal; }
nav { overflow-y: auto; scrollbar-width: none; } nav::-webkit-scrollbar { display: none; } /* se a janela for baixa, ainda rola, mas sem a barra */
.win { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--cream); color: var(--plum); border-radius: 12px; padding: 14px 16px; overflow: hidden; }
@media (max-height: 640px) { .neck, .foot { display: none; } .monitor { height: calc(100vh - 20px); } }
</style>
