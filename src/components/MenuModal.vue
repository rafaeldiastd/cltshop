<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PhArrowCounterClockwise, PhBug, PhClockCounterClockwise, PhGameController, PhList, PhPawPrint, PhShuffle, PhSmiley, PhUser } from '@phosphor-icons/vue'
import DebugPanel from './DebugPanel.vue'
import Modal from './Modal.vue'
import LogHistory from './LogHistory.vue'
import CustomerStats from './CustomerStats.vue'
import { settings, ui, restartGame } from '../game/state.js'
import { petThumb } from '../game/assets.js'
import { CharacterPreview } from '../game/preview.js'
import { partThumbs } from '../game/avatar.js'
import { AVATAR_PARTS, HATS, HAT_COLORS, FACES, SKIN_TONES, PALETTE, randomAvatar } from '../game/avatarData.js'
import { PETS } from '../game/config.js'

const TABS = [
  { id: 'char', label: 'Personagem', icon: PhUser },
  { id: 'pet', label: 'Pet', icon: PhPawPrint },
  { id: 'customers', label: 'Clientes', icon: PhSmiley },
  { id: 'log', label: 'Histórico', icon: PhClockCounterClockwise },
  { id: 'keys', label: 'Controles', icon: PhGameController },
]
// debug aparece rodando localmente; no site publicado, só abrindo com ?debug no endereço
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) TABS.push({ id: 'debug', label: 'Debug', icon: PhBug })
const tab = ref('char')
const cv = ref(null)
const shots = ref({ head: {}, body: {} })
let preview = null
const close = () => (ui.modal = null)

// criador de personagem
const av = settings.avatar
const part = ref('head')
const PARTS_TABS = [
  { id: 'head', label: 'Cabeça' },
  { id: 'body', label: 'Corpo' },
  { id: 'colors', label: 'Cores' },
  { id: 'acc', label: 'Acessórios' },
]
const COLOR_ROWS = [
  { key: 'skin', label: 'Pele', list: SKIN_TONES },
  { key: 'hair', label: 'Cabelo', list: PALETTE },
  { key: 'eyes', label: 'Olhos', list: PALETTE },
  { key: 'top', label: 'Blusa', list: PALETTE },
  { key: 'bottom', label: 'Calça', list: PALETTE },
]
const shuffle = () => Object.assign(av, randomAvatar())

onMounted(() => {
  shots.value = partThumbs(AVATAR_PARTS)
  preview = new CharacterPreview(cv.value)
  preview.show(av)
})
watch(() => JSON.stringify(av), () => preview?.show(av))
onBeforeUnmount(() => preview?.dispose())

const KEYS = [
  { keys: ['W', 'A', 'S', 'D'], alt: 'ou setas', what: 'Andar' },
  { keys: ['E'], what: 'Interagir com o que está por perto' },
  { keys: ['Q'], what: 'Soltar a caixa aos seus pés' },
  { keys: ['R'], what: 'Girar o móvel (no modo layout)' },
  { keys: ['Esc'], what: 'Cancelar / fechar' },
  { mouse: 'Clique', what: 'Andar até o lugar ou usar o objeto' },
  { mouse: 'Arrastar', what: 'Mover a visão da loja' },
  { mouse: 'Roda do mouse', what: 'Aproximar e afastar a câmera' },
]
</script>

