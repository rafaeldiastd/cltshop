<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Renderer } from './game/renderer.js'
import { world } from './game/world.js'
import { loadAssets } from './game/assets.js'
import { startMusic, setMusic, setSfx } from './game/audio.js'
import { game, ui, settings, newGame, load, save, pranksLeft, savesList, money, nextTipCost, nextTipXp, tipsLeft, toast } from './game/state.js'
import { onClick, hoverText } from './game/controls.js'
import { moveHeld, rotateHeld, rotateAt, sellHeld, sellAt, deselectTool, stopEdit, toggleProduceStyle, storeHeld, storeAt, setEditTab } from './game/editor.js'
import TopBar from './components/TopBar.vue'
import BottomBar from './components/BottomBar.vue'
import ToastStack from './components/ToastStack.vue'
import ShelfPanel from './components/ShelfPanel.vue'
import SummaryModal from './components/SummaryModal.vue'
import ComputerScreen from './components/ComputerScreen.vue'
import MenuModal from './components/MenuModal.vue'
import ThiefAlert from './components/ThiefAlert.vue'
import CafePanel from './components/CafePanel.vue'
import NpcPanel from './components/NpcPanel.vue'
import StaffBar from './components/StaffBar.vue'
import EditorPanel from './components/EditorPanel.vue'
import PetModal from './components/PetModal.vue'
import { buildEscape } from './game/build.js'
import { PhCrosshair } from '@phosphor-icons/vue'
import MusicPanel from './components/MusicPanel.vue'
import CloudLock from './components/CloudLock.vue'
import MultiplayerModal from './components/MultiplayerModal.vue'
import StartMenuModal from './components/StartMenuModal.vue'
import ArcadePanel from './components/ArcadePanel.vue'
import ArcadeModal from './components/ArcadeModal.vue'
import ChatOverlay from './components/ChatOverlay.vue'
import { startCloud, cloudStarted, saveSoon, saveOnExit } from './game/cloud.js'
import { mp, startMultiplayer, stopMultiplayer, visitStore, leaveVisit, sendEmote, sendTip } from './game/multiplayer.js'

const cv = ref(null)
let raf = 0, rend, autosave = 0, bgWorker = null, bgTimer = 0
const tip = ref(null)
const saveIfHidden = () => { if (document.hidden) saveOnExit() }
// gastou dinheiro (compra, contratação, obra…): grava já, para o F5 não desfazer
watch(() => game.money, (n, o) => { if (ui.ready && n < o) saveSoon() })

// a prateleira, o cliente e o fliperama dividem o mesmo lugar na tela: abrir um fecha os outros
watch(() => ui.panelShelf, (v) => { if (v != null) { ui.npc = null; ui.npcInfo = null; ui.panelArcade = null } })
watch(() => ui.npc, (v) => { if (v != null) { ui.panelArcade = null } })
watch(() => ui.panelCafe, (v) => { if (v) { ui.panelArcade = null } })
watch(() => ui.panelArcade, (v) => { if (v != null) { ui.panelShelf = null; ui.panelCafe = false; ui.npc = null; ui.npcInfo = null } })
watch(() => ui.modal, (m) => { if (!m && document.activeElement !== document.body) document.activeElement?.blur?.() })
watch(() => settings.musicOn, setMusic, { immediate: true })
watch(() => settings.sfxOn, setSfx, { immediate: true })

