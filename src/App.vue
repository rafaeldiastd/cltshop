<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Renderer } from './game/renderer.js'
import { world } from './game/world.js'
import { loadAssets } from './game/assets.js'
import { startMusic, setMusic, setSfx } from './game/audio.js'
import { game, ui, settings, newGame, load, save } from './game/state.js'
import { onClick, hoverText } from './game/controls.js'
import { moveHeld, rotateHeld, cancelHeld, stopEdit } from './game/editor.js'
import TopBar from './components/TopBar.vue'
import BottomBar from './components/BottomBar.vue'
import ToastStack from './components/ToastStack.vue'
import ShelfPanel from './components/ShelfPanel.vue'
import SummaryModal from './components/SummaryModal.vue'
import ComputerScreen from './components/ComputerScreen.vue'
import MenuModal from './components/MenuModal.vue'
import ThiefAlert from './components/ThiefAlert.vue'
import { PhCrosshair } from '@phosphor-icons/vue'
import MusicPanel from './components/MusicPanel.vue'

const cv = ref(null)
let raf = 0, rend, autosave = 0
const tip = ref(null)
const saveIfHidden = () => { if (document.hidden) save() }

watch(() => settings.musicOn, setMusic, { immediate: true })
watch(() => settings.sfxOn, setSfx, { immediate: true })

onMounted(async () => {
  if (!load()) newGame()
  await loadAssets()
  rend = new Renderer(cv.value)
  rend.onClick = onClick
  rend.onHover = (h) => {
    if (ui.held && h?.kind === 'floor') moveHeld(h.x, h.z)
    tip.value = hoverText(h)
    cv.value.style.cursor = h?.obj ? 'pointer' : ''
  }
  const p = world.player, saved = game.playerPos
  p.x = saved ? saved.x : 4; p.z = saved ? saved.z : world.d.rows + 1; p.face = saved?.face || 0
  world.refreshGrid()
  ui.ready = true
  autosave = setInterval(save, 5000)
  addEventListener('pagehide', save)
  document.addEventListener('visibilitychange', saveIfHidden)
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
    if (e.key === 'Escape') {
      if (ui.editing) { if (ui.held) cancelHeld(); else stopEdit(); return }
      ui.selectedBox = null; ui.panelShelf = null; ui.modal = ui.modal === 'summary' ? ui.modal : null; return
    }
    if (typing(e) || e.metaKey || e.ctrlKey) return
    if (MAP[e.code]) { world.keys.add(MAP[e.code]); startMusic(); e.preventDefault(); return }
    if (e.code === 'KeyR' && ui.held && !e.repeat) { rotateHeld(); return }
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
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(autosave)
  removeEventListener('pagehide', save)
  document.removeEventListener('visibilitychange', saveIfHidden)
})
</script>

<template>
  <canvas ref="cv" class="cv" />
  <template v-if="ui.ready">
    <TopBar />
    <ToastStack />
    <ShelfPanel />
    <BottomBar />
    <MusicPanel />
    <ThiefAlert />
    <SummaryModal v-if="ui.modal === 'summary'" />
    <ComputerScreen v-if="ui.modal === 'computer'" />
    <MenuModal v-if="ui.modal === 'menu'" />
    <button v-if="ui.panned" class="btn recenter" @click="ui.recenter = true"><PhCrosshair weight="bold" /> Centralizar</button>
    <div v-if="tip" class="tip" :style="{ left: ui.mouse.x + 14 + 'px', top: ui.mouse.y + 14 + 'px' }">{{ tip }}</div>
  </template>
  <div v-else class="loading">carregando a lojinha…</div>
</template>

<style>
.cv { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.cv:active { cursor: grabbing; }
.recenter { position: fixed; left: 12px; bottom: 16px; z-index: 9; }
.tip { position: fixed; z-index: 30; background: var(--plum); color: var(--cream); padding: 5px 10px; border-radius: 9px; font-size: 13px; font-weight: 700; pointer-events: none; box-shadow: var(--shadow); }
kbd { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; margin: 0 2px; border-radius: 6px; background: var(--cream); color: var(--plum); font: 800 .85em ui-rounded, system-ui; box-shadow: 0 2px 0 #c9b79a; }
.loading { position: fixed; inset: 0; display: grid; place-items: center; color: var(--cream); font-size: 22px; }
</style>
