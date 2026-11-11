<script setup>
import { game, ui } from '../game/state.js'
import { world } from '../game/world.js'
import { personThumb } from '../game/assets.js'
import { isOff, isTired } from '../game/team.js'
</script>

<template>
  <div v-if="game.team.length" class="staff-bar">
    <button
      v-for="m in game.team"
      :key="m.id"
      class="face-btn"
      :class="{ sel: ui.npc === m.id, off: isOff(m) }"
      :title="`${m.name} · clique para ver`"
      :aria-label="m.name"
      @click="world.openNpc(m.id)"
    >
      <img v-if="personThumb(m.g, m.look)" :src="personThumb(m.g, m.look)" alt="" />
      <span class="energy"><span class="fill" :class="{ low: m.energy < 30 || isTired(m) }" :style="{ width: m.energy + '%' }" /></span>
    </button>
  </div>
</template>

<style scoped>
.staff-bar { position: fixed; right: 12px; top: 84px; z-index: 8; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 180px); overflow-y: auto; padding: 2px; }
.face-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; border: none; background: none; cursor: pointer; }
.face-btn img { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; background: var(--cream); border: 2px solid var(--plum); box-shadow: var(--shadow); display: block; }
.face-btn.sel img { border-color: var(--coral); }
.face-btn.off img { filter: grayscale(1); opacity: .6; }
.energy { width: 56px; height: 5px; border-radius: 4px; background: rgba(59, 47, 74, .2); overflow: hidden; display: block; }
.fill { display: block; height: 100%; background: #6fb3a8; }
.fill.low { background: #ef8a77; }
</style>
