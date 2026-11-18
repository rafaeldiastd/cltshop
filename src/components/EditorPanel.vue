<script setup>
// Modo de edição da loja: menu lateral com móveis, decoração, inventário e a aba Construção (paredes e piso)
import { computed, ref, watch } from 'vue'
import {
  PhStack, PhPottedPlant, PhArchive, PhHammer, PhCheck, PhBroom, PhCoffee, PhSnowflake, PhCow, PhCarrot, PhLock,
  PhSecurityCamera, PhSiren, PhLamp, PhLampPendant, PhLightbulb, PhClock, PhFrameCorners, PhArrowRight, PhCoins, PhX,
} from '@phosphor-icons/vue'
import { game, ui, money, canExpand, hasPerk, storedDecorCount, shelfCount, produceCount, freezerCount, meatCount, maxShelves, maxProduce, maxFreezers, maxMeat } from '../game/state.js'
import { DECOR, CAFE, LEVELS } from '../game/config.js'
import { isDecorUnlocked, decorUnlockHint } from '../game/goals.js'
import { decorThumb } from '../game/assets.js'
import { buildThumb } from '../game/thumbs.js'
import {
  setEditTab, stopEdit, selectTool, setShelfType, setProduceStyle, SHELF_TYPES, PRODUCE_TYPES, TOOLS,
  buyDecor, canBuyDecor, decorMaxed, buyCafe, canBuyCafe, takeFromInv, clearStore,
} from '../game/editor.js'
import { invGroups, invTotal, sellFromInv, resaleOf } from '../game/inventory.js'
import { moveSelectionById } from '../game/build.js'
import BuildMode from './BuildMode.vue'

const initial = computed(() => game.plan.built === false)
const tabs = computed(() => [
  { id: 'shelves', label: 'Móveis', icon: PhStack },
  { id: 'decor', label: 'Decoração', icon: PhPottedPlant },
  { id: 'inv', label: 'Inventário', icon: PhArchive, badge: invTotal() },
  { id: 'build', label: 'Construção', icon: PhHammer, off: !canExpand(), why: 'A obra só pode ser feita antes de abrir ou depois do expediente' },
].map((t) => ({ ...t, off: t.off || (initial.value && t.id !== 'build') })))

// ---------- móveis ----------
const shelfType = computed(() => ui.shelfType)
const produceStyle = computed(() => (ui.held?.kind === 'produceGroup' && ui.held.isNew && !ui.held.fromInv ? ui.held.style : ui.produceStyle))
const furniture = computed(() => {
  const limit = (tool) => ({ shelf: [shelfCount(), maxShelves()], produce: [produceCount(), maxProduce()], fridge: [freezerCount(), maxFreezers()], meat: [meatCount(), maxMeat()] }[tool])
  const item = (id, tool, name, price, desc, thumb, pick, on) => {
    const [count, max] = limit(tool)
    return { id, tool, name, price, desc, thumb: buildThumb(thumb), count, max, on, pick, ok: on || TOOLS[tool].can() }
  }
  return [
    ...Object.entries(SHELF_TYPES).map(([id, t]) => item('shelf:' + id, 'shelf', `Prateleira ${t.name.toLowerCase()}`, t.price, t.desc, 'shelf:' + id,
      () => { if (ui.buyTool === 'shelf' && shelfType.value === id) return selectTool('shelf'); setShelfType(id); if (ui.buyTool !== 'shelf') selectTool('shelf') }, ui.buyTool === 'shelf' && shelfType.value === id)),
    ...Object.entries(PRODUCE_TYPES).map(([id, t]) => item('produce:' + id, 'produce', `Hortifruti ${t.name}`, t.price, t.desc, 'produce:' + id,
      () => { if (ui.buyTool === 'produce' && produceStyle.value === id) return selectTool('produce'); setProduceStyle(id); if (ui.buyTool !== 'produce') selectTool('produce') }, ui.buyTool === 'produce' && produceStyle.value === id)),
    item('fridge', 'fridge', 'Freezer', TOOLS.fridge.price, 'Guarda os produtos gelados', 'fridge', () => selectTool('fridge'), ui.buyTool === 'fridge'),
    item('meat', 'meat', 'Freezer de carnes', TOOLS.meat.price, 'Armário alto com porta de vidro', 'meat', () => selectTool('meat'), ui.buyTool === 'meat'),
  ]
})
const cafeState = computed(() => {
  if (game.cafe && game.cafe.x >= 0) return 'Instalada'
  if (game.inventory?.cafe) return 'No inventário'
  if (game.level < CAFE.minLevel) return `Libera como ${LEVELS[CAFE.minLevel].name}`
  return null
})

