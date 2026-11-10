import { game, ui, hooks, toast, newStats, uid, wages, save, stockFull, money, settings, costOf, refOf, demandOf, rollMarket, cafePrice, cafeCost, cafeRef, customersPerDay, maxCustomers, shelfCap, hasPerk, gainXp, cafeMenu, productPrice, clockText } from './state.js'
import { PRODUCTS, PID, DAY_SECONDS, PACK, MOODS, PETS, CAMERA_STOP_CHANCE, CAFE, LUNCH, SHELF_BOOST, FENG_SHUI, ARCADE, NIGHT_LIGHTS, DELIVERY, PET, TEAM, FREEZER, TECH, DIRT, DOORMAT, DECOR, canStockProduct } from './config.js'
import { onDuty, isOff, walkMult, workMult, serveMult, gainMemberXp, restTeam, teamMorning, ensureCandidates } from './team.js'
import { makeGoals, checkGoals } from './goals.js'
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

  get actors() { return [this.player, ...this.staff, ...this.customers, ...this.pets, ...(this.tech ? [this.tech] : [])] }

  // ---------- grade / caminhos ----------
  refreshGrid() {
    this.d = dims(game.plan)
    this.room = stockRoom(game.plan)
    this.blocked = new Set()
    game.shelves.forEach((s) => this.blocked.add(key(s.x, s.z)))
    game.decor.forEach((d) => { if (!DECOR[d.type]?.wall) this.blocked.add(key(d.x, d.z)) })
    if (game.cafe) this.blocked.add(key(game.cafe.x, game.cafe.z))
    const reg = game.register
    if (reg) {
      this.blocked.add(key(reg.x, reg.z))
      this.queueTiles = queueTiles(game.plan, reg, this.blocked) || Array(4).fill(shelfAccess(reg))
    }
    if (game.dirt.length) game.dirt = game.dirt.filter((d) => this.walkable(d.x, d.z) && d.z < this.d.rows)
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
    const units = Math.min(box.count, shelfCap() - shelf.count)
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
    const n = Math.min(box.count, shelfCap() - shelf.count)
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

  // valida se o produto pode ficar neste tipo de móvel/expositor
  wrongPlace(box, shelf) {
    if (canStockProduct(box.product, shelf)) return null
    const p = PID[box.product]
    const kind = shelf.kind || (shelf.fridge ? 'fridge' : 'shelf')
    // onde o produto vai (só carnes e gelados usam refrigeração; hortifruti vai no expositor; o resto na prateleira comum)
    const need = p.section === 'produce' ? 'no expositor de hortifruti' : p.section === 'meat' ? 'no freezer de carnes' : p.cold ? 'no freezer' : 'na prateleira comum'
    const here = kind === 'meat' ? 'no freezer de carnes' : kind === 'produce' ? 'no expositor de hortifruti' : kind === 'fridge' ? 'no freezer' : 'na prateleira comum'
    return `${p.name} não vai ${here}. O lugar certo é ${need}`
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
      if (shelf.count >= shelfCap()) return toast('Prateleira cheia', 'bad')
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
  // clicar no bichinho abre o menu: carinho (grátis) ou petisco (custa um pouco e dura mais)
  openPetMenu() {
    if (!this.pets[0]) return
    ui.petMenu = ui.petMenu ? null : { x: ui.mouse.x, y: ui.mouse.y }
    ui.panelShelf = null; ui.panelCafe = false
  }
  // o bichinho espera, o jogador chega ao lado e faz carinho ou dá o petisco
  cmdPet(mode = 'pat') {
    const pet = this.pets[0], p = this.player
    ui.petMenu = null
    if (!pet) return
    if (mode === 'treat' && game.money < PET.treatCost) return toast('Caixa insuficiente para o petisco', 'bad')
    const beside = this.besideTile(pet.x, pet.z)
    const near = this.close(p, pet.x, pet.z, 1.3)
    pet.setSteps([wait(near ? 3 : 8)])
    this.cmd([...(near || !beside ? [] : [go(beside.x, beside.z)]), call(() => (p.face = Math.atan2(pet.x - p.x, pet.z - p.z))), work(0.9, mode === 'treat' ? 'Dando petisco' : 'Fazendo carinho', () => {
      const name = PETS[pet.species].name
      if (mode === 'treat') {
        if (game.money < PET.treatCost) return toast('Caixa insuficiente para o petisco', 'bad')
        game.money -= PET.treatCost
      }
      pet.happy = Math.max(pet.happy || 0, mode === 'treat' ? PET.treat : PET.pat)
      pet.heartT = 0
      pet.say(mode === 'treat' ? '😋' : '❤️', 2.4)
      pet.setSteps([wait(0.8)])
      sfx('pop')
      toast(mode === 'treat' ? `${name} amou o petisco e saiu correndo pela loja! A equipe trabalha mais animada` : `${name} adorou o carinho e saiu correndo pela loja! A equipe trabalha mais animada`, 'good')
    })])
  }
  // bichinho feliz às vezes encontra dinheiro esquecido ou um produto caído no chão
  petFind(pet) {
    const t = game.today
    if (t.petFinds >= PET.findsPerDay || Math.random() > PET.findChance) return
    t.petFinds++
    const name = PETS[pet.species].name
    const shelves = game.shelves.filter((s) => s.product && s.count < shelfCap())
    if (shelves.length && Math.random() < 0.35) {
      const s = shelves[Math.floor(Math.random() * shelves.length)]
      const n = Math.min(1 + Math.floor(Math.random() * 3), shelfCap() - s.count)
      s.count += n
      pet.say('🎁', 2.4)
      toast(`🐾 ${name} achou ${n} ${PID[s.product].name} ${n === 1 ? 'caído' : 'caídos'} no chão: de volta à prateleira!`, 'good')
    } else {
      const v = Math.round(rnd(2, 10))
      game.money += v
      t.petFound += v
      pet.bubble = money(v); pet.bubbleT = 2.6
      pet.say('💰', 2.4)
      toast(`🐾 ${name} achou ${money(v)} esquecidos no chão!`, 'good')
    }
    sfx('coin')
  }
  // pet feliz contagia a equipe: andam e trabalham mais rápido
  get petBoost() { return this.pets.some((p) => p.happy > 0) ? PET.staffBoost : 1 }
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
    for (const d of game.dirt) cands.push({ kind: 'dirt', id: d.id, x: d.x + d.ox, z: d.z + d.oz })
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
    else if (t.kind === 'pet') this.openPetMenu()
    else if (t.kind === 'dirt') this.cmdClean(game.dirt.find((x) => x.id === t.id))
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
    checkGoals(true)
    const t = game.today
    const w = wages()
    game.money -= w
    this.activeTheft = null
    this.thiefTimes = null
    game.summary = {
      day: game.day, revenue: t.revenue, cogs: t.cogs, wages: w, profit: t.revenue - t.cogs - w - t.stolen - t.maintenance - t.spoiledValue,
      maintenance: t.maintenance, spoiled: t.spoiled, spoiledValue: t.spoiledValue, cleaned: t.cleaned, dirty: t.dirty,
      goals: game.goals.map((g) => ({ text: g.text, done: g.done, xp: g.xp })),
      stolen: t.stolen, stolenUnits: t.stolenUnits, caught: t.caught, cafeSales: t.cafeSales, cafeRevenue: t.cafeRevenue, lunchMissed: t.lunchMissed,
      deliveries: t.deliveries || 0, deliveryRevenue: t.deliveryRevenue || 0, arcadeRevenue: t.arcadeRevenue || 0, petFound: t.petFound || 0, impulse: t.impulse || 0,
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
    for (const o of game.pending) for (let i = 0; i < o.boxes; i++, n++) game.boxes.push({ id: uid(), product: o.product, count: o.size || PACK, state: 'dock', res: null })
    game.pending = []
    ui.modal = null
    if (n) toast(`Entrega chegou: ${n} caixas na calçada`, 'good')
    this.overnightSpoil()
    teamMorning()
    makeGoals()
    save()
  }

  // ---------- clientes ----------
  spawnRate() {
    const h = this.hour
    const curve = h < 11 ? 0.8 : h < 14 ? 1.3 : h < 17 ? 0.8 : h < 20 ? 1.5 : 0.7
    const stocked = new Set(game.shelves.filter((s) => s.count > 0 && s.price != null).map((s) => s.product)).size
    const variety = Math.max(0.35, Math.min(1.5, 0.35 + 0.16 * stocked))
    const rep = 0.5 + game.rep * 0.17
    let lightsMult = 1
    if (h >= NIGHT_LIGHTS.from && hasPerk('lights')) {
      const lightsCount = game.decor.filter((d) => NIGHT_LIGHTS.types.includes(d.type)).length
      lightsMult = 1 + Math.min(NIGHT_LIGHTS.max, lightsCount * NIGHT_LIGHTS.each)
    }
    const clean = 1 - DIRT.spawn * this.dirtiness()
    return (customersPerDay() / DAY_SECONDS) * (curve / 1.09) * variety * rep * lightsMult * clean
  }
  spawnCustomer() {
    const { cols, rows } = this.d
    const left = Math.random() < 0.5
    const c = new Actor({ id: 'c' + uid(), kind: 'customer', x: left ? -3 : cols + 2, z: rows + 2, speed: rnd(1.6, 2.1), basket: [], wants: [], patience: PATIENCE, waiting: false, hue: Math.random(), felt: new Set() })
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id])
    const maxItems = hasPerk('basket2') ? 5 : hasPerk('basket1') ? 4 : 3
    const n = Math.min(pool.length, 1 + Math.floor(Math.random() * maxItems))
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
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => { c.entered = true; this.feel(c, this.firstImpression(c), 2); this.maybeDirt(c, 'mud') }), wait(1), call(() => this.shopNext(c))])
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
    // loja suja estraga a primeira impressão de parte dos clientes
    const dirty = this.dirtiness()
    if (dirty > DIRT.feel && Math.random() < dirty) {
      game.today.dirty++
      game.rep = Math.max(1, game.rep - DIRT.rep)
      return 'dirty'
    }
    const found = c.wants.filter((w) => game.shelves.some((s) => s.product === w.pid && this.sellable(s) && s.price <= w.willing)).length
    if (!found) return 'empty'
    if (found < c.wants.length) return 'meh'
    const fill = game.shelves.reduce((n, s) => n + s.count, 0) / Math.max(1, game.shelves.length * shelfCap())
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
    restTeam(TEAM.lunchRest)
    toast('Hora do almoço! A equipe descansa. Ajuste a loja e reabra pela porta')
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
    const avail = game.shelves.filter((s) => s.product === w.pid && this.sellable(s)).sort((a, b) => a.price - b.price)
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
    const bInfo = SHELF_BOOST[shelf.boost || 0] || SHELF_BOOST[0]
    const maxPay = w.willing * (bInfo.willing || 1)
    if (shelf.count <= 0 || shelf.product !== w.pid || shelf.broken) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      this.feel(c, 'missing')
    } else if (shelf.price > maxPay) {
      game.today.price[w.pid] = (game.today.price[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      this.feel(c, 'pricey'); game.rep = Math.max(1, game.rep - 0.01)
    } else {
      let q = w.qty
      if (shelf.price < refOf(w.pid) * 0.9 && Math.random() < 0.6) q++
      q = Math.min(q, shelf.count)
      shelf.count -= q
      this.useFreezer(shelf, q)
      c.basket.push({ pid: w.pid, qty: q, price: shelf.price })
      this.feel(c, 'bought', 1.2); sfx('pop')
      this.maybeDirt(c, 'spill')
      this.checkImpulse(c, shelf)
    }
    this.shopNext(c)
  }
  checkImpulse(c, currentShelf) {
    const nearby = game.shelves.filter((s) => s !== currentShelf && this.sellable(s) && s.product && (s.boost || 0) > 0 && Math.hypot(s.x - c.x, s.z - c.z) <= 2.5)
    for (const ns of nearby) {
      const bInfo = SHELF_BOOST[ns.boost]
      if (Math.random() < (bInfo.impulse || 0) && !c.basket.some((b) => b.pid === ns.product)) {
        const takeQty = 1
        ns.count -= takeQty
        this.useFreezer(ns, takeQty)
        c.basket.push({ pid: ns.product, qty: takeQty, price: ns.price })
        game.today.impulse = (game.today.impulse || 0) + 1
        this.feel(c, 'impulse', 1.5)
        sfx('pop')
        break
      }
    }
  }
  // ---------- cafeteria: o cliente passa nela antes do caixa ----------
  cafeOpen() { return !!game.cafe && onDuty('barista') > 0 }
  openCafePanel() { ui.panelCafe = true; ui.panelShelf = null }
  pickCafeItem() {
    const list = cafeMenu()
    if (!list.length) return null
    let r = Math.random() * list.reduce((s, m) => s + m.weight, 0)
    for (const m of list) if ((r -= m.weight) <= 0) return m
    return list[0]
  }
  goCafe(c) {
    const item = c.cafeOrder, f = shelfAccess(game.cafe)
    c.cafeOrder = null
    if (cafePrice(item.id) > cafeRef(item.id) * rnd(0.85, 1.35)) { // achou caro e desiste do lanche
      game.today.lostValue += cafeRef(item.id)
      this.feel(c, 'pricey')
      return c.setSteps([wait(0.8), call(() => this.checkout(c))])
    }
    const barista = this.staff.find((s) => s.role === 'barista')
    c.setSteps([go(f.x, f.z), call(() => (c.atCafe = true)), wait(rnd(2.5, 4) * (barista ? workMult(barista.member) : 1)), call(() => { c.atCafe = false; this.serveCafe(c, item) }), call(() => this.checkout(c))])
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
    for (const b of this.staff) if (b.role === 'barista') gainMemberXp(b.member, 1)
    this.maybeDirt(c, 'crumbs')
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
    c.atCafe = false
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
    gainXp(1)
    for (const a of this.staff) if (a.role === 'cashier' && a.serving) gainMemberXp(a.member, 1)
    this.feel(c, 'paid', 2.6); sfx('coin')
    c.bubble = money(total); c.bubbleT = 2.6
    c.state = 'paid'
    this.leave(c)
  }

  hasFengShui() {
    if (!hasPerk('plants') || !game.register) return false
    const r = game.register
    return game.decor.some((d) => d.type === 'plant' && Math.hypot(d.x - r.x, d.z - r.z) <= FENG_SHUI.radius)
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

  // fliperama e máquina de dança geram renda passiva em moedas a cada cliente que passa por perto
  updateArcade(dt) {
    if (!hasPerk('arcade') || (game.phase !== 'open' && game.phase !== 'closing')) return
    const arcades = game.decor.filter((d) => ARCADE.types.includes(d.type))
    if (!arcades.length) return
    for (const c of this.customers) {
      if (!c.entered || c.arcadeCool > 0) {
        if (c.arcadeCool > 0) c.arcadeCool -= dt
        continue
      }
      for (const a of arcades) {
        if (Math.hypot(c.x - a.x, c.z - a.z) <= ARCADE.radius) {
          const coin = Math.round(rnd(ARCADE.min, ARCADE.max) * 2) / 2
          game.money += coin
          game.today.arcadeRevenue = (game.today.arcadeRevenue || 0) + coin
          game.today.revenue += coin
          c.arcadeCool = rnd(15, 30)
          this.feel(c, 'arcade', 1.8)
          sfx('coin')
          break
        }
      }
    }
  }

  // Zap da Lojinha: pedidos de delivery
  updateDelivery(dt) {
    if (!game.zapOn || onDuty('courier') <= 0 || game.phase !== 'open') return
    this.delivAcc = (this.delivAcc || 0) + dt
    const openOrders = game.orders.filter((o) => o.state === 'waiting' || o.state === 'packing')
    if (this.delivAcc >= 10 && openOrders.length < DELIVERY.maxOpen && Math.random() < DELIVERY.rate) {
      this.delivAcc = 0
      this.spawnDeliveryOrder()
    }
  }
  spawnDeliveryOrder() {
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id] && game.shelves.some((s) => s.product === p.id && this.sellable(s)))
    if (!pool.length) return
    const items = []
    const count = 1 + Math.floor(Math.random() * 2)
    const bag = [...pool]
    for (let i = 0; i < count && bag.length; i++) {
      const p = bag.splice(Math.floor(Math.random() * bag.length), 1)[0]
      const price = productPrice(p.id) ?? refOf(p.id)
      items.push({ pid: p.id, qty: 1 + Math.floor(Math.random() * 2), price })
    }
    const id = uid()
    const total = items.reduce((s, it) => s + it.qty * it.price, 0) + DELIVERY.fee
    const order = { id, items, total, state: 'waiting', time: clockText(), name: `Cliente #${Math.floor(rnd(100, 999))}` }
    game.orders.unshift(order)
    if (game.orders.length > 20) game.orders.pop()
    toast(`📱 Novo pedido no Zap da Lojinha: ${money(total)}!`, 'good')
    sfx('chime')
  }
  completeDelivery(order) {
    order.state = 'done'
    const t = game.today
    t.deliveries = (t.deliveries || 0) + 1
    t.deliveryRevenue = (t.deliveryRevenue || 0) + order.total
    t.revenue += order.total
    for (const it of order.items) {
      t.units += it.qty
      t.cogs += it.qty * costOf(it.pid)
      t.sold[it.pid] = (t.sold[it.pid] || 0) + it.qty
    }
    game.money += order.total
    game.rep = Math.min(5, game.rep + 0.03)
    gainXp(1)
    for (const a of this.staff) if (a.role === 'courier') gainMemberXp(a.member, 2)
    toast(`🛵 Entrega do Zap concluída! Recebeu ${money(order.total)}`, 'good')
    sfx('coin')
  }
  ensureEmptyBox() {
    if (!game.boxes.some((b) => b.state === 'empty' && !b.at)) game.boxes.push({ id: uid(), product: null, count: 0, state: 'empty', res: null })
  }

  // ---------- sujeira: clientes sujam, quem limpa é o jogador ou o faxineiro ----------
  dirtiness() { return Math.min(1, game.dirt.reduce((s, d) => s + d.level, 0) / DIRT.full) }
  maybeDirt(c, type) {
    if (c.thief) return
    let chance = type === 'mud' ? DIRT.enter : type === 'spill' ? DIRT.spill : DIRT.crumbs
    let x = Math.round(c.x), z = Math.round(c.z)
    if (type === 'mud') {
      // o tapete segura boa parte da sujeira; com frio (chão molhado) entra mais
      if (game.doormat) chance *= DOORMAT.dirt
      chance *= game.weather === 'cold' ? 1.3 : game.weather === 'hot' ? 0.8 : 1
      const di = doorInside(game.plan)
      const near = [[0, -1], [-1, -1], [1, -1], [0, -2], [-1, 0], [1, 0], ...(game.doormat ? [] : [[0, 0]])]
        .map(([dx, dz]) => ({ x: di.x + dx, z: di.z + dz })).filter((t) => this.walkable(t.x, t.z))
      if (near.length) ({ x, z } = near[Math.floor(Math.random() * near.length)])
    }
    if (Math.random() < chance) this.addDirt(x, z, type)
  }
  addDirt(x, z, type) {
    if (!this.walkable(x, z) || z >= this.d.rows || inStock(game.plan, x, z)) return
    const at = game.dirt.find((d) => d.x === x && d.z === z)
    if (at) { at.level = Math.min(3, at.level + 1); return }
    if (game.dirt.length >= DIRT.max) return
    game.dirt.push({ id: uid(), x, z, type, level: 1, ox: rnd(-0.2, 0.2), oz: rnd(-0.2, 0.2), rot: rnd(0, Math.PI * 2), res: null })
  }
  cleanSpot(spot, who) {
    const i = game.dirt.findIndex((d) => d.id === spot.id)
    if (i < 0) return
    game.dirt.splice(i, 1)
    game.today.cleaned++
    sfx('pop')
    if (who?.member) gainMemberXp(who.member, 1)
  }
  cmdClean(spot) {
    if (!spot) return
    const near = this.close(this.player, spot.x, spot.z, 1.2)
    this.cmd([...(near ? [] : [go(spot.x, spot.z)]), work(DIRT.clean, 'Limpando', () => this.cleanSpot(spot, this.player))])
  }
  cleanerAI(a, M) {
    const spot = game.dirt.filter((d) => !d.res).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0]
    if (spot) {
      spot.res = a.id
      return a.setSteps([go(spot.x, spot.z), work(DIRT.clean * M, 'Limpando', () => this.cleanSpot(spot, a)), call(() => { spot.res = null })])
    }
    const idle = { x: this.room.doorOut.x + 1 + (a.n % 4), z: this.room.doorOut.z + 1 }
    if (Math.hypot(a.x - idle.x, a.z - idle.z) > 0.3 && this.walkable(idle.x, idle.z)) a.setSteps([go(idle.x, idle.z)])
  }

  // ---------- freezers: o motor gasta com o uso; quebrado, não vende e os gelados estragam ----------
  sellable(s) { return s.count > 0 && s.price != null && !s.broken }
  useFreezer(s, units) { if (s.fridge && !s.broken) s.wear = Math.min(100, (s.wear || 0) + units * FREEZER.wearPerUnit) }
  updateFreezers(dt) {
    const hot = game.weather === 'hot' ? FREEZER.hot : 1
    for (const s of game.shelves) {
      if (!s.fridge || s.x < 0) continue
      if (s.broken) {
        s.brokenT = (s.brokenT || 0) + dt
        if (s.count > 0 && s.brokenT > FREEZER.spoilAfter) {
          s.spoilAcc = (s.spoilAcc || 0) + dt
          while (s.spoilAcc >= FREEZER.spoilEvery && s.count > 0) { s.spoilAcc -= FREEZER.spoilEvery; this.spoil(s, 1) }
        }
        continue
      }
      if (s.count <= 0) continue // vazio, o motor descansa
      s.wear = Math.min(100, (s.wear || 0) + FREEZER.wearPerSec * hot * dt)
      const risk = (s.wear - FREEZER.risk) / (100 - FREEZER.risk)
      if (s.wear >= 100 || (risk > 0 && Math.random() < risk * FREEZER.breakRate * dt)) this.breakFreezer(s)
    }
  }
  breakFreezer(s) {
    Object.assign(s, { broken: true, brokenT: 0, spoilAcc: 0, spoilWarned: false })
    if (s.call === 'service') { s.call = 'repair'; s.callCost = TECH.repair }
    toast(`O freezer${s.product ? ` de ${PID[s.product].name}` : ''} quebrou! Chame o técnico antes que os gelados estraguem`, 'bad')
  }
  spoil(s, n) {
    const k = Math.min(n, s.count)
    if (!k) return
    if (!s.spoilWarned) { s.spoilWarned = true; toast(`Os gelados do freezer quebrado começaram a estragar`, 'bad') }
    game.today.spoiled += k
    game.today.spoiledValue += k * costOf(s.product)
    s.count -= k
  }
  // a noite inteira desligado: metade do que estava no freezer quebrado se perde
  overnightSpoil() {
    let n = 0
    for (const s of game.shelves) if (s.fridge && s.broken && s.count > 0) { const k = Math.ceil(s.count * FREEZER.overnight); s.spoilWarned = true; this.spoil(s, k); n += k }
    if (n) toast(`O freezer quebrado passou a noite desligado: ${n} ${n === 1 ? 'item estragou' : 'itens estragaram'}`, 'bad')
  }
  serviceCost(s) { return s.broken ? TECH.repair : Math.round(TECH.serviceBase + (s.wear || 0) * TECH.servicePerWear) }
  callTech(s) {
    if (!s?.fridge || s.call || (!s.broken && (s.wear || 0) < FREEZER.serviceMin)) return
    s.call = s.broken ? 'repair' : 'service'
    s.callCost = this.serviceCost(s)
    toast(`Técnico chamado para ${s.broken ? 'consertar' : 'revisar'} o freezer. Ele cobra ${money(s.callCost)} no fim do serviço`, 'good')
  }
  callTechAll() { for (const s of game.shelves) if (s.fridge && !s.call && (s.broken || s.wear >= FREEZER.warn)) this.callTech(s) }
  // o técnico vem da rua alguns segundos depois de chamado
  updateTech(dt) {
    const jobs = game.shelves.some((s) => s.call)
    if (this.tech || !jobs) { if (!jobs) this.techT = null; return }
    if (this.techT == null) this.techT = rnd(TECH.arrive[0], TECH.arrive[1])
    if ((this.techT -= dt) > 0) return
    this.techT = null
    const left = Math.random() < 0.5
    this.tech = new Actor({ id: 'tech' + uid(), kind: 'tech', x: left ? -3 : this.d.cols + 2, z: this.d.rows + 2, speed: 2.2, job: null })
    toast('O técnico de refrigeração chegou')
  }
  techAI(a) {
    if (!a.idle) return
    const { cols, rows } = this.d
    if (a.leaving) {
      const dt = doorTile(game.plan), di = doorInside(game.plan)
      return a.setSteps([...(a.z < rows - 0.5 ? [go(di.x, di.z), go(dt.x, dt.z)] : []), go(a.x < cols / 2 ? -3 : cols + 2, rows + 2), call(() => { this.tech = null })])
    }
    let s = a.job && a.job.call && game.shelves.includes(a.job) ? a.job : null
    if (!s) s = game.shelves.filter((x) => x.call && x.x >= 0).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z))[0]
    if (!s) { a.leaving = true; a.note = null; return }
    a.job = s
    const acc = shelfAccess(s)
    if (Math.hypot(a.x - acc.x, a.z - acc.z) > 0.35) { s.techAt = 'walking'; return a.setSteps([go(acc.x, acc.z)]) }
    s.techAt = 'working'
    a.face = Math.atan2(s.x - a.x, s.z - a.z)
    const repair = !!s.broken
    a.note = repair ? 'Consertando' : 'Revisando'
    a.setSteps([work(repair ? TECH.repairTime : TECH.serviceTime, a.note, () => this.finishTech(a, s))])
  }
  finishTech(a, s) {
    a.note = null
    a.job = null
    if (!s.call) return
    const cost = s.callCost ?? this.serviceCost(s), repaired = !!s.broken
    game.money -= cost
    game.today.maintenance += cost
    Object.assign(s, { wear: 0, broken: false, brokenT: 0, spoilAcc: 0, spoilWarned: false, call: null, callCost: null, techAt: null })
    a.bubble = '-' + money(cost); a.bubbleT = 2.6
    sfx('coin')
    toast(`${repaired ? 'Freezer consertado' : 'Revisão do freezer feita'}: ${money(cost)} pagos ao técnico`, 'good')
  }

  // ---------- energia da equipe: gasta trabalhando, o pet animado ajuda a recuperar ----------
  updateEnergy(dt) {
    this.energyAcc = (this.energyAcc || 0) + dt
    if (this.energyAcc < 0.5) return
    const t = this.energyAcc, pet = this.petBoost > 1
    this.energyAcc = 0
    const cafeBusy = this.customers.some((c) => c.atCafe)
    for (const a of this.staff) {
      const m = a.member
      if (!m) continue
      const busy = !a.idle || a.serving || (a.role === 'barista' && cafeBusy)
      const drain = (busy ? TEAM.drainBusy : TEAM.drainIdle) * (m.gear ? 0.6 : 1)
      m.energy = Math.max(0, Math.min(100, m.energy - drain * t + (pet ? TEAM.petRest * t : 0)))
    }
  }

  // ---------- IA de equipe ----------
  ensurePets() {
    if (this.pets.length) { this.pets[0].species = settings.pet; return }
    this.pets.push(new Actor({ id: 'pet1', kind: 'pet', species: settings.pet, x: 6, z: 3, speed: 0.9 }))
  }
  petAI(a) {
    if (a.happy > 0) {
      a.happy -= 0.05
      a.speed = 2.4
      if (Math.random() < 0.02) a.say('❤️', 1.8)
      if (Math.random() < 0.01) this.petFind(a)
    } else {
      a.speed = 0.9
    }
    if (!a.idle) return
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(rnd(0, this.d.cols)), z = Math.floor(rnd(0, this.d.rows))
      if (this.walkable(x, z)) return a.setSteps([go(x, z), wait(rnd(a.happy > 0 ? 0.8 : 2, a.happy > 0 ? 2.5 : 8))])
    }
  }
  ensureStaff() {
    this.ensurePets()
    // um ator por funcionário que trabalha hoje; quem foi demitido ou está de folga sai da loja
    const present = new Map(game.team.filter((m) => !isOff(m)).map((m) => [m.id, m]))
    for (let i = this.staff.length - 1; i >= 0; i--) {
      const a = this.staff[i], m = present.get(a.id)
      if (m) { a.member = m; present.delete(a.id) } else this.staff.splice(i, 1)
    }
    for (const m of present.values()) {
      const di = doorInside(game.plan), courier = m.role === 'courier'
      this.staff.push(new Actor({ id: m.id, kind: 'staff', role: m.role, member: m, x: courier ? this.d.doorX + 3.6 : di.x, z: courier ? this.d.rows + 1.2 : di.z + 1, speed: 2.1 }))
    }
    let n = 0
    for (const a of this.staff) if (a.role === 'stocker' || a.role === 'cleaner') a.n = n++
    // caixa e sujeira reservadas por quem saiu voltam a ficar livres
    for (const b of game.boxes) if (b.res && !this.staff.some((s) => s.id === b.res)) b.res = null
    for (const d of game.dirt) if (d.res && !this.staff.some((s) => s.id === d.res)) d.res = null
  }
  staffAI(a) {
    if (!a.idle) return
    const m = a.member
    a.speed = 2.1 * walkMult(m) * this.petBoost
    if (a.role === 'courier') {
      const motoSpot = { x: this.d.doorX + 3.6, z: this.d.rows + 1.2 }
      const readyOrder = game.orders.find((o) => o.state === 'ready')
      if (readyOrder && !readyOrder.delivering) {
        readyOrder.delivering = true
        readyOrder.state = 'delivering'
        const dur = rnd(DELIVERY.ride[0], DELIVERY.ride[1]) / walkMult(m)
        a.say('🛵', dur)
        return a.setSteps([
          go(this.d.cols + 6, this.d.rows + 1.2),
          wait(dur),
          go(motoSpot.x, motoSpot.z),
          call(() => this.completeDelivery(readyOrder))
        ])
      }
      if (Math.hypot(a.x - motoSpot.x, a.z - motoSpot.z) > 0.4) {
        return a.setSteps([go(motoSpot.x, motoSpot.z)])
      }
      return
    }
    if (a.role === 'cashier' || a.role === 'barista') {
      const post = a.role === 'cashier' ? game.register : game.cafe
      if (!post) return
      const c = cashierTile(post)
      if (Math.hypot(a.x - c.x, a.z - c.z) > 0.2) a.setSteps([go(c.x, c.z)])
      return
    }
    const M = workMult(m) / this.petBoost
    if (a.role === 'cleaner') return this.cleanerAI(a, M)
    // cada tarefa concluída rende experiência para o funcionário
    const xp = (steps) => [...steps, call(() => gainMemberXp(m, 1))]
    // repositor: se houver pedido de delivery aguardando separação, ele separa se houver estoque
    const waitingOrder = game.orders.find((o) => o.state === 'waiting')
    if (waitingOrder) {
      const canFulfill = waitingOrder.items.every((it) => {
        const total = game.shelves.filter((s) => s.product === it.pid && !s.broken).reduce((sum, s) => sum + s.count, 0)
        return total >= it.qty
      })
      if (canFulfill) {
        waitingOrder.state = 'packing'
        const st = stockStand(game.plan)
        return a.setSteps(xp([
          go(st.x, st.z),
          work(2.5 * M, 'Separando pedido de delivery', () => {
            for (const it of waitingOrder.items) {
              let need = it.qty
              for (const s of game.shelves.filter((s) => s.product === it.pid && !s.broken)) {
                const take = Math.min(need, s.count)
                s.count -= take
                this.useFreezer(s, take)
                need -= take
                if (need <= 0) break
              }
            }
            waitingOrder.state = 'ready'
            toast(`📦 Pedido ${waitingOrder.name} embalado pelo repositor!`, 'info')
            sfx('pop')
          })
        ]))
      }
    }
    // caixa que o jogador soltou é dele; a que ele encheu só entra se o produto acabar
    const free = (b, s) => !b.res && !b.at && b.id !== ui.selectedBox && (!b.keep || s.count === 0)
    // primeiro o que está mais vazio: procura o produto aberto, depois fechado, depois na calçada
    for (const s of game.shelves.filter((x) => x.product && x.count < shelfCap()).sort((x, y) => x.count - y.count)) {
      const find = (state) => game.boxes.find((b) => b.state === state && b.product === s.product && free(b, s))
      const open = find('open')
      if (open) { open.res = a.id; return a.setSteps(xp(this.shelve(open, s, M, a))) }
      const closed = find('stock')
      if (closed) { closed.res = a.id; return a.setSteps(xp(this.unpack(closed, M, a))) }
      const onDock = !stockFull() && find('dock')
      if (onDock) { onDock.res = a.id; return a.setSteps(xp(this.receive(onDock, M, a))) }
    }
    // sem urgência: cuida do resto da entrega
    const dock = !stockFull() && game.boxes.find((b) => b.state === 'dock' && !b.res)
    if (dock) { dock.res = a.id; return a.setSteps(xp(this.receive(dock, M, a))) }
    const closed = game.boxes.find((b) => b.state === 'stock' && !b.res)
    if (closed) { closed.res = a.id; return a.setSteps(xp(this.unpack(closed, M, a))) }
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

    this.updateDelivery(dt)
    this.updateArcade(dt)
    this.updateTech(dt)
    if (live) { this.updateFreezers(dt); this.updateEnergy(dt) }
    // metas do dia e catálogo de candidatos: conferidos duas vezes por segundo
    this.goalT = (this.goalT || 0) + dt
    if (this.goalT > 0.5) {
      this.goalT = 0
      if (game.goalsDay !== game.day) makeGoals()
      if (live) checkGoals()
      if (!game.candidates.length) ensureCandidates()
    }

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
        const decay = this.hasFengShui() ? dt / FENG_SHUI.patience : dt
        c.patience -= decay
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
    for (const a of this.staff) a.serving = false
    for (const a of [this.player, ...this.staff.filter((s) => s.role === 'cashier')]) {
      const dist = Math.hypot(a.x - ct.x, a.z - ct.z)
      const ok = a.kind === 'player' ? a.cashiering && dist < 2.3 && !a.moving : dist < 0.3 && a.idle
      if (!ok) continue
      if (a.kind === 'player') { rate += 1 / 1.1; playerServing = true }
      else { rate += serveMult(a.member) / 1.7; a.serving = !!headReady }
    }
    if (headReady && rate > 0) {
      head.serve += dt * rate
      if (playerServing) this.player.work = { label: 'Atendendo', p: Math.min(1, head.serve) }
      if (head.serve >= 1) this.completeSale(head)
    } else if (this.player.cashiering) this.player.work = null

    for (const a of this.staff) this.staffAI(a)
    for (const a of this.pets) this.petAI(a)
    if (this.tech) this.techAI(this.tech)
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
