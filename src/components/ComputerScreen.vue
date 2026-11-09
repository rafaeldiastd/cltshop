<script setup>
import { PhPower, PhStorefront, PhTag } from '@phosphor-icons/vue'
import ProductsApp from './ProductsApp.vue'
import StoreApp from './StoreApp.vue'
import { game, ui, money, clockText } from '../game/state.js'

const APPS = [
  { id: 'products', label: 'Produtos', icon: PhTag },
  { id: 'store', label: 'Loja', icon: PhStorefront },
]
const close = () => (ui.modal = null)
</script>

<template>
  <div class="room">
    <div class="monitor" role="dialog" aria-label="Computador da loja">
      <div class="screen">
        <div class="os">
          <b>LojaOS</b>
          <span class="muted-l">Dia {{ game.day }} · {{ clockText() }}</span>
          <b class="cash">{{ money(game.money) }}</b>
          <button class="off" title="Desligar o computador" @click="close"><PhPower weight="bold" /> Sair</button>
        </div>
        <div class="desk">
          <nav>
            <button v-for="a in APPS" :key="a.id" class="app-ico" :class="{ on: ui.computerApp === a.id }" :aria-current="ui.computerApp === a.id" @click="ui.computerApp = a.id">
              <component :is="a.icon" weight="duotone" /><span>{{ a.label }}</span>
            </button>
          </nav>
          <main class="win">
            <ProductsApp v-if="ui.computerApp === 'products'" />
            <StoreApp v-else />
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
.room { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(30, 20, 45, .7); backdrop-filter: blur(4px); padding: 14px; }
.monitor { width: min(1120px, 100%); height: min(640px, calc(100vh - 80px)); background: #2a2333; border-radius: 18px; padding: 12px 12px 6px; display: flex; flex-direction: column; box-shadow: 0 18px 50px rgba(0, 0, 0, .45); }
.screen { flex: 1; min-height: 0; display: flex; flex-direction: column; background: linear-gradient(145deg, #5b4a6e, #3b2f4a); border-radius: 8px; overflow: hidden; color: var(--cream); }
.brand { height: 8px; margin: 3px auto 0; width: 44px; border-radius: 4px; background: #4a4055; flex: none; }
.neck { width: 90px; height: 22px; background: #2a2333; }
.foot { width: 200px; height: 10px; background: #2a2333; border-radius: 8px 8px 0 0; }
.os { display: flex; align-items: center; gap: 14px; padding: 7px 12px; background: rgba(0, 0, 0, .28); font-size: 14px; }
.muted-l { opacity: .75; font-variant-numeric: tabular-nums; }
.cash { margin-left: auto; font-variant-numeric: tabular-nums; }
.off { background: var(--coral); color: #fff; font-weight: 800; border-radius: 8px; padding: 4px 10px; }
.desk { flex: 1; min-height: 0; display: flex; gap: 10px; padding: 10px; }
nav { flex: none; display: flex; flex-direction: column; gap: 6px; width: 84px; }
.app-ico { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px; border-radius: 12px; background: none; color: var(--cream); font-size: 13px; font-weight: 700; }
.app-ico svg { font-size: 32px; }
.app-ico:hover { background: rgba(255, 255, 255, .1); }
.app-ico.on { background: rgba(255, 255, 255, .2); }
.win { flex: 1; min-width: 0; background: var(--cream); color: var(--plum); border-radius: 12px; padding: 12px 14px; }
@media (max-height: 520px) { .neck, .foot { display: none; } .monitor { height: calc(100vh - 28px); } }
</style>
