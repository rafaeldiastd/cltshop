<script setup>
import { computed, onMounted, ref } from 'vue'
import { PhArrowCounterClockwise, PhCheck, PhGameController, PhLock, PhPencilSimple, PhPlay, PhPlus, PhStorefront, PhTrash, PhUser, PhX } from '@phosphor-icons/vue'
import Modal from './Modal.vue'
import {
  game, ui, settings, savesList, refreshSavesList, getActiveSaveId,
  createNewSave, loadSaveSlot, restartSaveSlot, deleteSaveSlot, renameSaveSlot, money, regionOf,
} from '../game/state.js'
import { GAME_MODES } from '../game/config.js'

const creating = ref(false)
const playerName = ref(settings.playerName || game.playerName || 'Lojista')
const shopName = ref('')
const selectedMode = ref('normal')
const activeId = computed(() => getActiveSaveId())
const editingId = ref(null)
const editPlayer = ref('')
const editShop = ref('')

function startRename(s) {
  editingId.value = s.id
  editPlayer.value = s.playerName || 'Lojista'
  editShop.value = s.shopName || 'Lojinha Lofi'
}

function saveRename(sid) {
  renameSaveSlot(sid, { playerName: editPlayer.value, shopName: editShop.value })
  editingId.value = null
}

onMounted(() => {
  refreshSavesList()
  if (!savesList.length) creating.value = true
})

function openCreate() {
  playerName.value = settings.playerName || game.playerName || 'Lojista'
  shopName.value = ''
  selectedMode.value = 'normal'
  creating.value = true
}

function submitNew() {
  createNewSave({
    playerName: playerName.value,
    shopName: shopName.value || 'Mercadinho Lofi',
    mode: selectedMode.value,
  })
  creating.value = false
}

function playSlot(sid) {
  if (sid === activeId.value && savesList.length) {
    ui.modal = null
    return
  }
  loadSaveSlot(sid)
}

const modeInfo = (id) => GAME_MODES[id] || GAME_MODES.normal
</script>

<template>
  <Modal title="Menu de Partida — Lojinha Lofi" :icon="PhGameController" wide>
    <div v-if="!creating && savesList.length" class="saves-wrap">
      <p class="muted intro">Escolha uma loja salva para continuar, recomece do Dia 1 ou crie uma nova partida em outro modo de jogo.</p>
      <div class="saves-list">
        <div v-for="s in savesList" :key="s.id" class="save-card" :class="{ active: s.id === activeId }">
          <template v-if="editingId === s.id">
            <div class="edit-row">
              <label class="field mini">
                <span>Personagem</span>
                <input v-model="editPlayer" maxlength="20" placeholder="Lojista" />
              </label>
              <label class="field mini">
                <span>Lojinha</span>
                <input v-model="editShop" maxlength="24" placeholder="Lojinha Lofi" @keyup.enter="saveRename(s.id)" />
              </label>
              <div class="save-acts">
                <button class="btn sm good" title="Salvar nomes" @click="saveRename(s.id)"><PhCheck weight="bold" /> Salvar</button>
                <button class="btn sm" title="Cancelar" @click="editingId = null"><PhX weight="bold" /></button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="save-main">
              <div class="save-title">
                <PhStorefront weight="duotone" />
                <b>{{ s.shopName || 'Lojinha Lofi' }}</b>
                <span v-if="s.id === activeId" class="badge active">Atual</span>
                <span class="badge lock" :class="s.mode">
                  <PhLock weight="bold" /> {{ modeInfo(s.mode).emoji }} {{ modeInfo(s.mode).name }}
                </span>
              </div>
              <div class="save-meta muted">
                <span><PhUser weight="bold" /> {{ s.playerName || 'Lojista' }}</span>
                <span>· Dia {{ s.day || 1 }}</span>
                <span>· {{ money(s.money ?? 0) }}</span>
                <span>· {{ regionOf(s.region).emoji }} {{ regionOf(s.region).name }}</span>
              </div>
            </div>
            <div class="save-acts">
              <button class="btn sm primary" @click="playSlot(s.id)">
                <PhPlay weight="fill" /> {{ s.id === activeId ? 'Continuar' : 'Carregar' }}
              </button>
              <button class="btn sm" title="Alterar nome do personagem e da lojinha" @click="startRename(s)">
                <PhPencilSimple weight="bold" />
              </button>
              <button class="btn sm" title="Recomeçar esta partida do Dia 1" @click="restartSaveSlot(s.id)">
                <PhArrowCounterClockwise weight="bold" />
              </button>
              <button class="btn sm danger" title="Apagar este save" @click="deleteSaveSlot(s.id)">
                <PhTrash weight="bold" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <form v-else class="new-form" @submit.prevent="submitNew">
      <div class="fields">
        <label class="field">
          <span><PhUser weight="duotone" /> Seu nome de usuário</span>
          <input v-model="playerName" maxlength="20" required placeholder="Ex: Rafael" />
        </label>
        <label class="field">
          <span><PhStorefront weight="duotone" /> Nome do seu mercado / shop</span>
          <input v-model="shopName" maxlength="24" required placeholder="Ex: Empório do Bairro" />
        </label>
      </div>

      <div class="mode-section">
        <div class="mode-title">
          <b>Escolha o Modo de Jogo</b>
          <span class="warn-lock"><PhLock weight="bold" /> Definitivo: o modo não pode ser trocado depois neste save</span>
        </div>
        <div class="mode-grid">
          <button
            v-for="m in Object.values(GAME_MODES)"
            :key="m.id"
            type="button"
            class="mode-card"
            :class="[{ on: selectedMode === m.id }, m.id]"
            @click="selectedMode = m.id"
          >
            <div class="m-top">
              <span class="m-emoji">{{ m.emoji }}</span>
              <b>{{ m.name }}</b>
            </div>
            <small>{{ m.desc }}</small>
          </button>
        </div>
      </div>

      <div class="submit-row">
        <button type="submit" class="btn primary big"><PhPlay weight="fill" /> Começar Nova Partida</button>
      </div>
    </form>

    <template #foot>
      <template v-if="creating">
        <button v-if="savesList.length" class="btn" @click="creating = false">← Voltar para partidas</button>
      </template>
      <template v-else>
        <button class="btn good new-btn" @click="openCreate"><PhPlus weight="bold" /> Nova Partida (Novo Save)</button>
        <button v-if="savesList.length" class="btn primary" @click="ui.modal = null">Continuar jogo</button>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.intro { margin: 0 0 12px; font-size: 13.5px; }
