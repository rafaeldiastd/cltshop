import { reactive, watch } from 'vue'
import { PRODUCTS, PID, LEVELS, STAFF, START_MONEY, PACK, DAY_SECONDS, DECOR, EVENTS, WEATHER, EXPRESS_FEE, CAFE_ID, CAFE_MENU, SHELF_CAP, SHELF_CAP_BIG, CAREER_ID, careerNext, CONTRACTS, SHELF_BOOST, PASS, DOORMAT, RUMOR, canStockProduct } from './config.js'
import { makePerson } from './people.js'
import { basePlan, planArea, stockRoom, defaultRegister, defaultShelves, defaultFreezers, defaultProduce, produceSlots, defaultDecor, usableDecor, settleLayout } from './layout.js'

let _id = 1
export const uid = () => _id++
export const hooks = { refreshGrid: () => {}, beforeSave: () => {}, shiftActors: () => {} }

export const newStats = () => ({ revenue: 0, units: 0, cogs: 0, customers: 0, served: 0, sold: {}, oos: {}, price: {}, patience: 0, lostValue: 0, moods: {}, stolen: 0, stolenUnits: 0, caught: 0, cafeSales: 0, cafeRevenue: 0, lunchMissed: 0, deliveries: 0, deliveryRevenue: 0, arcadeRevenue: 0, petFound: 0, petFinds: 0, impulse: 0, xp: 0, maintenance: 0, spoiled: 0, spoiledValue: 0, cleaned: 0, dirty: 0 })
const noMarket = () => ({ text: null, mods: {} })
const newCareer = () => ({ xp: 0, earned: 0, points: 0, perks: {} })

export const game = reactive({
  day: 1,
  phase: 'prep', // prep | open | lunch | closing | night
  lunchOn: false,
  lunchDone: false,
  cafePrices: {},
  plan: basePlan(0),
  clock: 0,
  speed: 1,
  paused: false,
  money: START_MONEY,
  rep: 3,
  level: 0,
  unlocked: {},
  shelves: [],
  register: null,
  decor: [],
  boxes: [],
  pending: [],
  priceMemory: {},
  team: [], // funcionários contratados (pessoas, com status próprios)
  candidates: [], // catálogo de candidatos
  today: newStats(),
  summary: null,
  playerPos: null,
  market: noMarket(),
  forecast: null, // boato ativo: { text, mods, created: dia em que saiu }
  nextRumorDay: RUMOR.firstDay, // dia em que sai o próximo boato
  weather: 'mild',
  cafe: null,
  career: newCareer(),
  bought: {}, // unidades já compradas de cada produto (contratos e livro de receitas)
  recipes: {}, // receitas descobertas
  orders: [], // pedidos do Zap da Lojinha no dia
  zapOn: true,
  decorV2: false, // relógio, quadros e vitrines viraram decoração comprável (saves antigos ganham os que já tinham)
  pass: { claimed: {} }, // recompensas do passe já resgatadas, por nível
  goals: [], // metas do dia
  goalsDay: 0,
  dirt: [], // manchas no chão: { id, x, z, type, level }
  doormat: null, // tapete de entrada comprado: { text, color }
})

export const ui = reactive({
  modal: null, // summary | computer | menu
  computerApp: 'products', // products | store
  selectedBox: null,
  panelShelf: null,
  hover: null,
  mouse: { x: 0, y: 0 },
  log: [],
  toasts: [],
  action: null,
  editing: false,
  held: null,
  cart: {},
  ready: false,
  prompt: null,
  musicPanel: false,
  externalPlaying: false,
  panned: false,
  recenter: false,
  panelCafe: false,
  build: null, // obra sendo planejada: quantos quadrados cada parede anda
  buildArrows: [], // posição na tela dos controles de cada parede
  atRegister: false,
  theft: null, // balão do roubo em andamento: posição na tela e tempo restante
  petMenu: null, // menu do pet aberto: posição na tela
  buyTool: null, // modo layout: móvel que continua sendo comprado a cada clique (shelf | fridge | meat | produce)
  produceStyle: 'island', // formato do próximo expositor de hortifruti
  shelfType: 'std', // tipo da próxima prateleira: std | wall | corner
})

