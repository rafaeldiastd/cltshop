<script setup>
import { PhArrowsOut, PhMinus, PhPackage, PhPlus, PhReceipt, PhSnowflake, PhStack, PhStorefront, PhTrash, PhUsers, PhWrench } from '@phosphor-icons/vue'
import { game, money, expand, hire, fire, wipeSave, newGame, wages, isClosed, stockCount, stockCap, maxShelves, maxFreezers, shelfCount, freezerCount, emptyCount, trashEmpties } from '../game/state.js'
import { buyShelf, canBuyShelf, buyFreezer, canBuyFreezer, startEdit } from '../game/editor.js'
import { LEVELS, SHELF_PRICE, FREEZER_PRICE, STAFF } from '../game/config.js'

const STAFF_ICON = { cashier: PhReceipt, stocker: PhPackage }
const next = () => LEVELS[game.level + 1]
const restart = () => { if (confirm('Começar um novo jogo? O progresso salvo será apagado.')) { wipeSave(); newGame(); location.reload() } }
</script>

<template>
  <div class="app">
    <h2><PhStorefront weight="duotone" /> Minha loja</h2>
    <div class="scroll">
      <section>
        <div class="line">
          <PhArrowsOut class="ico" weight="duotone" />
          <div class="col"><b>{{ LEVELS[game.level].name }}</b><span class="muted">{{ LEVELS[game.level].cols }}×{{ LEVELS[game.level].rows }} · até {{ LEVELS[game.level].maxCust }} clientes ao mesmo tempo</span></div>
          <button v-if="next()" class="btn good" :disabled="game.money < next().cost || !isClosed()" @click="expand">Ampliar p/ {{ next().name }} · {{ money(next().cost) }}</button>
          <span v-else class="muted">nível máximo</span>
        </div>
        <div class="line">
          <PhPackage class="ico" weight="duotone" />
          <div class="col"><b>Estoque: {{ stockCount() }}/{{ stockCap() }} caixas</b><span class="muted">{{ emptyCount() }} vazia(s) guardada(s)<template v-if="next()"> · ampliando a loja vai para {{ next().stock.cap }}</template></span></div>
          <button class="btn" :disabled="emptyCount() <= 1" @click="trashEmpties"><PhTrash weight="bold" /> Jogar vazias fora</button>
        </div>
        <div class="line">
          <PhStack class="ico" weight="duotone" />
          <div class="col"><b>Prateleiras: {{ shelfCount() }}/{{ maxShelves() }}</b><span class="muted">{{ isClosed() ? 'escolha o lugar depois de comprar' : 'só com a loja fechada' }}</span></div>
          <button class="btn good" :disabled="!canBuyShelf()" @click="buyShelf">Comprar · {{ money(SHELF_PRICE) }}</button>
        </div>
        <div class="line">
          <PhSnowflake class="ico" weight="duotone" />
          <div class="col"><b>Freezers: {{ freezerCount() }}/{{ maxFreezers() }}</b><span class="muted">guardam os produtos gelados</span></div>
          <button class="btn good" :disabled="!canBuyFreezer()" @click="buyFreezer">Comprar · {{ money(FREEZER_PRICE) }}</button>
        </div>
        <div class="line">
          <PhWrench class="ico" weight="duotone" />
          <div class="col"><b>Layout</b><span class="muted">{{ isClosed() ? 'mude móveis, caixa, computador e rádio de lugar' : 'só com a loja fechada' }}</span></div>
          <button class="btn" :disabled="!isClosed()" @click="startEdit">Mudar layout</button>
        </div>
      </section>

      <h3><PhUsers weight="duotone" /> Equipe <span class="muted">salários/dia: {{ money(wages()) }}</span></h3>
      <section>
        <div v-for="(s, role) in STAFF" :key="role" class="line">
          <component :is="STAFF_ICON[role]" class="ico" weight="duotone" />
          <div class="col"><b>{{ s.name }} × {{ game.staff[role] }}</b><span class="muted">{{ s.desc }} {{ money(s.wage) }}/dia</span></div>
          <div class="btns">
            <button class="btn sm" :disabled="!game.staff[role]" :aria-label="`Demitir ${s.name}`" @click="fire(role)"><PhMinus weight="bold" /></button>
            <button class="btn good" :disabled="game.staff[role] >= s.max || game.money < s.hire" @click="hire(role)"><PhPlus weight="bold" /> Contratar · {{ money(s.hire) }}</button>
          </div>
        </div>
      </section>
    </div>
    <footer><button class="btn sm" @click="restart">Novo jogo</button></footer>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 10px; }
h2 { margin: 0; font-size: 1.25em; }
h3 { margin: 14px 0 6px; font-size: 1em; }
.scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
section { display: flex; flex-direction: column; gap: 6px; }
.line { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 12px; padding: 8px 12px; }
.ico { font-size: 26px; color: var(--plum2); }
.col { flex: 1; display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.btns { display: flex; gap: 6px; }
footer { display: flex; justify-content: flex-end; }
</style>
