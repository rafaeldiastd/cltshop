<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  PhArrowDown,
  PhArrowLeft,
  PhArrowRight,
  PhArrowUp,
  PhGameController,
  PhPlay,
  PhSparkle,
  PhTrophy,
  PhX,
} from '@phosphor-icons/vue'
import Modal from './Modal.vue'
import { game, ui, money } from '../game/state.js'
import { DECOR } from '../game/config.js'
import { playNote } from '../game/audio.js'
import { mp, payArcadeFee, finishArcadePlay } from '../game/multiplayer.js'

// Fliperama: WASD / Setas
const WASD_LANES = [
  { id: 0, label: 'A / ←', icon: PhArrowLeft, color: '#ef8a77', keys: ['KeyA', 'ArrowLeft'], freq: 440 },
  { id: 1, label: 'W / ↑', icon: PhArrowUp, color: '#6fb3a8', keys: ['KeyW', 'ArrowUp'], freq: 523.25 },
  { id: 2, label: 'S / ↓', icon: PhArrowDown, color: '#f2c25b', keys: ['KeyS', 'ArrowDown'], freq: 587.33 },
  { id: 3, label: 'D / →', icon: PhArrowRight, color: '#8f8cff', keys: ['KeyD', 'ArrowRight'], freq: 659.25 },
]

// Máquina de Dança: Guitar Hero QWER
const GH_LANES = [
  { id: 0, label: 'Q', color: '#f472b6', keys: ['KeyQ'], freq: 523.25 },
  { id: 1, label: 'W', color: '#22d3ee', keys: ['KeyW'], freq: 587.33 },
  { id: 2, label: 'E', color: '#facc15', keys: ['KeyE'], freq: 659.25 },
  { id: 3, label: 'R', color: '#4ade80', keys: ['KeyR'], freq: 783.99 },
]
const GH_MELODY = [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 987.77, 880, 783.99, 659.25]

// Pinball Space: apenas 4 lugares de pontos
const INITIAL_BUMPERS = () => [
  { id: 0, x: 32, y: 24, r: 6.5, pts: 10, emoji: '🛸', color: '#22d3ee', freq: 740, lit: 0 },
  { id: 1, x: 68, y: 24, r: 6.5, pts: 10, emoji: '🪐', color: '#f472b6', freq: 659.25, lit: 0 },
  { id: 2, x: 50, y: 38, r: 7.2, pts: 15, emoji: '☀️', color: '#facc15', freq: 880, lit: 0 },
  { id: 3, x: 50, y: 54, r: 6.5, pts: 5, emoji: '☄️', color: '#a78bfa', freq: 587.33, lit: 0 },
]

const decor = computed(() => game.decor.find((d) => d.id === ui.arcadeDecorId))
const machineType = computed(() => decor.value?.type || 'arcade')

const machineInfo = computed(() => {
  if (machineType.value === 'dance') {
    return {
      emoji: '💃',
      title: 'Máquina de Dança (Guitar Hero)',
      subtitle: 'Modo Infinito — Q W E R · 3 Vidas',
      hint: 'Você terá 5s de preparação! Começa devagar e vai acelerando aos poucos — você tem 3 vidas, erre ou perca 3 notas e é fim de jogo!',
    }
  }
  if (machineType.value === 'pinball') {
    return {
      emoji: '🎱',
      title: 'Pinball Space',
      subtitle: 'Modo Sobrevivência — A / D · Bola Única',
      hint: 'Use A / ← e D / →! Só os 4 astros centrais dão pontos. Cuidado com o tubo 💀 à esquerda (perde na hora); o tubo 🚀 à direita relança a bolinha!',
    }
  }
  return {
    emoji: '🕹️',
    title: 'Fliperama Clássico',
    subtitle: 'Modo Infinito — W A S D · 3 Vidas',
    hint: 'Sem cronômetro! Acerte as setas brilhantes usando W A S D, setinhas ou cliques. Você tem 3 vidas e só perde se errar.',
  }
})

const phase = ref('ready') // ready | playing | done
const score = ref(0)
const combo = ref(1)
const hits = ref(0)
const misses = ref(0)
const lives = ref(3)
const maxLives = computed(() => (machineType.value === 'pinball' ? 1 : 3))
const elapsed = ref(0)
const prepLeft = ref(0)
const feedback = ref(null)
const recordResult = ref({ newRecord: false, holder: '' })

// Estado: Fliperama WASD
const targetLane = ref(0)
const isBonus = ref(false)
const flashLane = ref(-1)

// Estado: Guitar Hero QWER (Dança)
const ghNotes = ref([])
const ghFlash = ref([false, false, false, false])
let noteIdSeq = 1
let ghSpawnT = 0
let ghMelodyIdx = 0

// Estado: Pinball
const ball = ref({ x: 50, y: 12, vx: 30, vy: 14 })
const bumpers = ref(INITIAL_BUMPERS())
const tubeFlashL = ref(0)
const tubeFlashR = ref(0)
const flipperL = ref(0) // tempo restante levantado
const flipperR = ref(0)
let flipCooldownL = 0
let flipCooldownR = 0
let launchCd = 0