// preferências ficam fora do save: sobrevivem a um "Novo jogo"
const SETTINGS_KEY = 'lojinha-lofi-settings'
function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {} } catch (e) { return {} }
}
export const settings = reactive({ character: 0, hat: 'none', hatColor: '#ef8a77', pet: 'cat', musicOn: true, sfxOn: true, volume: 0.8, playlist: null, ...readSettings() })
watch(settings, () => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch (e) { /* ignore */ }
})

export const money = (n) => 'R$ ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')
export const isClosed = () => game.phase === 'prep' || game.phase === 'night' || game.phase === 'lunch'
export const canExpand = () => game.phase === 'prep' || game.phase === 'night'
export function clockText() {
  if (game.phase === 'prep') return '08:30'
  if (game.phase === 'night') return '21:00'
  const h = 9 + (Math.min(game.clock, DAY_SECONDS) / DAY_SECONDS) * 12
  return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0')
}

// cada mensagem vira um toast passageiro e fica guardada no histórico do Menu; repetidas viram um contador
const LOG_MAX = 80, TOAST_MAX = 4, TOAST_MS = 4200
export function toast(msg, kind = 'info') {
  const last = ui.log[ui.log.length - 1]
  if (last && last.msg === msg && last.day === game.day) { last.count++; last.time = clockText() }
  else {
    ui.log.push({ id: uid(), msg, kind, day: game.day, time: clockText(), count: 1 })
    if (ui.log.length > LOG_MAX) ui.log.shift()
  }
  let t = ui.toasts.find((x) => x.msg === msg)
  if (t) { t.count++; clearTimeout(t.timer) }
  else {
    ui.toasts.push({ id: uid(), msg, kind, count: 1 })
    t = ui.toasts[ui.toasts.length - 1]
    if (ui.toasts.length > TOAST_MAX) ui.toasts.shift()
  }
  const id = t.id
  t.timer = setTimeout(() => {
    const i = ui.toasts.findIndex((x) => x.id === id)
    if (i >= 0) ui.toasts.splice(i, 1)
  }, TOAST_MS)
}

export function newGame() {
  const plan = basePlan(0)
  Object.assign(game, {
    day: 1, phase: 'prep', clock: 0, speed: 1, paused: false, money: START_MONEY, rep: 3, level: 0, plan,
    unlocked: Object.fromEntries(PRODUCTS.filter((p) => p.start).map((p) => [p.id, true])),
    shelves: [], register: defaultRegister(plan), decor: defaultDecor(plan).map((d) => ({ id: uid(), ...d })),
    boxes: [], pending: [], priceMemory: {}, team: [], candidates: [],
    today: newStats(), summary: null, playerPos: null, market: noMarket(), forecast: null, nextRumorDay: RUMOR.firstDay, weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {},
    career: newCareer(), bought: {}, recipes: {}, orders: [], zapOn: true, decorV2: true,
    pass: { claimed: {} }, goals: [], goalsDay: 0, dirt: [], doormat: null,
  })
  ui.build = null
  ui.cart = {}
  ui.selectedBox = null
  ui.panelShelf = null
  ui.panelCafe = false
  ui.modal = null
  ui.log = []
  ui.toasts = []
  // prateleiras iniciais + caixas da primeira entrega
  // começa com 3 prateleiras e 1 expositor de hortifruti (abaixo); freezers e decoração se compram depois
  for (const s of defaultShelves(plan)) addShelf(s)
  const dp = defaultProduce(plan), groupId = 'produce_' + uid()
  for (const s of produceSlots(dp.x, dp.z, dp.rot, dp.style)) {
    addShelf({ ...s, kind: 'produce', groupId })
  }
  for (const p of PRODUCTS.filter((p) => p.start)) {
    game.boxes.push({ id: uid(), product: p.id, count: PACK, state: 'dock', res: null })
    game.bought[p.id] = PACK
  }
  discoverRecipes(false)
  toast('Bem-vindo à lojinha! A primeira entrega está na calçada')
  hooks.refreshGrid()
}

