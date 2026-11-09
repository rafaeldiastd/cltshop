// Lofi gerado com WebAudio: pads de acordes, arpejo suave, kick/hat leves e chiado de vinil.
let ctx = null, master = null, timer = null, nextT = 0, step = 0, enabled = true, noiseBuf = null

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const CHORDS = [
  [50, 53, 57, 60, 64], // Dm9
  [43, 47, 50, 53, 57], // G13
  [48, 52, 55, 59, 62], // Cmaj9
  [45, 48, 52, 55, 59], // Am9
]
const BPM = 70
const EIGHTH = 60 / BPM / 2

function ensure() {
  if (ctx) return true
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch (e) { return false }
  master = ctx.createGain()
  master.gain.value = enabled ? 0.9 : 0
  master.connect(ctx.destination)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return true
}

function tone(freq, t, dur, { type = 'sine', vol = 0.05, attack = 0.02, lp = 1200, dest } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter()
  o.type = type; o.frequency.value = freq
  f.type = 'lowpass'; f.frequency.value = lp
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(f).connect(g).connect(dest || master)
  o.start(t); o.stop(t + dur + 0.05)
}
function noise(t, dur, { vol = 0.03, hp = 6000 } = {}) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter()
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(master)
  s.start(t, Math.random()); s.stop(t + dur)
}

function schedule() {
  while (nextT < ctx.currentTime + 0.6) {
    const bar = Math.floor(step / 8) % 4
    const pos = step % 8
    const chord = CHORDS[bar]
    if (pos === 0) chord.forEach((m, i) => tone(mtof(m), nextT, EIGHTH * 8.5, { vol: 0.035, attack: 0.5, lp: 700 + i * 80 }))
    if (pos === 0 || pos === 4) { // kick
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.setValueAtTime(120, nextT); o.frequency.exponentialRampToValueAtTime(40, nextT + 0.15)
      g.gain.setValueAtTime(0.16, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.2)
      o.connect(g).connect(master); o.start(nextT); o.stop(nextT + 0.25)
    }
    if (pos === 2 || pos === 6) noise(nextT, 0.12, { vol: 0.05, hp: 1800 }) // snare suave
    if (pos % 2 === 1) noise(nextT, 0.04, { vol: 0.025, hp: 7000 }) // hat
    if (Math.random() < 0.5) {
      const m = chord[1 + Math.floor(Math.random() * 4)] + 12
      tone(mtof(m), nextT + (Math.random() < 0.3 ? 0.03 : 0), EIGHTH * 2.2, { type: 'triangle', vol: 0.03, lp: 1800 })
    }
    nextT += EIGHTH * (pos % 2 === 0 ? 1.12 : 0.88) // swing
    step++
  }
}

export function startMusic() {
  if (!ensure()) return
  if (ctx.state === 'suspended') ctx.resume()
  if (timer) return
  // chiado de vinil
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter()
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 3000
  g.gain.value = 0.012
  s.connect(f).connect(g).connect(master); s.start()
  nextT = ctx.currentTime + 0.1
  timer = setInterval(schedule, 200)
}
export function setMusic(on) {
  enabled = on
  if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.15)
  if (on) startMusic()
}
export function sfx(name) {
  if (!ctx || !enabled) return
  const t = ctx.currentTime
  if (name === 'coin') { tone(988, t, 0.18, { type: 'square', vol: 0.03, lp: 3000 }); tone(1319, t + 0.07, 0.3, { type: 'square', vol: 0.03, lp: 3000 }) }
  else if (name === 'pop') tone(520, t, 0.1, { type: 'sine', vol: 0.06, attack: 0.005, lp: 2500 })
  else if (name === 'chime') [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.12, 0.8, { vol: 0.05, lp: 3000 }))
}