let rafId = 0
let lastTs = 0
let fbTimer = 0

const recordScore = computed(() => decor.value?.highScore?.score || 0)
const recordHolder = computed(() => decor.value?.highScore?.holder || '')
const recordPct = computed(() => (recordScore.value > 0 ? Math.min(100, Math.round((score.value / recordScore.value) * 100)) : 100))

function showFeedback(text, kind = 'good') {
  clearTimeout(fbTimer)
  feedback.value = { text, kind }
  fbTimer = setTimeout(() => { feedback.value = null }, 520)
}

function registerHit(pts, label, kind = 'good', freq = 660) {
  score.value += pts
  hits.value++
  combo.value = Math.min(5, 1 + Math.floor(hits.value / 4))
  playNote(freq, 0.16, 'triangle', 0.08)
  showFeedback(label, kind)
}

function registerMiss(label = 'ERROU!') {
  if (phase.value !== 'playing') return
  misses.value++
  combo.value = 1
  lives.value = Math.max(0, lives.value - 1)
  playNote(135, 0.16, 'sawtooth', 0.05)
  showFeedback(label, 'bad')
  if (lives.value <= 0) {
    endRun()
  }
}

// --- Fliperama WASD ---
function nextWasdTarget(prev = -1) {
  let lane = Math.floor(Math.random() * 4)
  if (lane === prev) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4
  targetLane.value = lane
  isBonus.value = hits.value > 0 && (hits.value + 1) % 5 === 0
}

function pressWasdLane(idx) {
  if (phase.value !== 'playing') return
  flashLane.value = idx
  setTimeout(() => { if (flashLane.value === idx) flashLane.value = -1 }, 120)

  if (idx === targetLane.value) {
    const base = isBonus.value ? 25 : 10
    const pts = base * combo.value
    registerHit(
      pts,
      isBonus.value ? `OURO! +${pts}` : combo.value >= 3 ? `COMBO ×${combo.value}! +${pts}` : `+${pts}`,
      isBonus.value ? 'gold' : 'good',
      WASD_LANES[idx].freq,
    )
    nextWasdTarget(idx)
  } else {
    registerMiss('ERROU!')
  }
}

// --- Máquina de Dança (Guitar Hero QWER) ---
function spawnGhNote(initialY = 0) {
  const prevLane = ghNotes.value.length ? ghNotes.value[ghNotes.value.length - 1].lane : -1
  let lane = Math.floor(Math.random() * 4)
  if (lane === prevLane && Math.random() < 0.65) lane = (lane + 1 + Math.floor(Math.random() * 3)) % 4
  const freq = GH_MELODY[ghMelodyIdx % GH_MELODY.length]
  ghMelodyIdx++
  ghNotes.value.push({ id: noteIdSeq++, lane, y: initialY, freq })
}

function pressGhLane(idx) {
  if (phase.value !== 'playing') return
  ghFlash.value[idx] = true
  setTimeout(() => { ghFlash.value[idx] = false }, 130)
  if (prepLeft.value > 0) {
    playNote(GH_LANES[idx].freq, 0.1, 'triangle', 0.04)
    return
  }

  let bestIdx = -1
  let bestDist = 999
  for (let i = 0; i < ghNotes.value.length; i++) {
    const n = ghNotes.value[i]
    if (n.lane !== idx) continue
    const d = Math.abs(n.y - 84)
    if (n.y >= 70 && n.y <= 95 && d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }

  if (bestIdx >= 0) {
    const [note] = ghNotes.value.splice(bestIdx, 1)
    const perfect = bestDist <= 5.5
    const base = perfect ? 25 : 15
    const pts = base * combo.value
    registerHit(pts, perfect ? `PERFEITO! +${pts}` : `BOM! +${pts}`, perfect ? 'gold' : 'good', note.freq)
  } else {
    registerMiss('FORA DO TEMPO!')
  }
}

function updateDance(dt) {
  const p = Math.min(1, elapsed.value / 45)
  const extra = Math.max(0, elapsed.value - 45) * 0.28
  const speed = Math.min(92, 30 + p * 44 + extra) // começa bem devagar (30%/s) e acelera infinitamente
  const spawnInterval = Math.max(0.28, 0.95 - p * 0.62 - Math.min(0.05, extra * 0.003))

  ghSpawnT -= dt
  if (ghSpawnT <= 0) {
    ghSpawnT = spawnInterval
    spawnGhNote(0)
    playNote(92, 0.06, 'sine', 0.035) // marcação rítmica leve
  }

  for (let i = ghNotes.value.length - 1; i >= 0; i--) {
    ghNotes.value[i].y += speed * dt
    if (ghNotes.value[i].y > 96) {
      ghNotes.value.splice(i, 1)
      registerMiss('PASSOU!')
      if (phase.value !== 'playing') break
    }
  }
}

// --- Pinball Space ---
function spawnPinball() {
  const dir = Math.random() < 0.5 ? -1 : 1
  ball.value = { x: 40 + Math.random() * 20, y: 12, vx: dir * (28 + Math.random() * 14), vy: 14 }
}

function closestPointOnSeg(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay
  const lenSq = abx * abx + aby * aby || 1
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq))
  return { x: ax + t * abx, y: ay + t * aby, t }
}

