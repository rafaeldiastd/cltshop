<script setup>
import { onMounted, ref } from 'vue'
import { PhCopy, PhGlobe, PhSignIn, PhStorefront, PhUsersThree, PhCheck, PhArrowClockwise } from '@phosphor-icons/vue'
import Modal from './Modal.vue'
import { ui, regionOf, toast } from '../game/state.js'
import { mp, toggleOpenToVisitors, visitStore, fetchDirectoryStores } from '../game/multiplayer.js'
import { LEVELS } from '../game/config.js'

const codeInput = ref('')
const copied = ref(false)
const close = () => { ui.modal = null }

onMounted(() => { fetchDirectoryStores() })

async function copyCode() {
  try {
    await navigator.clipboard.writeText(mp.myCode)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch (e) {
    toast(`Código da sua loja: ${mp.myCode}`, 'info')
  }
}

function goVisit() {
  if (codeInput.value.trim()) visitStore(codeInput.value)
}
</script>

<template>
  <Modal title="Visitas Online (Realtime)" :icon="PhGlobe" wide @close="close">
    <div class="mp">
      <section class="card-in">
        <div class="row">
          <div class="col">
            <label class="muted small" for="mp-name">Nome da sua loja</label>
            <input id="mp-name" v-model="mp.storeName" maxlength="24" placeholder="Lojinha Lofi" />
          </div>
          <div class="code-box">
            <span class="muted small">Código da sua loja</span>
            <div class="code-row">
              <b class="code">{{ mp.myCode }}</b>
              <button class="btn sm" @click="copyCode">
                <PhCheck v-if="copied" weight="bold" />
                <PhCopy v-else weight="bold" />
                {{ copied ? 'Copiado' : 'Copiar' }}
              </button>
            </div>
          </div>
          <button class="btn sm" :class="{ good: mp.openToVisitors }" @click="toggleOpenToVisitors">
            {{ mp.openToVisitors ? '🟢 Aberta a visitas' : '🔴 Visitas fechadas' }}
          </button>
        </div>
      </section>

      <section class="card-in">
        <b><PhSignIn weight="duotone" /> Visitar pelo código</b>
        <div class="join-row">
          <input v-model="codeInput" maxlength="8" placeholder="Ex: AB12CD" @keyup.enter="goVisit" />
          <button class="btn primary" :disabled="!codeInput.trim() || mp.connecting" @click="goVisit">
            {{ mp.connecting ? 'Conectando...' : 'Visitar loja' }}
          </button>
        </div>
        <span class="muted small">Dica: abra outra aba neste navegador ou compartilhe seu código com amigos!</span>
      </section>

      <section>
        <div class="list-head">
          <h3><PhStorefront weight="duotone" /> Lojas disponíveis ({{ mp.onlineStores.length }})</h3>
          <button class="btn sm" @click="fetchDirectoryStores"><PhArrowClockwise weight="bold" /> Atualizar</button>
        </div>
        <div v-if="mp.onlineStores.length" class="stores">
          <article v-for="s in mp.onlineStores" :key="s.code" class="store-card">
            <div class="col">
              <b>{{ s.storeName }} <span class="code-mini">#{{ s.code }}</span> <span v-if="s.live" class="live-dot" title="Ao vivo agora">●</span></b>
              <span class="muted small">{{ regionOf(s.region).emoji }} {{ regionOf(s.region).name }} · {{ LEVELS[s.level || 0]?.name }} · ★ {{ (s.rep || 3).toFixed(1) }}</span>
            </div>
            <button class="btn good sm" @click="visitStore(s.code)">Visitar</button>
          </article>
        </div>
        <p v-else class="muted small">Nenhuma outra loja aberta no momento. Compartilhe seu código ou abra outra aba!</p>
      </section>

      <section v-if="!mp.visiting && mp.visitors.length">
        <h3><PhUsersThree weight="duotone" /> Visitantes na sua loja ({{ mp.visitors.length }})</h3>
        <div class="visitors">
          <span v-for="v in mp.visitors" :key="v.id" class="v-chip">👤 {{ v.name }}</span>
        </div>
      </section>
    </div>

    <template #foot>
      <button class="btn primary" @click="close">Fechar</button>
    </template>
  </Modal>
</template>

<style scoped>
.mp { display: flex; flex-direction: column; gap: 12px; }
.card-in { background: #fff; border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.col { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 3px; }
.small { font-size: 12px; }
input { padding: 7px 10px; border-radius: 10px; border: 2px solid var(--cream2); font: inherit; background: #fff; }
.code-box { display: flex; flex-direction: column; gap: 3px; }
.code-row { display: flex; align-items: center; gap: 6px; }
.code { font-size: 1.15em; letter-spacing: 2px; background: var(--cream2); padding: 4px 10px; border-radius: 8px; }
.join-row { display: flex; gap: 8px; }
.join-row input { flex: 1; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
h3 { margin: 4px 0 6px; font-size: 1em; display: flex; align-items: center; gap: 6px; }
.stores { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
.store-card { background: #fff; border-radius: 12px; padding: 10px; display: flex; align-items: center; gap: 10px; border: 2px solid var(--cream2); }
.code-mini { font-size: 11px; opacity: .6; font-weight: 700; }
.visitors { display: flex; flex-wrap: wrap; gap: 6px; }
.v-chip { background: #e0f2fe; color: #075985; padding: 4px 10px; border-radius: 99px; font-weight: 700; font-size: 13px; }
.list-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.live-dot { color: #16a34a; font-size: 10px; }
</style>
