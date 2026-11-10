<script setup>
import { ref, computed, watch } from 'vue'
import {
  PhX,
  PhTag,
  PhWrench,
  PhSnowflake,
  PhPackage,
  PhSparkle,
  PhWarning,
  PhCheckCircle,
  PhScales,
  PhTrendUp,
  PhTrendDown,
  PhArrowUp,
  PhTrash,
  PhKnife,
  PhPlant
} from '@phosphor-icons/vue'
import PriceStepper from './PriceStepper.vue'
import { game, ui, money, productPrice, setPrice, costOf, refOf, shelfCap, upgradeShelf } from '../game/state.js'
import { PRODUCTS, PID, SHELF_BOOST, FREEZER, canStockProduct } from '../game/config.js'
import { world } from '../game/world.js'
import { productThumb } from '../game/assets.js'

const activeTab = ref('venda')

const shelf = computed(() => game.shelves.find((s) => s.id === ui.panelShelf))
const shelfKind = computed(() => shelf.value?.kind || (shelf.value?.fridge ? 'fridge' : 'shelf'))
const isCooled = computed(() => shelfKind.value === 'fridge' || shelfKind.value === 'meat' || !!shelf.value?.fridge)
const p = computed(() => shelf.value?.product && PID[shelf.value.product])
const price = computed(() => (p.value ? productPrice(p.value.id) : null))
const cost = computed(() => (p.value ? costOf(p.value.id) : 0))
const refPrice = computed(() => (p.value ? refOf(p.value.id) : 0))
const margin = computed(() => (price.value != null ? price.value - cost.value : 0))

const nextBoost = computed(() => shelf.value && SHELF_BOOST[(shelf.value.boost || 0) + 1])
const curBoost = computed(() => shelf.value && SHELF_BOOST[shelf.value.boost || 0])

// Desgaste e motor do refrigerador/freezer/açougue
const wear = computed(() => Math.round(shelf.value?.wear || 0))
const wearCls = computed(() => (shelf.value?.broken || wear.value >= FREEZER.risk ? 'bad' : wear.value >= FREEZER.warn ? 'warn' : 'ok'))
const hasEquipAlert = computed(() => isCooled.value && (shelf.value?.broken || wear.value >= FREEZER.warn))

const techState = computed(() => {
  const s = shelf.value
  if (!s?.call) return null
  return s.techAt === 'working' ? 'Técnico trabalhando' : s.techAt === 'walking' ? 'Técnico na loja' : 'Técnico a caminho'
})

// Lista de produtos compatíveis com este expositor
const compatibleProducts = computed(() => {
  if (!shelf.value) return []
  return PRODUCTS.filter((x) => game.unlocked[x.id] && canStockProduct(x.id, shelf.value))
})

const defaultShelfTitle = computed(() => {
  if (shelfKind.value === 'meat') return 'Freezer de carnes'
  if (shelfKind.value === 'produce') return 'Banca de hortifruti'
  if (shelfKind.value === 'fridge') return 'Freezer vazio'
  return 'Prateleira vazia'
})

const selectProduct = (pid) => {
  if (!shelf.value) return
  shelf.value.product = pid || null
  shelf.value.price = pid ? game.priceMemory[pid] ?? null : null
}

// Se o freezer quebrar enquanto aberto e estiver em outra aba, podemos alertar ou abrir equipamento
watch(() => shelf.value?.broken, (isBroken) => {
  if (isBroken) activeTab.value = 'equip'
})
</script>

