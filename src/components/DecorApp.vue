<script setup>
import { computed, ref, watch } from 'vue'
import { PhCoffee, PhPaintBrush, PhPottedPlant, PhSecurityCamera, PhLamp, PhLampPendant, PhLightbulb, PhCheck, PhClock, PhFrameCorners, PhSiren, PhLock, PhHouseLine } from '@phosphor-icons/vue'
import { game, money, isClosed, decorCount, sellDecor, hasPerk, buyDoormat, setDoormat, cleanMatText, setShopName, setShopStyle, defaultShopStyle } from '../game/state.js'
import { isDecorUnlocked, decorUnlockHint } from '../game/goals.js'
import { buyDecor, canBuyDecor, decorMaxed } from '../game/editor.js'
import { decorThumb } from '../game/assets.js'
import { DECOR, DOORMAT, WALLPAPERS, WALL_COLORS, TRIM_COLORS, WALL_MODES } from '../game/config.js'

const subTab = ref('decor') // decor | style
const items = Object.entries(DECOR).filter(([, d]) => d.price && (!d.perk || hasPerk(d.perk)))
const resale = (d) => Math.floor(d.price / 2)
const ICON = { camera: PhSecurityCamera, alarm: PhSiren, cafeTable: PhCoffee, lamp: PhLamp, pendant: PhLampPendant, led: PhLightbulb, clock: PhClock, frame: PhFrameCorners } // itens sem modelo GLB pronto

const style = computed(() => ({ ...defaultShopStyle(), ...(game.shopStyle || {}) }))

// tapete de entrada: texto e cor escolhidos aqui, aparece na porta da loja
const matText = ref(game.doormat?.text || 'Bem-vindo!')
const matColor = ref(game.doormat?.color || DOORMAT.colors[0])
watch(() => game.doormat, (m) => { if (m) { matText.value = m.text; matColor.value = m.color } })
const matChanged = () => !game.doormat || cleanMatText(matText.value) !== game.doormat.text || matColor.value !== game.doormat.color
const saveMat = () => (game.doormat ? setDoormat(matText.value, matColor.value) : buyDoormat(matText.value, matColor.value))
</script>