// ---------- decoração ----------
const ICON = { camera: PhSecurityCamera, alarm: PhSiren, cafeTable: PhCoffee, lamp: PhLamp, pendant: PhLampPendant, led: PhLightbulb, clock: PhClock, frame: PhFrameCorners }
const decorList = computed(() => Object.entries(DECOR)
  .filter(([, d]) => d.price && (!d.perk || hasPerk(d.perk)))
  .map(([type, d]) => ({ type, ...d, thumb: decorThumb(type), icon: ICON[type] || PhPottedPlant, locked: !isDecorUnlocked(type), stored: storedDecorCount(type) })))

// ---------- inventário ----------
const groups = computed(() => invGroups().map((g) => ({ ...g, thumb: g.decor ? decorThumb(g.decor) : g.thumb ? buildThumb(g.thumb) : null, resale: resaleOf(g.price), on: ui.invTool === g.key })))
const invIcon = (g) => (g.decor ? ICON[g.decor] || PhPottedPlant : g.key === 'cafe' ? PhCoffee : g.key === 'fridge' ? PhSnowflake : g.key === 'meat' ? PhCow : g.key.startsWith('produce') ? PhCarrot : PhStack)

// "Limpar tudo" pede um segundo clique para confirmar
const confirmClear = ref(false)
let clearTimer = 0
const placedCount = computed(() => new Set(game.shelves.filter((s) => s.x >= 0).map((s) => s.groupId || s.id)).size + game.decor.filter((d) => d.x >= 0 && DECOR[d.type]?.price).length + (game.cafe && game.cafe.x >= 0 ? 1 : 0))
function clearAllClick() {
  if (!confirmClear.value) { confirmClear.value = true; clearTimeout(clearTimer); clearTimer = setTimeout(() => (confirmClear.value = false), 4000); return }
  confirmClear.value = false
  clearStore()
  ui.editTab = 'inv'
}
watch(() => ui.editTab, () => { confirmClear.value = false })
const pickTab = (t) => { if (!t.off) setEditTab(t.id) }
</script>