function collideSegment(b, ballR, ax, ay, bx, by, bounce = 0.72) {
  const cp = closestPointOnSeg(b.x, b.y, ax, ay, bx, by)
  const dx = b.x - cp.x
  const dy = b.y - cp.y
  const dist = Math.hypot(dx, dy)
  const minD = ballR + 1.8
  if (dist >= minD) return null
  const nx = dist > 0.001 ? dx / dist : 0
  const ny = dist > 0.001 ? dy / dist : -1
  b.x = cp.x + nx * (minD + 0.1)
  b.y = cp.y + ny * (minD + 0.1)
  const vn = b.vx * nx + b.vy * ny
  if (vn < 0) {
    b.vx -= (1 + bounce) * vn * nx
    b.vy -= (1 + bounce) * vn * ny
  }
  return { nx, ny, impact: -vn, t: cp.t }
}

function triggerFlipper(side) {
  if (phase.value !== 'playing') return
  const b = ball.value
  if (side === 'left') {
    flipperL.value = 0.24
    if (flipCooldownL <= 0 && b.y >= 71 && b.y <= 93 && b.x >= 21 && b.x <= 45) {
      flipCooldownL = 0.15
      b.vy = -126 - Math.random() * 18
      b.vx = 20 + Math.random() * 44
      playNote(440, 0.06, 'triangle', 0.05)
    } else {
      playNote(210, 0.05, 'triangle', 0.03)
    }
  } else {
    flipperR.value = 0.24
    if (flipCooldownR <= 0 && b.y >= 71 && b.y <= 93 && b.x >= 55 && b.x <= 79) {
      flipCooldownR = 0.15
      b.vy = -126 - Math.random() * 18
      b.vx = -(20 + Math.random() * 44)
      playNote(493.88, 0.06, 'triangle', 0.05)
    } else {
      playNote(230, 0.05, 'triangle', 0.03)
    }
  }
}