export function addShelf(spot) {
  const kind = spot.kind || (spot.fridge ? 'fridge' : 'shelf')
  const fridge = kind === 'fridge' || kind === 'meat' || !!spot.fridge
  game.shelves.push({
    id: uid(),
    x: spot.x,
    z: spot.z,
    rot: spot.rot || 0,
    ...(spot.groupId ? { groupId: spot.groupId, slot: spot.slot, style: spot.style, level: spot.level, reach: spot.reach, grot: spot.grot || 0 } : {}),
    product: null,
    count: 0,
    price: null,
    kind,
    fridge,
    boost: 0,
    wear: 0,
    broken: false,
    brokenT: 0,
    call: null,
    techAt: null
  })
  hooks.refreshGrid()
}

// ---------- plano de carreira ----------
export const hasPerk = (id) => !!game.career?.perks?.[id]
export const shelfCap = () => (hasPerk('shelf') ? SHELF_CAP_BIG : SHELF_CAP)
export const perkLocked = (id) => { const r = CAREER_ID[id].req; return r && !hasPerk(r) ? CAREER_ID[r].name : null }
export const canBuyPerk = (id) => !hasPerk(id) && !perkLocked(id) && game.career.points >= CAREER_ID[id].cost
export function buyPerk(id) {
  if (!canBuyPerk(id)) return toast('Pontos de maestria insuficientes', 'bad')
  game.career.points -= CAREER_ID[id].cost
  game.career.perks[id] = true
  toast(`Melhoria de carreira: ${CAREER_ID[id].name}!`, 'good')
}
export const xpNext = () => careerNext(game.career.earned)
export function gainXp(n = 1) {
  const c = game.career
  c.xp += n
  game.today.xp += n
  while (c.xp >= careerNext(c.earned)) {
    c.xp -= careerNext(c.earned)
    c.earned++
    c.points++
    toast(passReward(c.earned)
      ? `Nível ${c.earned}! Recompensa do passe e ponto de maestria liberados no computador`
      : `Nível ${c.earned}! Novo ponto de maestria no Plano de Carreira`, 'good')
  }
}

// ---------- passe da lojinha: o nível de experiência libera recompensas, resgatadas uma a uma ----------
export const passLevel = () => game.career.earned
export const passReward = (level) => PASS[level - 1] || null
export const passLevelOf = (pid) => { const i = PASS.findIndex((r) => r.product === pid); return i >= 0 ? i + 1 : null }
export const passClaimed = (level) => !!game.pass?.claimed?.[level]
export const passClaimable = (level) => !!passReward(level) && level <= passLevel() && !passClaimed(level)
export const passPending = () => PASS.reduce((n, r, i) => n + (passClaimable(i + 1) ? 1 : 0), 0)
export function claimPass(level) {
  if (!passClaimable(level)) return
  const r = passReward(level)
  game.pass.claimed[level] = true
  const got = []
  if (r.product && !game.unlocked[r.product]) { game.unlocked[r.product] = true; got.push(`fornecedor de ${PID[r.product].name}`) }
  if (r.money) { game.money += r.money; got.push(money(r.money)) }
  toast(got.length ? `Passe nível ${level}: ${got.join(' e ')}` : `Passe nível ${level} resgatado`, 'good')
}
export function claimAllPass() { for (let i = 1; i <= PASS.length; i++) if (passClaimable(i)) claimPass(i) }

// ---------- livro de receitas: descobre quando já comprou todos os ingredientes ----------
export const knowsIngredient = (pid) => (game.bought[pid] || 0) > 0
export function discoverRecipes(announce = true) {
  for (const m of CAFE_MENU) {
    if (game.recipes[m.id] || !m.uses.every(knowsIngredient)) continue
    game.recipes[m.id] = true
    if (announce) toast(`📖 Nova receita no livro: ${m.name}!`, 'good')
  }
}
export const cafeMenu = () => CAFE_MENU.filter((m) => game.recipes[m.id])

// ---------- mercado: custo, preço de referência e procura variam com o evento e o clima do dia ----------
const mod = (pid) => game.market?.mods?.[pid] || {}
const cents = (n) => Math.round(n * 100) / 100
export const costOf = (pid) => cents(PID[pid].cost * (mod(pid).cost ?? 1))
export const refOf = (pid) => cents(PID[pid].ref * (mod(pid).ref ?? 1))
export const demandOf = (pid) => PID[pid].demand * (mod(pid).demand ?? 1) * (PID[pid].cold && !PID[pid].steady ? WEATHER[game.weather]?.cold ?? 1 : 1)
export const costChange = (pid) => Math.round(((mod(pid).cost ?? 1) - 1) * 100)