<template>
  <template v-if="ui.editing">
    <aside class="card editor" aria-label="Editar loja">
      <header>
        <b class="title"><PhHammer weight="duotone" /> {{ initial ? 'Construir a loja' : 'Editar loja' }}</b>
        <button v-if="!initial" class="btn sm primary" title="Concluir (Esc)" @click="stopEdit"><PhCheck weight="bold" /> Concluir</button>
        <button v-else class="btn sm" title="Fechar" @click="stopEdit"><PhX weight="bold" /></button>
      </header>
      <nav class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          :class="{ on: ui.editTab === t.id, build: t.id === 'build' }"
          role="tab"
          :aria-selected="ui.editTab === t.id"
          :disabled="t.off"
          :title="t.off && t.why ? t.why : t.label"
          @click="pickTab(t)"
        >
          <component :is="t.icon" weight="duotone" />
          <span>{{ t.label }}</span>
          <i v-if="t.badge" class="badge">{{ t.badge }}</i>
        </button>
      </nav>

      <div class="body">
        <BuildMode v-if="ui.editTab === 'build'" />

        <template v-else-if="ui.editTab === 'shelves'">
          <p class="hint">Escolha um móvel e clique no chão para colocar; ele continua na mão até desmarcar. Clique num móvel da loja para mudar de lugar.</p>
          <div class="list">
            <button v-for="f in furniture" :key="f.id" class="item" :class="{ on: f.on }" :disabled="!f.ok" :aria-pressed="f.on" @click="f.pick">
              <img v-if="f.thumb" :src="f.thumb" alt="" />
              <span v-else class="ph"><PhStack weight="duotone" /></span>
              <span class="info"><b>{{ f.name }}</b><span class="muted">{{ f.desc }}</span></span>
              <span class="side"><b>{{ money(f.price) }}</b><span class="muted">{{ f.count }}/{{ f.max }}</span></span>
            </button>
            <button class="item" :disabled="!canBuyCafe()" @click="buyCafe">
              <span class="ph"><PhCoffee weight="duotone" /></span>
              <span class="info"><b>Cafeteria</b><span class="muted">{{ cafeState || 'Balcão com atendente do café' }}</span></span>
              <span class="side"><b>{{ money(CAFE.price) }}</b></span>
            </button>
          </div>
        </template>

        <template v-else-if="ui.editTab === 'decor'">
          <p class="hint">Clique para comprar e escolha o lugar. Itens com cadeado liberam cumprindo metas.</p>
          <div class="grid">
            <button
              v-for="d in decorList"
              :key="d.type"
              class="deco"
              :class="{ locked: d.locked }"
              :disabled="!canBuyDecor(d.type)"
              :title="d.locked ? decorUnlockHint(d.type) : d.desc || d.name"
              @click="buyDecor(d.type)"
            >
              <img v-if="d.thumb" :src="d.thumb" alt="" />
              <component :is="d.icon" v-else class="ico" weight="duotone" />
              <b>{{ d.name }}</b>
              <span v-if="d.locked" class="muted"><PhLock weight="bold" /> bloqueada</span>
              <span v-else-if="decorMaxed(d.type)" class="muted">{{ d.stored ? 'no inventário' : 'já instalada' }}</span>
              <span v-else class="price">{{ money(d.price) }}</span>
            </button>
          </div>
        </template>

        <template v-else-if="ui.editTab === 'inv'">
          <p class="hint">O que você já pagou e tirou da loja. Volta para o lugar de graça; prateleiras voltam com os produtos.</p>
          <div v-if="groups.length" class="list">
            <div v-for="g in groups" :key="g.key" class="item inv" :class="{ on: g.on }">
              <img v-if="g.thumb" :src="g.thumb" alt="" />
              <span v-else class="ph"><component :is="invIcon(g)" weight="duotone" /></span>
              <span class="info"><b>{{ g.name }} <span class="qty">×{{ g.count }}</span></b><span v-if="g.full" class="muted">{{ g.full === g.count ? 'com produtos' : `${g.full} com produtos` }}</span></span>
              <span class="acts">
                <button class="btn sm good" :aria-pressed="g.on" @click="takeFromInv(g.key)"><PhArrowRight weight="bold" /> Colocar</button>
                <button class="btn sm" :disabled="g.full === g.count" :title="g.full === g.count ? 'Esvazie na loja antes de vender' : `Vender por ${money(g.resale)}`" @click="sellFromInv(g.key)"><PhCoins weight="bold" /> {{ money(g.resale) }}</button>
              </span>
            </div>
          </div>
          <p v-else class="empty">Nada guardado. Clique num móvel da loja e use <b>Guardar</b>, ou use <b>Limpar tudo</b> para recomeçar o layout.</p>
        </template>
      </div>

      <footer v-if="ui.editTab !== 'build'">
        <button class="btn sm clear" :class="{ armed: confirmClear }" :disabled="!placedCount && !confirmClear" @click="clearAllClick">
          <PhBroom weight="bold" /> {{ confirmClear ? `Guardar ${placedCount} itens? Clique de novo` : 'Limpar tudo' }}
        </button>
        <span class="muted keys"><kbd>R</kbd> gira · <kbd>I</kbd> guarda · <kbd>Del</kbd> vende</span>
      </footer>
    </aside>

    <button
      v-for="a in ui.buildArrows"
      :key="a.id"
      class="handle"
      :style="{ left: a.x + 'px', top: a.y + 'px' }"
      :title="a.tip"
      :aria-label="a.tip"
      @click="moveSelectionById(a.id)"
    >
      <PhArrowRight weight="bold" :style="{ transform: `rotate(${a.ang}deg)` }" />
    </button>
  </template>