function updatePinball(dt) {
  if (flipperL.value > 0) flipperL.value = Math.max(0, flipperL.value - dt)
  if (flipperR.value > 0) flipperR.value = Math.max(0, flipperR.value - dt)
  if (flipCooldownL > 0) flipCooldownL = Math.max(0, flipCooldownL - dt)
  if (flipCooldownR > 0) flipCooldownR = Math.max(0, flipCooldownR - dt)
  if (tubeFlashL.value > 0) tubeFlashL.value = Math.max(0, tubeFlashL.value - dt)
  if (tubeFlashR.value > 0) tubeFlashR.value = Math.max(0, tubeFlashR.value - dt)
  if (launchCd > 0) launchCd = Math.max(0, launchCd - dt)
  for (const bp of bumpers.value) {
    if (bp.lit > 0) bp.lit = Math.max(0, bp.lit - dt)
  }

  const b = ball.value
  b.vy += 64 * dt // gravidade
  b.x += b.vx * dt
  b.y += b.vy * dt

  const ballR = 2.6

  // Paredes laterais externas
  if (b.x < 4 + ballR) { b.x = 4 + ballR; b.vx = Math.abs(b.vx) * 0.86; playNote(320, 0.04, 'sine', 0.02) }
  if (b.x > 96 - ballR) { b.x = 96 - ballR; b.vx = -Math.abs(b.vx) * 0.86; playNote(320, 0.04, 'sine', 0.02) }

  // Teto + curva superior quando relançada pelo tubo direito
  if (b.y < 12 && b.x > 84 && b.vy < -25) {
    b.vx -= 220 * dt
  }
  if (b.y < 4 + ballR) {
    b.y = 4 + ballR
    if (b.x > 82 && b.vy < -40) {
      b.vx = -(46 + Math.random() * 24)
      b.vy = 20 + Math.random() * 12
    } else {
      b.vy = Math.abs(b.vy) * 0.86
    }
    playNote(360, 0.04, 'sine', 0.02)
  }

  // Tubo Esquerdo (x: 4..15, y > 53): corredor direto para perder!
  if (b.x < 14.5 && b.y > 53) {
    tubeFlashL.value = 0.25
    b.x += (9.5 - b.x) * Math.min(1, 16 * dt)
    b.vx *= 0.8
    b.vy = Math.max(75, b.vy + 110 * dt)
    if (b.y > 92) {
      registerMiss('CAIU NO TUBO!')
    }
    return
  }

  // Tubo Direito (x: 85..96, y > 53): corredor que relança a bolinha lá pra cima!
  if (b.x > 85.5 && b.y > 53) {
    tubeFlashR.value = 0.25
    b.x += (90.5 - b.x) * Math.min(1, 16 * dt)
    b.vx *= 0.8
    if (b.y >= 84 && launchCd <= 0) {
      launchCd = 0.45
      b.y = 83
      b.vx = 0
      b.vy = -168
      playNote(587.33, 0.16, 'triangle', 0.07)
      showFeedback('🚀 RELANÇOU!', 'good')
    }
  }

  // Divisórias verticais dos 2 tubos
  collideSegment(b, ballR, 15, 52, 15, 70, 0.78)
  collideSegment(b, ballR, 85, 52, 85, 70, 0.78)

  // Rampas internas sólidas entre divisórias dos tubos e as pás (sem pontos grátis)
  const hitRailL = collideSegment(b, ballR, 15, 70, 25, 85, 0.65)
  if (hitRailL) b.vx += 20 * dt
  const hitRailR = collideSegment(b, ballR, 85, 70, 75, 85, 0.65)
  if (hitRailR) b.vx -= 20 * dt

  // Colisão física com as 2 pás (somente impulsionam, sem pontos grátis)
  const tipLY = flipperL.value > 0 ? 77 : 90
  const tipLX = flipperL.value > 0 ? 39 : 41
  const hitPadL = collideSegment(b, ballR, 25, 85, tipLX, tipLY, 0.55)
  if (hitPadL) {
    if (flipperL.value > 0 && flipCooldownL <= 0) {
      flipCooldownL = 0.15
      b.vy = -126 - Math.random() * 18
      b.vx = 20 + Math.random() * 44
      playNote(440, 0.06, 'triangle', 0.05)
    } else {
      b.vx += 26 * dt
    }
  }

  const tipRY = flipperR.value > 0 ? 77 : 90
  const tipRX = flipperR.value > 0 ? 61 : 59
  const hitPadR = collideSegment(b, ballR, 75, 85, tipRX, tipRY, 0.55)
  if (hitPadR) {
    if (flipperR.value > 0 && flipCooldownR <= 0) {
      flipCooldownR = 0.15
      b.vy = -126 - Math.random() * 18
      b.vx = -(20 + Math.random() * 44)
      playNote(493.88, 0.06, 'triangle', 0.05)
    } else {
      b.vx -= 26 * dt
    }
  }

  // Bloqueio de segurança abaixo das rampas internas (entre x=15..41 e x=59..85)
  if (b.y > 85 && b.x >= 15 && b.x <= 25) {
    b.y = 85 - ballR
    b.vx = Math.abs(b.vx) + 18
    b.vy = -Math.abs(b.vy) * 0.45
  } else if (b.y > 85 && b.x >= 75 && b.x <= 85) {
    b.y = 85 - ballR
    b.vx = -Math.abs(b.vx) - 18
    b.vy = -Math.abs(b.vy) * 0.45
  }

  // Colisão com os 4 bumpers centrais (única fonte de pontos!)
  for (const bp of bumpers.value) {
    const dx = b.x - bp.x
    const dy = b.y - bp.y
    const dist = Math.hypot(dx, dy)
    const minD = bp.r + ballR
    if (dist < minD) {
      const nx = dist > 0.01 ? dx / dist : 0
      const ny = dist > 0.01 ? dy / dist : -1
      b.x = bp.x + nx * (minD + 0.4)
      b.y = bp.y + ny * (minD + 0.4)
      const kick = 84 + Math.random() * 20
      b.vx = nx * kick + (Math.random() - 0.5) * 16
      b.vy = ny * kick - 12
      bp.lit = 0.22
      const pts = bp.pts * combo.value
      registerHit(pts, `${bp.emoji} +${pts}`, combo.value >= 3 ? 'gold' : 'good', bp.freq)
    }
  }

  // Caiu pelo vão central entre as pás: perdeu!
  if (b.y > 97) {
    registerMiss('BOLA CAIU!')
  }
}

// --- Ciclo do Jogo ---
function startRun() {
  if (!decor.value) return
  if (!payArcadeFee(5)) return
  score.value = 0
  combo.value = 1
  hits.value = 0
  misses.value = 0
  elapsed.value = 0
  lives.value = machineType.value === 'pinball' ? 1 : 3
  recordResult.value = { newRecord: false, holder: '' }
  feedback.value = null
  phase.value = 'playing'

  if (machineType.value === 'dance') {
    ghNotes.value = []
    ghSpawnT = 0
    ghMelodyIdx = 0
    prepLeft.value = 5.0
    playNote(440, 0.08, 'sine', 0.04)
  } else if (machineType.value === 'pinball') {
    prepLeft.value = 0
    bumpers.value = INITIAL_BUMPERS()
    tubeFlashL.value = 0
    tubeFlashR.value = 0
    launchCd = 0
    flipperL.value = 0
    flipperR.value = 0
    flipCooldownL = 0
    flipCooldownR = 0
    spawnPinball()
  } else {
    prepLeft.value = 0
    nextWasdTarget(-1)
  }

  lastTs = performance.now()
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(tick)
}

async function endRun() {
  if (phase.value !== 'playing') return
  cancelAnimationFrame(rafId)
  phase.value = 'done'
  if (decor.value) {
    recordResult.value = await finishArcadePlay(decor.value, score.value)
  }
}