// ---------- preços da cafeteria: custo e mercado seguem a média dos ingredientes ----------
const usesMod = (item, field) => item.uses.reduce((s, pid) => s + (mod(pid)[field] ?? 1), 0) / item.uses.length
export const cafeCost = (id) => cents(CAFE_ID[id].cost * usesMod(CAFE_ID[id], 'cost'))
export const cafeRef = (id) => cents(CAFE_ID[id].ref * usesMod(CAFE_ID[id], 'ref'))
export const cafeCostChange = (id) => Math.round((usesMod(CAFE_ID[id], 'cost') - 1) * 100)
export const cafePrice = (id) => game.cafePrices[id] ?? CAFE_ID[id].ref
export function setCafePrice(id, value) {
  const price = Math.max(0.1, Math.round(value * 100) / 100)
  if (Number.isFinite(price)) game.cafePrices[id] = price
}
export function cafeVerdict(id) {
  const r = cafePrice(id) / cafeRef(id)
  if (r < 0.9) return { text: 'Barato', cls: 'cheap' }
  if (r < 1.15) return { text: 'Justo', cls: 'fair' }
  return { text: 'Caro', cls: 'dear' }
}
// o evento aparece no mercado do dia seguinte; um boato só avisa antes e pode não se cumprir
const pickEvent = (excludePids = []) => {
  const pool = EVENTS.filter((e) => Object.keys(e.mods).some((pid) => game.unlocked[pid]) && !excludePids.some((pid) => e.mods[pid]))
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}
const asMarket = (e) => (e ? { text: e.text, mods: e.mods } : noMarket())
// dias que faltam para o boato se resolver, contados do ponto de vista de quem lê (2 = depois de amanhã, 1 = amanhã)
export const rumorDays = () => (game.forecast ? game.forecast.created + RUMOR.lead - game.day : 0)
export function rollMarket() {
  let market = noMarket(), failed = null
  const r = game.forecast
  if (r) {
    // chegou a hora do boato: ele se cumpre com a chance definida
    if (Math.random() < RUMOR.chance) market = { text: r.text, mods: r.mods }
    else failed = r
    game.forecast = null
  }
  // sem boato cumprido, às vezes aparece uma notícia sem aviso (nunca repetindo o boato que falhou)
  if (!market.text && Math.random() < RUMOR.surprise) market = asMarket(pickEvent(failed ? Object.keys(failed.mods) : []))
  game.market = market
  // boato novo a cada 3 ou 4 dias, sobre outros produtos que o evento de hoje
  if (!game.forecast && game.day >= game.nextRumorDay) {
    const e = pickEvent(market.mods ? Object.keys(market.mods) : [])
    if (e) {
      game.forecast = { text: e.text, mods: e.mods, created: game.day }
      game.nextRumorDay = game.day + RUMOR.every[0] + Math.floor(Math.random() * (RUMOR.every[1] - RUMOR.every[0] + 1))
    }
  }
  const w = Math.random()
  game.weather = w < 0.3 ? 'hot' : w < 0.8 ? 'mild' : 'cold'
  if (failed) toast(`O boato não se confirmou: ${failed.text}`)
  if (market.text) toast(`Notícia: ${market.text}`)
  if (game.forecast) toast(`Boato: ${Math.round(RUMOR.chance * 100)}% de chance, em ${RUMOR.lead} dias: ${game.forecast.text}`)
}
// quanto o custo deve mudar se o boato se confirmar
export const forecastChange = (pid) => Math.round(((game.forecast?.mods?.[pid]?.cost ?? 1) - 1) * 100)

// ---------- contratos com fornecedores ----------
export function contractTier(pid) {
  let t = -1
  CONTRACTS.forEach((c, i) => { if ((game.bought[pid] || 0) >= c.at) t = i })
  return t
}
export const nextContract = (pid) => CONTRACTS[contractTier(pid) + 1] || null
export const boxDiscount = (pid, size) => { const t = contractTier(pid); return t >= 0 ? CONTRACTS[t].sizes[size] || 0 : 0 }
export const boxSizes = (pid) => { const t = contractTier(pid); return [PACK, ...(t >= 0 ? Object.keys(CONTRACTS[t].sizes).map(Number) : [])] }

