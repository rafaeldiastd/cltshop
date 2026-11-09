import { game, ui, hooks, toast, newStats, uid, wages, save } from './state.js'
import { PRODUCTS, PID, LEVELS, SHELF_CAP, DAY_SECONDS, PACK } from './config.js'
import { dims, counterTiles, cashierTile, queueTiles, doorTile, doorInside, shelfAccess, stockStand, boxSlots, decorTiles } from './layout.js'
import { sfx } from './audio.js'
import { hoverText } from './texts.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const key = (x, z) => x + ',' + z
const PATIENCE = 75

export const go = (x, z) => ({ t: 'go', x, z })
export const work = (dur, label, fn) => ({ t: 'work', dur, label, fn })
export const wait = (dur) => ({ t: 'wait', dur })
export const call = (fn) => ({ t: 'call', fn })

class Actor {
  constructor(o) {
    Object.assign(this, { x: 0, z: 0, path: null, steps: [], speed: 2.3, face: 0, moving: false, work: null, emote: null, emoteT: 0 }, o)
  }
  setSteps(steps) { this.steps = steps; this.path = null; this.work = null }
  get idle() { return this.steps.length === 0 }
  say(e, t = 2.2) { this.emote = e; this.emoteT = t }
  update(dt, world) {
    if (this.emoteT > 0 && (this.emoteT -= dt) <= 0) this.emote = null
    for (let guard = 0; guard < 8; guard++) {
      const s = this.steps[0]
      if (!s) { this.moving = false; return }
      if (s.t === 'call') { this.steps.shift(); s.fn(this); continue }
      if (s.t === 'go') {
        if (!this.path) this.path = world.findPath(this, s.x, s.z)
        if (!this.path || !this.path.length) { this.steps.shift(); this.path = null; continue }
        let budget = this.speed * dt
        while (budget > 0 && this.path.length) {
          const n = this.path[0]
          const dx = n.x - this.x, dz = n.z - this.z
          const d = Math.hypot(dx, dz)
          if (d > 0.001) this.face = Math.atan2(dx, dz)
          if (d <= budget) { this.x = n.x; this.z = n.z; budget -= d; this.path.shift() }
          else { this.x += (dx / d) * budget; this.z += (dz / d) * budget; budget = 0 }
        }
        this.moving = true
        if (!this.path.length) { this.steps.shift(); this.path = null; continue }
        return
      }
      this.moving = false
      if (s.t === 'work' || s.t === 'wait') {
        s.el = (s.el || 0) + dt
        this.work = s.t === 'work' ? { label: s.label, p: Math.min(1, s.el / s.dur) } : null
        if (s.el >= s.dur) { this.steps.shift(); this.work = null; s.fn && s.fn(this); continue }
        return
      }
    }
  }
}

class World {
  constructor() {
    this.player = new Actor({ id: 'player', kind: 'player', x: 4, z: 8, speed: 3.0, cashiering: false })
    this.staff = []
    this.customers = []
    this.queue = []
    this.blocked = new Set()
    this.spawnAcc = 0
    this.closeGrace = 0
    this.nightT = 0
    this.keys = new Set()
    this.target = null
    this.pets = []
    this._lastPrompt = null
    hooks.refreshGrid = () => this.refreshGrid()
    this.refreshGrid()
  }

  get actors() { return [this.player, ...this.staff, ...this.customers, ...this.pets] }

