<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Renderer } from './game/renderer.js'
import { world } from './game/world.js'
import { loadAssets } from './game/assets.js'
import { startMusic } from './game/audio.js'
import { game, ui, newGame, load } from './game/state.js'
import { onClick, hoverText } from './game/controls.js'
import TopBar from './components/TopBar.vue'
import BottomBar from './components/BottomBar.vue'
import ShelfPanel from './components/ShelfPanel.vue'
import SummaryModal from './components/SummaryModal.vue'
import OrdersModal from './components/OrdersModal.vue'
import ShopModal from './components/ShopModal.vue'

const cv = ref(null)
const info = ref('')
let raf = 0, rend
const tip = ref(null)

onMounted(async () => {
  if (!load()) newGame()
  const a = await loadAssets()
  info.value = a.models || a.characters ? `Assets Kenney: ${a.models} modelos, ${a.characters} personagens` : 'Modelos procedurais (sem .glb da Kenney)'
  rend = new Renderer(cv.value)
  rend.onClick = onClick
  rend.onHover = (h) => (tip.value = hoverText(h))
  const p = world.player; p.x = 4; p.z = world.d.rows + 1
  ui.ready = true
  let last = performance.now()
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t
    world.update(dt)
    rend.update(dt)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  window.__game = { game, ui, world, rend }
  const MAP = { KeyW: 'w', ArrowUp: 'w', KeyA: 'a', ArrowLeft: 'a', KeyS: 's', ArrowDown: 's', KeyD: 'd', ArrowRight: 'd' }
  const typing = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ui.placing = false; ui.selectedBox = null; ui.panelShelf = null; ui.modal = ui.modal === 'summary' ? ui.modal : null; return }
    if (typing(e) || e.metaKey || e.ctrlKey) return
    if (MAP[e.code]) { world.keys.add(MAP[e.code]); startMusic(); e.preventDefault(); return }
    if (e.code === 'KeyE' && !e.repeat) {
      startMusic()
      if (ui.modal) return
      if (!world.interact()) { const h = rend.hover; if (h && h.kind !== 'floor') onClick(h) }
    }
    if (e.code === 'KeyQ') world.drop()
  })
  addEventListener('keyup', (e) => { if (MAP[e.code]) world.keys.delete(MAP[e.code]) })
  addEventListener('blur', () => world.keys.clear())
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="cv" class="cv" />
  <template v-if="ui.ready">
    <TopBar />
    <ShelfPanel />
    <BottomBar />
    <SummaryModal v-if="ui.modal === 'summary'" />
    <OrdersModal v-if="ui.modal === 'orders'" />
    <ShopModal v-if="ui.modal === 'shop'" />
    <div v-if="ui.prompt" class="prompt"><kbd>E</kbd> {{ ui.prompt }}</div>
    <div class="keys card"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover · <kbd>E</kbd> interagir · <kbd>Q</kbd> soltar caixa · clique também funciona</div>
    <div v-if="tip" class="tip" :style="{ left: ui.mouse.x + 14 + 'px', top: ui.mouse.y + 14 + 'px' }">{{ tip }}</div>
    <div class="info">{{ info }}</div>
  </template>
  <div v-else class="loading">carregando a lojinha…</div>
</template>

<style>
.cv { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.tip { position: fixed; z-index: 30; background: var(--plum); color: var(--cream); padding: 5px 10px; border-radius: 9px; font-size: 13px; font-weight: 700; pointer-events: none; box-shadow: var(--shadow); }
.prompt { position: fixed; left: 50%; bottom: 150px; transform: translateX(-50%); z-index: 11; background: var(--plum); color: var(--cream); padding: 8px 16px; border-radius: 14px; font-weight: 800; box-shadow: var(--shadow); pointer-events: none; }
kbd { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; margin: 0 2px; border-radius: 6px; background: var(--cream); color: var(--plum); font: 800 .85em ui-rounded, system-ui; box-shadow: 0 2px 0 #c9b79a; }
.keys { position: fixed; left: 12px; bottom: 26px; z-index: 9; font-size: 12px; padding: 7px 10px; opacity: .88; max-width: 280px; line-height: 1.9; }
.info { position: fixed; left: 12px; bottom: 6px; font-size: 11px; color: #fff; opacity: .45; pointer-events: none; }
.loading { position: fixed; inset: 0; display: grid; place-items: center; color: var(--cream); font-size: 22px; }
</style>
