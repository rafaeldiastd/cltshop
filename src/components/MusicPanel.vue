<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { PhRadio, PhSpeakerHigh, PhSpeakerLow, PhX } from '@phosphor-icons/vue'
import { settings, ui, toast } from '../game/state.js'
import { duckMusic, setMusicVolume } from '../game/audio.js'

const host = ref(null)
const link = ref('')
const error = ref('')
const source = computed(() => settings.playlist?.split(':')[0])
let teardown = null
let playerVolume = null // só o YouTube aceita volume de fora; o embed do Spotify não
let stopWaiting = null

// o navegador só libera som depois de uma interação: ao recarregar a página, volta a tocar no primeiro clique ou tecla
function playOnFirstGesture(player) {
  const go = () => { stopWaiting?.(); player.playVideo() }
  stopWaiting = () => {
    removeEventListener('pointerdown', go, true)
    removeEventListener('keydown', go, true)
    stopWaiting = null
  }
  addEventListener('pointerdown', go, true)
  addEventListener('keydown', go, true)
}

// o script do player só é baixado quando existe uma playlist conectada
const loaders = {}
function loadApi(src, readyName) {
  return (loaders[src] ||= new Promise((resolve, reject) => {
    window[readyName] = (api) => resolve(api || window.YT)
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onerror = () => { delete loaders[src]; reject(new Error(src)) }
    document.body.appendChild(s)
  }))
}
function setPlaying(on) {
  ui.externalPlaying = on
  duckMusic(on)
}
function unmountPlayer() {
  teardown?.()
  teardown = null
  playerVolume = null
  stopWaiting?.()
  if (host.value) host.value.innerHTML = ''
  setPlaying(false)
}

// spec = id da playlist ou "video:id" para um vídeo só (que fica em loop)
function mountYouTube(el, spec, autoplay) {
  return loadApi('https://www.youtube.com/iframe_api', 'onYouTubeIframeAPIReady').then((YT) => {
    if (settings.playlist !== 'youtube:' + spec) return
    const video = spec.startsWith('video:') ? spec.slice(6) : null
    let failures = 0
    const player = new YT.Player(el, {
      width: '100%',
      height: 170,
      ...(video ? { videoId: video } : {}),
      playerVars: { loop: 1, rel: 0, playsinline: 1, ...(video ? { playlist: video } : { listType: 'playlist', list: spec }) },
      events: {
        onReady: (e) => {
          playerVolume = (v) => e.target.setVolume(Math.round(v * 100))
          playerVolume(settings.volume)
          if (autoplay) e.target.playVideo()
          else playOnFirstGesture(e.target)
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) { stopWaiting?.(); failures = 0; error.value = ''; setPlaying(true) }
          else if (e.data === YT.PlayerState.PAUSED) setPlaying(false)
        },
        // alguns vídeos não permitem tocar fora do YouTube: numa playlist, pula para o próximo
        onError: (e) => {
          if (video) error.value = 'O dono desse vídeo não permite tocar fora do YouTube. Tente outro link.'
          else if (++failures > 8) error.value = 'Os vídeos dessa playlist não podem tocar fora do YouTube. Tente outra.'
          else e.target.nextVideo()
        },
      },
    })
    teardown = () => player.destroy()
  })
}
function mountSpotify(el, uri) {
  return loadApi('https://open.spotify.com/embed/iframe-api/v1', 'onSpotifyIframeApiReady').then((IFrameAPI) => {
    if (settings.playlist !== uri) return
    IFrameAPI.createController(el, { uri, width: '100%', height: 152 }, (c) => {
      teardown = () => c.destroy()
      c.addListener('playback_update', (e) => setPlaying(!e.data.isPaused))
    })
  })
}
function mountPlayer(value, autoplay) {
  error.value = ''
  unmountPlayer()
  const el = document.createElement('div')
  host.value.appendChild(el)
  const [kind, ...rest] = value.split(':')
  const job = kind === 'youtube' ? mountYouTube(el, rest.join(':'), autoplay) : mountSpotify(el, value)
  job.catch(() => { error.value = 'Não consegui carregar o player. Confira sua conexão e tente de novo.' })
}

onMounted(() => { if (settings.playlist) mountPlayer(settings.playlist, false) })
watch(() => settings.playlist, (value) => { if (value) mountPlayer(value, true); else unmountPlayer() })
watch(() => settings.volume, (v) => { setMusicVolume(v); playerVolume?.(v) }, { immediate: true })

