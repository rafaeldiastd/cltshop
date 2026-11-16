<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PhChatCircleDots, PhPaperPlaneRight, PhX } from '@phosphor-icons/vue'
import { ui } from '../game/state.js'
import { mp, sendChat } from '../game/multiplayer.js'

const draft = ref('')
const chatInput = ref(null)
const showHistory = ref(false)

function splitTokens(text) {
  const parts = String(text || '').split(/(\s+)/)
  let offset = 0
  return parts.map((p) => {
    const start = offset
    const chars = Array.from(p)
    offset += chars.length
    return { isSpace: /^\s+$/.test(p), chars, start }
  })
}

function submit() {
  const ok = sendChat(draft.value)
  if (ok) draft.value = ''
  chatInput.value?.blur()
}

function onGlobalKey(e) {
  if (e.key !== 'Enter' || ui.modal || ui.build || ui.editing) return
  const tag = document.activeElement?.tagName
  if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return
  e.preventDefault()
  chatInput.value?.focus()
}

onMounted(() => addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <!-- Balões flutuantes acima dos personagens -->
  <div class="chat-stage" aria-live="polite">
    <div
      v-for="b in ui.chatBubbles"
      :key="b.id"
      class="speech-wrap"
      :class="{ fading: b.fading }"
      :style="{ left: b.x + 'px', top: b.y + 'px' }"
    >
      <div class="speech-bubble">
        <span class="speaker">{{ b.fromName }}</span>
        <div class="speech-line">
          <template v-for="(tok, ti) in splitTokens(b.text)" :key="ti">
            <span v-if="tok.isSpace" class="space">&nbsp;</span>
            <span v-else class="word">
              <span
                v-for="(ch, ci) in tok.chars"
                :key="ci"
                class="char"
                :style="{ animationDelay: ((tok.start + ci) * 26) + 'ms' }"
              >{{ ch }}</span>
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Barra de chat no canto inferior esquerdo -->
  <div v-if="!ui.editing && !ui.build" class="chat-dock">
    <div v-if="showHistory" class="card chat-log">
      <div class="log-head">
        <b><PhChatCircleDots weight="duotone" /> Chat da Loja</b>
        <button class="icon-x" title="Fechar histórico" @click="showHistory = false"><PhX weight="bold" /></button>
      </div>
      <div v-if="!mp.chatMessages.length" class="muted empty">Nenhuma mensagem ainda. Diga oi!</div>
      <div v-else class="log-items">
        <div v-for="m in mp.chatMessages.slice(-14)" :key="m.id" class="log-row" :class="{ self: m.self }">
          <b>{{ m.fromName }}:</b> <span>{{ m.text }}</span>
        </div>
      </div>
    </div>

    <form class="card chat-form" @submit.prevent="submit">
      <button
        type="button"
        class="btn sm hist-btn"
        :class="{ primary: showHistory }"
        title="Ver histórico do chat"
        @click="showHistory = !showHistory"
      >
        <PhChatCircleDots weight="duotone" />
        <span v-if="mp.chatMessages.length" class="cnt">{{ mp.chatMessages.length }}</span>
      </button>
      <input
        ref="chatInput"
        v-model="draft"
        maxlength="100"
        placeholder="Falar no chat… (Enter)"
        @keydown.esc.stop="chatInput?.blur()"
      />
      <button type="submit" class="btn sm primary" title="Enviar"><PhPaperPlaneRight weight="bold" /></button>
    </form>
  </div>
</template>

<style scoped>
.chat-stage { position: fixed; inset: 0; pointer-events: none; z-index: 24; overflow: hidden; }
.speech-wrap {
  position: fixed;
  transform: translate(-50%, -100%);
  transition: opacity .45s ease, transform .45s ease;
  will-change: left, top;
}
.speech-wrap.fading { opacity: 0; transform: translate(-50%, calc(-100% - 10px)) scale(.92); }
.speech-bubble {
  position: relative;
  max-width: 230px;
  padding: 7px 12px 9px;
  border-radius: 16px;
  background: #fffdf7;
  color: var(--plum);
  border: 2.5px solid var(--plum);
  box-shadow: 0 6px 18px rgba(59, 47, 74, .22);
  text-align: center;
  transform-origin: bottom center;
  animation: balloonPop .28s cubic-bezier(.22, 1.35, .36, 1) both;
}
.speech-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -9px;
  width: 14px;
  height: 14px;
  background: #fffdf7;
  border-right: 2.5px solid var(--plum);
  border-bottom: 2.5px solid var(--plum);
  transform: translateX(-50%) rotate(45deg);
}
.speaker { display: block; font-size: 10.5px; font-weight: 800; color: var(--teal); margin-bottom: 1px; letter-spacing: .02em; }
.speech-line { font-size: 13.5px; font-weight: 800; line-height: 1.25; word-break: break-word; }
.word { display: inline-block; }
.space { display: inline-block; width: .28em; }
.char {
  display: inline-block;
  animation: letterPop .26s cubic-bezier(.2, 1.4, .4, 1) both;
}
@keyframes balloonPop {
  0% { opacity: 0; transform: scale(.35) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes letterPop {
  0% { opacity: 0; transform: translateY(7px) scale(.55); }
  65% { opacity: 1; transform: translateY(-2px) scale(1.12); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.chat-dock { position: fixed; left: 12px; bottom: 68px; z-index: 18; width: min(310px, calc(100vw - 24px)); display: flex; flex-direction: column; gap: 6px; }
.chat-log { padding: 8px 10px; max-height: 180px; display: flex; flex-direction: column; gap: 6px; background: rgba(255, 250, 240, .95); }
.log-head { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
.log-head b { display: inline-flex; align-items: center; gap: 5px; }
.icon-x { border: 0; background: transparent; color: var(--plum); padding: 2px; cursor: pointer; display: grid; place-items: center; }
.log-items { overflow-y: auto; display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
.log-row b { color: var(--teal); }
.log-row.self b { color: var(--coral); }
.empty { font-size: 12px; margin: 2px 0; }
.chat-form { display: flex; align-items: center; gap: 5px; padding: 5px 6px; background: rgba(255, 250, 240, .94); }
.chat-form input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 13px; font-weight: 700; color: var(--plum); padding: 4px 6px; }
.chat-form input:focus { outline: none; }
.hist-btn { display: inline-flex; align-items: center; gap: 3px; }
.cnt { font-size: 11px; font-weight: 800; }
</style>