// ---------- compras ----------
// carrinho: "pid" = caixa padrão; "pid|24" = caixa maior do contrato
export const cartKey = (pid, size = PACK) => (size === PACK ? pid : `${pid}|${size}`)
export const parseCartKey = (k) => { const [pid, s] = k.split('|'); return { pid, size: Number(s) || PACK } }
export const boxCost = (pid, size = PACK) => cents(costOf(pid) * size * (1 - boxDiscount(pid, size)))
const cartItems = () => Object.entries(ui.cart).map(([k, n]) => ({ ...parseCartKey(k), n }))
export const cartTotal = () => cartItems().reduce((s, c) => s + c.n * boxCost(c.pid, c.size), 0)
export const cartBoxes = () => cartItems().reduce((s, c) => s + c.n, 0)
// tudo que vai ocupar a sala do estoque: o que já está lá, o que está na calçada e o que está a caminho
export const dockCount = () => game.boxes.filter((b) => b.state === 'dock' && !b.at).length
export const pendingBoxes = () => game.pending.reduce((s, o) => s + o.boxes, 0)
export const stockFree = () => stockCap() - stockCount() - dockCount() - pendingBoxes()
const NO_ROOM = 'Sem espaço no estoque para mais caixas. Amplie a sala do estoque no modo Construção'
export function cartAdd(pid, d, size = PACK) {
  const k = cartKey(pid, size)
  if (d > 0 && cartBoxes() + d > stockFree()) return toast(NO_ROOM, 'bad')
  const n = Math.max(0, Math.min(20, (ui.cart[k] || 0) + d))
  if (n) ui.cart[k] = n
  else delete ui.cart[k]
}
// no almoço o pedido chega na hora, com taxa de entrega expressa
export const isExpress = () => game.phase === 'lunch'
export const orderFee = () => (isExpress() ? Math.round(cartTotal() * EXPRESS_FEE * 100) / 100 : 0)
// compras acumulam para os contratos e destravam receitas
function recordPurchase(pid, units) {
  const before = contractTier(pid)
  game.bought[pid] = (game.bought[pid] || 0) + units
  const after = contractTier(pid)
  if (after > before) {
    const c = CONTRACTS[after]
    const deals = Object.entries(c.sizes).map(([s, k]) => `caixa de ${s} com ${Math.round(k * 100)}% off`).join(', ')
    toast(`🤝 Contrato ${c.name} com o fornecedor de ${PID[pid].name}: ${deals}`, 'good')
  }
}
export function placeOrder() {
  const base = cartTotal()
  if (!base) return true
  const fee = orderFee(), total = base + fee
  if (total > game.money) { toast('Sem caixa suficiente para esse pedido', 'bad'); return false }
  if (cartBoxes() > stockFree()) { toast(NO_ROOM, 'bad'); return false }
  game.money -= total
  const items = cartItems()
  for (const c of items) recordPurchase(c.pid, c.n * c.size)
  discoverRecipes()
  ui.cart = {}
  if (isExpress()) {
    for (const c of items) for (let i = 0; i < c.n; i++) game.boxes.push({ id: uid(), product: c.pid, count: c.size, state: 'dock', res: null })
    toast(`Entrega expressa na calçada! Taxa de ${money(fee)}`, 'good')
    return true
  }
  for (const c of items) {
    const o = game.pending.find((o) => o.product === c.pid && (o.size || PACK) === c.size)
    if (o) o.boxes += c.n
    else game.pending.push({ product: c.pid, boxes: c.n, size: c.size })
  }
  toast('Pedido emitido! Chega amanhã cedo', 'good')
  return true
}