  // ---------- grade / caminhos ----------
  refreshGrid() {
    this.d = dims(game.level)
    this.blocked = new Set()
    game.shelves.forEach((s) => this.blocked.add(key(s.x, s.z)))
    counterTiles(game.level).forEach((t) => this.blocked.add(key(t.x, t.z)))
    decorTiles(game.level).forEach((t) => this.blocked.add(key(t.x, t.z)))
  }
  // colisão do jogador controlado por teclado (raio pequeno)
  walkAt(x, z) {
    const r = 0.2
    return [[-r, -r], [r, -r], [-r, r], [r, r]].every(([dx, dz]) => this.walkable(Math.round(x + dx), Math.round(z + dz)))
  }
  walkable(x, z) {
    const { cols, rows, doorX } = this.d
    if (z < 0) return false
    if (z <= rows - 1) return x >= 0 && x <= cols - 1 && !this.blocked.has(key(x, z))
    if (z === rows) return x === doorX
    if (z <= rows + 2) return x >= -3 && x <= cols + 2
    return false
  }
  nearest(x, z) {
    let best = null, bd = 1e9
    for (let r = 1; r <= 4 && !best; r++)
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (!this.walkable(x + dx, z + dz)) continue
        const d = Math.hypot(dx, dz)
        if (d < bd) { bd = d; best = { x: x + dx, z: z + dz } }
      }
    return best
  }
  findPath(a, gx, gz) {
    gx = Math.round(gx); gz = Math.round(gz)
    let s = { x: Math.round(a.x), z: Math.round(a.z) }
    if (!this.walkable(s.x, s.z)) s = this.nearest(s.x, s.z)
    const g = this.walkable(gx, gz) ? { x: gx, z: gz } : this.nearest(gx, gz)
    if (!s || !g) return null
    const h = (x, z) => Math.abs(x - g.x) + Math.abs(z - g.z)
    const open = [{ x: s.x, z: s.z, g: 0, f: h(s.x, s.z) }]
    const came = new Map(), best = new Map([[key(s.x, s.z), 0]])
    while (open.length) {
      let bi = 0
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
      const c = open.splice(bi, 1)[0]
      if (c.x === g.x && c.z === g.z) {
        const out = []
        let k = key(c.x, c.z)
        while (came.has(k)) { const [x, z] = k.split(',').map(Number); out.unshift({ x, z }); k = came.get(k) }
        return out
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, nz = c.z + dz
        if (!this.walkable(nx, nz)) continue
        const ng = c.g + 1, nk = key(nx, nz)
        if (ng < (best.get(nk) ?? 1e9)) {
          best.set(nk, ng); came.set(nk, key(c.x, c.z))
          open.push({ x: nx, z: nz, g: ng, f: ng + h(nx, nz) })
        }
      }
    }
    return null
  }

  // ---------- tarefas (jogador e repositores) ----------
  boxTile(box) {
    const pos = boxSlots(game.boxes, game.level).get(box.id)
    return pos ? { x: pos.x + 0.3, z: pos.z + 0.3 } : { x: 2, z: 2 }
  }
  close(a, x, z, r = 1.9) { return a && Math.hypot(a.x - x, a.z - z) < r }
  receive(box, m = 1, a) {
    const t = this.boxTile(box)
    return [...(this.close(a, t.x, t.z) ? [] : [go(t.x, t.z + 0.6)]), work(1.2 * m, 'Recebendo caixa', () => {
      if (game.boxes.includes(box) && box.state === 'dock') { box.state = 'stock'; sfx('pop') }
      box.res = null
    })]
  }
  unpack(box, m = 1, a) {
    const t = this.boxTile(box)
    return [...(this.close(a, t.x, t.z) ? [] : [go(stockStand.x, stockStand.z)]), work(1.8 * m, 'Desembalando', () => {
      if (game.boxes.includes(box) && box.state === 'stock') { box.state = 'open'; sfx('pop') }
      box.res = null
    })]
  }
  shelve(box, shelf, m = 1, actor) {
    const units = Math.min(box.count, SHELF_CAP - shelf.count)
    const a = shelfAccess(shelf)
    const steps = []
    if (actor?.kind !== 'player') steps.push(go(stockStand.x, stockStand.z))
    if (!this.close(actor, shelf.x, shelf.z + 0.3, 1.7)) steps.push(go(a.x, a.z))
    return [...steps, work((0.5 + 0.08 * units) * m, 'Repondo prateleira', (who) => this.doShelve(box, shelf, who)), call(() => { box.res = null })]
  }
  doShelve(box, shelf, who) {
    if (!game.boxes.includes(box) || box.state !== 'open') return
    if (shelf.product && shelf.product !== box.product && shelf.count > 0) return toast('Essa prateleira já tem outro produto', 'bad')
    const n = Math.min(box.count, SHELF_CAP - shelf.count)
    if (n <= 0) return toast('Prateleira cheia', 'bad')
    if (shelf.product !== box.product) { shelf.product = box.product; shelf.price = game.priceMemory[box.product] ?? null }
    shelf.count += n
    box.count -= n
    sfx('pop')
    if (box.count <= 0) {
      game.boxes.splice(game.boxes.indexOf(box), 1)
      if (ui.selectedBox === box.id) ui.selectedBox = null
    } else toast(`Sobraram ${box.count} na caixa`, 'info')
    if (shelf.price == null && who?.kind === 'player') { ui.panelShelf = shelf.id; toast('Defina o preço dessa prateleira 🏷️') }
  }

  // ---------- comandos do jogador ----------
  cmd(steps) { this.player.cashiering = false; this.player.setSteps(steps) }
  cmdMove(x, z) { this.cmd([go(x, z)]) }
  cmdBox(box) {
    if (box.state === 'dock') this.cmd(this.receive(box, 1, this.player))
    else if (box.state === 'stock') this.cmd(this.unpack(box, 1, this.player))
    else ui.selectedBox = ui.selectedBox === box.id ? null : box.id
  }
  cmdShelf(shelf) {
    const box = game.boxes.find((b) => b.id === ui.selectedBox)
    if (box) {
      if (shelf.product && shelf.product !== box.product && shelf.count > 0) return toast('Essa prateleira já tem outro produto', 'bad')
      if (shelf.count >= SHELF_CAP) return toast('Prateleira cheia', 'bad')
      this.cmd(this.shelve(box, shelf, 1, this.player))
    } else {
      ui.panelShelf = shelf.id
      const a = shelfAccess(shelf)
      if (!this.close(this.player, shelf.x, shelf.z + 0.3, 1.7)) this.cmd([go(a.x, a.z)])
    }
  }
  cmdServe() {
    const c = cashierTile(game.level)
    this.cmd([go(c.x, c.z), call((p) => (p.cashiering = true))])
  }

  // ---------- interação por proximidade (tecla E) ----------
  computeTarget() {
    const p = this.player
    if (ui.modal || ui.placing) return null
    const carrying = game.boxes.find((b) => b.id === ui.selectedBox)
    const cands = []
    const slots = boxSlots(game.boxes, game.level)
    if (!carrying) for (const b of game.boxes) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
    else for (const b of game.boxes) if (b.state === 'open' && b.id !== carrying.id) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
    for (const s of game.shelves) cands.push({ kind: 'shelf', id: s.id, x: s.x, z: s.z + 0.35 })
    const ct = counterTiles(game.level)
    cands.push({ kind: 'counter', id: 'c', x: (ct[0].x + ct[1].x) / 2, z: ct[0].z + 0.4 })
    let best = null, bs = 1e9
    const fx = Math.sin(p.face), fz = Math.cos(p.face)
    for (const c of cands) {
      const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz)
      if (d > 1.7) continue
      const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1
      if (d > 0.9 && dot < -0.2) continue
      const sc = d - dot * 0.45
      if (sc < bs) { bs = sc; best = c }
    }
    return best
  }
  interact() {
    const t = this.target
    if (!t) return false
    const p = this.player
    if (t.kind === 'box') { const b = game.boxes.find((x) => x.id === t.id); if (b) this.cmdBox(b) }
    else if (t.kind === 'shelf') { const s = game.shelves.find((x) => x.id === t.id); if (s) this.cmdShelf(s) }
    else if (t.kind === 'counter') {
      if (game.phase === 'open' || game.phase === 'closing') {
        p.cashiering = !p.cashiering
        toast(p.cashiering ? 'Você está no caixa 🧾' : 'Saiu do caixa')
      } else toast('O balcão só funciona com a loja aberta')
    }
    return true
  }
  drop() { ui.selectedBox = null }

  // ---------- fluxo do dia ----------
  openShop() {
    if (game.phase !== 'prep') return
    game.phase = 'open'
    game.clock = 0
    this.spawnAcc = 0
    this.closeGrace = 0
    toast('Loja aberta! ☀️', 'good')
    sfx('chime')
  }
  closeEarly() { if (game.phase === 'open') game.clock = DAY_SECONDS }
  get hour() { return 9 + (game.clock / DAY_SECONDS) * 12 }

  endDay() {
    const t = game.today
    const w = wages()
    game.money -= w
    game.summary = {
      day: game.day, revenue: t.revenue, cogs: t.cogs, wages: w, profit: t.revenue - t.cogs - w,
      customers: t.customers, served: t.served, units: t.units, sold: { ...t.sold },
      oos: { ...t.oos }, price: { ...t.price }, patience: t.patience, lostValue: t.lostValue, rep: game.rep,
    }
    game.phase = 'night'
    this.player.setSteps([]); this.player.cashiering = false
    ui.modal = 'summary'
    sfx('chime')
  }
  startNextDay() {
    game.day++
    game.phase = 'prep'
    game.clock = 0
    game.today = newStats()
    let n = 0
    for (const o of game.pending) for (let i = 0; i < o.boxes; i++, n++) game.boxes.push({ id: uid(), product: o.product, count: PACK, state: 'dock', res: null })
    game.pending = []
    ui.modal = null
    if (n) toast(`Entrega chegou: ${n} caixas na calçada 🚚`, 'good')
    save()
  }

  // ---------- clientes ----------
  spawnRate() {
    const h = this.hour
    const curve = h < 11 ? 0.8 : h < 14 ? 1.3 : h < 17 ? 0.8 : h < 20 ? 1.5 : 0.7
    const stocked = new Set(game.shelves.filter((s) => s.count > 0 && s.price != null).map((s) => s.product)).size
    const variety = Math.max(0.35, Math.min(1.5, 0.35 + 0.16 * stocked))
    const rep = 0.5 + game.rep * 0.17
    return (LEVELS[game.level].customers / DAY_SECONDS) * (curve / 1.09) * variety * rep
  }
  spawnCustomer() {
    const { cols, rows } = this.d
    const left = Math.random() < 0.5
    const c = new Actor({ id: 'c' + uid(), kind: 'customer', x: left ? -3 : cols + 2, z: rows + 2, speed: rnd(1.6, 2.1), basket: [], wants: [], patience: PATIENCE, waiting: false, hue: Math.random() })
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id])
    const n = Math.random() < 0.45 ? 1 : Math.random() < 0.7 ? 2 : 3
    const bag = [...pool]
    for (let i = 0; i < n && bag.length; i++) {
      const total = bag.reduce((s, p) => s + p.demand, 0)
      let r = Math.random() * total, pick = bag[0]
      for (const p of bag) { if ((r -= p.demand) <= 0) { pick = p; break } }
      bag.splice(bag.indexOf(pick), 1)
      c.wants.push({ pid: pick.id, qty: Math.random() < 0.6 ? 1 : 2, willing: pick.ref * rnd(0.85, 1.35) })
    }
    game.today.customers++
    const dt = doorTile(game.level), di = doorInside(game.level)
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => this.shopNext(c))])
    this.customers.push(c)
  }
  shopNext(c) {
    if (game.phase === 'closing' || !c.wants.length) return this.checkout(c)
    const w = c.wants.shift()
    const p = PID[w.pid]
    const here = game.shelves.filter((s) => s.product === w.pid && s.price != null)
    const avail = here.filter((s) => s.count > 0).sort((a, b) => a.price - b.price)
    if (!avail.length) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * p.ref
      c.say('😕'); game.rep = Math.max(1, game.rep - 0.012)
      return c.setSteps([wait(0.6), call(() => this.shopNext(c))])
    }
    const shelf = avail[0]
    const a = shelfAccess(shelf)
    c.setSteps([go(a.x, a.z), wait(rnd(0.8, 1.6)), call(() => this.take(c, w, shelf))])
  }
  take(c, w, shelf) {
    const p = PID[w.pid]
    if (shelf.count <= 0 || shelf.product !== w.pid) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * p.ref
      c.say('😕')
    } else if (shelf.price > w.willing) {
      game.today.price[w.pid] = (game.today.price[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * p.ref
      c.say('💸'); game.rep = Math.max(1, game.rep - 0.01)
    } else {
      let q = w.qty
      if (shelf.price < p.ref * 0.9 && Math.random() < 0.6) q++
      q = Math.min(q, shelf.count)
      shelf.count -= q
      c.basket.push({ pid: w.pid, qty: q, price: shelf.price })
      c.say('🛒', 1.2); sfx('pop')
    }
    this.shopNext(c)
  }
  checkout(c) {
    if (!c.basket.length) { c.say('😞'); return this.leave(c) }
    if (this.queue.length >= 4) { c.waiting = true; return c.setSteps([wait(1), call(() => this.checkout(c))]) }
    c.waiting = false
    this.queue.push(c)
    c.state = 'queued'; c.qIdx = -1; c.serve = 0
  }
  leave(c) {
    const qi = this.queue.indexOf(c)
    if (qi >= 0) this.queue.splice(qi, 1)
    c.state = 'leaving'; c.waiting = false
    const dt = doorTile(game.level), di = doorInside(game.level)
    c.setSteps([go(di.x, di.z), go(dt.x, dt.z), go(c.x < this.d.cols / 2 ? -3 : this.d.cols + 2, this.d.rows + 2), call(() => this.remove(c))])
  }
  remove(c) { const i = this.customers.indexOf(c); if (i >= 0) this.customers.splice(i, 1) }
  completeSale(c) {
    const t = game.today
    let total = 0
    for (const b of c.basket) { total += b.qty * b.price; t.units += b.qty; t.cogs += b.qty * PID[b.pid].cost; t.sold[b.pid] = (t.sold[b.pid] || 0) + b.qty }
    game.money += total; t.revenue += total; t.served++
    game.rep = Math.min(5, game.rep + 0.02)
    c.say('😊', 2.5); sfx('coin')
    c.state = 'paid'
    this.leave(c)
  }

  // ---------- IA de equipe ----------
  ensurePets() {
    if (this.pets.length) return
    const a = new Actor({ id: 'pet1', kind: 'pet', species: 'cat', x: 3, z: 2, speed: 0.9 })
    this.pets.push(a)
  }
  petAI(a) {
    if (!a.idle) return
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(rnd(0, this.d.cols)), z = Math.floor(rnd(0, this.d.rows))
      if (this.walkable(x, z)) return a.setSteps([go(x, z), wait(rnd(2, 8))])
    }
  }
  ensureStaff() {
    this.ensurePets()
    for (const role of ['cashier', 'stocker']) {
      const have = this.staff.filter((s) => s.role === role)
      for (let i = have.length; i < game.staff[role]; i++) {
        const di = doorInside(game.level)
        this.staff.push(new Actor({ id: role + uid(), kind: 'staff', role, x: di.x, z: di.z + 1, speed: 2.1, n: i }))
      }
      for (let i = have.length - 1; i >= game.staff[role]; i--) this.staff.splice(this.staff.indexOf(have[i]), 1)
    }
  }
  shelfFor(box) {
    return game.shelves.filter((s) => s.product === box.product && s.count < SHELF_CAP).sort((a, b) => a.count - b.count)[0]
  }
  staffAI(a) {
    if (!a.idle) return
    if (a.role === 'cashier') {
      const c = cashierTile(game.level)
      if (Math.hypot(a.x - c.x, a.z - c.z) > 0.2) a.setSteps([go(c.x, c.z)])
      return
    }
    const M = 1.35
    const dock = game.boxes.find((b) => b.state === 'dock' && !b.res)
    if (dock) { dock.res = a.id; return a.setSteps(this.receive(dock, M, a)) }
    const closed = game.boxes.find((b) => b.state === 'stock' && !b.res)
    if (closed) { closed.res = a.id; return a.setSteps(this.unpack(closed, M, a)) }
    for (const b of game.boxes) {
      if (b.state !== 'open' || b.res) continue
      const sh = this.shelfFor(b)
      if (sh) { b.res = a.id; return a.setSteps(this.shelve(b, sh, M, a)) }
    }
    const idle = { x: 1 + (a.n % 3), z: 2 }
    if (Math.hypot(a.x - idle.x, a.z - idle.z) > 0.3) a.setSteps([go(idle.x, idle.z)])
  }

  movePlayer(dt) {
    const k = this.keys, p = this.player
    const dx = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0)
    const dz = (k.has('s') ? 1 : 0) - (k.has('w') ? 1 : 0)
    if (!dx && !dz) return
    if (p.steps.length || p.work) p.setSteps([])
    const l = Math.hypot(dx, dz), sp = 3.3 * dt
    const nx = p.x + (dx / l) * sp, nz = p.z + (dz / l) * sp
    if (this.walkAt(nx, p.z)) p.x = nx
    if (this.walkAt(p.x, nz)) p.z = nz
    p.face = Math.atan2(dx, dz)
    p.moving = true
  }

  // ---------- loop ----------
  update(rawDt) {
    this.ensureStaff()
    const paused = game.paused || ui.modal === 'orders' || ui.modal === 'shop' || ui.modal === 'summary'
    if (paused) return
    const live = game.phase === 'open' || game.phase === 'closing'
    const dt = live ? rawDt * game.speed : rawDt

    if (game.phase === 'open') {
      game.clock += dt
      this.spawnAcc += this.spawnRate() * dt
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (this.customers.length < LEVELS[game.level].maxCust) this.spawnCustomer() }
      if (game.clock >= DAY_SECONDS) { game.phase = 'closing'; this.closeGrace = 0; toast('Fechamos! Atendendo quem ficou 🌙') }
    } else if (game.phase === 'closing') {
      this.closeGrace += dt
      if (!this.customers.length || this.closeGrace > 150) { this.customers = []; this.queue = []; this.endDay() }
    }

    // fila
    const qt = queueTiles(game.level)
    this.queue.forEach((c, i) => {
      if (c.qIdx !== i) { c.qIdx = i; c.setSteps([go(qt[i].x, qt[i].z)]) }
    })
    for (const c of [...this.customers]) {
      if (c.state === 'queued' || c.waiting) {
        c.patience -= dt
        if (c.patience < 20 && !c.emote) c.say('😤', 1.5)
        if (c.patience <= 0) {
          game.today.patience++
          game.today.lostValue += c.basket.reduce((s, b) => s + b.qty * b.price, 0)
          game.rep = Math.max(1, game.rep - 0.04)
          c.say('😡'); this.leave(c)
        }
      }
    }
    // atendimento
    const ct = cashierTile(game.level)
    const head = this.queue[0]
    const headReady = head && head.state === 'queued' && head.idle && head.qIdx === 0
    let rate = 0
    let playerServing = false
    for (const a of [this.player, ...this.staff.filter((s) => s.role === 'cashier')]) {
      const dist = Math.hypot(a.x - ct.x, a.z - ct.z)
      const ok = a.kind === 'player' ? a.cashiering && dist < 2.3 && !a.moving : dist < 0.3 && a.idle
      if (ok) { rate += a.kind === 'player' ? 1 / 1.1 : 1 / 1.7; if (a.kind === 'player') playerServing = true }
    }
    if (headReady && rate > 0) {
      head.serve += dt * rate
      if (playerServing) this.player.work = { label: 'Atendendo', p: Math.min(1, head.serve) }
      if (head.serve >= 1) this.completeSale(head)
    } else if (this.player.cashiering) this.player.work = null

    for (const a of this.staff) this.staffAI(a)
    for (const a of this.pets) this.petAI(a)
    for (const a of this.actors) a.update(dt, this)
    this.movePlayer(rawDt)
    this.target = this.computeTarget()
    const prompt = this.target ? hoverText(this.target) : null
    if (prompt !== this._lastPrompt) { this._lastPrompt = prompt; ui.prompt = prompt }
    if (this.player.cashiering && Math.hypot(this.player.x - ct.x, this.player.z - ct.z) > 2.6) this.player.cashiering = false
    ui.action = this.player.work ? { ...this.player.work } : null
  }
}

export const world = new World()
