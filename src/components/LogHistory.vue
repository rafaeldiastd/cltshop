<script setup>
import { computed, onMounted, ref } from 'vue'
import { ui } from '../game/state.js'

const list = ref(null)
const items = computed(() => {
  const out = []
  let day = null
  for (const m of ui.log) {
    if (m.day !== day) { day = m.day; out.push({ sep: true, id: 'd' + day, day }) }
    out.push(m)
  }
  return out
})
onMounted(() => { list.value.scrollTop = list.value.scrollHeight })
</script>

<template>
  <div ref="list" class="list">
    <p v-if="!items.length" class="muted">Nenhuma notificação ainda.</p>
    <template v-for="m in items" :key="m.id">
      <div v-if="m.sep" class="sep">Dia {{ m.day }}</div>
      <div v-else class="msg" :class="m.kind">
        <span>{{ m.msg }}<b v-if="m.count > 1"> ×{{ m.count }}</b></span>
        <time>{{ m.time }}</time>
      </div>
    </template>
  </div>
</template>

<style scoped>
.list { max-height: 52vh; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; padding: 2px; }
.msg { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; background: var(--cream2); border-radius: 10px; padding: 6px 12px; font-size: 14px; font-weight: 600; }
.msg.good { background: #d9efdf; } .msg.bad { background: #f7d6d1; }
time { flex: none; font-size: 11px; opacity: .6; font-variant-numeric: tabular-nums; }
.sep { align-self: center; font-size: 12px; font-weight: 800; opacity: .55; padding: 4px 0 2px; }
</style>
