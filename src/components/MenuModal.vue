<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PhArrowCounterClockwise, PhBug, PhClockCounterClockwise, PhGameController, PhList, PhLock, PhPawPrint, PhShuffle, PhSmiley, PhUser } from '@phosphor-icons/vue'
import DebugPanel from './DebugPanel.vue'
import Modal from './Modal.vue'
import LogHistory from './LogHistory.vue'
import CustomerStats from './CustomerStats.vue'
import { game, settings, ui, restartGame, setPlayerName, setShopName } from '../game/state.js'
import { petThumb } from '../game/assets.js'
import { CharacterPreview } from '../game/preview.js'
import { partThumbs } from '../game/avatar.js'
import { AVATAR_PARTS, HATS, HAT_COLORS, FACES, SKIN_TONES, PALETTE, randomAvatar, avatarUnlockLevel, isAvatarUnlocked } from '../game/avatarData.js'
import { isPetUnlocked, petUnlockHint } from '../game/goals.js'
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
const charLevel = computed(() => game.career?.earned || 0)
const unlockedModelsCount = computed(() => AVATAR_PARTS.filter((id) => isAvatarUnlocked(id, charLevel.value)).length)
const shuffle = () => Object.assign(av, randomAvatar(charLevel.value))

onMounted(() => {
  shots.value = partThumbs(AVATAR_PARTS)
  preview = new CharacterPreview(cv.value)
  preview.show(av)
})
watch(() => JSON.stringify(av), () => preview?.show(av))
onBeforeUnmount(() => preview?.dispose())