.saves-list { display: flex; flex-direction: column; gap: 10px; }
.save-card {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 14px; border-radius: 14px; background: var(--cream2); border: 2px solid transparent;
}
.save-card.active { background: #fff; border-color: var(--teal); box-shadow: 0 3px 10px rgba(59, 47, 74, .08); }
.save-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.save-title { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 15px; }
.save-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; }
.save-meta span { display: inline-flex; align-items: center; gap: 3px; }
.save-acts { display: flex; gap: 6px; align-items: center; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 800; }
.badge.active { background: #d1fae5; color: #065f46; }
.badge.lock { background: #f3e8d2; color: var(--plum); }
.badge.lock.lofi { background: #e0f2fe; color: #0369a1; }
.badge.lock.hardcore { background: #fee2e2; color: #991b1b; }
.btn.danger:hover { background: #fee2e2; color: #991b1b; }

.new-form { display: flex; flex-direction: column; gap: 16px; }
.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 800; }
.field span { display: inline-flex; align-items: center; gap: 5px; }
.field input { padding: 9px 12px; border-radius: 10px; border: 2px solid var(--cream2); background: #fff; font: inherit; font-weight: 700; color: var(--plum); }
.field input:focus { outline: none; border-color: var(--teal); }
.edit-row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; width: 100%; }
.field.mini { flex: 1; min-width: 140px; font-size: 12px; }
.field.mini input { padding: 6px 10px; }
.mode-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.warn-lock { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 800; color: #9a3412; background: #ffedd5; padding: 3px 9px; border-radius: 99px; }
.mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mode-card {
  display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 12px; border-radius: 14px;
  background: var(--cream2); border: 2.5px solid transparent; transition: transform .12s, border-color .12s;
}
.mode-card:hover { transform: translateY(-2px); }
.mode-card.on { background: #fff; border-color: var(--teal); box-shadow: 0 4px 12px rgba(59, 47, 74, .1); }
.mode-card.lofi.on { border-color: #0284c7; background: #f0f9ff; }
.mode-card.hardcore.on { border-color: #dc2626; background: #fef2f2; }
.m-top { display: flex; align-items: center; gap: 6px; font-size: 14.5px; }
.m-emoji { font-size: 18px; }
.mode-card small { font-size: 12px; line-height: 1.35; opacity: .82; }
.submit-row { display: flex; justify-content: flex-end; }
.btn.big { padding: 10px 18px; font-size: 15px; }
.new-btn { margin-right: auto; }
@media (max-width: 680px) {
  .fields { grid-template-columns: 1fr; }
  .mode-grid { grid-template-columns: 1fr; }
}
</style>