// ---------- preços: valem para todas as prateleiras do produto ----------
export const productPrice = (pid) => game.priceMemory[pid] ?? null
export function setPrice(pid, value) {
  const price = Math.max(0.1, Math.round(value * 100) / 100)
  if (!Number.isFinite(price)) return
  game.priceMemory[pid] = price
  for (const s of game.shelves) if (s.product === pid) s.price = price
}
export const stepPrice = (pid, d) => setPrice(pid, (productPrice(pid) ?? refOf(pid)) + d)
// destaque: a prateleira chama mais atenção para o produto que está nela
export function upgradeShelf(id) {
  const s = game.shelves.find((x) => x.id === id)
  const next = s && SHELF_BOOST[(s.boost || 0) + 1]
  if (!next) return
  if (game.money < next.price) return toast('Caixa insuficiente', 'bad')
  game.money -= next.price
  s.boost = (s.boost || 0) + 1
  toast(`Prateleira com ${next.name.toLowerCase()}!`, 'good')
}
export function priceVerdict(pid) {
  const price = productPrice(pid)
  if (price == null) return { text: 'Sem preço', cls: 'none' }
  const r = price / refOf(pid)
  if (r < 0.9) return { text: 'Barato', cls: 'cheap' }
  if (r < 1.15) return { text: 'Justo', cls: 'fair' }
  return { text: 'Caro', cls: 'dear' }
}

// ---------- loja ----------
// a caixa vazia padrão não ocupa lugar na conta do estoque
export const stockCount = () => {
  // caixas soltas no chão também ocupam o limite: não dá para escapar dele largando caixas por aí
  const inside = game.boxes.filter((b) => b.state !== 'dock')
  return Math.max(0, inside.length - (inside.some((b) => b.state === 'empty') ? 1 : 0))
}
export const stockCap = () => stockRoom(game.plan).cap
// mais área, mais movimento: nos tamanhos de referência de cada tipo dá exatamente o número da tabela
function byArea(field, plan) {
  const a = planArea(plan), pts = LEVELS.map((L) => [L.cols * L.rows, L[field]])
  let i = 0
  while (i < pts.length - 2 && a > pts[i + 1][0]) i++
  const [a0, v0] = pts[i], [a1, v1] = pts[i + 1]
  return v0 + ((a - a0) * (v1 - v0)) / (a1 - a0)
}
export const customersPerDay = (plan = game.plan) => byArea('customers', plan)
export const maxCustomers = (plan = game.plan) => Math.round(byArea('maxCust', plan))
export const stockFull = () => stockCount() >= stockCap()
export const maxShelves = () => LEVELS[game.level].maxShelves
export const maxFreezers = () => LEVELS[game.level].maxFreezers
export const maxMeat = () => LEVELS[game.level].maxMeat || 4
export const maxProduce = () => LEVELS[game.level].maxProduce || 4
export const shelfCount = () => game.shelves.filter((s) => s.kind === 'shelf' || (!s.kind && !s.fridge)).length
export const freezerCount = () => game.shelves.filter((s) => s.kind === 'fridge' || (!s.kind && s.fridge)).length
export const meatCount = () => game.shelves.filter((s) => s.kind === 'meat').length
export const produceCount = () => new Set(game.shelves.filter((s) => s.kind === 'produce').map((s) => s.groupId || s.id)).size
export const decorCount = (type) => game.decor.filter((d) => d.type === type).length
export function sellDecor(type) {
  const list = game.decor.filter((d) => d.type === type)
  if (!list.length || !DECOR[type]?.price) return
  if (!isClosed()) return toast('Venda móveis com a loja fechada', 'bad')
  game.decor.splice(game.decor.indexOf(list[list.length - 1]), 1)
  const value = Math.floor(DECOR[type].price / 2)
  game.money += value
  hooks.refreshGrid()
  toast(`Vendeu ${DECOR[type].name} por ${money(value)}`, 'good')
}
export const emptyCount = () => game.boxes.filter((b) => b.state === 'empty').length
export function storeBox(id) {
  const b = game.boxes.find((x) => x.id === id)
  if (!b) return
  b.at = null
  if (ui.selectedBox === id) ui.selectedBox = null
}
export function trashBox(id) {
  const i = game.boxes.findIndex((b) => b.id === id && (b.state === 'empty' || b.state === 'open'))
  if (i < 0) return
  const [b] = game.boxes.splice(i, 1)
  if (ui.selectedBox === id) ui.selectedBox = null
  toast(b.state === 'empty' ? 'Caixa vazia jogada fora' : `Caixa com ${b.count} de ${PID[b.product].name} jogada fora`)
}
export function trashEmpties() {
  const n = emptyCount() - 1 // sempre sobra uma no estoque
  if (n <= 0) return
  let kept = false
  game.boxes = game.boxes.filter((b) => {
    if (b.state !== 'empty') return true
    if (!kept && !b.at) { kept = true; return true }
    return false
  })
  if (!game.boxes.some((b) => b.id === ui.selectedBox)) ui.selectedBox = null
  toast(n === 1 ? '1 caixa vazia jogada fora' : `${n} caixas vazias jogadas fora`)
}

