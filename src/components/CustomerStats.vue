<script setup>
import { computed } from 'vue'
import { game, money } from '../game/state.js'
import { MOODS } from '../game/config.js'

// compara hoje com o último dia fechado
const prev = computed(() => (game.summary && game.summary.day !== game.day ? game.summary : null))
const rows = computed(() => {
  const t = game.today, p = prev.value
  return [
    { label: 'Clientes', now: t.customers, old: p?.customers },
    { label: 'Atendidos', now: t.served, old: p?.served },
    { label: 'Itens vendidos', now: t.units, old: p?.units },
    { label: 'Vendas', now: money(t.revenue), old: p && money(p.revenue) },
    { label: 'Desistiram da fila', now: t.patience, old: p?.patience },
    { label: 'Roubos evitados', now: t.caught, old: p?.caught },
    { label: 'Perdido em roubos', now: money(t.stolen), old: p && money(p.stolen || 0) },
  ]
})
</script>

<template>
  <div class="grid" :class="{ two: prev }">
    <span class="h">Resumo</span><b class="h n">Hoje</b><b v-if="prev" class="h n">Dia {{ prev.day }}</b>
    <template v-for="r in rows" :key="r.label">
      <span>{{ r.label }}</span><b class="n">{{ r.now }}</b><span v-if="prev" class="n old">{{ r.old ?? 0 }}</span>
    </template>
    <span class="h gap">O que sentiram</span><b class="h n gap">Hoje</b><b v-if="prev" class="h n gap">Dia {{ prev.day }}</b>
    <template v-for="(m, id) in MOODS" :key="id">
      <span :class="{ zero: !game.today.moods[id] }"><span class="e">{{ m.emoji }}</span> {{ m.text }}</span>
      <b class="n" :class="{ zero: !game.today.moods[id] }">{{ game.today.moods[id] || 0 }}</b>
      <span v-if="prev" class="n old">{{ prev.moods?.[id] || 0 }}</span>
    </template>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 72px; gap: 4px 10px; align-items: center; font-size: 14px; font-weight: 600; }
.grid.two { grid-template-columns: 1fr 72px 72px; }
.h { font-size: 12px; font-weight: 800; text-transform: uppercase; opacity: .6; }
.gap { margin-top: 12px; }
.n { text-align: right; font-variant-numeric: tabular-nums; }
.old { opacity: .6; }
.e { font-size: 17px; }
.zero { opacity: .45; }
</style>