<template>
  <div v-if="shelf" class="card panel">
    <!-- Cabeçalho -->
    <div class="head">
      <div class="prod-thumb-box" :class="{ empty: !p }">
        <img v-if="p" :src="productThumb(p.id)" alt="" />
        <PhKnife v-else-if="shelfKind === 'meat'" weight="duotone" class="thumb-icon meat" />
        <PhPlant v-else-if="shelfKind === 'produce'" weight="duotone" class="thumb-icon produce" />
        <PhSnowflake v-else-if="shelfKind === 'fridge'" weight="duotone" class="thumb-icon cold" />
        <PhPackage v-else weight="duotone" class="thumb-icon" />
      </div>

      <div class="head-info">
        <div class="title-row">
          <b class="name" :title="p ? p.name : defaultShelfTitle">
            {{ p ? p.name : defaultShelfTitle }}
          </b>
          <span class="type-pill" :class="shelfKind">
            <PhKnife v-if="shelfKind === 'meat'" weight="bold" />
            <PhPlant v-else-if="shelfKind === 'produce'" weight="bold" />
            <PhSnowflake v-else-if="shelfKind === 'fridge'" weight="bold" />
            <PhPackage v-else weight="bold" />
            <span>{{ shelfKind === 'meat' ? 'Açougue' : shelfKind === 'produce' ? 'Hortifruti' : shelfKind === 'fridge' ? 'Gelado' : 'Seco' }}</span>
          </span>
        </div>

        <div class="capacity-row">
          <div class="fill-bar">
            <i :style="{ width: ((shelf.count / shelfCap()) * 100) + '%' }" />
          </div>
          <span class="cap-text">{{ shelf.count }}/{{ shelfCap() }} un</span>
        </div>
      </div>

      <button class="btn sm close-btn" aria-label="Fechar" @click="ui.panelShelf = null">
        <PhX weight="bold" />
      </button>
    </div>

    <!-- Seletor de Abas (Venda vs Equipamento) -->
    <div class="tabs-nav">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'venda' }"
        @click="activeTab = 'venda'"
      >
        <PhTag weight="bold" />
        <span>Venda</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'equip' }"
        @click="activeTab = 'equip'"
      >
        <PhWrench weight="bold" />
        <span>Equipamento</span>
        <span v-if="hasEquipAlert" class="alert-dot" title="Atenção necessária">
          <PhWarning weight="fill" />
        </span>
      </button>
    </div>

    <!-- ==================== ABA 1: VENDA ==================== -->
    <div v-if="activeTab === 'venda'" class="tab-content">
      <!-- Caso tenha produto configurado -->
      <template v-if="p">
        <!-- Card de Precificação -->
        <div class="sub-card">
          <div class="sub-head">
            <span class="sub-title"><PhTag weight="bold" /> Preço unitário</span>
          </div>

          <PriceStepper :pid="p.id" :fast="true" />

          <button class="btn sm good market-btn" @click="setPrice(p.id, refPrice)">
            <PhScales weight="bold" />
            <span>Usar mercado: {{ money(refPrice) }}</span>
          </button>
        </div>

        <!-- Métricas Rápidas (Custo, Mercado e Margem) -->
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-lbl">Custo</span>
            <b class="metric-val">{{ money(cost) }}</b>
          </div>

          <div class="metric-card">
            <span class="metric-lbl">Margem</span>
            <b class="metric-val" :class="margin >= 0 ? 'good-t' : 'bad-t'">
              <PhTrendUp v-if="margin >= 0" weight="bold" />
              <PhTrendDown v-else weight="bold" />
              {{ margin >= 0 ? '+' : '' }}{{ money(margin) }}
            </b>
          </div>
        </div>

        <!-- Se a prateleira estiver zerada (0 un), permite trocar o produto facilmente -->
        <div v-if="shelf.count === 0" class="sub-card">
          <div class="sub-head">
            <span class="sub-title"><PhPackage weight="bold" /> Trocar produto desta prateleira</span>
            <button class="btn sm clear-btn" title="Deixar prateleira vazia" @click="selectProduct(null)">
              <PhTrash weight="bold" /> Limpar
            </button>
          </div>

          <div class="product-grid">
            <button
              v-for="x in compatibleProducts"
              :key="x.id"
              class="prod-chip"
              :class="{ active: x.id === p.id }"
              @click="selectProduct(x.id)"
            >
              <img :src="productThumb(x.id)" alt="" />
              <span class="chip-name">{{ x.name }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- Caso a prateleira esteja totalmente vazia e sem produto -->
      <div v-else class="sub-card empty-picker">
        <div class="sub-head">
          <span class="sub-title"><PhPackage weight="bold" /> Escolha o produto</span>
        </div>

        <div class="product-grid">
          <button
            v-for="x in compatibleProducts"
            :key="x.id"
            class="prod-chip"
            @click="selectProduct(x.id)"
          >
            <img :src="productThumb(x.id)" alt="" />
            <span class="chip-name">{{ x.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== ABA 2: EQUIPAMENTO ==================== -->
    <div v-else-if="activeTab === 'equip'" class="tab-content">
      <!-- Motor de refrigeração (apenas se for freezer ou balcão de carnes) -->
      <div v-if="isCooled" class="sub-card motor-card" :class="wearCls">
        <div class="sub-head">
          <span class="sub-title"><PhWrench weight="fill" /> {{ shelfKind === 'meat' ? 'Motor do açougue' : 'Motor do freezer' }}</span>
          <span class="status-badge" :class="wearCls">
            <PhWarning v-if="shelf.broken || wear >= FREEZER.warn" weight="fill" />
            <PhCheckCircle v-else weight="fill" />
            <span>{{ shelf.broken ? 'Quebrado' : `${wear}% uso` }}</span>
          </span>
        </div>

        <!-- Medidor segmentado de 4 blocos -->
        <div class="segmented-gauge">
          <div class="seg" :class="{ filled: wear > 0, ok: wear <= 50 }" />
          <div class="seg" :class="{ filled: wear > 25, ok: wear <= 50, warn: wear > 50 && wear <= 75 }" />
          <div class="seg" :class="{ filled: wear > 50, warn: wear > 50 && wear <= 75, bad: wear > 75 }" />
          <div class="seg" :class="{ filled: wear > 75 || shelf.broken, bad: true, pulse: shelf.broken || wear >= FREEZER.risk }" />
        </div>

        <!-- Ação técnica -->
        <div v-if="techState" class="tech-alert">
          <PhWrench weight="fill" />
          <span>{{ techState }} · {{ money(shelf.callCost) }}</span>
        </div>

        <button
          v-else-if="shelf.broken"
          class="btn primary w-full action-btn"
          @click="world.callTech(shelf)"
        >
          <PhWrench weight="bold" />
          <span>Consertar motor · {{ money(world.serviceCost(shelf)) }}</span>
        </button>

        <button
          v-else-if="wear >= FREEZER.serviceMin"
          class="btn warn w-full action-btn"
          @click="world.callTech(shelf)"
        >
          <PhWrench weight="bold" />
          <span>Chamar revisão · {{ money(world.serviceCost(shelf)) }}</span>
        </button>

        <div v-else class="status-msg">
          <PhCheckCircle weight="bold" class="good-t" />
          <span>Motor em bom estado (revisão a partir de {{ FREEZER.serviceMin }}%)</span>
        </div>
      </div>

      <!-- Destaque / Upgrade da prateleira (comum a prateleiras e freezers) -->
      <div class="sub-card boost-card">
        <div class="sub-head">
          <span class="sub-title"><PhSparkle weight="fill" class="sparkle-ico" /> Destaque</span>
          <span class="boost-tier">Nível {{ (shelf.boost || 0) + 1 }}/3 · {{ curBoost.name }}</span>
        </div>

        <button
          v-if="nextBoost"
          class="btn good w-full action-btn"
          :disabled="game.money < nextBoost.price"
          @click="upgradeShelf(shelf.id)"
        >
          <PhArrowUp weight="bold" />
          <span>Melhorar para {{ nextBoost.name }} · {{ money(nextBoost.price) }}</span>
        </button>

        <div v-else class="status-msg good-t">
          <PhCheckCircle weight="bold" />
          <span>Nível máximo de destaque</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 12px;
  top: 72px;
  width: 340px;
  z-index: 12;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}

/* Cabeçalho */
.head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.prod-thumb-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #fff;
  border: 2px solid var(--cream2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.prod-thumb-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-icon {
  font-size: 24px;
  color: var(--plum2);
}
.thumb-icon.cold {
  color: var(--teal);
}
.head-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name {
  font-size: 14px;
  color: var(--plum);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 800;
}
.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.type-pill.cold {
  background: #d4f0eb;
  color: #1e695d;
}
.type-pill.dry {
  background: #fbe6cb;
  color: #794d1b;
}
.capacity-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fill-bar {
  flex: 1;
  height: 6px;
  background: #e6d6bd;
  border-radius: 99px;
  overflow: hidden;
}
.fill-bar i {
  display: block;
  height: 100%;
  background: var(--teal);
  transition: width 0.2s ease;
}
.cap-text {
  font-size: 11px;
  font-weight: 800;
  color: var(--plum2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.close-btn {
  margin-left: auto;
  width: 30px;
  height: 30px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Tabs */
.tabs-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  background: #ebdcc4;
  padding: 3px;
  border-radius: 12px;
}
.tab-btn {
  background: transparent;
  padding: 6px 10px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  color: var(--plum2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;
  position: relative;
}
.tab-btn.active {
  background: #fff;
  color: var(--plum);
  box-shadow: 0 2px 5px rgba(59, 47, 74, 0.12);
}
.alert-dot {
  color: var(--bad);
  font-size: 14px;
  display: flex;
  align-items: center;
  animation: pulse-dot 1.5s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

/* Tab Content */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sub-card {
  background: #fff;
  border-radius: 12px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1.5px solid var(--cream2);
}
.sub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.sub-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--plum);
  display: flex;
  align-items: center;
  gap: 5px;
}
.market-btn {
  width: 100%;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  padding: 7px 10px;
}

/* Métricas Financeiras */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.metric-card {
  background: #fff;
  border: 1.5px solid var(--cream2);
  border-radius: 10px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}
.metric-lbl {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--plum2);
  opacity: 0.8;
}
.metric-val {
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* Grade de Produtos */
.empty-picker {
  max-height: 240px;
  overflow-y: auto;
}
.product-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 2px;
}
.prod-chip {
  background: var(--cream);
  border: 1.5px solid var(--cream2);
  border-radius: 8px;
  padding: 5px 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s ease;
}
.prod-chip img {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  flex-shrink: 0;
}
.chip-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--plum);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prod-chip:hover {
  background: #fff;
  border-color: var(--teal);
  transform: translateY(-1px);
}
.prod-chip.active {
  background: #d4f0eb;
  border-color: var(--teal);
}
.clear-btn {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
}

/* Equipamento e Motor */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.status-badge.ok {
  background: #dcf2e4;
  color: #266b42;
}
.status-badge.warn {
  background: #fdf0cd;
  color: #795713;
}
.status-badge.bad {
  background: #fadcd9;
  color: #922c23;
}

/* Medidor Segmentado */
.segmented-gauge {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  height: 7px;
  margin: 2px 0;
}
.seg {
  background: #eee3d1;
  border-radius: 3px;
  transition: background 0.2s ease;
}
.seg.filled.ok {
  background: var(--good);
}
.seg.filled.warn {
  background: var(--mustard);
}
.seg.filled.bad {
  background: var(--bad);
}
.seg.pulse {
  animation: pulse-seg 1s infinite alternate;
}
@keyframes pulse-seg {
  from { opacity: 0.6; }
  to { opacity: 1; }
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  font-size: 12px;
}
.tech-alert {
  background: #e1f0f8;
  color: #1e5c7a;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-msg {
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--plum2);
}
.sparkle-ico {
  color: var(--mustard);
}
.boost-tier {
  font-size: 11px;
  font-weight: 800;
  color: var(--plum2);
}
.w-full {
  width: 100%;
}
</style>