<template>
  <Modal title="Menu" :icon="PhList" wide>
    <div class="tabs" role="tablist">
      <button v-for="t in TABS" :key="t.id" class="btn sm" :class="{ primary: tab === t.id }" role="tab" :aria-selected="tab === t.id" @click="tab = t.id"><component :is="t.icon" weight="duotone" /> {{ t.label }}</button>
    </div>

    <div v-show="tab === 'char'" class="char">
      <div class="side">
        <canvas ref="cv" class="stage" aria-hidden="true" />
        <button class="btn sm" @click="shuffle"><PhShuffle weight="bold" /> Aleatório</button>
      </div>
      <div class="opts">
        <div class="tabs sub" role="tablist">
          <button v-for="t in PARTS_TABS" :key="t.id" class="btn sm" :class="{ primary: part === t.id }" role="tab" :aria-selected="part === t.id" @click="part = t.id">{{ t.label }}</button>
        </div>
        <div v-if="part === 'head' || part === 'body'" class="grid">
          <button v-for="id in AVATAR_PARTS" :key="id" class="thumb" :class="{ on: av[part] === id }" :aria-label="`${part === 'head' ? 'Cabeça' : 'Corpo'} ${id}`" @click="av[part] = id">
            <img v-if="shots[part][id]" :src="shots[part][id]" alt="" />
          </button>
        </div>
        <template v-if="part === 'colors'">
          <template v-for="row in COLOR_ROWS" :key="row.key">
            <h3>{{ row.label }}</h3>
            <div class="chips">
              <button class="swatch orig" :class="{ on: !av[row.key] }" aria-label="Cor original" title="Original" @click="av[row.key] = null" />
              <button v-for="c in row.list" :key="c.cell" class="swatch" :class="{ on: av[row.key] === c.cell }" :style="{ background: c.hex }" :aria-label="`Cor ${c.hex}`" @click="av[row.key] = c.cell" />
            </div>
          </template>
        </template>
        <template v-if="part === 'acc'">
          <h3>Chapéu</h3>
          <div class="chips">
            <button v-for="h in HATS" :key="h.id" class="btn sm" :class="{ primary: av.hat === h.id }" @click="av.hat = h.id">{{ h.name }}</button>
          </div>
          <template v-if="av.hat !== 'none'">
            <h3>Cor do chapéu</h3>
            <div class="chips">
              <button v-for="c in HAT_COLORS" :key="c" class="swatch" :class="{ on: av.hatColor === c }" :style="{ background: c }" :aria-label="`Cor ${c}`" @click="av.hatColor = c" />
            </div>
          </template>
          <h3>Rosto</h3>
          <div class="chips">
            <button v-for="f in FACES" :key="f.id" class="btn sm" :class="{ primary: av.face === f.id }" @click="av.face = f.id">{{ f.name }}</button>
          </div>
        </template>
      </div>
    </div>

    <div v-if="tab === 'pet'" class="pets">
      <button v-for="(p, id) in PETS" :key="id" class="pet" :class="{ on: settings.pet === id }" @click="settings.pet = id">
        <img v-if="petThumb(id)" :src="petThumb(id)" class="face" alt="" /><PhPawPrint v-else class="face" weight="duotone" /><b>{{ p.name }}</b>
      </button>
      <p class="muted full">Para fazer carinho, clique no bichinho ou chegue perto e aperte <kbd>E</kbd>.</p>
    </div>

    <DebugPanel v-if="tab === 'debug'" />
    <CustomerStats v-if="tab === 'customers'" />
    <LogHistory v-if="tab === 'log'" />

    <div v-if="tab === 'keys'">
      <div v-for="k in KEYS" :key="k.what" class="line">
        <span class="k"><template v-if="k.keys"><kbd v-for="x in k.keys" :key="x">{{ x }}</kbd> <span v-if="k.alt" class="muted">{{ k.alt }}</span></template><b v-else>{{ k.mouse }}</b></span>
        <span>{{ k.what }}</span>
      </div>
      <p class="muted">Seu progresso é salvo automaticamente neste navegador.</p>
    </div>

    <template #foot>
      <button class="btn restart" @click="restartGame"><PhArrowCounterClockwise weight="bold" /> Recomeçar o jogo</button>
      <button class="btn primary" @click="close">Fechar</button>
    </template>
  </Modal>
</template>

<style scoped>
.tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.restart { margin-right: auto; }
.char { display: grid; grid-template-columns: 220px 1fr; gap: 16px; }
.side { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.sub { margin-bottom: 8px; }
.opts { min-width: 0; }
.swatch.orig { background: repeating-linear-gradient(135deg, #fff 0 5px, var(--cream2) 5px 10px); }
.stage { width: 220px; height: 280px; background: radial-gradient(circle at 50% 70%, #fbe6c8, var(--cream2)); border-radius: 14px; }
h3 { margin: 8px 0 6px; font-size: 1em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
.thumb { padding: 0; background: var(--cream2); border-radius: 10px; border: 3px solid transparent; aspect-ratio: 1; overflow: hidden; }
.thumb img { width: 100%; height: 100%; display: block; }
.thumb.on { border-color: var(--coral); background: #fff; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.swatch { width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent; box-shadow: inset 0 0 0 1px rgba(59, 47, 74, .2); }
.swatch.on { border-color: var(--plum); }
.pets { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.pet { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: var(--cream2); border-radius: 12px; border: 3px solid transparent; font-size: 13px; }
.pet.on { border-color: var(--coral); background: #fff; }
.face { width: 52px; height: 52px; }
.full { grid-column: 1 / -1; }
.line { display: flex; gap: 14px; align-items: center; padding: 8px 0; border-bottom: 1px dashed rgba(59, 47, 74, .15); }
.k { flex: 0 0 210px; }
@media (max-width: 640px) { .char { grid-template-columns: 1fr; } .stage { width: 100%; height: 180px; } .side { flex-direction: row; } .side .stage { flex: 1; } .k { flex-basis: 130px; } }
</style>