<template>
  <div class="app">
    <div class="head-tabs">
      <h2><PhPaintBrush weight="duotone" /> Decoração &amp; Loja</h2>
      <div class="tab-pills">
        <button class="btn sm" :class="{ primary: subTab === 'decor' }" @click="subTab = 'decor'">
          <PhPaintBrush weight="bold" /> Decorações &amp; Tapete
        </button>
        <button class="btn sm" :class="{ primary: subTab === 'style' }" @click="subTab = 'style'">
          <PhHouseLine weight="bold" /> Fachada &amp; Papel de Parede
        </button>
      </div>
    </div>

    <template v-if="subTab === 'decor'">
      <p class="muted">{{ isClosed() ? 'Depois de comprar, escolha o lugar na loja. Itens especiais liberam cumprindo Metas!' : 'Compra e venda só com a loja fechada.' }}</p>
      <section class="mat-card">
        <div class="mat-preview" :style="{ background: matColor }"><span>{{ cleanMatText(matText) || 'Bem-vindo!' }}</span></div>
        <div class="mat-form">
          <b>Tapete de entrada</b>
          <span class="desc">Segura a sujeira dos sapatos: {{ Math.round((1 - DOORMAT.dirt) * 100) }}% menos pegadas dentro da loja.</span>
          <label class="muted small" for="mat-text">Texto do tapete</label>
          <input id="mat-text" v-model="matText" :maxlength="DOORMAT.maxText" placeholder="Bem-vindo!" />
          <div class="swatches">
            <button v-for="c in DOORMAT.colors" :key="c" class="swatch" :class="{ on: matColor === c }" :style="{ background: c }" :aria-label="`Cor ${c}`" @click="matColor = c" />
          </div>
          <button v-if="!game.doormat" class="btn good sm" :disabled="game.money < DOORMAT.price" @click="saveMat">Comprar · {{ money(DOORMAT.price) }}</button>
          <button v-else class="btn sm" :disabled="!matChanged()" @click="saveMat"><PhCheck weight="bold" /> {{ matChanged() ? 'Salvar texto e cor' : 'Instalado na porta' }}</button>
        </div>
      </section>
      <div class="grid">
        <article v-for="[type, d] in items" :key="type" class="item" :class="{ locked: !isDecorUnlocked(type) }">
          <img v-if="decorThumb(type)" :src="decorThumb(type)" alt="" />
          <component :is="ICON[type] || PhPottedPlant" v-else class="fallback" weight="duotone" />
          <b class="name">{{ d.name }}</b>
          <span v-if="!isDecorUnlocked(type)" class="lock-pill"><PhLock weight="bold" /> {{ decorUnlockHint(type) }}</span>
          <span v-else-if="d.desc" class="desc">{{ d.desc }}</span>
          <span class="muted">{{ decorCount(type) }} na loja</span>
          <button class="btn good sm" :disabled="!canBuyDecor(type)" @click="buyDecor(type)">
            {{ !isDecorUnlocked(type) ? 'Bloqueada' : decorMaxed(type) ? 'Já instalada' : `Comprar · ${money(d.price)}` }}
          </button>
          <button class="btn sm" :disabled="!isClosed() || !decorCount(type)" @click="sellDecor(type)">Vender · {{ money(resale(d)) }}</button>
        </article>
      </div>
    </template>

    <div v-else class="style-scroll">
      <section class="style-card">
        <b>🏪 Nome na Fachada da Loja (Letreiro 3D)</b>
        <span class="muted small">Aparece em cima da porta da sua loja e para os amigos que visitarem!</span>
        <div class="facade-row">
          <div class="facade-preview" :style="{ borderColor: style.trimColor }">
            <span>{{ game.shopName || game.branchName || 'Lojinha Lofi' }}</span>
          </div>
          <input
            :value="game.shopName"
            maxlength="24"
            placeholder="Lojinha Lofi"
            @input="setShopName($event.target.value, false)"
            @blur="setShopName($event.target.value, true)"
          />
        </div>
      </section>

      <section class="style-card">
        <b>🧱 Visibilidade das Paredes</b>
        <div class="tab-pills">
          <button
            v-for="wm in WALL_MODES"
            :key="wm.id"
            class="btn sm"
            :class="{ primary: style.wallMode === wm.id }"
            @click="setShopStyle({ wallMode: wm.id })"
          >
            {{ wm.icon }} {{ wm.name }}
          </button>
        </div>
      </section>

      <section class="style-card">
        <b>🧱 Papel de Parede (estilo The Sims)</b>
        <div class="wp-grid">
          <button
            v-for="wp in WALLPAPERS"
            :key="wp.id"
            class="wp-btn"
            :class="{ on: style.wallPaper === wp.id }"
            @click="setShopStyle({ wallPaper: wp.id })"
          >
            <span class="wp-swatch" :class="'pat-' + wp.id" :style="{ backgroundColor: style.wallColor }" />
            <b>{{ wp.icon }} {{ wp.name }}</b>
          </button>
        </div>
      </section>

      <section class="style-card">
        <b>🎨 Cor das Paredes</b>
        <div class="swatches big">
          <button
            v-for="c in WALL_COLORS"
            :key="c"
            class="swatch"
            :class="{ on: style.wallColor === c }"
            :style="{ background: c }"
            :aria-label="`Parede ${c}`"
            @click="setShopStyle({ wallColor: c })"
          />
        </div>
      </section>

      <section class="style-card">
        <b>🪵 Cor dos Rodapés e Molduras</b>
        <div class="swatches big">
          <button
            v-for="c in TRIM_COLORS"
            :key="c"
            class="swatch"
            :class="{ on: style.trimColor === c }"
            :style="{ background: c }"
            :aria-label="`Moldura ${c}`"
            @click="setShopStyle({ trimColor: c })"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.head-tabs { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.tab-pills { display: flex; gap: 6px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 0; }
.grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; align-content: start; padding-right: 4px; }
.item { display: flex; flex-direction: column; align-items: center; gap: 4px; background: #fff; border-radius: 12px; padding: 10px; text-align: center; }
.item.locked { background: #f5f3f7; opacity: .78; }
.item.locked img { filter: grayscale(0.8); }
.item img { width: 64px; height: 64px; }
.fallback { font-size: 64px; color: var(--good); }
.name { text-transform: capitalize; }
.desc { font-size: 12px; font-weight: 700; color: var(--good); }
.lock-pill { font-size: 11px; font-weight: 800; color: #9a3412; background: #ffedd5; padding: 2px 7px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px; line-height: 1.2; }
.item .btn { width: 100%; margin-top: auto; }
.mat-card { display: flex; gap: 14px; align-items: center; background: #fff; border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
.mat-preview { width: 170px; height: 100px; border-radius: 14px; display: grid; place-items: center; box-shadow: inset 0 0 0 5px rgba(255, 255, 255, .45); flex: none; }
.mat-preview span { color: #fff8ec; font: 800 20px ui-rounded, system-ui, sans-serif; padding: 0 10px; text-align: center; word-break: break-word; }
.mat-form { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; }
.mat-form input, .facade-row input { padding: 7px 10px; border-radius: 10px; border: 2px solid var(--cream2); font: inherit; background: #fff; color: var(--plum); font-weight: 700; }
.small { font-size: 12px; }
.swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.swatches.big .swatch { width: 34px; height: 34px; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 3px solid transparent; box-shadow: inset 0 0 0 1px rgba(59, 47, 74, .2); }
.swatch.on { border-color: var(--plum); transform: scale(1.08); }
.mat-form .btn { align-self: flex-start; }

.style-scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
.style-card { background: #fff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.facade-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.facade-row input { flex: 1; min-width: 180px; }
.facade-preview { padding: 8px 16px; border-radius: 10px; background: #fff6e5; border: 4px solid #b98a5a; color: #3b2f4a; font: 900 16px ui-rounded, system-ui, sans-serif; min-width: 170px; text-align: center; }
.wp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.wp-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px; border-radius: 12px; background: var(--cream2); border: 2.5px solid transparent; font-size: 12.5px; }
.wp-btn.on { border-color: var(--teal); background: #fff; }
.wp-swatch { width: 100%; height: 42px; border-radius: 8px; border: 1.5px solid rgba(59, 47, 74, .18); }
.pat-stripes { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.32) 0 8px, transparent 8px 16px); }
.pat-brick { background-image: repeating-linear-gradient(0deg, rgba(59,47,74,.14) 0 2px, transparent 2px 14px), repeating-linear-gradient(90deg, rgba(59,47,74,.12) 0 2px, transparent 2px 24px); }
.pat-tiles { background-image: conic-gradient(rgba(255,255,255,.32) 90deg, transparent 90deg 180deg, rgba(255,255,255,.32) 180deg 270deg, transparent 270deg); background-size: 20px 20px; }
.pat-wood { background-image: repeating-linear-gradient(90deg, rgba(90,55,25,.18) 0 2px, transparent 2px 10px); }
.pat-stars { background-image: radial-gradient(rgba(255,255,255,.7) 1.5px, transparent 1.5px); background-size: 16px 16px; }
</style>
