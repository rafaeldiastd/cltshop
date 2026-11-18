<script setup>
// Conteúdo da aba Construção do painel de edição: ferramentas, o que está selecionado, checagens e o botão de aplicar a obra
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { game, ui, money } from '../game/state.js'
import { BUILD_TILES } from '../game/config.js'
import {
  setBuildTool, autoWrapWalls, clearDraft, applyStarterTemplate, undoBuild, canUndo, quote, confirmBuild, discardBuild,
  deleteSelection, demolishRun, demolishRoom, setRoomType, removeOpening, swapOpening, startCarry, clearSelection, ROOM_NAME,
} from '../game/build.js'
import {
  PhCheck, PhSparkle, PhTrash, PhDoor, PhSquare, PhWall, PhFrameCorners, PhEraser, PhArrowCounterClockwise,
  PhHouseLine, PhCursor, PhArrowsOutCardinal, PhSwap, PhX, PhArrowUUpLeft,
} from '@phosphor-icons/vue'

const q = computed(() => quote())
const b = computed(() => ui.build)
const sel = computed(() => ui.build?.sel)

const tools = [
  { id: 'select', key: 'V', label: 'Selecionar', hint: 'Parede, cômodo, porta ou janela', icon: PhCursor },
  { id: 'sales', key: '1', label: 'Piso da loja', price: `${money(BUILD_TILES.sales)}/m²`, swatch: '#7fd6a8', icon: PhSquare },
  { id: 'stock', key: '2', label: 'Piso do estoque', price: `${money(BUILD_TILES.stock)}/m²`, swatch: '#f2c25b', icon: PhSquare },
  { id: 'wall', key: '3', label: 'Parede', price: `${money(BUILD_TILES.wall)}/un`, swatch: '#e7c9a0', icon: PhWall },
  { id: 'window', key: '4', label: 'Janela', price: `${money(BUILD_TILES.window)}/un`, swatch: '#7dd3fc', icon: PhFrameCorners },
  { id: 'door', key: '5', label: 'Porta', price: `${money(BUILD_TILES.door)}/un`, swatch: '#6fb3a8', icon: PhDoor },
  { id: 'erase', key: 'X', label: 'Apagar', hint: 'Piso, parede, janela ou porta', icon: PhEraser },
]
const visibleTools = computed(() => (b.value?.initial ? tools.filter((t) => t.id !== 'select') : tools))

const selTitle = computed(() => {
  const s = sel.value
  if (!s) return null
  if (s.kind === 'run') return `Parede inteira · ${s.run.b - s.run.a + 1} m`
  if (s.kind === 'room') return `${ROOM_NAME[s.type] === 'salão' ? 'Salão' : 'Estoque'} · ${s.cells.length} m²`
  return s.type === 'door' ? 'Porta' : 'Janela'
})
const openingName = computed(() => (sel.value?.type === 'door' ? 'porta' : 'janela'))

