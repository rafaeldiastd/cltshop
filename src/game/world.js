import { game, ui, hooks, toast, newStats, uid, wages, save, stockFull, money, settings, costOf, refOf, demandOf, rollMarket, cafePrice, cafeCost, cafeRef, customersPerDay, maxCustomers } from './state.js'
import { PRODUCTS, PID, SHELF_CAP, DAY_SECONDS, PACK, MOODS, PETS, CAMERA_STOP_CHANCE, CAFE, CAFE_MENU, LUNCH } from './config.js'
import { dims, cashierTile, queueTiles, doorTile, doorInside, shelfAccess, shelfPoint, stockStand, stockRoom, inStock, boxSlots, isUsable } from './layout.js'
import { sfx } from './audio.js'
import { hoverText } from './texts.js'
import { startEdit } from './editor.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const key = (x, z) => x + ',' + z
const PATIENCE = 75
const THEFT_SECONDS = 3
const FULL_MSG = 'Estoque cheio! Desembale, reponha ou jogue fora caixas vazias'

export const go = (x, z) => ({ t: 'go', x, z })
export const work = (dur, label, fn) => ({ t: 'work', dur, label, fn })
export const wait = (dur) => ({ t: 'wait', dur })
export const call = (fn) => ({ t: 'call', fn })

class Actor {
  constructor(o) {
    Object.assign(this, { x: 0, z: 0, path: null, steps: [], speed: 2.3, face: 0, moving: false, work: null, emote: null, emoteT: 0, bubble: null, bubbleT: 0 }, o)
  }
  setSteps(steps) { this.steps = steps; this.path = null; this.work = null }
  get idle() { return this.steps.length === 0 }
  say(e, t = 2.2) { this.emote = e; this.emoteT = t }
  update(dt, world) {
    if (this.emoteT > 0 && (this.emoteT -= dt) <= 0) this.emote = null
    if (this.bubbleT > 0 && (this.bubbleT -= dt) <= 0) this.bubble = null
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
    this.queueTiles = []
    hooks.refreshGrid = () => this.refreshGrid()
    hooks.shiftActors = (dx, dz) => this.shiftActors(dx, dz)
    hooks.beforeSave = () => { game.playerPos = { x: this.player.x, z: this.player.z, face: this.player.face } }
    this.refreshGrid()
  }

  get actors() { return [this.player, ...this.staff, ...this.customers, ...this.pets] }