function parseLink(text) {
  if (/youtu\.?be/i.test(text)) {
    const list = text.match(/[?&]list=([\w-]+)/)?.[1]
    const video = text.match(/(?:[?&]v=|youtu\.be\/|\/(?:shorts|embed|live)\/)([\w-]{11})/i)?.[1]
    // listas "RD" são mixes automáticos, que não tocam fora do YouTube
    if (list && !(video && list.startsWith('RD'))) return 'youtube:' + list
    return video ? 'youtube:video:' + video : null
  }
  const sp = text.match(/spotify.*?(playlist|album)[/:]([A-Za-z0-9]{22})/i)
  if (sp) return `spotify:${sp[1]}:${sp[2]}`
  return null
}
function connect() {
  const value = parseLink(link.value.trim())
  if (!value) { error.value = 'Não reconheci esse link. Use um vídeo ou playlist do YouTube, ou uma playlist do Spotify.'; return }
  error.value = ''
  settings.playlist = value
  link.value = ''
  toast('Música conectada', 'good')
}
const disconnect = () => { settings.playlist = null }
</script>

<template>
  <!-- fica fora da tela em vez de sair do DOM: a música continua tocando com o painel fechado -->
  <aside class="music card" :class="{ away: !ui.musicPanel }" :aria-hidden="!ui.musicPanel" aria-label="Rádio">
    <header><b><PhRadio weight="duotone" /> Rádio da loja</b><button class="btn sm" title="Fechar" aria-label="Fechar" @click="ui.musicPanel = false"><PhX weight="bold" /></button></header>
    <label class="tg"><input v-model="settings.musicOn" type="checkbox" /> Lofi do jogo <span v-if="ui.externalPlaying" class="muted">(pausado: playlist tocando)</span></label>
    <label class="tg"><input v-model="settings.sfxOn" type="checkbox" /> Efeitos sonoros</label>
    <label class="vol" title="Volume da música">
      <PhSpeakerLow weight="bold" />
      <input v-model.number="settings.volume" type="range" min="0" max="1" step="0.01" aria-label="Volume da música" />
      <PhSpeakerHigh weight="bold" />
    </label>

    <div v-show="settings.playlist" ref="host" class="player" />
    <template v-if="settings.playlist">
      <p v-if="source === 'youtube'" class="muted">Toca completo. Ao recarregar a página, volta a tocar no primeiro clique ou tecla.</p>
      <p v-else class="muted">Sem login no Spotify neste navegador, o player pode tocar só prévias de 30s, e o volume acima não vale para ele. O YouTube não tem essas limitações.</p>
      <button class="btn sm" @click="disconnect">Trocar música</button>
    </template>
    <form v-else class="connect" @submit.prevent="connect">
      <label for="playlist-link"><b>Sua música</b></label>
      <div class="row">
        <input id="playlist-link" v-model="link" placeholder="Link do YouTube ou Spotify" autocomplete="off" />
        <button class="btn good" :disabled="!link.trim()">Conectar</button>
      </div>
      <p class="muted">Vídeo ou playlist do YouTube toca completo, sem login.</p>
    </form>
    <p v-if="error" class="bad-t err">{{ error }}</p>
  </aside>
</template>

<style scoped>
.music { position: fixed; right: 12px; bottom: 16px; width: min(320px, calc(100vw - 24px)); z-index: 11; display: flex; flex-direction: column; gap: 6px; transition: transform .22s ease; }
.music.away { transform: translateX(calc(100% + 32px)); }
header { display: flex; justify-content: space-between; align-items: center; }
.tg { display: flex; gap: 8px; align-items: center; font-weight: 600; font-size: 14px; }
.vol { display: flex; align-items: center; gap: 8px; }
.vol input { flex: 1; min-width: 0; accent-color: var(--coral); }
.player { border-radius: 12px; overflow: hidden; min-height: 152px; margin-top: 4px; }
.connect { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.row { display: flex; gap: 6px; }
input:not([type]) { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 10px; border: 2px solid var(--cream2); background: #fff; font: inherit; font-size: 14px; }
p { margin: 2px 0; font-size: 12px; line-height: 1.35; }
.err { font-weight: 700; }
</style>
