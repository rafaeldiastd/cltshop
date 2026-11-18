import { game, ui, hooks, toast, newStats, uid, wages, save, stockFull, money, settings, costOf, refOf, demandOf, rollMarket, cafePrice, cafeCost, cafeRef, customersPerDay, maxCustomers, shelfCap, hasPerk, gainXp, cafeMenu, productPrice, clockText, modeMods, regionMods, daySeconds, branchDailyProfit, stockInfo, boxCost, stockFree, pranksLeft, usePrankQuota, syncShelfBatches, addShelfBatch, consumeShelfStock, transferStockBatches, effectiveShelfPrice, logVisitorAction, mergeArcadeScores } from './state.js'
import { PRODUCTS, PID, DAY_SECONDS, PACK, MOODS, PETS, CAMERA_STOP_CHANCE, CAFE, LUNCH, SHELF_BOOST, FENG_SHUI, ARCADE, NIGHT_LIGHTS, DELIVERY, PET, TEAM, FREEZER, TECH, DIRT, DOORMAT, DECOR, canStockProduct, shelfLifeOf, ROBBERY } from './config.js'
import { onDuty, isOff, walkMult, workMult, serveMult, skillSpeed, energyDrain, gainMemberXp, restTeam, teamMorning, ensureCandidates } from './team.js'
import { makeGoals, checkGoals, checkBigGoals } from './goals.js'
import { mp, broadcastClean, broadcastPet, broadcastPrank, sendEmote } from './multiplayer.js'
import { dims, cashierTile, queueTiles, doorTile, doorInside, shelfAccess, shelfPoint, stockStand, stockRoom, inStock, boxSlots, isUsable, isArcade, isGridPlan, planCell, canCrossGridEdge } from './layout.js'
import { sfx } from './audio.js'
import { hoverText } from './texts.js'
import { newNpcIdentity, npcInfo, staffInfo } from './npc.js'
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
    Object.assign(this, { x: 0, z: 0, path: null, steps: [], speed: 2.3, face: 0, moving: false, work: null, emote: null, emoteT: 0, bubble: null, bubbleT: 0, anim: null, pose: null }, o)
  }
  setSteps(steps) { this.steps = steps; this.path = null; this.work = null; this.pose = null }
  // clipe de ação que toca uma vez (pick-up, emote-yes...); o renderer só reage quando o seq muda
  play(name) { this.anim = { name, seq: (this.anim?.seq || 0) + 1 } }
  get idle() { return this.steps.length === 0 }
  say(e, t = 2.2) { this.emote = e; this.emoteT = t }
  update(dt, world) {
    if (this.emoteT > 0 && (this.emoteT -= dt) <= 0) this.emote = null
    if (this.bubbleT > 0 && (this.bubbleT -= dt) <= 0) this.bubble = null
    if (this.kind === 'visitor' || (window.__visiting && this.remoteSync)) return
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
    this.camAngle = null
    this.remoteActors = []
    this.robberyTimes = null
    this.playerIdleT = 0
    this.cashierEmptyT = 0
    this.pomoPrepT = 0
    hooks.refreshGrid = () => this.refreshGrid()
    hooks.shiftActors = (dx, dz) => this.shiftActors(dx, dz)
    hooks.beforeSave = () => { game.playerPos = { x: this.player.x, z: this.player.z, face: this.player.face } }
    hooks.getPlayerState = () => ({ x: this.player.x, z: this.player.z, face: this.player.face, moving: this.player.moving, emote: this.player.emote, anim: this.player.anim })
    hooks.setPlayerPos = (x, z, face = 0) => { this.player.x = x; this.player.z = z; this.player.face = face; this.player.setSteps([]) }
    hooks.sayEmote = (e, t = 3) => this.player.say(e, t)
    hooks.sayChat = (entry) => { this.player.chat = entry }
    hooks.showBubble = (text, emote) => {
      this.player.bubble = text
      this.player.bubbleT = 2.6
      if (emote) this.player.say(emote, 2.4)
    }
    hooks.resetEntities = () => { this.customers = []; this.queue = []; this.staff = []; this.pets = []; this.activeTheft = null; this.tech = null; this.remoteActors = []; this.remoteEntities = null }
    const r2 = (n) => Math.round((n || 0) * 100) / 100
    hooks.getHostEntities = () => ({
      pets: this.pets.map((p) => ({ id: p.id, species: p.species, x: r2(p.x), z: r2(p.z), face: r2(p.face), moving: p.moving, emote: p.emote })),
      staff: this.staff.map((s) => ({
        id: s.id, role: s.role,
        member: s.member ? { id: s.member.id, name: s.member.name, g: s.member.g, look: s.member.look, role: s.member.role } : null,
        x: r2(s.x), z: r2(s.z), face: r2(s.face), moving: s.moving, emote: s.emote, pose: s.pose, anim: s.anim,
      })),
      customers: this.customers.map((c) => ({
        id: c.id, name: c.name, age: c.age, g: c.g, look: c.look, hue: c.hue,
        robber: !!c.robber, thief: !!c.thief,
        x: r2(c.x), z: r2(c.z), face: r2(c.face), moving: c.moving, emote: c.emote, bubble: c.bubble, bubbleT: c.bubbleT, anim: c.anim,
      })),
    })
    hooks.syncHostEntities = (ent) => { this.remoteEntities = ent }
    hooks.remoteClean = (x, z, fromName, fromCode) => {
      const idx = game.dirt.findIndex((d) => Math.round(d.x) === Math.round(x) && Math.round(d.z) === Math.round(z))
      if (idx >= 0) {
        game.dirt.splice(idx, 1)
        game.today.cleaned++
        if (!window.__visiting && fromName) {
          logVisitorAction({
            actorName: fromName,
            storeCode: fromCode,
            emoji: '🧹',
            text: `${fromName} limpou uma sujeira na sua loja!`,
            kind: 'good',
          })
        }
      }
    }
    hooks.remotePet = (fromName, fromCode) => {
      const pet = this.pets[0]
      if (!pet) return
      pet.happy = Math.max(pet.happy || 0, PET.pat)
      pet.say('❤️', 2.4)
      pet.setSteps([wait(0.8)])
      if (!window.__visiting) {
        logVisitorAction({
          actorName: fromName,
          storeCode: fromCode,
          emoji: '🐾',
          text: `${fromName || 'Visitante'} fez carinho em ${PETS[pet.species]?.name || 'seu pet'}!`,
          kind: 'good',
        })
      }
    }
    hooks.remotePrank = ({ x, z, action, newPrice, fromName, fromCode }) => {
      const actor = fromName || 'Visitante'
      if (action === 'pee') {
        game.dirt.push({ id: uid(), x, z, type: 'pee', level: 2, ox: 0, oz: 0, rot: 0, res: null, prankedBy: actor })
        if (!window.__visiting) {
          logVisitorAction({
            actorName: actor,
            storeCode: fromCode,
            emoji: '🚽',
            text: `${actor} mijou no chão da sua loja!`,
            kind: 'bad',
          })
          sfx('bad')
        }
        return
      }
      const s = game.shelves.find((sh) => sh.x === x && sh.z === z)
      if (!s || !s.product) return
      const pName = PID[s.product]?.name || 'produto'
      if (action === 'swap_price' || action === 'unprice') {
        s.price = newPrice != null ? newPrice : 0
        s.prankedBy = actor
        if (!window.__visiting) {
          logVisitorAction({
            actorName: actor,
            storeCode: fromCode,
            emoji: '🏷️',
            text: `${actor} trocou o preço da prateleira (${pName}) para ${money(s.price)}!`,
            kind: 'warn',
          })
          sfx('bad')
        }
      } else if (action === 'unstock' && s.count > 0) {
        const pid = s.product, qty = s.count
        s.prankedBy = actor
        if (window.__visiting) {
          s.count = 0; s.product = null; s.daysLeft = null; s.batches = []
          return
        }
        for (const b of game.boxes) {
          if (s.count <= 0) break
          if (b.state === 'open' && b.product === pid && b.count < PACK) {
            transferStockBatches(s, b, PACK - b.count)
          }
        }
        while (s.count > 0) {
          const empty = game.boxes.find((b) => b.state === 'empty' && !b.res)
          if (empty) {
            Object.assign(empty, { product: pid, count: 0, state: 'open', keep: false, daysLeft: null, batches: [] })
            transferStockBatches(s, empty, PACK)
          } else if (!stockFull()) {
            const nb = { id: uid(), product: pid, count: 0, state: 'open', daysLeft: null, batches: [] }
            transferStockBatches(s, nb, PACK)
            game.boxes.push(nb)
          } else break
        }
        if (s.count <= 0) { s.product = null; s.daysLeft = null; s.batches = [] }
        logVisitorAction({
          actorName: actor,
          storeCode: fromCode,
          emoji: '📦',
          text: `${actor} tirou ${qty}× ${pName} da prateleira e devolveu às caixas!`,
          kind: 'warn',
        })
        sfx('bad')
      }
    }
    hooks.remoteArcadePlay = ({ x, z, decorType, score, holder, fromCode, storeName, fee, scores }) => {
      const d = game.decor.find((it) => (it.x === x && it.z === z) || (it.type === decorType && isArcade(it)))
      if (!window.__visiting && fee > 0) {
        game.money += fee
        game.today.arcadeRevenue = (game.today.arcadeRevenue || 0) + fee
        this.player.bubble = money(fee)
        this.player.bubbleT = 2.6
        sfx('coin')
      }
      const isRec = d ? mergeArcadeScores(d, { holder, storeName, storeCode: fromCode, score }, scores) : false
      const machineName = DECOR[d?.type || decorType]?.name || 'fliperama'
      if (!window.__visiting) {
        if (isRec) {
          logVisitorAction({
            actorName: holder,
            storeCode: fromCode,
            emoji: '🏆',
            text: `${holder} bateu o recorde do ${machineName} com ${score} pts${fee > 0 ? ` (+${money(fee)})` : ''}!`,
            kind: 'good',
          })
        } else if (fee > 0 || score > 0) {
          logVisitorAction({
            actorName: holder,
            storeCode: fromCode,
            emoji: '🕹️',
            text: `${holder} jogou no ${machineName} (${score} pts)${fee > 0 ? ` e pagou ${money(fee)}` : ''}!`,
            kind: 'info',
          })
        }
      }
    }
    this.refreshGrid()
  }

  get actors() { return [this.player, ...this.staff, ...this.customers, ...this.pets, ...this.remoteActors, ...(this.tech ? [this.tech] : [])] }

  // ---------- grade / caminhos ----------
  refreshGrid() {
    this.d = dims(game.plan)
    this.room = stockRoom(game.plan)
    this.blocked = new Set()
    game.shelves.forEach((s) => this.blocked.add(key(s.x, s.z)))
    game.decor.forEach((d) => { if (!DECOR[d.type]?.wall && !DECOR[d.type]?.ceiling) this.blocked.add(key(d.x, d.z)) }) // parede e teto não ocupam o chão
    if (game.cafe) this.blocked.add(key(game.cafe.x, game.cafe.z))
    const reg = game.register
    if (reg) {
      this.blocked.add(key(reg.x, reg.z))
      this.queueTiles = queueTiles(game.plan, reg, this.blocked) || Array(4).fill(shelfAccess(reg))
    } else {
      this.queueTiles = []
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
    if (isGridPlan(game.plan)) {
      const cx = Math.round(x), cz = Math.round(z)
      return corners.every(([dx, dz]) => {
        const tx = Math.round(x + dx), tz = Math.round(z + dz)
        if (tx !== cx && !canCrossGridEdge(game.plan, cx, cz, tx, cz)) return false
        if (tz !== cz && !canCrossGridEdge(game.plan, cx, cz, cx, tz)) return false
        if (tx !== cx && tz !== cz && (!canCrossGridEdge(game.plan, tx, cz, tx, tz) || !canCrossGridEdge(game.plan, cx, tz, tx, tz))) return false
        return true
      })
    }
    const sides = corners.map(([dx, dz]) => inStock(game.plan, x + dx, z + dz))
    if (sides.every((s) => s === sides[0])) return true
    // encostando na parede do estoque: só atravessa pelo vão da porta
    return Math.abs(x - this.room.wallX) <= r && Math.abs(z - this.room.door.z) <= 0.5 - r
  }
  // a parede separa dois lugares vizinhos, exceto na porta
  canStep(ax, az, bx, bz) {
    if (isGridPlan(game.plan)) return canCrossGridEdge(game.plan, ax, az, bx, bz)
    if (inStock(game.plan, ax, az) === inStock(game.plan, bx, bz)) return true
    const { door, doorOut } = this.room
    return (ax === door.x && az === door.z && bx === doorOut.x && bz === doorOut.z) || (bx === door.x && bz === door.z && ax === doorOut.x && az === doorOut.z)
  }
  walkable(x, z) {
    const { cols, rows, doorX } = this.d
    if (z < 0) return false
    if (game.plan.built === false) return z <= rows + 2 && x >= -3 && x <= cols + 2
    if (isGridPlan(game.plan)) {
      if (z <= rows - 1) return x >= 0 && x <= cols - 1 && !this.blocked.has(key(x, z))
      if (z <= rows + 2) return x >= -3 && x <= cols + 2
      return false
    }
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
    return [call((w) => { w.pose = 'holding-right' }), ...steps, work((0.5 + 0.08 * units) * m, 'Repondo prateleira', (who) => this.doShelve(box, shelf, who)), call((w) => { box.res = null; w.pose = null })]
  }
  doShelve(box, shelf, who) {
    if (!game.boxes.includes(box) || box.state !== 'open') return
    if (this.wrongPlace(box, shelf)) return toast(this.wrongPlace(box, shelf), 'bad')
    if (shelf.product && shelf.product !== box.product && shelf.count > 0) return toast('Essa prateleira já tem outro produto', 'bad')
    const n = Math.min(box.count, shelfCap() - shelf.count)
    if (n <= 0) return toast('Prateleira cheia', 'bad')
    if (shelf.product !== box.product) { shelf.product = box.product; shelf.price = game.priceMemory[box.product] ?? null; shelf.batches = [] }
    transferStockBatches(box, shelf, n)
    sfx('pop')
    who?.play?.('pick-up')
    if (box.count <= 0) {
      const autoEmpty = game.mode === 'lofi' && game.pomodoro?.autoPilot && ui.selectedBox !== box.id
      if (who?.kind === 'player' && !autoEmpty) { box.state = 'empty'; box.product = null; box.keep = false; box.batches = []; box.daysLeft = null }
      else {
        game.boxes.splice(game.boxes.indexOf(box), 1)
        if (ui.selectedBox === box.id) ui.selectedBox = null
      }
    } else toast(`Sobraram ${box.count} na caixa`, 'info')
    if (shelf.price == null && who?.kind === 'player') {
      if (game.mode === 'lofi' && game.pomodoro?.autoPilot) {
        shelf.price = refOf(shelf.product)
        game.priceMemory[shelf.product] = shelf.price
      } else {
        ui.panelShelf = shelf.id
        toast('Defina o preço dessa prateleira')
      }
    }
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
    box.product = shelf.product
    box.batches = []
    box.count = 0
    const n = transferStockBatches(shelf, box, PACK)
    box.state = 'open'
    box.keep = true // retirada de propósito: o repositor só usa se o produto acabar
    if (!shelf.count) { shelf.product = null; shelf.price = null; shelf.daysLeft = null; shelf.batches = [] } // esvaziada de propósito fica livre
    sfx('pop')
    toast(`${n} ${PID[box.product].name} ${n === 1 ? 'foi' : 'foram'} para a caixa`)
  }

  // ---------- comandos do jogador ----------
  // no caixa o jogador fica preso até clicar em "Sair do caixa"
  cmd(steps) { if (!this.player.cashiering) { this.playerIdleT = 0; this.player.setSteps(steps) } }
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
    if (!game.register) return
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
      addShelfBatch(s, n, shelfLifeOf(s.product))
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
  // computador abre a tela de gestão; rádio abre o painel de música; fliperama/pinball/dança abrem o painel lateral com ranking
  cmdUse(d) {
    if (!isUsable(d) && !isArcade(d)) return
    if (window.__visiting && !isArcade(d)) return
    const open = () => {
      if (isArcade(d)) {
        ui.panelArcade = d.id
        ui.arcadeDecorId = d.id
        ui.panelShelf = null
        ui.panelCafe = false
        ui.npc = null
        ui.npcInfo = null
      } else if (d.type === 'computer') ui.modal = 'computer'
      else ui.musicPanel = true
    }
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
  cmdVisitPet() {
    const pet = this.pets[0], p = this.player
    if (!pet) return
    const beside = this.besideTile(pet.x, pet.z)
    const near = this.close(p, pet.x, pet.z, 1.3)
    pet.setSteps([wait(near ? 3 : 6)])
    this.cmd([...(near || !beside ? [] : [go(beside.x, beside.z)]), call(() => {
      p.face = Math.atan2(pet.x - p.x, pet.z - p.z)
      p.play('emote-yes')
      p.say('❤️', 2.2)
      pet.happy = Math.max(pet.happy || 0, PET.pat)
      pet.say('❤️', 2.4)
      pet.setSteps([wait(0.8)])
      sfx('pop')
      const name = PETS[pet.species]?.name || 'o pet'
      toast(`🐾 Você fez carinho em ${name}!`, 'good')
      broadcastPet()
    })])
  }
  cmdPeeFloor() {
    if (!window.__visiting) return
    if ((game.career?.earned || 0) < 1) return toast('🔒 Alcance o Nível 1 (dando gorjetas ou na sua loja) para liberar: Mijar no Chão!', 'bad')
    if (pranksLeft() <= 0) return toast('😈 Você já usou suas 3 bagunças de hoje (UTC)! Volte amanhã.', 'bad')
    if (!usePrankQuota()) return
    const p = this.player
    const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10
    p.play('emote-yes')
    sendEmote('🚽')
    sfx('bad')
    game.dirt.push({ id: uid(), x, z, type: 'pee', level: 2, ox: 0, oz: 0, rot: 0, res: null })
    toast(`🚽 Você mijou no chão da loja! (${pranksLeft()}/3 restantes hoje)`, 'good')
    broadcastPrank({ x, z, action: 'pee' })
  }
  cmdPrankShelf(shelf) {
    if (shelf?.product === 'lock') {
      return toast('🔒 Alcance o Nível 2 para liberar: Esvaziar Prateleira! (Ou use Trocar Preço)', 'bad')
    }
    if (!shelf || !shelf.product) return toast('Escolha uma prateleira com produtos para bagunçar!', 'info')
    if (pranksLeft() <= 0) return toast('😈 Você já usou suas 3 bagunças de hoje (UTC)! Volte amanhã.', 'bad')
    const wantUnstock = ui.prankMode === 'unstock'
    if (wantUnstock && (game.career?.earned || 0) < 2) {
      return toast('🔒 Alcance o Nível 2 para liberar: Esvaziar Prateleira! (Ou use Trocar Preço)', 'bad')
    }
    const action = wantUnstock && shelf.count > 0 ? 'unstock' : 'swap_price'
    const st = shelfAccess(shelf), pt = shelfPoint(shelf)
    this.cmd([...(this.close(this.player, pt.x, pt.z, 1.7) ? [] : [go(st.x, st.z)]), work(1.1, 'Bagunçando…', () => {
      if (!shelf.product) return
      if (!usePrankQuota()) return toast('😈 Limite de 3 bagunças diárias atingido!', 'bad')
      const pName = PID[shelf.product]?.name || 'produto'
      this.player.play('pick-up')
      sendEmote('😈')
      sfx('pop')
      if (action === 'swap_price') {
        const ref = refOf(shelf.product)
        const newPrice = Math.random() < 0.5
          ? Math.max(0.5, Math.round(ref * 0.25 * 2) / 2)
          : Math.round(ref * 2.8 * 2) / 2
        shelf.price = newPrice
        toast(`🏷️ Você trocou o preço de ${pName} para ${money(newPrice)}! (${pranksLeft()}/3 restantes hoje)`, 'good')
        broadcastPrank({ x: shelf.x, z: shelf.z, action: 'swap_price', newPrice })
      } else {
        shelf.count = 0
        shelf.product = null
        shelf.daysLeft = null
        shelf.batches = []
        toast(`📦 Você esvaziou a prateleira de ${pName}! (${pranksLeft()}/3 restantes hoje)`, 'good')
        broadcastPrank({ x: shelf.x, z: shelf.z, action: 'unstock' })
      }
    })])
  }

  // ---------- interação por proximidade (tecla E) ----------
  computeTarget() {
    const p = this.player
    if (ui.modal || ui.editing || p.cashiering) return null
    const cands = []
    if (window.__visiting) {
      for (const s of game.shelves) if (s.product) cands.push({ kind: 'shelf', id: s.id, ...shelfPoint(s) })
      for (const a of this.pets) cands.push({ kind: 'pet', id: a.id, x: a.x, z: a.z })
      for (const d of game.dirt) cands.push({ kind: 'dirt', id: d.id, x: d.x + d.ox, z: d.z + d.oz })
      for (const d of game.decor) if (isArcade(d)) cands.push({ kind: 'decor', id: d.id, x: d.x, z: d.z })
    } else {
      const carrying = game.boxes.find((b) => b.id === ui.selectedBox)
      const slots = boxSlots(game.boxes, game.plan)
      if (!carrying) for (const b of game.boxes) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
      else for (const b of game.boxes) if ((b.state === 'open' || b.state === 'empty') && b.id !== carrying.id) { const q = slots.get(b.id); cands.push({ kind: 'box', id: b.id, x: q.x + 0.3, z: q.z + 0.3 }) }
      for (const s of game.shelves) cands.push({ kind: 'shelf', id: s.id, ...shelfPoint(s) })
      if (game.register) cands.push({ kind: 'counter', id: 'c', x: game.register.x, z: game.register.z })
      if (game.plan.built !== false && (game.phase === 'prep' || game.phase === 'lunch')) { const di = doorInside(game.plan); cands.push({ kind: 'door', id: 'door', x: di.x, z: di.z + 0.6 }) }
      for (const a of this.pets) cands.push({ kind: 'pet', id: a.id, x: a.x, z: a.z })
      for (const d of game.dirt) cands.push({ kind: 'dirt', id: d.id, x: d.x + d.ox, z: d.z + d.oz })
      if (game.cafe) cands.push({ kind: 'cafe', id: game.cafe.id, x: game.cafe.x, z: game.cafe.z })
      for (const d of game.decor) if (isUsable(d) || isArcade(d)) cands.push({ kind: 'decor', id: d.id, x: d.x, z: d.z })
    }
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
    if (window.__visiting) {
      if (t.kind === 'dirt') { this.cmdClean(game.dirt.find((x) => x.id === t.id)); return true }
      if (t.kind === 'pet') { this.cmdVisitPet(); return true }
      if (t.kind === 'shelf') { this.cmdPrankShelf(game.shelves.find((x) => x.id === t.id)); return true }
      if (t.kind === 'decor') {
        const d = game.decor.find((x) => x.id === t.id)
        if (d && isArcade(d)) { this.cmdUse(d); return true }
      }
      return false
    }
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
    if (game.plan.built === false) return toast('🏗️ Construa sua loja e seu estoque antes de abrir!', 'bad')
    game.phase = 'open'
    game.clock = 0
    this.spawnAcc = 0
    this.closeGrace = 0
    game.lunchDone = false
    this.planThieves()
    toast('Loja aberta!', 'good')
    sfx('chime')
  }
  closeEarly() { if (game.phase === 'open') game.clock = daySeconds() }
  get hour() { return 9 + (game.clock / daySeconds()) * 12 }

  updateExpiration() {
    if (!modeMods().expiration) return
    let boxSpoiled = 0, shelfAutoDiscarded = 0, shelfExpiredLeft = 0, expiringSoon = 0
    for (let i = game.boxes.length - 1; i >= 0; i--) {
      const b = game.boxes[i]
      if (b.state === 'empty' || !b.product || b.count <= 0) continue
      syncShelfBatches(b)
      for (const bt of b.batches) bt.daysLeft--
      const expQty = b.batches.filter((bt) => bt.daysLeft <= 0).reduce((sum, bt) => sum + bt.count, 0)
      if (expQty > 0) {
        boxSpoiled += expQty
        game.today.expired += expQty
        game.today.expiredValue += expQty * costOf(b.product)
        b.batches = b.batches.filter((bt) => bt.daysLeft > 0)
        syncShelfBatches(b)
        if (b.count <= 0) game.boxes.splice(i, 1)
      } else {
        syncShelfBatches(b)
      }
    }
    const hasStocker = game.team.some((m) => m.role === 'stocker')
    // o que está guardado no inventário continua vencendo, como se estivesse na prateleira
    const stored = (game.inventory?.shelves || []).filter((s) => !game.shelves.includes(s))
    for (const s of [...game.shelves, ...stored]) {
      if (!s.product || s.count <= 0) { s.daysLeft = null; s.batches = []; continue }
      syncShelfBatches(s)
      for (const bt of s.batches) bt.daysLeft--
      const expQty = s.batches.filter((bt) => bt.daysLeft <= 0).reduce((sum, bt) => sum + bt.count, 0)
      if (expQty > 0) {
        if (hasStocker) {
          shelfAutoDiscarded += expQty
          game.today.expired += expQty
          game.today.expiredValue += expQty * costOf(s.product)
          s.batches = s.batches.filter((bt) => bt.daysLeft > 0)
          syncShelfBatches(s)
          if (s.count <= 0) { s.product = null; s.price = null }
        } else {
          syncShelfBatches(s)
          shelfExpiredLeft++
        }
      } else {
        syncShelfBatches(s)
        if (s.daysLeft === 1) expiringSoon++
      }
    }
    if (boxSpoiled) toast(`🗑️ ${boxSpoiled} unidades no estoque venceram e foram descartadas`, 'bad')
    if (shelfAutoDiscarded) toast(`📦 Repositores descartaram ${shelfAutoDiscarded} itens vencidos das prateleiras`, 'info')
    if (shelfExpiredLeft) toast(`⚠️ ${shelfExpiredLeft} prateleira(s) com produto vencido! Descarte no painel`, 'bad')
    if (expiringSoon) toast(`⏰ ${expiringSoon} prateleira(s) vencem hoje! Faça promoção −30%`, 'info')
  }

  endDay() {
    checkGoals(true)
    const t = game.today
    const w = wages()
    game.money -= w
    let branchProfit = 0
    for (const b of game.branches || []) branchProfit += branchDailyProfit(b)
    if (branchProfit !== 0) {
      game.money += branchProfit
      t.branchRevenue = branchProfit
    }
    this.activeTheft = null
    this.thiefTimes = null
    this.robberyTimes = null
    game.summary = {
      day: game.day, revenue: t.revenue, cogs: t.cogs, wages: w,
      profit: t.revenue + (t.branchRevenue || 0) - t.cogs - w - t.stolen - t.maintenance - t.spoiledValue - (t.expiredValue || 0) - (t.sanitaryFine || 0),
      maintenance: t.maintenance, spoiled: t.spoiled, spoiledValue: t.spoiledValue, cleaned: t.cleaned, dirty: t.dirty,
      expired: t.expired || 0, expiredValue: t.expiredValue || 0, sanitaryFine: t.sanitaryFine || 0, branchRevenue: t.branchRevenue || 0,
      goals: game.goals.map((g) => ({ text: g.text, done: g.done, xp: g.xp })),
      stolen: t.stolen, stolenUnits: t.stolenUnits, caught: t.caught, cafeSales: t.cafeSales, cafeRevenue: t.cafeRevenue, lunchMissed: t.lunchMissed,
      deliveries: t.deliveries || 0, deliveryRevenue: t.deliveryRevenue || 0, arcadeRevenue: t.arcadeRevenue || 0, petFound: t.petFound || 0, impulse: t.impulse || 0,
      customers: t.customers, served: t.served, units: t.units, sold: { ...t.sold },
      oos: { ...t.oos }, price: { ...t.price }, patience: t.patience, lostValue: t.lostValue, rep: game.rep, moods: { ...t.moods },
    }
    game.phase = 'night'
    rollMarket()
    this.player.setSteps([]); this.player.cashiering = false
    if (game.mode === 'lofi') {
      if (!game.pomodoro) game.pomodoro = { focusMin: 25, breakMin: 5, autoCycle: true, autoRestock: true, autoPilot: true, sessions: 0 }
      game.pomodoro.sessions = (game.pomodoro.sessions || 0) + 1
      if (game.pomodoro.autoRestock) {
        let ordered = 0
        for (const p of PRODUCTS.filter((x) => game.unlocked[x.id])) {
          const info = stockInfo(p.id)
          if (info.shelves + info.boxes + info.incoming < PACK && stockFree() > 0 && game.money - boxCost(p.id) > 150) {
            game.money -= boxCost(p.id)
            const o = game.pending.find((x) => x.product === p.id && (x.size || PACK) === PACK)
            if (o) o.boxes++
            else game.pending.push({ product: p.id, boxes: 1, size: PACK })
            ordered++
          }
        }
        if (ordered) toast(`🎧 Lo-Fi: ${ordered} caixa(s) pedida(s) automaticamente para amanhã`, 'info')
      }
      if (game.pomodoro.autoCycle) ui.pomoBreakLeft = Math.max(10, (game.pomodoro.breakMin || 5) * 60)
    }
    ui.modal = 'summary'
    sfx('chime')
  }
  startNextDay() {
    ui.pomoBreakLeft = 0
    this.pomoPrepT = 0
    game.day++
    game.phase = 'prep'
    game.clock = 0
    game.today = newStats()
    game.dayUnlocked = { ...game.unlocked }
    let n = 0
    for (const o of game.pending) for (let i = 0; i < o.boxes; i++, n++) game.boxes.push({ id: uid(), product: o.product, count: o.size || PACK, state: 'dock', res: null, daysLeft: shelfLifeOf(o.product) })
    game.pending = []
    ui.modal = null
    if (n) toast(`Entrega chegou: ${n} caixas na calçada`, 'good')
    this.overnightSpoil()
    this.updateExpiration()
    teamMorning()
    makeGoals()
    save()
  }

  // ---------- clientes ----------
  spawnRate() {
    const h = this.hour
    const curve = h < 11 ? 0.8 : h < 14 ? 1.3 : h < 17 ? 0.8 : h < 20 ? 1.5 : 0.7
    const stocked = new Set(game.shelves.filter((s) => s.count > 0 && effectiveShelfPrice(s) != null).map((s) => s.product)).size
    const variety = Math.max(0.35, Math.min(1.5, 0.35 + 0.16 * stocked))
    const rep = 0.5 + game.rep * 0.17
    let lightsMult = 1
    if (h >= NIGHT_LIGHTS.from && hasPerk('lights')) {
      const lightsCount = game.decor.filter((d) => NIGHT_LIGHTS.types.includes(d.type)).length
      lightsMult = 1 + Math.min(NIGHT_LIGHTS.max, lightsCount * NIGHT_LIGHTS.each)
    }
    const clean = 1 - DIRT.spawn * this.dirtiness()
    return (customersPerDay() / daySeconds()) * (curve / 1.09) * variety * rep * lightsMult * clean
  }
  spawnCustomer() {
    const { cols, rows } = this.d
    const left = Math.random() < 0.5
    const mm = modeMods(), rm = regionMods()
    const c = new Actor({ id: 'c' + uid(), kind: 'customer', ...newNpcIdentity(), x: left ? -3 : cols + 2, z: rows + 2, speed: rnd(1.6, 2.1), basket: [], wants: [], came: [], issues: [], patience: PATIENCE * mm.patience * rm.patience, waiting: false, hue: Math.random(), felt: new Set() })
    const pool = PRODUCTS.filter((p) => (game.dayUnlocked || game.unlocked)[p.id])
    const maxItems = hasPerk('basket2') ? 5 : hasPerk('basket1') ? 4 : 3
    const n = Math.min(pool.length, 1 + Math.floor(Math.random() * maxItems))
    const bag = [...pool]
    for (let i = 0; i < n && bag.length; i++) {
      const total = bag.reduce((s, p) => s + demandOf(p.id), 0)
      let r = Math.random() * total, pick = bag[0]
      for (const p of bag) { if ((r -= demandOf(p.id)) <= 0) { pick = p; break } }
      bag.splice(bag.indexOf(pick), 1)
      c.wants.push({ pid: pick.id, qty: Math.random() < 0.6 ? 1 : 2, willing: refOf(pick.id) * rnd(0.85, 1.35) * mm.willing * rm.willing })
    }
    c.came = c.wants.map((w) => ({ pid: w.pid, qty: w.qty })) // foto do que veio buscar (wants vai sendo consumido na loja)
    game.today.customers++
    if (this.cafeOpen() && Math.random() < CAFE.chance * (regionMods().cafe ?? 1) * (game.weather === 'cold' ? 1.3 : game.weather === 'hot' ? 0.8 : 1)) c.cafeOrder = this.pickCafeItem()
    c.cafeCame = c.cafeOrder?.name ?? null
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
    const found = c.wants.filter((w) => game.shelves.some((s) => s.product === w.pid && this.sellable(s) && effectiveShelfPrice(s) <= w.willing)).length
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
    const pool = PRODUCTS.filter((p) => (game.dayUnlocked || game.unlocked)[p.id])
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
    const avail = game.shelves.filter((s) => s.product === w.pid && this.sellable(s)).sort((a, b) => (effectiveShelfPrice(a) ?? 999) - (effectiveShelfPrice(b) ?? 999))
    if (!avail.length) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      c.issues.push({ kind: 'unseen', pid: w.pid }) // nem está à venda na loja
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
    const unitPrice = effectiveShelfPrice(shelf)
    if (shelf.count <= 0 || shelf.product !== w.pid || shelf.broken) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      c.issues.push({ kind: 'missing', pid: w.pid }) // a prateleira estava vazia ou quebrada
      this.feel(c, 'missing')
    } else if (modeMods().expiration && shelf.daysLeft != null && shelf.daysLeft <= 0) {
      game.today.oos[w.pid] = (game.today.oos[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      c.issues.push({ kind: 'missing', pid: w.pid })
      this.feel(c, 'expired')
      game.rep = Math.max(1, game.rep - 0.03)
      if (game.mode === 'hardcore' && Math.random() < 0.25) {
        const fine = 80
        game.money -= fine
        game.today.sanitaryFine = (game.today.sanitaryFine || 0) + fine
        sfx('alarm')
        toast('🚨 Fiscalização Sanitária: multa de R$ 80 por produto vencido na prateleira!', 'bad')
      }
    } else if (unitPrice > maxPay) {
      game.today.price[w.pid] = (game.today.price[w.pid] || 0) + w.qty
      game.today.lostValue += w.qty * refOf(w.pid)
      c.issues.push({ kind: 'pricey', pid: w.pid, price: unitPrice, willing: maxPay })
      this.feel(c, 'pricey'); game.rep = Math.max(1, game.rep - 0.01)
    } else {
      let q = w.qty
      if (unitPrice < refOf(w.pid) * 0.9 && Math.random() < 0.6) q++
      q = consumeShelfStock(shelf, Math.min(q, shelf.count))
      this.useFreezer(shelf, q)
      c.basket.push({ pid: w.pid, qty: q, price: unitPrice })
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
        const nsPrice = effectiveShelfPrice(ns)
        const takeQty = consumeShelfStock(ns, 1)
        if (!takeQty) continue
        this.useFreezer(ns, takeQty)
        c.basket.push({ pid: ns.product, qty: takeQty, price: nsPrice })
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
      c.cafeSkipped = { name: item.name, price: cafePrice(item.id) }
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
    if (!c.basket.length) {
      t.served++
      game.lifetime.served = (game.lifetime.served || 0) + 1
    }
    game.lifetime.revenue = (game.lifetime.revenue || 0) + price
    c.hadCafe = true
    c.cafeBuy = { name: item.name, price }
    c.bubble = money(price); c.bubbleT = 2.6
    this.feel(c, 'cafe', 2.6); sfx('coin')
    for (const b of this.staff) if (b.role === 'barista') gainMemberXp(b.member, 1)
    this.maybeDirt(c, 'crumbs')
  }
  checkout(c) {
    if (c.cafeOrder && game.phase === 'open' && this.cafeOpen()) return this.goCafe(c)
    c.cafeOrder = null
    if (!c.basket.length) { if (!c.hadCafe) { this.feel(c, 'nothing'); c.play('emote-no') } return this.leave(c) }
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
    game.lifetime.served = (game.lifetime.served || 0) + 1
    game.lifetime.revenue = (game.lifetime.revenue || 0) + total
    game.rep = Math.min(5, game.rep + 0.02)
    gainXp(1)
    for (const a of this.staff) if (a.role === 'cashier' && a.serving) { gainMemberXp(a.member, 1); a.play('interact-right') }
    if (this.player.cashiering) this.player.play('interact-right')
    c.play('emote-yes')
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

  // ---------- painel do cliente: clicar num cliente mostra o resumo dele; depois que sai, o último resumo fica ----------
  openNpc(id) {
    ui.npc = id; ui.npcInfo = this.npcSnapshot(id)
    ui.panelShelf = null; ui.panelCafe = false
  }
  npcSnapshot(id) {
    const c = this.customers.find((x) => x.id === id)
    if (c) return npcInfo(c)
    const m = game.team.find((x) => x.id === id)
    if (m) return staffInfo(m, this.staff.find((a) => a.id === id))
    if (ui.npcInfo?.id !== id) return null
    return { ...ui.npcInfo, status: ui.npcInfo.kind === 'staff' ? 'Saiu da equipe' : 'Saiu da loja' }
  }

  // ---------- ladrão (furtos evitáveis) e assaltos esporádicos (sem reação manual) ----------
  planThieves() {
    if (!modeMods().thieves) { this.thiefTimes = []; this.robberyTimes = []; return }
    const dur = daySeconds()
    const n = game.day < 2 ? 0 : Math.random() < 0.35 ? 2 : 1
    this.thiefTimes = Array.from({ length: n }, () => rnd(0.15, 0.85) * dur).filter((t) => t > game.clock).sort((a, b) => a - b)
    this.robberyTimes = []
    if (modeMods().robberies && game.day >= ROBBERY.minDay) {
      const chance = (game.mode === 'hardcore' ? ROBBERY.hardcoreChance : ROBBERY.baseChance) * regionMods().crime
      if (Math.random() < chance) this.robberyTimes.push(rnd(0.25, 0.8) * dur)
      this.robberyTimes = this.robberyTimes.filter((t) => t > game.clock).sort((a, b) => a - b)
    }
  }
  spawnThief() {
    if (this.customers.some((c) => c.thief)) return
    const targets = game.shelves.filter((s) => s.count > 0 && s.price != null)
    if (!targets.length) return
    const shelf = targets[Math.floor(Math.random() * targets.length)]
    const { cols, rows } = this.d, left = Math.random() < 0.5
    const c = new Actor({ id: 't' + uid(), kind: 'customer', thief: true, ...newNpcIdentity(), x: left ? -3 : cols + 2, z: rows + 2, speed: 2.2, basket: [], wants: [], came: [], issues: [], patience: 999, waiting: false, hue: Math.random(), felt: new Set() })
    const dt = doorTile(game.plan), di = doorInside(game.plan), a = shelfAccess(shelf)
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => (c.entered = true)), go(a.x, a.z), call(() => this.startTheft(c, shelf))])
    this.customers.push(c)
  }
  spawnRobber() {
    if (this.customers.some((c) => c.robber) || !game.register) return
    const { cols, rows } = this.d, left = Math.random() < 0.5
    const c = new Actor({ id: 'r' + uid(), kind: 'customer', thief: true, robber: true, ...newNpcIdentity(), x: left ? -3 : cols + 2, z: rows + 2, speed: 2.6, basket: [], wants: [], came: [], issues: [], patience: 999, waiting: false, hue: 0.02, felt: new Set() })
    const dt = doorTile(game.plan), di = doorInside(game.plan), a = shelfAccess(game.register)
    c.setSteps([go(dt.x, dt.z), go(di.x, di.z), call(() => (c.entered = true)), go(a.x, a.z), call(() => this.startRobbery(c))])
    this.customers.push(c)
  }
  startTheft(c, shelf) {
    if (!shelf.count) return this.leave(c)
    if (game.decor.some((d) => d.type === 'camera') && Math.random() < CAMERA_STOP_CHANCE) return this.foilTheft(c, 'A câmera de segurança afastou um ladrão!')
    this.feel(c, 'sneaky', THEFT_SECONDS + 0.2)
    c.theft = { shelf, t: THEFT_SECONDS }
    this.activeTheft = c
  }
  startRobbery(c) {
    if (game.decor.some((d) => d.type === 'alarm') && Math.random() < 0.8) {
      game.lifetime.robberiesStopped = (game.lifetime.robberiesStopped || 0) + 1
      sfx('alarm')
      return this.foilTheft(c, '🚨 O alarme policial espantou o assaltante!')
    }
    if (game.decor.some((d) => d.type === 'camera') && Math.random() < 0.35) {
      game.lifetime.robberiesStopped = (game.lifetime.robberiesStopped || 0) + 1
      return this.foilTheft(c, '📹 A câmera de segurança impediu o assalto!')
    }
    sfx('alarm')
    this.feel(c, 'robber', ROBBERY.seconds)
    toast('🔫 Assalto no caixa!', 'bad')
    c.setSteps([wait(ROBBERY.seconds), call(() => this.finishRobbery(c))])
  }
  finishRobbery(c) {
    const amount = Math.min(Math.max(0, game.money), Math.round(rnd(ROBBERY.stealMin, ROBBERY.stealMax) * (1 + game.level * 0.4)))
    if (amount > 0) {
      game.money -= amount
      game.today.stolen += amount
    }
    game.rep = Math.max(1, game.rep - 0.08)
    this.feel(c, 'stole', 2.4)
    sfx('alarm')
    toast(amount > 0 ? `🔫 Assaltaram o caixa! Levaram ${money(amount)}` : '🔫 Tentaram assaltar o caixa, mas estava vazio!', 'bad')
    c.speed = 3.5
    this.leave(c)
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
          const coin = Math.round(rnd(ARCADE.min, ARCADE.max) * (regionMods().arcade ?? 1) * 2) / 2
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
    if (this.delivAcc >= DELIVERY.every) {
      this.delivAcc = 0 // um sorteio por intervalo
      const w = DELIVERY.weather[game.weather] || DELIVERY.weather.mild
      if (openOrders.length < DELIVERY.maxOpen && Math.random() < DELIVERY.rate * w.rate * (regionMods().delivery ?? 1)) this.spawnDeliveryOrder()
    }
  }
  spawnDeliveryOrder() {
    const pool = PRODUCTS.filter((p) => game.unlocked[p.id] && game.shelves.some((s) => s.product === p.id && this.sellable(s)))
    if (!pool.length) return
    const items = []
    const count = 1 + Math.floor(Math.random() * 2)
    const bag = [...pool]
    const dw = (DELIVERY.weather[game.weather] || DELIVERY.weather.mild).drinks // calor: bebidas geladas pesam mais no sorteio
    const weight = (p) => (p.section === 'drink' ? dw : 1)
    for (let i = 0; i < count && bag.length; i++) {
      let r = Math.random() * bag.reduce((t, p) => t + weight(p), 0), k = 0
      while (k < bag.length - 1 && (r -= weight(bag[k])) > 0) k++
      const p = bag.splice(k, 1)[0]
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
    game.lifetime.served = (game.lifetime.served || 0) + 1
    game.lifetime.revenue = (game.lifetime.revenue || 0) + order.total
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
    let chance = (type === 'mud' ? DIRT.enter : type === 'spill' ? DIRT.spill : DIRT.crumbs) * modeMods().dirt * regionMods().dirt
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
    broadcastClean(spot.x, spot.z)
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
  sellable(s) { return s.count > 0 && effectiveShelfPrice(s) != null && !s.broken }
  useFreezer(s, units) { if (s.fridge && !s.broken) s.wear = Math.min(100, (s.wear || 0) + units * FREEZER.wearPerUnit * modeMods().freezerWear * regionMods().freezerWear) }
  updateFreezers(dt) {
    const hot = (game.weather === 'hot' ? FREEZER.hot : 1) * modeMods().freezerWear * regionMods().freezerWear
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
      const drain = (busy ? TEAM.drainBusy : TEAM.drainIdle) * (m.gear ? 0.6 : 1) * energyDrain(m)
      if (busy) m.work = (m.work || 0) + t // segundos ocupado hoje: vira a carga de trabalho
      m.energy = Math.max(0, Math.min(100, m.energy - drain * t + (pet ? TEAM.petRest * t : 0)))
    }
  }

  // ---------- IA de equipe ----------
  ensurePets() {
    const sp = window.__visiting ? (game.visitedPet || settings.pet) : settings.pet
    if (this.pets.length) { this.pets[0].species = sp; return }
    this.pets.push(new Actor({ id: 'pet1', kind: 'pet', species: sp, x: 6, z: 3, speed: 0.9 }))
  }
  petAI(a) {
    if (a.happy > 0) {
      a.happy -= 0.05
      a.speed = 2.4
      if (Math.random() < 0.02) a.say('❤️', 1.8)
      if (!window.__visiting && Math.random() < 0.01) this.petFind(a)
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
    for (const b of game.boxes) if (b.res && b.res !== 'player' && !this.staff.some((s) => s.id === b.res)) b.res = null
    for (const d of game.dirt) if (d.res && d.res !== 'player' && !this.staff.some((s) => s.id === d.res)) d.res = null
    if (this.player.idle && !this.player.work) {
      for (const b of game.boxes) if (b.res === 'player') b.res = null
      for (const d of game.dirt) if (d.res === 'player') d.res = null
    }
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
        const dur = rnd(DELIVERY.ride[0], DELIVERY.ride[1]) / (skillSpeed(m) * (m.energy < 30 ? 0.8 : 1)) // entrega mais rápido com competência
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
    const Mw = workMult(m) / this.petBoost // fator de duração das tarefas: competência 3 = 1, 5 = metade do tempo, 1 = o dobro
    if (a.role === 'cleaner') return this.cleanerAI(a, Mw)
    const M = Mw * 1.35 // tempo de referência do repositor
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
                const take = consumeShelfStock(s, Math.min(need, s.count))
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
    // primeiro o que está mais vazio. Só prateleiras onde o produto cabe: uma com produto incompatível (ou freezer quebrado) não trava as outras
    const pickJob = () => {
      for (const s of game.shelves.filter((x) => x.product && x.count < shelfCap() && !x.broken && canStockProduct(x.product, x)).sort((x, y) => x.count - y.count)) {
        const find = (state) => game.boxes.find((b) => b.state === state && b.product === s.product && free(b, s))
        const open = find('open'); if (open) return { kind: 'shelve', box: open, shelf: s }
        const closed = find('stock'); if (closed) return { kind: 'unpack', box: closed }
        const onDock = !stockFull() && find('dock'); if (onDock) return { kind: 'receive', box: onDock }
      }
      return null
    }
    // fila de tarefas: o sistema sorteia UM repositor livre para a tarefa e só ele vai; se ninguém está livre, a tarefa espera na fila até alguém ficar livre
    const job = pickJob()
    if (!job) this.restockOwner = null
    else {
      const owner = this.restockOwner && this.staff.find((s) => s.id === this.restockOwner)
      if (!owner || owner.role !== 'stocker') {
        const livres = this.staff.filter((s) => s.role === 'stocker' && s.idle && !s.serving)
        const sorteado = livres[Math.floor(Math.random() * livres.length)]
        this.restockOwner = sorteado ? sorteado.id : null
      }
      if (this.restockOwner !== a.id) return // não foi o sorteado: espera
      const st = stockStand(game.plan)
      if (job.kind !== 'receive' && Math.hypot(a.x - st.x, a.z - st.z) > 0.6) return a.setSteps([go(st.x, st.z)])
      job.box.res = a.id
      this.restockOwner = null
      return a.setSteps(xp(job.kind === 'shelve' ? this.shelve(job.box, job.shelf, M, a) : job.kind === 'unpack' ? this.unpack(job.box, M, a) : this.receive(job.box, M, a)))
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
    const rx = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0)
    const rz = (k.has('s') ? 1 : 0) - (k.has('w') ? 1 : 0)
    if (!rx && !rz) return
    this.playerIdleT = 0
    const baseAngle = Math.atan2(0.5, 0.9)
    const rot = (this.camAngle ?? baseAngle) - baseAngle
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const dx = rx * cos + rz * sin
    const dz = -rx * sin + rz * cos
    if (p.steps.length || p.work) p.setSteps([])
    const l = Math.hypot(dx, dz), sp = 3.3 * dt
    const nx = p.x + (dx / l) * sp, nz = p.z + (dz / l) * sp
    if (this.walkAt(nx, p.z)) p.x = nx
    if (this.walkAt(p.x, nz)) p.z = nz
    p.face = Math.atan2(dx, dz)
    p.moving = true
  }

  syncRemoteActors(dt) {
    const list = mp.visitors || []
    const alive = new Set(list.map((v) => v.id))
    this.remoteActors = this.remoteActors.filter((a) => alive.has(a.id))
    for (const v of list) {
      let a = this.remoteActors.find((x) => x.id === v.id)
      if (!a) {
        a = new Actor({ id: v.id, kind: 'visitor', name: v.name, avatar: v.avatar, x: v.x, z: v.z, face: v.face || 0, moving: !!v.moving, emote: v.emote || null, anim: v.anim || null, chat: v.chat || null })
        this.remoteActors.push(a)
      }
      const dist = Math.hypot((v.x ?? a.x) - a.x, (v.z ?? a.z) - a.z)
      const k = Math.min(1, dt * 12)
      a.x += (v.x - a.x) * k
      a.z += (v.z - a.z) * k
      a.face = v.face ?? a.face
      a.moving = Boolean(v.moving || dist > 0.03)
      a.emote = v.emote || null
      if (v.anim) a.anim = v.anim
      if (v.chat) a.chat = v.chat
      a.name = v.name || a.name
      if (v.avatar) a.avatar = v.avatar
    }
  }

  syncRemoteEntities(dt) {
    const ent = this.remoteEntities
    if (!ent) {
      this.ensurePets()
      for (const a of this.pets) { a.remoteSync = false; this.petAI(a) }
      return
    }
    const k = Math.min(1, dt * 10)
    const pList = ent.pets || []
    const pAlive = new Set(pList.map((p) => p.id))
    this.pets = this.pets.filter((a) => pAlive.has(a.id))
    for (const p of pList) {
      let a = this.pets.find((x) => x.id === p.id)
      if (!a) {
        a = new Actor({ id: p.id, kind: 'pet', species: p.species || settings.pet, x: p.x, z: p.z, face: p.face || 0, remoteSync: true })
        this.pets.push(a)
      }
      a.remoteSync = true
      const dist = Math.hypot((p.x ?? a.x) - a.x, (p.z ?? a.z) - a.z)
      a.x += (p.x - a.x) * k
      a.z += (p.z - a.z) * k
      a.face = p.face ?? a.face
      a.moving = Boolean(p.moving || dist > 0.02)
      a.species = p.species || a.species
      a.emote = p.emote || (a.emoteT > 0 ? a.emote : null)
    }
    const sList = ent.staff || []
    const sAlive = new Set(sList.map((s) => s.id))
    this.staff = this.staff.filter((a) => sAlive.has(a.id))
    for (const s of sList) {
      let a = this.staff.find((x) => x.id === s.id)
      if (!a) {
        a = new Actor({ id: s.id, kind: 'staff', role: s.role, member: s.member, x: s.x, z: s.z, face: s.face || 0, remoteSync: true })
        this.staff.push(a)
      }
      a.remoteSync = true
      const dist = Math.hypot((s.x ?? a.x) - a.x, (s.z ?? a.z) - a.z)
      a.x += (s.x - a.x) * k
      a.z += (s.z - a.z) * k
      a.face = s.face ?? a.face
      a.moving = Boolean(s.moving || dist > 0.03)
      a.emote = s.emote || null
      a.pose = s.pose || null
      if (s.anim) a.anim = s.anim
      if (s.member) a.member = s.member
    }
    const cList = ent.customers || []
    const cAlive = new Set(cList.map((c) => c.id))
    this.customers = this.customers.filter((a) => cAlive.has(a.id))
    for (const c of cList) {
      let a = this.customers.find((x) => x.id === c.id)
      if (!a) {
        a = new Actor({ id: c.id, kind: 'customer', name: c.name, age: c.age, g: c.g, look: c.look, hue: c.hue, robber: c.robber, thief: c.thief, x: c.x, z: c.z, face: c.face || 0, remoteSync: true })
        this.customers.push(a)
      }
      a.remoteSync = true
      const dist = Math.hypot((c.x ?? a.x) - a.x, (c.z ?? a.z) - a.z)
      a.x += (c.x - a.x) * k
      a.z += (c.z - a.z) * k
      a.face = c.face ?? a.face
      a.moving = Boolean(c.moving || dist > 0.03)
      a.emote = c.emote || null
      a.bubble = c.bubble || null
      a.bubbleT = c.bubbleT || 1.5
      if (c.anim) a.anim = c.anim
    }
  }

  runLofiAutoPilot(dt) {
    if (game.mode !== 'lofi' || !game.pomodoro?.autoPilot || ui.editing || ui.build || ui.modal) return
    const p = this.player
    if (p.cashiering) {
      if (!this.queue.length && (game.phase === 'open' || game.phase === 'prep')) {
        this.cashierEmptyT += dt
        if (this.cashierEmptyT > 2.5) { p.cashiering = false; p.work = null; this.cashierEmptyT = 0 }
      } else this.cashierEmptyT = 0
      return
    }
    if (!p.idle || p.work) { this.playerIdleT = 0; return }
    if ((game.phase === 'open' || game.phase === 'closing') && this.queue.length > 0 && !this.registerStaffed()) {
      this.cmdServe()
      return
    }
    this.playerIdleT += dt
    if (this.playerIdleT < 1.8) return
    this.playerIdleT = 0

    // 1. Limpar sujeira
    const dirt = game.dirt.find((d) => !d.res)
    if (dirt) { dirt.res = 'player'; this.cmdClean(dirt); return }

    // 2. Se já está segurando uma caixa aberta, repõe a prateleira compatível
    const heldBox = game.boxes.find((b) => b.id === ui.selectedBox)
    if (heldBox?.state === 'open') {
      const sh = game.shelves.find((s) => s.product === heldBox.product && s.count < shelfCap() && !s.broken && canStockProduct(heldBox.product, s))
      if (sh) { heldBox.res = 'player'; this.cmd(this.shelve(heldBox, sh, 1, p)); return }
    }

    // 3. Repor prateleiras já configuradas
    const shelves = game.shelves.filter((x) => x.product && x.count < shelfCap() && !x.broken && canStockProduct(x.product, x)).sort((a, b) => a.count - b.count)
    for (const s of shelves) {
      const free = (b) => !b.res && !b.at && b.product === s.product
      const open = game.boxes.find((b) => b.state === 'open' && free(b))
      if (open) { open.res = 'player'; this.cmd(this.shelve(open, s, 1, p)); return }
      const closed = game.boxes.find((b) => b.state === 'stock' && free(b))
      if (closed) { closed.res = 'player'; this.cmd(this.unpack(closed, 1, p)); return }
      const dock = !stockFull() && game.boxes.find((b) => b.state === 'dock' && free(b))
      if (dock) { dock.res = 'player'; this.cmd(this.receive(dock, 1, p)); return }
    }

    // 4. Receber e desembalar caixas paradas na calçada/estoque
    const dockAny = !stockFull() && game.boxes.find((b) => b.state === 'dock' && !b.res)
    if (dockAny) { dockAny.res = 'player'; this.cmd(this.receive(dockAny, 1, p)); return }
    const stockAny = game.boxes.find((b) => b.state === 'stock' && !b.res)
    if (stockAny) { stockAny.res = 'player'; this.cmd(this.unpack(stockAny, 1, p)); return }

    // 5. Manutenção preventiva dos freezers
    const worn = game.shelves.find((s) => s.fridge && !s.call && (s.broken || (s.wear || 0) >= FREEZER.warn))
    if (worn) this.callTech(worn)
  }

  // ---------- loop ----------
  update(rawDt) {
    this.syncRemoteActors(rawDt)
    if (window.__visiting) {
      this.syncRemoteEntities(rawDt)
      for (const a of this.actors) a.update(rawDt, this)
      this.movePlayer(rawDt)
      this.target = this.computeTarget()
      const prompt = this.target ? hoverText(this.target) : null
      if (prompt !== this._lastPrompt) { this._lastPrompt = prompt; ui.prompt = prompt }
      ui.action = this.player.work ? { ...this.player.work } : null
      return
    }
    if (!game.paused && game.phase === 'night' && game.mode === 'lofi' && game.pomodoro?.autoCycle && ui.pomoBreakLeft > 0) {
      ui.pomoBreakLeft = Math.max(0, ui.pomoBreakLeft - rawDt)
      if (ui.pomoBreakLeft <= 0) this.startNextDay()
    }
    if (ui.npc) { // painel do cliente aberto: atualiza o resumo algumas vezes por segundo
      this.npcT = (this.npcT || 0) - rawDt
      if (this.npcT <= 0) { this.npcT = 0.25; ui.npcInfo = this.npcSnapshot(ui.npc) }
    }
    this.ensureStaff()
    this.ensureEmptyBox()
    if (ui.atRegister !== this.player.cashiering) ui.atRegister = this.player.cashiering
    // com a loja funcionando, só o botão de pausa para o jogo; telas abertas não param nada
    const live = game.phase === 'open' || game.phase === 'closing'
    if (!live && game.paused) game.paused = false
    if (game.paused || (ui.modal && !live)) {
      if (!ui.modal) {
        this.player.update(rawDt, this)
        this.movePlayer(rawDt)
        this.target = this.computeTarget()
        const prompt = this.target ? hoverText(this.target) : null
        if (prompt !== this._lastPrompt) { this._lastPrompt = prompt; ui.prompt = prompt }
      }
      return
    }
    const dt = live ? rawDt * game.speed : rawDt

    this.updateDelivery(dt)
    this.updateArcade(dt)
    this.updateTech(dt)
    if (live) { this.updateFreezers(dt); this.updateEnergy(dt) }
    if (game.phase === 'prep' && game.mode === 'lofi' && game.pomodoro?.autoCycle) {
      this.pomoPrepT = (this.pomoPrepT || 0) + rawDt
      const dockLeft = game.boxes.some((b) => b.state === 'dock')
      if ((!dockLeft && this.pomoPrepT > 3) || this.pomoPrepT > 14) this.openShop()
    }
    this.runLofiAutoPilot(rawDt)
    // metas do dia, metas grandes e catálogo de candidatos: conferidos duas vezes por segundo
    this.goalT = (this.goalT || 0) + dt
    if (this.goalT > 0.5) {
      this.goalT = 0
      if (game.goalsDay !== game.day) makeGoals()
      if (live) checkGoals()
      checkBigGoals()
      if (!game.candidates.length) ensureCandidates()
    }

    if (game.phase === 'open') {
      game.clock += dt
      if (game.clock >= daySeconds()) this.closeDoors()
      else if (game.lunchOn && !game.lunchDone && game.clock >= LUNCH.start && game.clock < LUNCH.end) this.startLunch()
      else {
        this.spawnAcc += this.spawnRate() * dt
        while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (this.customers.length < maxCustomers()) this.spawnCustomer() }
        if (!this.thiefTimes) this.planThieves() // jogo carregado com a loja já aberta
        while (this.thiefTimes.length && this.thiefTimes[0] <= game.clock) { this.thiefTimes.shift(); this.spawnThief() }
        while (this.robberyTimes?.length && this.robberyTimes[0] <= game.clock) { this.robberyTimes.shift(); this.spawnRobber() }
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
          this.feel(c, 'angry'); c.play('emote-no'); this.leave(c)
        }
      }
    }
    // atendimento
    const ct = game.register ? cashierTile(game.register) : null
    const head = this.queue[0]
    const headReady = head && head.state === 'queued' && head.idle && head.qIdx === 0
    let rate = 0
    let playerServing = false
    for (const a of this.staff) a.serving = false
    if (ct) {
      for (const a of [this.player, ...this.staff.filter((s) => s.role === 'cashier')]) {
        const dist = Math.hypot(a.x - ct.x, a.z - ct.z)
        const ok = a.kind === 'player' ? a.cashiering && dist < 2.3 && !a.moving : dist < 0.3 && a.idle
        if (!ok) continue
        if (a.kind === 'player') { rate += 1 / 1.1; playerServing = true }
        else { rate += serveMult(a.member) / 1.7; a.serving = !!headReady }
      }
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
    if (ct && this.player.cashiering && Math.hypot(this.player.x - ct.x, this.player.z - ct.z) > 2.6) this.player.cashiering = false
    ui.action = this.player.work ? { ...this.player.work } : null
  }
}

export const world = new World()