onMounted(async () => {
  // a nuvem pode trazer um save mais novo, então ela vem antes do load()
  await Promise.all([startCloud(), loadAssets()])
  if (!load()) newGame()
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
  addEventListener('pagehide', saveOnExit)
  cloudStarted()
  document.addEventListener('visibilitychange', saveIfHidden)
  let last = performance.now()
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t
    world.update(dt)
    rend.update(dt)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  // aba em segundo plano: o navegador para o requestAnimationFrame, então a simulação segue por um relógio de Web Worker (não sofre a pausa das abas), sem desenhar
  const bgStep = () => {
    if (!document.hidden) { last = performance.now(); return }
    const now = performance.now()
    let left = Math.min(5, (now - last) / 1000); last = now
    while (left > 0) { const dt = Math.min(0.05, left); world.update(dt); left -= dt }
  }
  try {
    bgWorker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),250)'], { type: 'text/javascript' })))
    bgWorker.onmessage = bgStep
  } catch { bgTimer = setInterval(bgStep, 250) }
  window.__game = { game, ui, world, rend, mp }
  mp.storeName = game.shopName || settings.storeName || 'Lojinha Lofi'
  startMultiplayer()
  const visitCode = new URLSearchParams(location.search).get('visit')
  if (visitCode) visitStore(visitCode)
  else ui.modal = 'start'
  const MOVE_MAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' }
  const CAM_MAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
  const typing = (e) => {
    const el = e.target || document.activeElement
    return ['INPUT', 'SELECT', 'TEXTAREA'].includes(el?.tagName) || !!el?.isContentEditable
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ui.build) { // aba Construção: solta a seleção primeiro; sem nada pendente, volta para os móveis
        const r = buildEscape()
        if (r === 'leave') { if (game.plan.built === false) stopEdit(); else setEditTab('shelves') }
        else if (r === 'pending') toast('Aplique ou descarte a obra antes de sair', 'bad')
        return
      }
      if (ui.editing) { if (ui.held || ui.buyTool) deselectTool(); else stopEdit(); return }
      ui.selectedBox = null; ui.panelShelf = null; ui.panelCafe = false; ui.npc = null; ui.panelArcade = null
      ui.modal = (ui.modal === 'summary' || (ui.modal === 'start' && !savesList.length)) ? ui.modal : null
      return
    }
    if (ui.modal || typing(e) || e.metaKey || e.ctrlKey) return
    if (CAM_MAP[e.code]) { rend?.camKeys.add(CAM_MAP[e.code]); startMusic(); e.preventDefault(); return }
    if (ui.build) return
    if (MOVE_MAP[e.code]) { world.keys.add(MOVE_MAP[e.code]); startMusic(); e.preventDefault(); return }
    if (e.code === 'Space' && !e.repeat && !ui.modal && document.activeElement?.tagName !== 'BUTTON') {
      if (game.phase === 'open' || game.phase === 'closing') game.paused = !game.paused
      e.preventDefault()
      return
    }
    if (!ui.modal && (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.key === '-')) {
      rend?.zoomCamera(1)
      e.preventDefault()
      return
    }
    if (!ui.modal && (e.code === 'Equal' || e.code === 'NumpadAdd' || e.key === '+' || e.key === '=')) {
      rend?.zoomCamera(-1)
      e.preventDefault()
      return
    }
    if (!ui.modal && (e.code === 'Comma' || e.key === '<' || e.key === ',')) {
      rend?.rotateCamera(-1)
      e.preventDefault()
      return
    }
    if (!ui.modal && (e.code === 'Period' || e.key === '>' || e.key === '.')) {
      rend?.rotateCamera(1)
      e.preventDefault()
      return
    }
    if ((e.code === 'Delete' || e.code === 'Backspace') && ui.editing && !e.repeat) {
      if (ui.held) sellHeld(); else sellAt(rend.hover)
      e.preventDefault(); return
    }
    if (e.code === 'KeyR' && ui.editing && !e.repeat) {
      const dir = e.shiftKey ? -1 : 1
      if (ui.held) rotateHeld(dir); else rotateAt(rend.hover, dir)
      return
    }
    if (e.code === 'KeyI' && ui.editing && !e.repeat) { if (ui.held) storeHeld(); else storeAt(rend.hover); return }
    if (e.code === 'KeyM' && (ui.held?.kind === 'produceGroup' || ui.held?.isNew) && !e.repeat) { toggleProduceStyle(); return }
    if (e.code === 'KeyE' && !e.repeat) {
      startMusic()
      if (ui.modal) return
      if (!world.interact()) { const h = rend.hover; if (h && h.kind !== 'floor') onClick(h) }
    }
    if (e.code === 'KeyQ' && !ui.modal) world.drop()
  })
  addEventListener('keyup', (e) => {
    if (MOVE_MAP[e.code]) world.keys.delete(MOVE_MAP[e.code])
    if (CAM_MAP[e.code]) rend?.camKeys.delete(CAM_MAP[e.code])
  })
  addEventListener('blur', () => { world.keys.clear(); rend?.camKeys.clear() })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(autosave)
  clearInterval(bgTimer)
  bgWorker?.terminate()
  stopMultiplayer()
  removeEventListener('pagehide', saveOnExit)
  document.removeEventListener('visibilitychange', saveIfHidden)
})
</script>