function settle() {
  const lost = settleLayout(game.plan, game)
  if (lost.length) game.decor = game.decor.filter((d) => !lost.includes(d))
}
// o tipo de comércio libera mais área, móveis e a cafeteria; o espaço em si é comprado no modo construção
export function upgradeType() {
  const next = LEVELS[game.level + 1]
  if (!next) return
  if (!canExpand()) return toast('Mude o tipo do comércio antes de abrir ou depois do expediente', 'bad')
  if (game.money < next.cost) return toast('Caixa insuficiente', 'bad')
  game.money -= next.cost
  game.level++
  toast(`Agora o seu comércio é ${next.name}!`, 'good')
}
// salário de todos os contratados, inclusive de quem está de folga
export const wages = () => game.team.reduce((s, m) => s + m.wage, 0)

// ---------- tapete de entrada ----------
export const cleanMatText = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, DOORMAT.maxText)
export function buyDoormat(text, color) {
  if (game.doormat) return setDoormat(text, color)
  if (game.money < DOORMAT.price) return toast('Caixa insuficiente', 'bad')
  game.money -= DOORMAT.price
  game.doormat = { text: cleanMatText(text) || 'Bem-vindo!', color: color || DOORMAT.colors[0] }
  toast(`Tapete de entrada instalado por ${money(DOORMAT.price)}. Menos sujeira entra na loja`, 'good')
}
export function setDoormat(text, color) {
  if (!game.doormat) return
  game.doormat = { text: cleanMatText(text) || game.doormat.text, color: color || game.doormat.color }
  toast('Tapete atualizado', 'good')
}