</template>

<style scoped>
.editor { position: fixed; left: 12px; top: 72px; bottom: 12px; width: 340px; z-index: 12; display: flex; flex-direction: column; gap: 10px; padding: 12px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.title { display: flex; align-items: center; gap: 6px; font-size: 16px; }
.tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; background: var(--cream2); padding: 4px; border-radius: 14px; }
.tab { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 2px; border-radius: 10px; background: transparent; font-size: 11px; font-weight: 800; }
.tab svg { font-size: 19px; }
.tab:hover:not(:disabled) { background: rgba(255, 255, 255, .6); }
.tab.on { background: #fff; box-shadow: 0 2px 0 rgba(59, 47, 74, .15); }
.tab.build.on { background: var(--plum); color: var(--cream); }
.tab:disabled { opacity: .4; cursor: not-allowed; }
.badge { position: absolute; top: 2px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 99px; background: var(--coral); color: #fff; font: 800 10px/16px system-ui, sans-serif; font-style: normal; }
.body { flex: 1; min-height: 0; overflow-y: auto; padding-right: 2px; }
.hint { margin: 0 0 8px; font-size: 12px; line-height: 1.35; opacity: .75; }
.list { display: flex; flex-direction: column; gap: 5px; }
.item { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; border-radius: 12px; background: #fff; border: 2px solid transparent; text-align: left; line-height: 1.25; }
button.item:hover:not(:disabled) { border-color: var(--teal); }
.item.on { border-color: var(--plum); background: #dff3ee; }
.item:disabled { opacity: .45; cursor: not-allowed; }
.item img, .item .ph { width: 44px; height: 44px; flex: none; border-radius: 9px; background: var(--cream2); object-fit: contain; display: grid; place-items: center; font-size: 24px; color: var(--plum2); }
.info { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; }
.info .muted { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side { display: flex; flex-direction: column; align-items: flex-end; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.side .muted { font-size: 11px; }
.qty { font-weight: 800; color: var(--plum2); }
.inv .acts { display: flex; flex-direction: column; gap: 4px; align-items: stretch; }
.inv .acts .btn { white-space: nowrap; font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.deco { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 12px; background: #fff; border: 2px solid transparent; font-size: 11.5px; line-height: 1.2; text-align: center; }
.deco:hover:not(:disabled) { border-color: var(--teal); }
.deco:disabled { opacity: .5; cursor: not-allowed; }
.deco img { width: 52px; height: 52px; object-fit: contain; }
.deco .ico { font-size: 34px; color: var(--plum2); margin: 9px 0; }
.deco .price { font-weight: 800; font-variant-numeric: tabular-nums; }
.deco .muted { font-size: 10.5px; }
.deco.locked img { filter: grayscale(1); }
.empty { font-size: 13px; line-height: 1.45; background: #fff; border-radius: 12px; padding: 12px; margin: 0; }
footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.clear.armed { background: var(--bad); color: #fff; }
.keys { font-size: 11px; }
.keys kbd { font-size: 10px; min-width: 18px; }
.handle { position: fixed; z-index: 9; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; display: grid; place-items: center; background: var(--teal); color: #fff; font-size: 18px; box-shadow: 0 3px 0 #4d8c81, 0 4px 14px rgba(40, 20, 50, .35); border: 2px solid #fff; }
.handle:hover { background: var(--plum); box-shadow: 0 3px 0 #241c2e, 0 4px 14px rgba(40, 20, 50, .35); }
@media (max-width: 720px) {
  .editor { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 46vh; }
}
</style>