<template>
  <canvas ref="cv" class="cv" />
  <template v-if="ui.ready">
    <TopBar />
    <ToastStack />
    <ShelfPanel />
    <CafePanel />
    <NpcPanel />
    <ArcadePanel />
    <StaffBar />
    <EditorPanel />
    <BottomBar />
    <MusicPanel />
    <ThiefAlert />
    <PetModal />
    <SummaryModal v-if="ui.modal === 'summary'" />
    <ComputerScreen v-if="ui.modal === 'computer'" />
    <MenuModal v-if="ui.modal === 'menu'" />
    <MultiplayerModal v-if="ui.modal === 'multiplayer'" />
    <StartMenuModal v-if="ui.modal === 'start'" />
    <ArcadeModal v-if="ui.modal === 'arcade'" />
    <ChatOverlay />
    <div v-if="mp.visiting" class="card visit-bar">
      <span>🌐 Visitando: <b>{{ mp.visiting.storeName }}</b></span>
      <span class="pill">😈 {{ pranksLeft() }}/3 bagunças</span>
      <div class="visit-acts">
        <button v-for="em in ['👋', '❤️', '🔥', '👏']" :key="em" class="btn sm" @click="sendEmote(em)">{{ em }}</button>
        <button class="btn sm" :class="{ primary: ui.prankMode === 'swap_price' }" title="Clique em uma prateleira para trocar o preço" @click="ui.prankMode = 'swap_price'">🏷️ Trocar Preço</button>
        <button class="btn sm" :disabled="pranksLeft() <= 0" :title="game.career.earned >= 1 ? 'Mijar no chão onde você está' : 'Requer Nível 1'" @click="world.cmdPeeFloor()">🚽 Mijar {{ game.career.earned < 1 ? '🔒Nv1' : '' }}</button>
        <button class="btn sm" :class="{ primary: ui.prankMode === 'unstock' }" :title="game.career.earned >= 2 ? 'Clique em uma prateleira para esvaziar os produtos' : 'Requer Nível 2'" @click="game.career.earned >= 2 ? (ui.prankMode = 'unstock') : world.cmdPrankShelf({ product: 'lock' })">📦 Esvaziar {{ game.career.earned < 2 ? '🔒Nv2' : '' }}</button>
        <button class="btn good sm" :disabled="tipsLeft() <= 0" @click="sendTip()">
          💝 {{ tipsLeft() > 0 ? `Gorjeta ${money(nextTipCost())} (${nextTipXp() > 0 ? `+${nextTipXp()} XP` : 'não ganhará XP'} · ${tipsLeft()}/10)` : 'Gorjetas esgotadas (10/10 · não ganhará XP)' }}
        </button>
        <button class="btn primary sm" @click="leaveVisit">🏠 Voltar</button>
      </div>
    </div>
    <button v-if="ui.panned" class="btn recenter" @click="ui.recenter = true"><PhCrosshair weight="bold" /> Centralizar</button>
    <div v-if="tip" class="tip" :style="{ left: ui.mouse.x + 14 + 'px', top: ui.mouse.y + 14 + 'px' }">{{ tip }}</div>
  </template>
  <div v-else class="loading">carregando a lojinha…</div>
  <CloudLock />
</template>

<style>
.cv { position: fixed; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.cv:active { cursor: grabbing; }
.recenter { position: fixed; left: 12px; bottom: 16px; z-index: 9; }
.visit-bar { position: fixed; top: 68px; left: 50%; transform: translateX(-50%); z-index: 25; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: #e0f2fe; border: 2px solid var(--teal); padding: 8px 14px; }
.visit-acts { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tip { position: fixed; z-index: 30; background: var(--plum); color: var(--cream); padding: 5px 10px; border-radius: 9px; font-size: 13px; font-weight: 700; pointer-events: none; box-shadow: var(--shadow); }
kbd { display: inline-block; min-width: 24px; text-align: center; padding: 1px 6px; margin: 0 2px; border-radius: 6px; background: var(--cream); color: var(--plum); font: 800 .85em ui-rounded, system-ui; box-shadow: 0 2px 0 #c9b79a; }
.loading { position: fixed; inset: 0; display: grid; place-items: center; color: var(--cream); font-size: 22px; }
</style>