  // ---------- grade / caminhos ----------
  refreshGrid() {
    this.d = dims(game.plan)
    this.room = stockRoom(game.plan)
    this.blocked = new Set()
    game.shelves.forEach((s) => this.blocked.add(key(s.x, s.z)))
    game.decor.forEach((d) => this.blocked.add(key(d.x, d.z)))
    if (game.cafe) this.blocked.add(key(game.cafe.x, game.cafe.z))
    const reg = game.register
    if (reg) {
      this.blocked.add(key(reg.x, reg.z))
      this.queueTiles = queueTiles(game.plan, reg, this.blocked) || Array(4).fill(shelfAccess(reg))
    }
    // quem ficou em cima de um móvel novo ou de uma parede nova é colocado no lugar livre mais próximo
    for (const a of this.actors) {
      if (this.walkAt(a.x, a.z)) continue
      const x = Math.round(a.x), z = Math.round(a.z)
      const spot = this.walkable(x, z) ? { x, z } : this.nearest(x, z)
      if (spot) { a.x = spot.x; a.z = spot.z; a.path = null }
    }
  }
  // obra na parede esquerda ou do fundo renumera os quadrados: todos ficam onde estavam e recomeçam o que faziam
  shiftActors(dx, dz) {
    for (const a of this.actors) { a.x += dx; a.z += dz; a.setSteps([]) }
    for (const b of game.boxes) b.res = null
  }
  // colisão do jogador controlado por teclado (raio pequeno)
  walkAt(x, z) {
    const r = 0.2, corners = [[-r, -r], [r, -r], [-r, r], [r, r]]
    if (!corners.every(([dx, dz]) => this.walkable(Math.round(x + dx), Math.round(z + dz)))) return false
    const sides = corners.map(([dx, dz]) => inStock(game.plan, x + dx, z + dz))
    if (sides.every((s) => s === sides[0])) return true
    // encostando na parede do estoque: só atravessa pelo vão da porta
    return Math.abs(x - this.room.wallX) <= r && Math.abs(z - this.room.door.z) <= 0.5 - r
  }
  // a parede do estoque separa dois lugares vizinhos, exceto na porta
  canStep(ax, az, bx, bz) {
    if (inStock(game.plan, ax, az) === inStock(game.plan, bx, bz)) return true
    const { door, doorOut } = this.room
    return (ax === door.x && az === door.z && bx === doorOut.x && bz === doorOut.z) || (bx === door.x && bz === door.z && ax === doorOut.x && az === doorOut.z)
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
        if (!this.walkable(nx, nz) || !this.canStep(c.x, c.z, nx, nz)) continue
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
    const pos = boxSlots(game.boxes, game.plan).get(box.id)
    return pos ? { x: pos.x + 0.3, z: pos.z + 0.3 } : stockStand(game.plan)
  }
  // perto de verdade: parede do estoque no meio não conta
  close(a, x, z, r = 1.9) { return a && Math.hypot(a.x - x, a.z - z) < r && inStock(game.plan, a.x, a.z) === inStock(game.plan, x, z) }
  receive(box, m = 1, a) {
    const t = this.boxTile(box)
    return [...(this.close(a, t.x, t.z) ? [] : [go(t.x, t.z + 0.6)]), work(1.2 * m, 'Recebendo caixa', () => {
      if (game.boxes.includes(box) && box.state === 'dock') {
        if (stockFull()) toast(FULL_MSG, 'bad')
        else { box.state = 'stock'; sfx('pop') }
      }
      box.res = null
    })]
  }
  unpack(box, m = 1, a) {
    const t = this.boxTile(box), st = stockStand(game.plan)
    return [...(this.close(a, t.x, t.z) ? [] : [go(st.x, st.z)]), work(1.8 * m, 'Desembalando', () => {
      if (game.boxes.includes(box) && box.state === 'stock') { box.state = 'open'; sfx('pop') }
      box.res = null
    })]
  }
  shelve(box, shelf, m = 1, actor) {
    const units = Math.min(box.count, SHELF_CAP - shelf.count)
    const a = shelfAccess(shelf), st = stockStand(game.plan), pt = shelfPoint(shelf)
    const steps = []
    if (actor?.kind !== 'player') steps.push(go(st.x, st.z))
    if (!this.close(actor, pt.x, pt.z, 1.7)) steps.push(go(a.x, a.z))
    return [...steps, work((0.5 + 0.08 * units) * m, 'Repondo prateleira', (who) => this.doShelve(box, shelf, who)), call(() => { box.res = null })]
  }
  doShelve(box, shelf, who) {
    if (!game.boxes.includes(box) || box.state !== 'open') return
    if (this.wrongPlace(box, shelf)) return toast(this.wrongPlace(box, shelf), 'bad')
    if (shelf.product && shelf.product !== box.product && shelf.count > 0) return toast('Essa prateleira já tem outro produto', 'bad')
    const n = Math.min(box.count, SHELF_CAP - shelf.count)
    if (n <= 0) return toast('Prateleira cheia', 'bad')
    if (shelf.product !== box.product) { shelf.product = box.product; shelf.price = game.priceMemory[box.product] ?? null }
    shelf.count += n
    box.count -= n
    sfx('pop')
    if (box.count <= 0) {
      // a caixa do jogador fica vazia na mão; a dos repositores eles mesmos descartam
      if (who?.kind === 'player') { box.state = 'empty'; box.product = null; box.keep = false }
      else {
        game.boxes.splice(game.boxes.indexOf(box), 1)
        if (ui.selectedBox === box.id) ui.selectedBox = null
      }
    } else toast(`Sobraram ${box.count} na caixa`, 'info')
    if (shelf.price == null && who?.kind === 'player') { ui.panelShelf = shelf.id; toast('Defina o preço dessa prateleira') }
  }

  // gelados só no freezer, e o freezer só recebe gelados
  wrongPlace(box, shelf) {
    const cold = !!PID[box.product].cold
    if (PID[box.product].either || cold === !!shelf.fridge) return null
    return cold ? `${PID[box.product].name} precisa ir no freezer` : 'O freezer é só para produtos gelados'
  }
  // tira da prateleira o que couber numa caixa vazia
  doWithdraw(box, shelf) {
    if (!game.boxes.includes(box) || box.state !== 'empty' || !shelf.count) return
    const n = Math.min(PACK, shelf.count)
    box.product = shelf.product
    box.count = n
    box.state = 'open'
    box.keep = true // retirada de propósito: o repositor só usa se o produto acabar
    shelf.count -= n
    if (!shelf.count) { shelf.product = null; shelf.price = null } // esvaziada de propósito fica livre
    sfx('pop')
    toast(`${n} ${PID[box.product].name} ${n === 1 ? 'foi' : 'foram'} para a caixa`)
  }

