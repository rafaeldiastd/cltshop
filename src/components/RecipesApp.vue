<script setup>
import { computed } from 'vue'
import { PhBookOpen, PhCoffee, PhLock, PhCheckCircle } from '@phosphor-icons/vue'
import { game, money, knowsIngredient } from '../game/state.js'
import { CAFE_MENU, PID } from '../game/config.js'

const recipes = CAFE_MENU
const isUnlocked = (m) => !!game.recipes[m.id]
</script>

<template>
  <div class="app">
    <div class="header">
      <div>
        <h2><PhBookOpen weight="duotone" /> Minilivro de Receitas</h2>
        <p class="muted">Descubra novas receitas brasileiras da cafeteria comprando os ingredientes no atacado!</p>
      </div>
      <div class="badge-discovered">
        <b>{{ Object.keys(game.recipes).length }} / {{ recipes.length }}</b> descobertas
      </div>
    </div>

    <div class="grid">
      <article
        v-for="m in recipes"
        :key="m.id"
        class="card-recipe"
        :class="{ discovered: isUnlocked(m), locked: !isUnlocked(m) }"
      >
        <div class="recipe-top">
          <component :is="isUnlocked(m) ? PhCheckCircle : PhLock" class="ico" :weight="isUnlocked(m) ? 'fill' : 'bold'" />
          <b>{{ m.name }}</b>
          <span class="ref-val">{{ money(m.ref) }}</span>
        </div>

        <p class="desc">{{ m.desc }}</p>

        <div class="ingredients-box">
          <span class="ing-lbl">Ingredientes necessários:</span>
          <div class="chips">
            <span
              v-for="pid in m.uses"
              :key="pid"
              class="chip"
              :class="{ known: knowsIngredient(pid), unknown: !knowsIngredient(pid) }"
            >
              {{ PID[pid]?.name || pid }}
              <i v-if="!knowsIngredient(pid)">(comprar atacado)</i>
            </span>
          </div>
        </div>

        <div class="recipe-status">
          <span v-if="isUnlocked(m)" class="status-ok">Disponível no cardápio da cafeteria</span>
          <span v-else class="status-missing">Compre todos os ingredientes para desbloquear</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
h2 { margin: 0; font-size: 1.25em; }
p { margin: 2px 0 0; }
.badge-discovered { background: #fff; border: 2px solid var(--teal); padding: 6px 14px; border-radius: 12px; font-size: 13px; font-weight: 700; }

.grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; align-content: start; padding-right: 4px; }
.card-recipe { background: #fff; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; border: 2px solid transparent; }
.card-recipe.discovered { border-color: var(--teal); background: #f6fbf9; }
.card-recipe.locked { opacity: 0.65; background: #faf8f5; }

.recipe-top { display: flex; align-items: center; gap: 8px; font-size: 1.05em; }
.ico { font-size: 20px; color: var(--teal); }
.card-recipe.locked .ico { color: #8a7e93; }
.ref-val { margin-left: auto; font-weight: 800; font-size: 13px; color: var(--plum); }

.desc { font-size: 12px; color: #5a5065; line-height: 1.3; }
.ingredients-box { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.ing-lbl { font-size: 11px; font-weight: 700; opacity: 0.7; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
.chip.known { background: #dcfce7; color: #15803d; }
.chip.unknown { background: #fee2e2; color: #b91c1c; }
.chip i { font-style: normal; font-size: 10px; opacity: 0.8; margin-left: 2px; }

.recipe-status { margin-top: auto; padding-top: 6px; font-size: 11px; font-weight: 800; }
.status-ok { color: var(--good); }
.status-missing { color: var(--coral); }
</style>
