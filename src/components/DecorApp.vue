<script setup>
import { ref, watch } from 'vue'
import { PhCoffee, PhPaintBrush, PhPottedPlant, PhSecurityCamera, PhLamp, PhLightbulb, PhCheck, PhClock, PhFrameCorners } from '@phosphor-icons/vue'
import { game, money, isClosed, decorCount, sellDecor, hasPerk, buyDoormat, setDoormat, cleanMatText } from '../game/state.js'
import { buyDecor, canBuyDecor, decorMaxed } from '../game/editor.js'
import { decorThumb } from '../game/assets.js'
import { DECOR, DOORMAT } from '../game/config.js'

const items = Object.entries(DECOR).filter(([, d]) => d.price && (!d.perk || hasPerk(d.perk)))
const resale = (d) => Math.floor(d.price / 2)
const ICON = { camera: PhSecurityCamera, cafeTable: PhCoffee, lamp: PhLamp, led: PhLightbulb, clock: PhClock, frame: PhFrameCorners } // itens sem modelo GLB pronto

// tapete de entrada: texto e cor escolhidos aqui, aparece na porta da loja
const matText = ref(game.doormat?.text || 'Bem-vindo!')
const matColor = ref(game.doormat?.color || DOORMAT.colors[0])
watch(() => game.doormat, (m) => { if (m) { matText.value = m.text; matColor.value = m.color } })
const matChanged = () => !game.doormat || cleanMatText(matText.value) !== game.doormat.text || matColor.value !== game.doormat.color
const saveMat = () => (game.doormat ? setDoormat(matText.value, matColor.value) : buyDoormat(matText.value, matColor.value))
</script>

<template>
  <div class="app">
    <h2><PhPaintBrush weight="duotone" /> Decoração</h2>
    <p class="muted">{{ isClosed() ? 'Depois de comprar, escolha o lugar na loja. A revenda paga metade do preço.' : 'Compra e venda só com a loja fechada.' }}</p>
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
      <article v-for="[type, d] in items" :key="type" class="item">
        <img v-if="decorThumb(type)" :src="decorThumb(type)" alt="" />
        <component :is="ICON[type] || PhPottedPlant" v-else class="fallback" weight="duotone" />
        <b class="name">{{ d.name }}</b>
        <span v-if="d.desc" class="desc">{{ d.desc }}</span>
        <span class="muted">{{ decorCount(type) }} na loja</span>
        <button class="btn good sm" :disabled="!canBuyDecor(type)" @click="buyDecor(type)">{{ decorMaxed(type) ? 'Já instalada' : `Comprar · ${money(d.price)}` }}</button>
        <button class="btn sm" :disabled="!isClosed() || !decorCount(type)" @click="sellDecor(type)">Vender · {{ money(resale(d)) }}</button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 0; }
.grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; align-content: start; padding-right: 4px; }
.item { display: flex; flex-direction: column; align-items: center; gap: 4px; background: #fff; border-radius: 12px; padding: 10px; text-align: center; }
.item img { width: 64px; height: 64px; }
.fallback { font-size: 64px; color: var(--good); }
.name { text-transform: capitalize; }
.desc { font-size: 12px; font-weight: 700; color: var(--good); }
.item .btn { width: 100%; }
.mat-card { display: flex; gap: 14px; align-items: center; background: #fff; border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
.mat-preview { width: 170px; height: 100px; border-radius: 14px; display: grid; place-items: center; box-shadow: inset 0 0 0 5px rgba(255, 255, 255, .45); flex: none; }
.mat-preview span { color: #fff8ec; font: 800 20px ui-rounded, system-ui, sans-serif; padding: 0 10px; text-align: center; word-break: break-word; }
.mat-form { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; }
.mat-form input { padding: 6px 10px; border-radius: 10px; border: 2px solid var(--cream2); font: inherit; background: #fff; }
.small { font-size: 12px; }
.swatches { display: flex; gap: 6px; }
.swatch { width: 26px; height: 26px; border-radius: 50%; border: 3px solid transparent; box-shadow: inset 0 0 0 1px rgba(59, 47, 74, .2); }
.swatch.on { border-color: var(--plum); }
.mat-form .btn { align-self: flex-start; }
</style>