  // ---------- comandos do jogador ----------
  // no caixa o jogador fica preso até clicar em "Sair do caixa"
  cmd(steps) { if (!this.player.cashiering) this.player.setSteps(steps) }
  leaveRegister() {
    const p = this.player
    if (!p.cashiering) return
    p.cashiering = false
    p.work = null
    toast('Saiu do caixa')
  }
  cmdMove(x, z) { this.cmd([go(x, z)]) }
  cmdBox(box) {
    if (box.state === 'dock') {
      if (stockFull()) return toast(FULL_MSG, 'bad')
      this.cmd(this.receive(box, 1, this.player))
    } else if (box.state === 'stock') this.cmd(this.unpack(box, 1, this.player))
    else ui.selectedBox = ui.selectedBox === box.id ? null : box.id
  }
  cmdShelf(shelf) {
    const box = game.boxes.find((b) => b.id === ui.selectedBox)
    if (box?.state === 'empty') {
      if (!shelf.count) return toast('Essa prateleira não tem itens para retirar', 'bad')
      const a = shelfAccess(shelf), pt = shelfPoint(shelf)
      this.cmd([...(this.close(this.player, pt.x, pt.z, 1.7) ? [] : [go(a.x, a.z)]), work(0.5 + 0.08 * Math.min(PACK, shelf.count), 'Retirando itens', () => this.doWithdraw(box, shelf))])
    } else if (box) {
      if (this.wrongPlace(box, shelf)) return toast(this.wrongPlace(box, shelf), 'bad')
      if (shelf.product && shelf.product !== box.product && shelf.count > 0) return toast('Essa prateleira já tem outro produto', 'bad')
      if (shelf.count >= SHELF_CAP) return toast('Prateleira cheia', 'bad')
      this.cmd(this.shelve(box, shelf, 1, this.player))
    } else {
      ui.panelShelf = shelf.id
      ui.panelCafe = false
      const a = shelfAccess(shelf), pt = shelfPoint(shelf)
      if (!this.close(this.player, pt.x, pt.z, 1.7)) this.cmd([go(a.x, a.z)])
    }
  }
  cmdServe() {
    const r = game.register, c = cashierTile(r)
    this.cmd([go(c.x, c.z), call((p) => {
      p.cashiering = true
      p.face = Math.atan2(r.x - p.x, r.z - p.z)
      toast('Você está no caixa')
    })])
  }
  // carinho: o bichinho espera, o jogador chega ao lado e faz
  cmdPet() {
    const pet = this.pets[0], p = this.player
    if (!pet) return
    const beside = this.besideTile(pet.x, pet.z)
    const near = this.close(p, pet.x, pet.z, 1.3)
    pet.setSteps([wait(near ? 3 : 8)])
    this.cmd([...(near || !beside ? [] : [go(beside.x, beside.z)]), call(() => (p.face = Math.atan2(pet.x - p.x, pet.z - p.z))), work(0.9, 'Fazendo carinho', () => {
      pet.say('❤️', 2.4)
      pet.setSteps([wait(2.4)])
      sfx('pop')
      toast(`${PETS[pet.species].name} adorou o carinho!`, 'good')
    })])
  }
  // lugar livre ao lado de (x, z) mais perto do jogador
  besideTile(x, z) {
    const p = this.player, cx = Math.round(x), cz = Math.round(z)
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => ({ x: cx + dx, z: cz + dz }))
      .filter((t) => this.walkable(t.x, t.z) && this.canStep(cx, cz, t.x, t.z))
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]
  }
  // computador abre a tela de gestão; rádio abre o painel de música
  cmdUse(d) {
    if (!isUsable(d)) return
    const open = () => { if (d.type === 'computer') ui.modal = 'computer'; else ui.musicPanel = true }
    const spot = this.besideTile(d.x, d.z)
    if (this.close(this.player, d.x, d.z, 1.8) || !spot) return open()
    this.cmd([go(spot.x, spot.z), call(open)])
  }
  // abrir a loja é na porta: anda até ela se estiver longe
  cmdDoor() {
    if (game.phase !== 'prep' && game.phase !== 'lunch') return
    const act = () => (game.phase === 'lunch' ? this.endLunch() : this.openShop())
    const di = doorInside(game.plan)
    if (this.close(this.player, di.x, di.z + 0.5)) return act()
    this.cmd([go(di.x, di.z), call(act)])
  }

  // ---------- interação por proximidade (tecla E) ----------
  computeTarget() {
    const p = this.player
    if (ui.modal || ui.editing || p.cashiering) return null
    const carrying = game.boxes.find((b) => b.id === ui.selectedBox)
    const cands = []
    const slots = boxSlots(game.boxes, game.plan)
    if (!carrying) for (const b of game.boxes) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
    else for (const b of game.boxes) if ((b.state === 'open' || b.state === 'empty') && b.id !== carrying.id) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
    for (const s of game.shelves) cands.push({ kind: 'shelf', id: s.id, ...shelfPoint(s) })
    cands.push({ kind: 'counter', id: 'c', x: game.register.x, z: game.register.z })
    if (game.phase === 'prep' || game.phase === 'lunch') { const di = doorInside(game.plan); cands.push({ kind: 'door', id: 'door', x: di.x, z: di.z + 0.6 }) }
    for (const a of this.pets) cands.push({ kind: 'pet', id: a.id, x: a.x, z: a.z })
    if (game.cafe) cands.push({ kind: 'cafe', id: game.cafe.id, x: game.cafe.x, z: game.cafe.z })
    for (const d of game.decor) if (isUsable(d)) cands.push({ kind: 'decor', id: d.id, x: d.x, z: d.z })
    let best = null, bs = 1e9
    const fx = Math.sin(p.face), fz = Math.cos(p.face)
    const inside = inStock(game.plan, p.x, p.z)
    for (const c of cands) {
      const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz)
      if (d > 1.7 || inStock(game.plan, c.x, c.z) !== inside) continue
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
      if (game.phase === 'open' || game.phase === 'closing') this.cmdServe()
      else startEdit()
    }
    else if (t.kind === 'door') this.cmdDoor()
    else if (t.kind === 'pet') this.cmdPet()
    else if (t.kind === 'cafe') this.openCafePanel()
    else if (t.kind === 'decor') { const d = game.decor.find((x) => x.id === t.id); if (d) this.cmdUse(d) }
    return true
  }
  // solta a caixa nos pés do jogador
  drop() {
    const b = game.boxes.find((x) => x.id === ui.selectedBox)
    if (!b) return
    b.at = { x: this.player.x, z: this.player.z }
    ui.selectedBox = null
    sfx('pop')
  }

  // ---------- fluxo do dia ----------
  openShop() {
    if (game.phase !== 'prep') return
    game.phase = 'open'
    game.clock = 0
    this.spawnAcc = 0
    this.closeGrace = 0
    game.lunchDone = false
    this.planThieves()
    toast('Loja aberta!', 'good')
    sfx('chime')
  }
  closeEarly() { if (game.phase === 'open') game.clock = DAY_SECONDS }
  get hour() { return 9 + (game.clock / DAY_SECONDS) * 12 }

  endDay() {
    const t = game.today
    const w = wages()
    game.money -= w
    this.activeTheft = null
    this.thiefTimes = null
    game.summary = {
      day: game.day, revenue: t.revenue, cogs: t.cogs, wages: w, profit: t.revenue - t.cogs - w - t.stolen,
      stolen: t.stolen, stolenUnits: t.stolenUnits, caught: t.caught, cafeSales: t.cafeSales, cafeRevenue: t.cafeRevenue, lunchMissed: t.lunchMissed,
      customers: t.customers, served: t.served, units: t.units, sold: { ...t.sold },
      oos: { ...t.oos }, price: { ...t.price }, patience: t.patience, lostValue: t.lostValue, rep: game.rep, moods: { ...t.moods },
    }
    game.phase = 'night'
    rollMarket()
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
    if (n) toast(`Entrega chegou: ${n} caixas na calçada`, 'good')
    save()
  }

  // ---------- clientes ----------
  spawnRate() {
    const h = this.hour
    const curve = h < 11 ? 0.8 : h < 14 ? 1.3 : h < 17 ? 0.8 : h < 20 ? 1.5 : 0.7
    const stocked = new Set(game.shelves.filter((s) => s.count > 0 && s.price != null).map((s) => s.product)).size
    const variety = Math.max(0.35, Math.min(1.5, 0.35 + 0.16 * stocked))
    const rep = 0.5 + game.rep * 0.17
    return (customersPerDay() / DAY_SECONDS) * (curve / 1.09) * variety * rep
  }
  spawnCustomer() {
    const { cols, rows } = this.d
    const left = Math.random() < 0.5
    const c = new Actor({ id: 'c' + uid(), kind: 'customer', x: left ? -3 : cols + 2, z: rows + 2, speed: rnd(1.6, 2.1), basket: [], wants: [], patience: PATIENCE, waiting: false, hue: Math.random(), felt: new Set() })
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id])
    const n = Math.random() < 0.45 ? 1 : Math.random() < 0.7 ? 2 : 3
    const bag = [...pool]
    for (let i = 0; i < n && bag.length; i++) {
      const total = bag.reduce((s, p) => s + demandOf(p.id), 0)
      let r = Math.random() * total, pick = bag[0]
      for (const p of bag) { if ((r -= demandOf(p.id)) <= 0) { pick = p; break } }
      bag.splice(bag.indexOf(pick), 1)
      c.wants.push({ pid: pick.id, qty: Math.random() < 0.6 ? 1 : 2, willing: refOf(pick.id) * rnd(0.85, 1.35) })
    }
    game.today.customers++
    if (this.cafeOpen() && Math.random() < CAFE.chance * (game.weather === 'cold' ? 1.3 : game.weather === 'hot' ? 0.8 : 1)) c.cafeOrder = this.pickCafeItem()
    const dt = doorTile(game.plan), di = doorInside(game.plan)
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => { c.entered = true; this.feel(c, this.firstImpression(c), 2) }), wait(1), call(() => this.shopNext(c))])
    this.customers.push(c)
  }
  // balão sobre a cabeça; a aba Clientes conta cada emoção uma vez por cliente
  feel(c, mood, t = 2.2) {
    c.say(MOODS[mood].emoji, t)
    if (c.felt.has(mood)) return
    c.felt.add(mood)
    game.today.moods[mood] = (game.today.moods[mood] || 0) + 1
  }
  // primeira impressão ao entrar: o que ele queria está à venda por um preço que aceita?
  firstImpression(c) {
    const found = c.wants.filter((w) => game.shelves.some((s) => s.product === w.pid && s.count > 0 && s.price != null && s.price <= w.willing)).length
    if (!found) return 'empty'
    if (found < c.wants.length) return 'meh'
    const fill = game.shelves.reduce((n, s) => n + s.count, 0) / Math.max(1, game.shelves.length * SHELF_CAP)
    return fill >= 0.4 ? 'love' : 'like'
  }
  // fim do expediente: quem ainda não entrou dá meia-volta e não conta como cliente do dia
  closeDoors() {
    game.phase = 'closing'
    this.closeGrace = 0
    toast('Fechamos! Atendendo quem ficou')
    for (const c of this.customers) if (!c.entered) this.turnAway(c)
  }
  turnAway(c) {
    if (!c.thief) game.today.customers--
    this.feel(c, 'closed')
    c.setSteps([go(c.x < this.d.cols / 2 ? -3 : this.d.cols + 2, this.d.rows + 2), call(() => this.remove(c))])
  }
  // ---------- almoço: às 12h a loja fecha, o tempo para e só volta (já às 13h) quando o jogador reabrir ----------
  startLunch() {
    game.phase = 'lunch'
    game.clock = LUNCH.start
    game.lunchDone = true
    this.player.cashiering = false
    this.activeTheft = null
    for (const c of [...this.customers]) {
      c.theft = null
      if (!c.entered) this.turnAway(c)
      else if (c.state === 'leaving' || c.state === 'paid') continue
      else if (c.basket.length && !c.thief) this.completeSale(c) // quem já estava comprando paga e sai
      else this.leave(c)
    }
    this.queue = []
    toast('Hora do almoço! Ajuste a loja e reabra pela porta')
    sfx('chime')
  }
  endLunch() {
    if (game.phase !== 'lunch' || ui.editing) return
    // quem viria entre 12h e 13h encontrou a porta fechada
    const expected = this.spawnRate() * (LUNCH.end - LUNCH.start)
    const missed = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0)
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id])
    const ticket = pool.reduce((s, p) => s + refOf(p.id), 0) / Math.max(1, pool.length)
    const t = game.today
    t.lunchMissed += missed
    t.customers += missed
    t.lostValue += missed * ticket
    if (missed) t.moods.lunch = (t.moods.lunch || 0) + missed
    game.rep = Math.max(1, game.rep - Math.min(0.2, missed * 0.01))
    game.phase = 'open'
    game.clock = LUNCH.end
    this.spawnAcc = 0
    if (this.thiefTimes) this.thiefTimes = this.thiefTimes.filter((x) => x > game.clock)
    sfx('chime')
    toast(missed ? `Loja reaberta! ${missed} ${missed === 1 ? 'cliente encontrou' : 'clientes encontraram'} a porta fechada` : 'Loja reaberta!', missed ? 'bad' : 'good')
  }
  shopNext(c) {
    if (game.phase === 'closing' || !c.wants.length) return this.checkout(c)
    const w = c.wants.shift()
    const p = PID[w.pid]
    const here = game.shelves.filter((s) => s.product === w.pid && s.price != null)
    const avail = here.filter((s) => s.count > 0).sort((a, b) => a.price - b.price)
    if (!avail.length) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      this.feel(c, p.cold && game.weather === 'hot' ? 'hot' : 'missing'); game.rep = Math.max(1, game.rep - 0.012)
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
      game.today.lostValue += w.qty * refOf(w.pid)
      this.feel(c, 'missing')
    } else if (shelf.price > w.willing) {
      game.today.price[w.pid] = (game.today.price[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      this.feel(c, 'pricey'); game.rep = Math.max(1, game.rep - 0.01)
    } else {
      let q = w.qty
      if (shelf.price < refOf(w.pid) * 0.9 && Math.random() < 0.6) q++
      q = Math.min(q, shelf.count)
      shelf.count -= q
      c.basket.push({ pid: w.pid, qty: q, price: shelf.price })
      this.feel(c, 'bought', 1.2); sfx('pop')
    }
    this.shopNext(c)
  }
  // ---------- cafeteria: o cliente passa nela antes do caixa ----------
  cafeOpen() { return !!game.cafe && game.staff.barista > 0 }
  openCafePanel() { ui.panelCafe = true; ui.panelShelf = null }
  pickCafeItem() {
    let r = Math.random() * CAFE_MENU.reduce((s, m) => s + m.weight, 0)
    for (const m of CAFE_MENU) if ((r -= m.weight) <= 0) return m
    return CAFE_MENU[0]
  }
  goCafe(c) {
    const item = c.cafeOrder, f = shelfAccess(game.cafe)
    c.cafeOrder = null
    if (cafePrice(item.id) > cafeRef(item.id) * rnd(0.85, 1.35)) { // achou caro e desiste do lanche
      game.today.lostValue += cafeRef(item.id)
      this.feel(c, 'pricey')
      return c.setSteps([wait(0.8), call(() => this.checkout(c))])
    }
    c.setSteps([go(f.x, f.z), wait(rnd(2.5, 4)), call(() => this.serveCafe(c, item)), call(() => this.checkout(c))])
  }
  serveCafe(c, item) {
    if (!this.cafeOpen()) return
    const t = game.today, price = cafePrice(item.id)
    game.money += price
    t.revenue += price
    t.cogs += cafeCost(item.id)
    t.cafeSales++
    t.cafeRevenue += price
    if (!c.basket.length) t.served++
    c.hadCafe = true
    c.bubble = money(price); c.bubbleT = 2.6
    this.feel(c, 'cafe', 2.6); sfx('coin')
  }
  checkout(c) {
    if (c.cafeOrder && game.phase === 'open' && this.cafeOpen()) return this.goCafe(c)
    c.cafeOrder = null
    if (!c.basket.length) { if (!c.hadCafe) this.feel(c, 'nothing'); return this.leave(c) }
    if (this.queue.length >= 4) { c.waiting = true; return c.setSteps([wait(1), call(() => this.checkout(c))]) }
    c.waiting = false
    this.queue.push(c)
    c.state = 'queued'; c.qIdx = -1; c.serve = 0
  }
  leave(c) {
    const qi = this.queue.indexOf(c)
    if (qi >= 0) this.queue.splice(qi, 1)
    c.state = 'leaving'; c.waiting = false
    const dt = doorTile(game.plan), di = doorInside(game.plan)
    c.setSteps([go(di.x, di.z), go(dt.x, dt.z), go(c.x < this.d.cols / 2 ? -3 : this.d.cols + 2, this.d.rows + 2), call(() => this.remove(c))])
  }
  remove(c) { const i = this.customers.indexOf(c); if (i >= 0) this.customers.splice(i, 1) }
  completeSale(c) {
    const t = game.today
    let total = 0
    for (const b of c.basket) { total += b.qty * b.price; t.units += b.qty; t.cogs += b.qty * costOf(b.pid); t.sold[b.pid] = (t.sold[b.pid] || 0) + b.qty }
    game.money += total; t.revenue += total; t.served++
    game.rep = Math.min(5, game.rep + 0.02)
    this.feel(c, 'paid', 2.6); sfx('coin')
    c.bubble = money(total); c.bubbleT = 2.6
    c.state = 'paid'
    this.leave(c)
  }

  // tem alguém atendendo? (luz verde no caixa)
  registerStaffed() {
    const c = cashierTile(game.register)
    return this.player.cashiering || this.staff.some((s) => s.role === 'cashier' && s.idle && Math.hypot(s.x - c.x, s.z - c.z) < 0.3)
  }

  // ---------- ladrão: aparece de vez em quando; clicar no balão em 3 segundos evita o roubo ----------
  planThieves() {
    const n = game.day < 2 ? 0 : Math.random() < 0.35 ? 2 : 1
    this.thiefTimes = Array.from({ length: n }, () => rnd(0.15, 0.85) * DAY_SECONDS).filter((t) => t > game.clock).sort((a, b) => a - b)
  }
  spawnThief() {
    if (this.customers.some((c) => c.thief)) return
    const targets = game.shelves.filter((s) => s.count > 0 && s.price != null)
    if (!targets.length) return
    const shelf = targets[Math.floor(Math.random() * targets.length)]
    const { cols, rows } = this.d, left = Math.random() < 0.5
    const c = new Actor({ id: 't' + uid(), kind: 'customer', thief: true, x: left ? -3 : cols + 2, z: rows + 2, speed: 2.2, basket: [], wants: [], patience: 999, waiting: false, hue: Math.random(), felt: new Set() })
    const dt = doorTile(game.plan), di = doorInside(game.plan), a = shelfAccess(shelf)
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => (c.entered = true)), go(a.x, a.z), call(() => this.startTheft(c, shelf))])
    this.customers.push(c)
  }
  startTheft(c, shelf) {
    if (!shelf.count) return this.leave(c)
    if (game.decor.some((d) => d.type === 'camera') && Math.random() < CAMERA_STOP_CHANCE) return this.foilTheft(c, 'A câmera de segurança afastou um ladrão!')
    this.feel(c, 'sneaky', THEFT_SECONDS + 0.2)
    c.theft = { shelf, t: THEFT_SECONDS }
    this.activeTheft = c
  }
  stopTheft() {
    const c = this.activeTheft
    if (!c) return
    this.activeTheft = null
    c.theft = null
    this.foilTheft(c, 'Ladrão impedido!')
  }
  foilTheft(c, msg) {
    game.today.caught++
    game.rep = Math.min(5, game.rep + 0.03)
    this.feel(c, 'caught', 2.4)
    c.speed = 3.2
    sfx('chime')
    toast(msg, 'good')
    this.leave(c)
  }
  finishTheft(c) {
    const { shelf } = c.theft
    this.activeTheft = null
    c.theft = null
    const qty = Math.min(shelf.count, 3 + Math.floor(Math.random() * 4))
    if (qty > 0) {
      const name = PID[shelf.product].name
      shelf.count -= qty
      game.today.stolen += qty * shelf.price
      game.today.stolenUnits += qty
      game.rep = Math.max(1, game.rep - 0.03)
      this.feel(c, 'stole', 2.4)
      toast(`Roubaram ${qty} de ${name}!`, 'bad')
    }
    c.speed = 3.2
    this.leave(c)
  }

  // sempre existe uma caixa vazia no estoque (ou na mão), para poder retirar itens das prateleiras
  ensureEmptyBox() {
    if (!game.boxes.some((b) => b.state === 'empty' && !b.at)) game.boxes.push({ id: uid(), product: null, count: 0, state: 'empty', res: null })
  }

  // ---------- IA de equipe ----------
  ensurePets() {
    if (this.pets.length) { this.pets[0].species = settings.pet; return }
    this.pets.push(new Actor({ id: 'pet1', kind: 'pet', species: settings.pet, x: 6, z: 3, speed: 0.9 }))
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
    for (const role of ['cashier', 'stocker', 'barista']) {
      const have = this.staff.filter((s) => s.role === role)
      for (let i = have.length; i < game.staff[role]; i++) {
        const di = doorInside(game.plan)
        this.staff.push(new Actor({ id: role + uid(), kind: 'staff', role, x: di.x, z: di.z + 1, speed: 2.1, n: i }))
      }
      for (let i = have.length - 1; i >= game.staff[role]; i--) this.staff.splice(this.staff.indexOf(have[i]), 1)
    }
    // caixa reservada por quem foi demitido volta a ficar livre
    for (const b of game.boxes) if (b.res && !this.staff.some((s) => s.id === b.res)) b.res = null
  }
  staffAI(a) {
    if (!a.idle) return
    if (a.role === 'cashier' || a.role === 'barista') {
      const post = a.role === 'cashier' ? game.register : game.cafe
      if (!post) return
      const c = cashierTile(post)
      if (Math.hypot(a.x - c.x, a.z - c.z) > 0.2) a.setSteps([go(c.x, c.z)])
      return
    }
    const M = 1.35
    // caixa que o jogador soltou é dele; a que ele encheu só entra se o produto acabar
    const free = (b, s) => !b.res && !b.at && b.id !== ui.selectedBox && (!b.keep || s.count === 0)
    // primeiro o que está mais vazio: procura o produto aberto, depois fechado, depois na calçada
    for (const s of game.shelves.filter((x) => x.product && x.count < SHELF_CAP).sort((x, y) => x.count - y.count)) {
      const find = (state) => game.boxes.find((b) => b.state === state && b.product === s.product && free(b, s))
      const open = find('open')
      if (open) { open.res = a.id; return a.setSteps(this.shelve(open, s, M, a)) }
      const closed = find('stock')
      if (closed) { closed.res = a.id; return a.setSteps(this.unpack(closed, M, a)) }
      const onDock = !stockFull() && find('dock')
      if (onDock) { onDock.res = a.id; return a.setSteps(this.receive(onDock, M, a)) }
    }
    // sem urgência: cuida do resto da entrega
    const dock = !stockFull() && game.boxes.find((b) => b.state === 'dock' && !b.res)
    if (dock) { dock.res = a.id; return a.setSteps(this.receive(dock, M, a)) }
    const closed = game.boxes.find((b) => b.state === 'stock' && !b.res)
    if (closed) { closed.res = a.id; return a.setSteps(this.unpack(closed, M, a)) }
    const idle = { x: this.room.doorOut.x + 1 + (a.n % 3), z: this.room.doorOut.z }
    if (Math.hypot(a.x - idle.x, a.z - idle.z) > 0.3 && this.walkable(idle.x, idle.z)) a.setSteps([go(idle.x, idle.z)])
  }

  movePlayer(dt) {
    if (ui.editing || ui.modal || this.player.cashiering) return
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
    this.ensureEmptyBox()
    if (ui.atRegister !== this.player.cashiering) ui.atRegister = this.player.cashiering
    // com a loja funcionando, só o botão de pausa para o jogo; telas abertas não param nada
    const live = game.phase === 'open' || game.phase === 'closing'
    if (game.paused || (ui.modal && !live)) return
    const dt = live ? rawDt * game.speed : rawDt

    if (game.phase === 'open') {
      game.clock += dt
      if (game.clock >= DAY_SECONDS) this.closeDoors()
      else if (game.lunchOn && !game.lunchDone && game.clock >= LUNCH.start && game.clock < LUNCH.end) this.startLunch()
      else {
        this.spawnAcc += this.spawnRate() * dt
        while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (this.customers.length < maxCustomers()) this.spawnCustomer() }
        if (!this.thiefTimes) this.planThieves() // jogo carregado com a loja já aberta
        while (this.thiefTimes.length && this.thiefTimes[0] <= game.clock) { this.thiefTimes.shift(); this.spawnThief() }
      }
    } else if (game.phase === 'closing') {
      this.closeGrace += dt
      if (!this.customers.length || this.closeGrace > 150) { this.customers = []; this.queue = []; this.endDay() }
    }

    // o tempo do roubo não acelera no 2×: são sempre 3 segundos de verdade para reagir
    if (this.activeTheft && (this.activeTheft.theft.t -= rawDt) <= 0) this.finishTheft(this.activeTheft)

    // fila
    const qt = this.queueTiles
    this.queue.forEach((c, i) => {
      if (c.qIdx !== i) { c.qIdx = i; c.setSteps([go(qt[i].x, qt[i].z)]) }
    })
    for (const c of [...this.customers]) {
      if (c.state === 'queued' || c.waiting) {
        c.patience -= dt
        if (c.patience < 20 && !c.emote) this.feel(c, 'impatient', 1.5)
        if (c.patience <= 0) {
          game.today.patience++
          game.today.lostValue += c.basket.reduce((s, b) => s + b.qty * b.price, 0)
          game.rep = Math.max(1, game.rep - 0.04)
          this.feel(c, 'angry'); this.leave(c)
        }
      }
    }
    // atendimento
    const ct = cashierTile(game.register)
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