const KEYS = [
  { keys: ['W', 'A', 'S', 'D'], what: 'Andar com o personagem' },
  { keys: ['↑', '↓', '←', '→'], what: 'Mover a câmera (estilo The Sims)' },
  { keys: ['<', '>'], what: 'Rotacionar a tela em 45°' },
  { keys: ['−', '+'], what: 'Afastar e aproximar zoom' },
  { keys: ['Espaço'], what: 'Pausar / continuar o jogo' },
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
        <div class="name-row">
          <label class="name-field">
            <span>Seu nome</span>
            <input
              :value="game.playerName"
              maxlength="20"
              placeholder="Lojista"
              @input="setPlayerName($event.target.value, false)"
              @blur="setPlayerName($event.target.value, true)"
            />
          </label>
          <label class="name-field">
            <span>Nome da lojinha</span>
            <input
              :value="game.shopName"
              maxlength="24"
              placeholder="Lojinha Lofi"
              @input="setShopName($event.target.value, false)"
              @blur="setShopName($event.target.value, true)"
            />
          </label>
        </div>
        <div class="xp-unlock-bar">
          <span>⭐ Nível <b>{{ charLevel }}</b> de XP</span>
          <span class="muted">{{ unlockedModelsCount }}/{{ AVATAR_PARTS.length }} modelos liberados</span>
        </div>
        <div class="tabs sub" role="tablist">
          <button v-for="t in PARTS_TABS" :key="t.id" class="btn sm" :class="{ primary: part === t.id }" role="tab" :aria-selected="part === t.id" @click="part = t.id">{{ t.label }}</button>
        </div>
        <div v-if="part === 'head' || part === 'body'" class="grid">
          <button
            v-for="id in AVATAR_PARTS"
            :key="id"
            class="thumb"
            :class="{ on: av[part] === id, locked: !isAvatarUnlocked(id, charLevel) }"
            :disabled="!isAvatarUnlocked(id, charLevel)"
            :title="isAvatarUnlocked(id, charLevel) ? `${part === 'head' ? 'Cabeça' : 'Corpo'} ${id}` : `Libera no Nível ${avatarUnlockLevel(id)} de XP`"
            :aria-label="`${part === 'head' ? 'Cabeça' : 'Corpo'} ${id}`"
            @click="isAvatarUnlocked(id, charLevel) && (av[part] = id)"
          >
            <img v-if="shots[part][id]" :src="shots[part][id]" alt="" />
            <span v-if="!isAvatarUnlocked(id, charLevel)" class="lock-tag"><PhLock weight="bold" /> Nv {{ avatarUnlockLevel(id) }}</span>
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
      <button
        v-for="(p, id) in PETS"
        :key="id"
        class="pet"
        :class="{ on: settings.pet === id, locked: !isPetUnlocked(id), exotic: p.exotic }"
        :disabled="!isPetUnlocked(id)"
        :title="isPetUnlocked(id) ? p.name : `Requisito: ${petUnlockHint(id)}`"
        @click="isPetUnlocked(id) && (settings.pet = id)"
      >
        <img v-if="petThumb(id)" :src="petThumb(id)" class="face" alt="" /><PhPawPrint v-else class="face" weight="duotone" />
        <b>{{ p.name }}</b>
        <span v-if="p.exotic && isPetUnlocked(id)" class="exotic-tag">✨ Exótico</span>
        <span v-else-if="!isPetUnlocked(id)" class="pet-lock"><PhLock weight="bold" /> {{ petUnlockHint(id) }}</span>
      </button>
      <p class="muted full">Pets exóticos são liberados cumprindo Metas Diárias e Metas Grandes! Para fazer carinho, clique no bichinho ou chegue perto e aperte <kbd>E</kbd>.</p>
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
      <button class="btn restart" @click="ui.modal = 'start'">📂 Partidas / Saves</button>
      <button class="btn" @click="restartGame"><PhArrowCounterClockwise weight="bold" /> Recomeçar o jogo</button>
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
.name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.name-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 800; color: var(--plum); }
.name-field input { padding: 6px 10px; border-radius: 9px; border: 2px solid var(--cream2); font: inherit; background: #fff; color: var(--plum); }
.name-field input:focus { outline: none; border-color: var(--teal); }
.swatch.orig { background: repeating-linear-gradient(135deg, #fff 0 5px, var(--cream2) 5px 10px); }
.stage { width: 220px; height: 280px; background: radial-gradient(circle at 50% 70%, #fbe6c8, var(--cream2)); border-radius: 14px; }
h3 { margin: 8px 0 6px; font-size: 1em; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
.thumb { position: relative; padding: 0; background: var(--cream2); border-radius: 10px; border: 3px solid transparent; aspect-ratio: 1; overflow: hidden; }
.thumb img { width: 100%; height: 100%; display: block; }
.thumb.on { border-color: var(--coral); background: #fff; }
.thumb.locked { opacity: .55; cursor: not-allowed; }
.thumb.locked img { filter: grayscale(0.8); }
.lock-tag { position: absolute; inset: auto 2px 2px 2px; background: rgba(59, 47, 74, .88); color: #fde047; font-size: 9.5px; font-weight: 800; border-radius: 6px; padding: 1px 3px; display: inline-flex; align-items: center; justify-content: center; gap: 2px; }
.xp-unlock-bar { display: flex; justify-content: space-between; align-items: center; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 9px; padding: 5px 9px; font-size: 12px; margin-bottom: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.swatch { width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent; box-shadow: inset 0 0 0 1px rgba(59, 47, 74, .2); }
.swatch.on { border-color: var(--plum); }
.pets { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 8px; }
.pet { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: var(--cream2); border-radius: 12px; border: 3px solid transparent; font-size: 12.5px; }
.pet.on { border-color: var(--coral); background: #fff; }
.pet.exotic { background: #fefce8; }
.pet.locked { opacity: .62; cursor: not-allowed; background: #f3f1f5; }
.pet.locked .face { filter: grayscale(0.9); }
.exotic-tag { font-size: 10px; font-weight: 800; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 99px; }
.pet-lock { font-size: 9.5px; font-weight: 800; color: var(--plum2); text-align: center; line-height: 1.15; display: flex; align-items: center; gap: 2px; }
.face { width: 52px; height: 52px; }
.full { grid-column: 1 / -1; }
.line { display: flex; gap: 14px; align-items: center; padding: 8px 0; border-bottom: 1px dashed rgba(59, 47, 74, .15); }
.k { flex: 0 0 210px; }
@media (max-width: 640px) { .char { grid-template-columns: 1fr; } .stage { width: 100%; height: 180px; } .side { flex-direction: row; } .side .stage { flex: 1; } .k { flex-basis: 130px; } }
</style>