function tick(now) {
  if (phase.value !== 'playing') return
  const dt = Math.min(0.05, (now - lastTs) / 1000)
  lastTs = now

  if (prepLeft.value > 0) {
    const prevSec = Math.ceil(prepLeft.value)
    prepLeft.value = Math.max(0, prepLeft.value - dt)
    const curSec = Math.ceil(prepLeft.value)
    if (curSec > 0 && curSec < prevSec) playNote(440, 0.08, 'sine', 0.04)
    if (prepLeft.value <= 0) {
      playNote(659.25, 0.14, 'triangle', 0.06)
      ghSpawnT = 0
    }
    rafId = requestAnimationFrame(tick)
    return
  }

  elapsed.value += dt

  if (machineType.value === 'dance') updateDance(dt)
  else if (machineType.value === 'pinball') updatePinball(dt)

  if (phase.value === 'playing') {
    rafId = requestAnimationFrame(tick)
  }
}

function onKeyDown(e) {
  if (phase.value === 'playing') {
    if (e.repeat) return
    if (machineType.value === 'dance') {
      const lane = GH_LANES.find((l) => l.keys.includes(e.code))
      if (lane) { e.preventDefault(); e.stopPropagation(); pressGhLane(lane.id) }
    } else if (machineType.value === 'pinball') {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); triggerFlipper('left') }
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); triggerFlipper('right') }
      else if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); triggerFlipper('left'); triggerFlipper('right') }
    } else {
      const lane = WASD_LANES.find((l) => l.keys.includes(e.code))
      if (lane) { e.preventDefault(); e.stopPropagation(); pressWasdLane(lane.id) }
    }
  } else if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
    e.preventDefault()
    startRun()
  }
}

function close() {
  cancelAnimationFrame(rafId)
  clearTimeout(fbTimer)
  ui.modal = null
  ui.arcadeDecorId = null
}

onMounted(() => addEventListener('keydown', onKeyDown, true))
onBeforeUnmount(() => {
  removeEventListener('keydown', onKeyDown, true)
  cancelAnimationFrame(rafId)
  clearTimeout(fbTimer)
})
</script>

