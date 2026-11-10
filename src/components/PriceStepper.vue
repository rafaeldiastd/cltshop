<script setup>
import { computed } from 'vue'
import { PhMinus, PhPlus } from '@phosphor-icons/vue'
import { productPrice, setPrice, stepPrice, priceVerdict, cafePrice, setCafePrice, cafeVerdict } from '../game/state.js'

// pid = produto comum; cafe = item do cardápio da cafeteria
const props = defineProps({ pid: String, cafe: String })
const price = computed(() => (props.cafe ? cafePrice(props.cafe) : productPrice(props.pid)))
const verdict = computed(() => (props.cafe ? cafeVerdict(props.cafe) : priceVerdict(props.pid)))
const set = (v) => (props.cafe ? setCafePrice(props.cafe, v) : setPrice(props.pid, v))
const step = (d) => (props.cafe ? setCafePrice(props.cafe, price.value + d) : stepPrice(props.pid, d))
const typed = (e) => {
  const v = parseFloat(String(e.target.value).replace(',', '.'))
  if (Number.isFinite(v)) set(v)
  else e.target.value = price.value == null ? '' : price.value.toFixed(2)
}
</script>

<template>
  <div class="ps">
    <button class="btn sm" title="Diminuir R$ 0,10" aria-label="Diminuir preço" @click="step(-0.1)"><PhMinus weight="bold" /></button>
    <label class="field"><span>R$</span><input :value="price == null ? '' : price.toFixed(2)" inputmode="decimal" placeholder="—" :aria-label="'Preço'" @change="typed" /></label>
    <button class="btn sm" title="Aumentar R$ 0,10" aria-label="Aumentar preço" @click="step(0.1)"><PhPlus weight="bold" /></button>
    <span class="chip" :class="verdict.cls">{{ verdict.text }}</span>
  </div>
</template>

<style scoped>
.ps { display: flex; align-items: center; gap: 4px; }
.field { display: flex; align-items: center; gap: 3px; background: #fff; border: 2px solid var(--cream2); border-radius: 9px; padding: 2px 6px; font-size: 13px; font-weight: 700; }
input { width: 46px; border: 0; outline: 0; background: none; font: inherit; font-weight: 800; text-align: right; color: inherit; font-variant-numeric: tabular-nums; }
.field:focus-within { border-color: var(--teal); }
.chip { margin-left: 2px; min-width: 58px; text-align: center; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 99px; }
.none { background: #f4c3bd; color: #8a2e26; } .cheap { background: #d9efdf; color: #245c43; } .fair { background: var(--cream2); } .dear { background: #f8dfa2; color: #7a5410; }
</style>