// ---------- save ----------
const KEY = 'lojinha-lofi-v1'
let restarting = false // ao recomeçar, o salvamento automático não pode regravar o jogo antigo
export function save() {
  if (restarting) return
  try {
    hooks.beforeSave()
    const d = JSON.parse(JSON.stringify(game))
    d.boxes.forEach((b) => (b.res = null))
    // móvel novo ainda na mão não foi comprado
    d.shelves = d.shelves.filter((s) => s.x >= 0)
    d.decor = d.decor.filter((o) => o.x >= 0)
    if (d.cafe && d.cafe.x < 0) d.cafe = null
    localStorage.setItem(KEY, JSON.stringify({ ...d, cart: ui.cart, log: ui.log }))
  } catch (e) { /* ignore */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const { cart, log, ...d } = JSON.parse(raw)
    // saves de versões anteriores não têm os campos novos: entram os valores padrão
    Object.assign(game, { market: noMarket(), forecast: null, nextRumorDay: RUMOR.firstDay, weather: 'mild', cafe: null, lunchOn: false, lunchDone: false, cafePrices: {}, plan: basePlan(d.level || 0), career: newCareer(), recipes: {}, orders: [], zapOn: true, team: [], candidates: [], pass: { claimed: {} }, goals: [], goalsDay: 0, dirt: [], doormat: null }, d, { speed: 1, paused: false })
    delete game.staff
    if (game.forecast && game.forecast.created == null) game.forecast = null // boato do sistema antigo
    if (!d.team && d.staff) { // saves antigos guardavam só quantos havia de cada cargo
      const taken = new Set()
      for (const [role, n] of Object.entries(d.staff)) for (let i = 0; i < n && STAFF[role]; i++) {
        const m = makePerson(role, { skill: 3, speed: 3, wage: STAFF[role].wage }, taken)
        taken.add(m.name); game.team.push(m)
      }
    }
    game.pass = { claimed: { ...(game.pass?.claimed || {}) } }
    game.dirt = (game.dirt || []).map((x) => ({ ...x, id: uid(), res: null }))
    game.today = { ...newStats(), ...game.today }
    game.career = { ...newCareer(), ...game.career, perks: { ...(game.career?.perks || {}) } }
    // saves antigos não contavam as compras: cada produto liberado conta como uma caixa
    if (!d.bought) game.bought = Object.fromEntries(Object.keys(game.unlocked).map((pid) => [pid, PACK]))
    discoverRecipes(false)
    // pedidos do Zap em andamento dependiam do repositor e do motoboy na tela: ficam só os concluídos
    game.orders = (game.orders || []).filter((o) => o.state === 'done' || o.state === 'refused')
    game.boxes.forEach((b) => { b.res = null; b.id = uid() })
    game.shelves = game.shelves.filter((s) => !(s.style === 'wall' && s.slot >= 2))
    // versões de teste converteram a prateleira da ponta em outro tipo: volta ao tipo e ao giro que ela tinha
    for (const s of game.shelves) {
      if (s.auto) { s.rot = s.rot0 || 0; if (s.var0) s.variant = s.var0; else delete s.variant }
      if (s.variant === 'corner') delete s.variant
      delete s.auto; delete s.rot0; delete s.var0; delete s.tall; delete s.mir
    } // a estante de parede antiga tinha 4 lugares; agora são 2
    game.shelves.forEach((s) => {
      s.id = uid()
      s.rot = s.rot || 0
      s.kind = s.kind || (s.fridge ? 'fridge' : 'shelf')
      s.fridge = (s.kind === 'fridge' || s.kind === 'meat' || !!s.fridge)
      s.boost = s.boost || 0
      s.wear = s.wear || 0
      s.broken = !!s.broken
      s.brokenT = s.brokenT || 0
      s.call = s.call || null
      s.techAt = null
    })
    game.register = d.register || defaultRegister(game.plan)
    game.decor = (d.decor || defaultDecor(game.plan)).map((o) => ({ ...o, id: uid() }))
    for (const u of usableDecor(game.plan)) if (!game.decor.some((o) => o.type === u.type)) game.decor.push({ ...u, id: uid() })
    // freezers eram decoração e agora guardam produtos; saves bem antigos nem tinham freezer salvo
    const freezers = d.decor ? game.decor.filter((o) => o.type === 'freezer') : defaultFreezers(game.plan)
    game.decor = game.decor.filter((o) => DECOR[o.type])
    if (!d.decorV2) { // o que antes era parede fixa vira decoração da loja (já é do jogador)
      const cols = game.plan.cols, wall = [{ type: 'clock', x: cols - 2 }, { type: 'frame', x: 1, hue: 0 }, { type: 'frame', x: 5, hue: 1 }, ...(cols > 9 ? [{ type: 'frame', x: 9, hue: 2 }] : [])]
      for (const w of wall) game.decor.push({ id: uid(), z: 0, rot: 0, ...w })
    }
    game.decorV2 = true
    if (!game.shelves.some((s) => s.fridge)) for (const f of freezers) addShelf({ ...f, fridge: true })
    // saves de antes das regras de seção: prateleira vazia com produto que não vai mais nela fica livre; com itens, avisa para esvaziar
    let misplaced = 0
    for (const s of game.shelves) {
      if (!s.product || s.x < 0 || canStockProduct(s.product, s)) continue
      if (s.count === 0) { s.product = null; s.price = null } else misplaced++
    }
    if (misplaced) toast(`${misplaced === 1 ? '1 prateleira guarda' : `${misplaced} prateleiras guardam`} produto que agora vai em outro móvel: esvazie para o repositor voltar a repor`, 'bad')
    settle()
    ui.cart = cart || {}
    ui.log = (log || []).map((m) => ({ ...m, id: uid() }))
    if (game.phase === 'night' && game.summary) ui.modal = 'summary'
    hooks.refreshGrid()
    return true
  } catch (e) { return false }
}
export function wipeSave() {
  try { localStorage.removeItem(KEY) } catch (e) { /* ignore */ }
}
// personagem, pet e música ficam nas preferências e não são apagados
export function restartGame() {
  if (!confirm('Recomeçar do zero? Todo o progresso salvo será apagado.')) return
  restarting = true
  wipeSave()
  location.reload()
}

export const stockInfo = (pid) => ({
  shelves: game.shelves.filter((s) => s.product === pid).reduce((n, s) => n + s.count, 0),
  boxes: game.boxes.filter((b) => b.product === pid).reduce((n, b) => n + b.count, 0),
  incoming: game.pending.filter((o) => o.product === pid).reduce((n, o) => n + o.boxes * (o.size || PACK), 0),
})