<template>
  <Modal :title="`${machineInfo.emoji} ${machineInfo.title}`" :icon="PhGameController">
    <div v-if="decor" class="arcade">
      <div class="hs-banner" :class="{ empty: !recordScore }">
        <PhTrophy weight="fill" class="trophy" />
        <div class="hs-info">
          <span class="small muted">Top 1 Recorde na Máquina</span>
          <b v-if="recordScore">{{ recordHolder }} — {{ recordScore }} pts</b>
          <b v-else>Sem recorde ainda — seja o 1º!</b>
        </div>
        <span v-if="mp.visiting" class="fee-tag">Ficha: {{ money(5) }} (vai ao dono)</span>
        <span v-else class="fee-tag free">Modo Dono (Grátis)</span>
      </div>

      <div v-if="phase === 'ready'" class="screen ready">
        <div class="big-emoji">{{ machineInfo.emoji }}</div>
        <h3>{{ machineInfo.subtitle }}</h3>
        <p class="muted">{{ machineInfo.hint }}</p>
        <div v-if="machineType === 'dance'" class="keys-preview">
          <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd>
        </div>
        <div v-else-if="machineType === 'pinball'" class="keys-preview">
          <kbd>A / ⬅️</kbd> <span class="muted">vs</span> <kbd>D / ➡️</kbd>
        </div>
        <div v-else class="keys-preview">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        </div>
        <button class="btn primary big" @click="startRun">
          <PhPlay weight="fill" /> Jogar Agora {{ mp.visiting ? `(${money(5)})` : '' }}
        </button>
      </div>

      <div v-else-if="phase === 'playing'" class="screen playing">
        <div class="hud">
          <div class="stat">
            <span class="muted small">Pontos</span>
            <b class="score">{{ score }}</b>
          </div>
          <div class="combo" :class="{ hot: combo >= 3 }">
            <PhSparkle weight="fill" /> {{ combo }}×
          </div>
          <div class="stat right">
            <span class="muted small">{{ machineType === 'pinball' ? 'Bola' : 'Vidas' }}</span>
            <div class="lives-row" :title="machineType === 'pinball' ? 'Bola única: caiu, perdeu!' : `${lives} de ${maxLives} vidas`">
              <span v-if="machineType === 'pinball'" class="ball-life">🎱 1 Bola</span>
              <span v-for="i in maxLives" v-else :key="i" class="heart" :class="{ lost: i > lives }">
                {{ i <= lives ? '❤️' : '🖤' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="recordScore" class="rec-track">
          <div class="rec-fill" :style="{ width: recordPct + '%' }" />
          <span>{{ score > recordScore ? '🔥 Você passou o recorde!' : `Faltam ${recordScore - score + 1} pts para o Top 1` }}</span>
        </div>

        <!-- JOGO 1: MÁQUINA DE DANÇA (GUITAR HERO QWER) -->
        <div v-if="machineType === 'dance'" class="stage gh-stage">
          <div v-if="feedback" class="fb" :class="feedback.kind">{{ feedback.text }}</div>
          <div class="gh-board">
            <div v-if="prepLeft > 0" class="gh-prep">
              <span>PREPARE-SE!</span>
              <b>{{ Math.ceil(prepLeft) }}</b>
              <small>Posicione os dedos em <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd></small>
            </div>
            <div class="gh-hitzone" />
            <div class="gh-tracks">
              <div
                v-for="l in GH_LANES"
                :key="l.id"
                class="gh-track"
                :style="{ '--lane-col': l.color }"
                @mousedown="pressGhLane(l.id)"
              >
                <div
                  v-for="n in ghNotes.filter((x) => x.lane === l.id)"
                  :key="n.id"
                  class="gh-note"
                  :style="{ top: n.y + '%' }"
                >
                  ♪
                </div>
                <button
                  type="button"
                  class="gh-receptor"
                  :class="{ flash: ghFlash[l.id] }"
                >
                  {{ l.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- JOGO 2: PINBALL SPACE (FLIPPERS A/D) -->
        <div v-else-if="machineType === 'pinball'" class="stage pin-stage">
          <div v-if="feedback" class="fb" :class="feedback.kind">{{ feedback.text }}</div>
          <div class="pin-table">
            <div
              v-for="bp in bumpers"
              :key="bp.id"
              class="pin-bumper"
              :class="{ lit: bp.lit > 0 }"
              :style="{ left: bp.x + '%', top: bp.y + '%', '--bp-col': bp.color }"
            >
              <span>{{ bp.emoji }}</span>
              <small>+{{ bp.pts }}</small>
            </div>

            <!-- Tubo Esquerdo: Corredor direto para perder -->
            <div class="pin-tube left" :class="{ lit: tubeFlashL > 0 }">
              <span>💀</span>
              <small>SAÍDA</small>
            </div>
            <div class="tube-wall left" />

            <!-- Tubo Direito: Corredor que relança a bolinha -->
            <div class="pin-tube right" :class="{ lit: tubeFlashR > 0 }">
              <span>🚀</span>
              <small>LANÇA</small>
            </div>
            <div class="tube-wall right" />

            <div class="pin-rail left" />
            <div class="pin-rail right" />

            <div class="pin-ball" :style="{ left: ball.x + '%', top: ball.y + '%' }" />

            <div class="flipper left" :class="{ up: flipperL > 0 }" />
            <div class="flipper right" :class="{ up: flipperR > 0 }" />
          </div>

          <div class="pin-controls">
            <button type="button" class="btn pin-btn" :class="{ active: flipperL > 0 }" @mousedown="triggerFlipper('left')">
              ⬅️ Flipper Esquerdo (<kbd>A</kbd>)
            </button>
            <button type="button" class="btn pin-btn" :class="{ active: flipperR > 0 }" @mousedown="triggerFlipper('right')">
              (<kbd>D</kbd>) Flipper Direito ➡️
            </button>
          </div>
        </div>

        <!-- JOGO 3: FLIPERAMA CLÁSSICO (WASD) -->
        <div v-else class="stage">
          <div v-if="feedback" class="fb" :class="feedback.kind">{{ feedback.text }}</div>
          <div class="lanes">
            <button
              v-for="l in WASD_LANES"
              :key="l.id"
              type="button"
              class="lane-btn"
              :class="{
                active: targetLane === l.id,
                bonus: targetLane === l.id && isBonus,
                flash: flashLane === l.id,
              }"
              :style="{ '--lane-col': l.color }"
              @click="pressWasdLane(l.id)"
            >
              <div class="cue">
                <component :is="l.icon" weight="bold" class="arrow" />
                <span v-if="targetLane === l.id && isBonus" class="star">★25</span>
              </div>
              <span class="key-lbl">{{ l.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-else class="screen done">
        <div class="done-badge" :class="{ win: recordResult.newRecord }">
          <PhTrophy v-if="recordResult.newRecord" weight="fill" />
          <PhGameController v-else weight="duotone" />
        </div>
        <h3 v-if="recordResult.newRecord">🏆 NOVO RECORDE NA {{ DECOR[decor.type]?.name?.toUpperCase() }}!</h3>
        <h3 v-else>Fim de Jogo!</h3>
        <div class="final-score">{{ score }} <span>pts</span></div>
        <p class="muted stats-line">Acertos: <b>{{ hits }}</b> · Erros: <b>{{ misses }}</b></p>
        <p v-if="recordResult.newRecord" class="good-t">
          Seu nome ({{ recordResult.holder }}) agora está no topo da máquina! (+8 XP)
        </p>
        <p v-else-if="recordScore" class="muted">
          Top 1 atual: <b>{{ recordHolder }}</b> com <b>{{ recordScore }} pts</b>.
        </p>
        <div class="done-acts">
          <button class="btn primary big" @click="startRun">
            <PhPlay weight="fill" /> Jogar de novo {{ mp.visiting ? `(${money(5)})` : '' }}
          </button>
        </div>
      </div>
    </div>

    <template #foot>
      <button class="btn" @click="close"><PhX weight="bold" /> Fechar</button>
    </template>
  </Modal>
</template>

<style scoped>
.arcade { display: flex; flex-direction: column; gap: 12px; }
.hs-banner {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 12px; border-radius: 12px; background: #fffbeb; border: 2px solid #f59e0b;
}
.hs-banner.empty { background: var(--cream2); border-color: rgba(59, 47, 74, .15); }
.trophy { font-size: 26px; color: #d97706; flex: none; }
.hs-banner.empty .trophy { color: var(--plum2); opacity: .5; }
.hs-info { display: flex; flex-direction: column; flex: 1; min-width: 140px; line-height: 1.2; }
.small { font-size: 11.5px; }
.fee-tag { font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 99px; background: #e0f2fe; color: #0369a1; }
.fee-tag.free { background: #dcfce7; color: #166534; }

.screen {
  background: #2b2138; color: #fff8ec; border-radius: 16px; padding: 18px;
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;
  border: 3px solid #4a3a60; box-shadow: inset 0 0 24px rgba(0, 0, 0, .35);
}
.screen .muted { color: #d5c7e3; }
.big-emoji { font-size: 46px; line-height: 1; }
.keys-preview { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; }
.btn.big { padding: 10px 20px; font-size: 15px; }

.hud { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.stat { display: flex; flex-direction: column; text-align: left; }
.stat.right { text-align: right; align-items: flex-end; }
.stat .score { font-size: 22px; font-variant-numeric: tabular-nums; }
.combo {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 99px;
  background: rgba(255, 255, 255, .12); font-weight: 900; font-size: 16px;
}
.combo.hot { background: #f59e0b; color: #2b2138; transform: scale(1.08); }
.lives-row { display: flex; align-items: center; gap: 4px; font-size: 16px; min-height: 26px; }
.heart { transition: transform .15s, opacity .15s; }
.heart.lost { opacity: .4; transform: scale(.85); }
.ball-life { font-size: 13px; font-weight: 800; color: #fde047; }

.rec-track {
  position: relative; width: 100%; height: 20px; border-radius: 99px;
  background: rgba(255, 255, 255, .1); overflow: hidden; font-size: 11px; font-weight: 800;
  display: grid; place-items: center;
}
.rec-fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(245, 158, 11, .38); transition: width .12s; }
.rec-track span { position: relative; z-index: 1; }

.stage { position: relative; width: 100%; padding-top: 24px; }
.fb {
  position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
  font-size: 14px; font-weight: 900; letter-spacing: .04em; z-index: 5; white-space: nowrap;
  animation: popUp .35s ease-out both;
}
.fb.good { color: #86efac; }
.fb.gold { color: #fde047; font-size: 16px; }
.fb.bad { color: #fca5a5; }
@keyframes popUp {
  0% { opacity: 0; transform: translate(-50%, 6px) scale(.8); }
  100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

/* MODO 1: WASD */
.lanes { width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.lane-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 14px 6px; border-radius: 14px; border: 2.5px solid rgba(255, 255, 255, .16);
  background: rgba(255, 255, 255, .06); color: #e2d8ee; transition: transform .08s, background .08s;
}
.lane-btn .arrow { font-size: 30px; }
.lane-btn .cue { position: relative; display: grid; place-items: center; height: 42px; }
.lane-btn .key-lbl { font-size: 11.5px; font-weight: 800; opacity: .75; }
.lane-btn.active {
  background: var(--lane-col); color: #2b2138; border-color: #fff;
  transform: scale(1.06); box-shadow: 0 0 18px var(--lane-col);
}
.lane-btn.active .key-lbl { opacity: 1; }
.lane-btn.bonus {
  background: linear-gradient(135deg, #fde047, #f59e0b);
  box-shadow: 0 0 22px #fde047;
}
.lane-btn.flash { transform: scale(.93); }
.star { position: absolute; top: -8px; right: -14px; font-size: 10px; font-weight: 900; background: #2b2138; color: #fde047; padding: 1px 4px; border-radius: 6px; }

/* MODO 2: GUITAR HERO QWER (MÁQUINA DE DANÇA) */
.gh-board {
  position: relative; width: 100%; height: 260px; border-radius: 14px;
  background: linear-gradient(180deg, #1b1326 0%, #2a1d3b 85%, #171020 100%);
  border: 2px solid rgba(255, 255, 255, .16); overflow: hidden;
}
.gh-prep {
  position: absolute; inset: 0; z-index: 6;
  background: rgba(20, 14, 30, .72); backdrop-filter: blur(2px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
}
.gh-prep span { font-size: 13px; font-weight: 900; letter-spacing: .12em; color: #22d3ee; }
.gh-prep b { font-size: 52px; line-height: 1; color: #fde047; text-shadow: 0 0 18px rgba(253, 224, 71, .5); }
.gh-prep small { font-size: 12px; color: #e2d8ee; }
.gh-hitzone {
  position: absolute; left: 0; right: 0; top: 84%; height: 34px; transform: translateY(-50%);
  background: rgba(255, 255, 255, .09); border-top: 2px dashed rgba(255, 255, 255, .35);
  border-bottom: 2px dashed rgba(255, 255, 255, .35); pointer-events: none;
}
.gh-tracks {
  position: relative; width: 100%; height: 100%;
  display: grid; grid-template-columns: repeat(4, 1fr);
}
.gh-track {
  position: relative; border-right: 1px solid rgba(255, 255, 255, .08); cursor: pointer;
}
.gh-track:last-child { border-right: none; }
.gh-note {
  position: absolute; left: 50%; transform: translate(-50%, -50%);
  width: 36px; height: 24px; border-radius: 99px;
  background: var(--lane-col); color: #1b1326; font-weight: 900; font-size: 15px;
  display: grid; place-items: center; border: 2px solid #fff;
  box-shadow: 0 0 12px var(--lane-col); pointer-events: none;
}
.gh-receptor {
  position: absolute; left: 50%; top: 84%; transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  border: 3px solid var(--lane-col); background: rgba(20, 14, 28, .85);
  color: #fff; font-weight: 900; font-size: 16px; cursor: pointer;
  transition: transform .07s, background .07s, box-shadow .07s;
}
.gh-receptor.flash {
  background: var(--lane-col); color: #1b1326;
  transform: translate(-50%, -50%) scale(1.16); box-shadow: 0 0 20px var(--lane-col);
}

/* MODO 3: PINBALL SPACE */
.pin-stage { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.pin-table {
  position: relative; width: 100%; max-width: 360px; height: 380px; border-radius: 22px 22px 14px 14px;
  background: radial-gradient(circle at 50% 25%, #3b2360 0%, #190f2b 92%);
  border: 3px solid #6b4e93; overflow: hidden;
  box-shadow: inset 0 0 26px rgba(0, 0, 0, .6);
}
.pin-bumper {
  position: absolute; transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255, 255, 255, .1); border: 3px solid var(--bp-col);
  display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;
  box-shadow: 0 0 10px var(--bp-col); transition: transform .08s, background .08s;
}
.pin-bumper span { font-size: 16px; }
.pin-bumper small { font-size: 9.5px; font-weight: 900; color: #fff; }
.pin-bumper.lit {
  background: var(--bp-col); transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0 0 22px var(--bp-col);
}
.pin-bumper.lit small { color: #1b1326; }
.pin-tube {
  position: absolute; top: 53%; bottom: 0; width: 15%;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  padding-bottom: 12px; gap: 2px; font-size: 10px; font-weight: 900; pointer-events: none;
  transition: background .12s;
}
.pin-tube span { font-size: 15px; }
.pin-tube small { font-size: 8.5px; letter-spacing: .05em; }
.pin-tube.left {
  left: 0;
  background: linear-gradient(180deg, rgba(239, 68, 68, .12), rgba(239, 68, 68, .32));
  color: #fecaca;
}
.pin-tube.left.lit { background: rgba(239, 68, 68, .55); }
.pin-tube.right {
  right: 0;
  background: linear-gradient(180deg, rgba(34, 211, 238, .12), rgba(34, 211, 238, .32));
  color: #a5f3fc;
}
.pin-tube.right.lit { background: rgba(34, 211, 238, .55); box-shadow: inset 0 0 14px #22d3ee; }
.tube-wall {
  position: absolute; top: 52%; height: 18%; width: 4px; border-radius: 99px;
  background: #a78bfa; box-shadow: 0 0 8px rgba(167, 139, 250, .7);
}
.tube-wall.left { left: 15%; transform: translateX(-50%); }
.tube-wall.right { left: 85%; transform: translateX(-50%); }
.pin-rail {
  position: absolute; top: 70%; bottom: 0; width: 10%;
  background: linear-gradient(135deg, rgba(167, 139, 250, .42), rgba(107, 78, 147, .24));
  border-top: 3px solid rgba(167, 139, 250, .75); pointer-events: none;
}
.pin-rail.left { left: 15%; clip-path: polygon(0 0, 100% 50%, 100% 100%, 0 100%); }
.pin-rail.right { right: 15%; clip-path: polygon(0 50%, 100% 0, 100% 100%, 0 100%); }
.pin-ball {
  position: absolute; transform: translate(-50%, -50%);
  width: 18px; height: 18px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff, #cbd5e1 60%, #64748b);
  box-shadow: 0 0 12px #fff;
}
.flipper {
  position: absolute; top: 85%; width: 16%; height: 10px; border-radius: 99px;
  background: linear-gradient(90deg, #f59e0b, #fde047); box-shadow: 0 0 10px rgba(250, 204, 21, .5);
  transition: transform .07s ease-out;
}
.flipper.left {
  left: 25%; transform-origin: 0% 50%; transform: translateY(-50%) rotate(16deg);
}
.flipper.left.up { transform: translateY(-50%) rotate(-28deg); }
.flipper.right {
  right: 25%; transform-origin: 100% 50%; transform: translateY(-50%) rotate(-16deg);
}
.flipper.right.up { transform: translateY(-50%) rotate(28deg); }
.pin-controls { width: 100%; max-width: 360px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pin-btn { justify-content: center; background: rgba(255, 255, 255, .14); color: #fff; border-color: rgba(255, 255, 255, .22); }
.pin-btn.active { background: #f59e0b; color: #2b2138; }

.done-badge { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 34px; background: rgba(255, 255, 255, .12); }
.done-badge.win { background: #f59e0b; color: #2b2138; }
.final-score { font-size: 40px; font-weight: 900; color: #fde047; line-height: 1; }
.final-score span { font-size: 18px; color: #fff8ec; }
.stats-line { margin: 0; font-size: 13px; }
.good-t { color: #86efac; font-weight: 800; margin: 0; }
.done-acts { margin-top: 4px; }
</style>
