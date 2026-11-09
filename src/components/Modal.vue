<script setup>
defineProps({ title: String, wide: Boolean })
defineEmits(['close'])
</script>
<template>
  <div class="back">
    <div class="card box" :class="{ wide }">
      <div class="head"><h2>{{ title }}</h2><button v-if="$attrs.onClose" class="btn sm" @click="$emit('close')">✕</button></div>
      <div class="body"><slot /></div>
      <div class="foot"><slot name="foot" /></div>
    </div>
  </div>
</template>
<style scoped>
.back { position: fixed; inset: 0; background: rgba(30, 20, 45, .55); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 50; }
.box { width: min(92vw, 520px); max-height: 88vh; display: flex; flex-direction: column; padding: 18px 20px; }
.box.wide { width: min(94vw, 760px); }
.head { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0 0 8px; }
.body { overflow: auto; flex: 1; }
.foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; align-items: center; }
</style>