function onKey(e) {
  if (!ui.build || ui.modal) return
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undoBuild(); return }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  const t = visibleTools.value.find((x) => x.key.toLowerCase() === k)
  if (t) { setBuildTool(ui.build.tool === t.id && t.id === 'erase' ? 'select' : t.id); e.preventDefault(); return }
  if (e.code === 'Delete' || e.code === 'Backspace') {
    if (ui.build.sel) deleteSelection()
    else setBuildTool(ui.build.tool === 'erase' ? 'select' : 'erase')
    e.preventDefault()
  }
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="b && q" class="build">
    <div class="tools" role="toolbar" aria-label="Ferramentas de construção">
      <button
        v-for="t in visibleTools"
        :key="t.id"
        class="tool"
        :class="{ on: b.tool === t.id, erase: t.id === 'erase' }"
        :aria-pressed="b.tool === t.id"
        :title="t.hint || t.label"
        @click="setBuildTool(t.id)"
      >
        <span class="tool-top">
          <span v-if="t.swatch" class="swatch" :style="{ background: t.swatch }" />
          <component :is="t.icon" weight="duotone" />
          <kbd>{{ t.key }}</kbd>
        </span>
        <span class="tool-name">{{ t.label }}</span>
        <span v-if="t.price" class="tool-price">{{ t.price }}</span>
      </button>
    </div>

    <section v-if="b.tool === 'select'" class="sel">
      <template v-if="b.carry">
        <b><PhArrowsOutCardinal weight="bold" /> Levando a {{ b.carry.type === 'door' ? 'porta' : 'janela' }}</b>
        <span class="muted">Clique em qualquer parede para colocar. O lugar de onde ela saiu vira parede.</span>
        <div class="row"><button class="btn sm" @click="clearSelection"><PhX weight="bold" /> Cancelar <kbd>Esc</kbd></button></div>
      </template>
      <template v-else-if="sel">
        <b>{{ selTitle }}</b>
        <template v-if="sel.kind === 'run'">
          <span class="muted">Use as setas na parede para empurrá-la para fora (aumenta o cômodo) ou puxar para dentro.</span>
          <div class="row">
            <button class="btn sm" @click="demolishRun"><PhTrash weight="bold" /> Derrubar parede <kbd>Del</kbd></button>
          </div>
        </template>
        <template v-else-if="sel.kind === 'room'">
          <span class="muted">Cada lado tem duas setas: uma aumenta, a outra diminui o cômodo.</span>
          <div class="row">
            <button class="btn sm" @click="setRoomType(sel.type === 's' ? 'k' : 's')"><PhSwap weight="bold" /> Virar {{ sel.type === 's' ? 'estoque' : 'salão' }}</button>
            <button class="btn sm" @click="demolishRoom"><PhTrash weight="bold" /> Demolir cômodo <kbd>Del</kbd></button>
          </div>
        </template>
        <template v-else>
          <span class="muted">Leve a {{ openingName }} para outra parede ou tire daqui. Mudar de lugar não custa nada.</span>
          <div class="row">
            <button class="btn sm good" @click="startCarry"><PhArrowsOutCardinal weight="bold" /> Mover</button>
            <button class="btn sm" @click="swapOpening"><PhSwap weight="bold" /> Trocar por {{ sel.type === 'door' ? 'janela' : 'porta' }}</button>
            <button class="btn sm" @click="removeOpening"><PhTrash weight="bold" /> Tirar <kbd>Del</kbd></button>
          </div>
        </template>
      </template>
      <span v-else class="muted">Clique numa parede para pegá-la inteira, no piso para pegar o cômodo todo, ou numa porta ou janela.</span>
    </section>

    <div class="checks">
      <span class="pill" :class="{ ok: q.checks.salesOk }">Salão {{ q.counts.sales }}/{{ BUILD_TILES.minSales }} m²</span>
      <span class="pill" :class="{ ok: q.checks.stockOk }">Estoque {{ q.counts.stock }}/{{ BUILD_TILES.minStock }} m² · {{ q.cap1 }} cx</span>
      <span class="pill" :class="{ ok: q.checks.doorOk }"><PhCheck v-if="q.checks.doorOk" weight="bold" /><PhX v-else weight="bold" /> Porta</span>
      <span class="pill" :class="{ ok: q.checks.stockLinkOk }"><PhCheck v-if="q.checks.stockLinkOk" weight="bold" /><PhX v-else weight="bold" /> Acesso ao estoque</span>
      <span class="pill neutral">{{ q.customers1 }} clientes/dia</span>
    </div>

    <div class="row">
      <button class="btn sm" :disabled="!canUndo()" title="Desfazer (Ctrl+Z)" @click="undoBuild"><PhArrowCounterClockwise weight="bold" /> Desfazer</button>
      <button class="btn sm" title="Contorna o piso com paredes e põe as portas que faltam" @click="autoWrapWalls"><PhSparkle weight="duotone" /> Auto-paredes</button>
      <button v-if="q.initial" class="btn sm" title="Preenche um modelo pronto para editar" @click="applyStarterTemplate"><PhHouseLine weight="duotone" /> Modelo base</button>
      <button v-if="q.initial" class="btn sm" @click="clearDraft"><PhTrash weight="duotone" /> Limpar rascunho</button>
    </div>

    <div class="status">
      <span v-if="!q.changed" class="muted">{{ q.initial ? 'Pinte o piso da loja e do estoque, ou use o Modelo base.' : 'Nada mudou ainda. Botão direito arrasta a câmera.' }}</span>
      <span v-else-if="q.why" class="bad-t">{{ q.why }}</span>
      <span v-else-if="!q.affordable" class="bad-t">Caixa insuficiente (você tem {{ money(game.money) }})</span>
      <span v-else-if="q.moved" class="warn">{{ q.moved === 1 ? '1 móvel está fora do piso novo' : `${q.moved} móveis estão fora do piso novo` }}: vão para o lugar livre mais perto, ou para o inventário se não couberem.</span>
      <span v-else class="good-t">Tudo certo para construir.</span>
    </div>

    <div class="apply">
      <button v-if="!q.initial" class="btn" :disabled="!q.changed" @click="discardBuild"><PhArrowUUpLeft weight="bold" /> Descartar</button>
      <button class="btn good grow" :disabled="!q.changed || !!q.why || !q.affordable" @click="confirmBuild">
        <PhCheck weight="bold" />
        {{ q.initial ? 'Construir' : 'Aplicar' }} · {{ q.total > 0 ? money(q.total) : 'grátis' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.build { display: flex; flex-direction: column; gap: 10px; }
.tools { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.tool { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 12px; border: 2px solid transparent; background: #fff; line-height: 1.2; }
.tool:hover { border-color: var(--teal); }
.tool.on { background: var(--teal); border-color: var(--plum); color: #fff; }
.tool.on.erase { background: var(--bad); }
.tool-top { display: flex; align-items: center; gap: 4px; font-size: 18px; }
.tool kbd { font-size: 10px; min-width: 0; padding: 0 4px; box-shadow: none; background: rgba(59, 47, 74, .1); color: inherit; }
.tool.on kbd { background: rgba(255, 255, 255, .25); }
.swatch { width: 9px; height: 9px; border-radius: 3px; border: 1px solid rgba(59, 47, 74, .3); }
.tool-name { font-size: 11px; font-weight: 800; text-align: center; }
.tool-price { font-size: 10px; opacity: .75; }
.sel { display: flex; flex-direction: column; gap: 5px; background: #fff; border-radius: 12px; padding: 9px 11px; font-size: 13px; line-height: 1.35; }
.sel .muted { font-size: 12px; opacity: .75; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
.checks { display: flex; gap: 4px; flex-wrap: wrap; }
.pill { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 99px; background: rgba(224, 103, 93, .15); color: #a63d35; }
.pill.ok { background: rgba(95, 168, 121, .2); color: #2c6e45; }
.pill.neutral { background: var(--cream2); color: var(--plum); }
.status { font-size: 12.5px; font-weight: 700; line-height: 1.35; }
.warn { color: #9a6a12; }
.apply { display: flex; gap: 8px; }
.apply .grow { flex: 1; }
</style>
