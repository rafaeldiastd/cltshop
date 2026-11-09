import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { game, ui, money } from './state.js'
import { world } from './world.js'
import { PID, SHELF_CAP, SHELF_SLOTS, DAY_SECONDS } from './config.js'
import { dims, counterTiles, boxSlots, decorTiles } from './layout.js'
import * as assets from './assets.js'
import { Scenery } from './scenery.js'

const C = { wood: 0xc9955c, woodDark: 0x9a6a3f, cream: 0xf6e7cf, plum: 0x3b2f4a, teal: 0x6fb3a8, coral: 0xef8a77, mustard: 0xf2c25b, cardboard: 0xc89a63 }
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o })
const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color))
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true
  return m
}

// ---------- sprites de texto/emoji ----------
const texCache = new Map()
function labelTex(k, w, h, draw) {
  if (texCache.has(k)) return texCache.get(k)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const g = cv.getContext('2d'); draw(g, w, h)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace
  texCache.set(k, t); return t
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill() }
function tagTex(text, bg, fg = '#3b2f4a') {
  return labelTex(`tag|${text}|${bg}|${fg}`, 256, 80, (g, w, h) => {
    g.fillStyle = bg; rr(g, 4, 4, w - 8, h - 8, 28)
    g.fillStyle = fg; g.font = '700 38px system-ui, -apple-system, "Apple Color Emoji", sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2)
  })
}
function emojiTex(e) {
  return labelTex('emo|' + e, 96, 96, (g, w, h) => {
    g.fillStyle = 'rgba(255,246,230,0.92)'; g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.fill()
    g.font = '52px "Apple Color Emoji", system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, w / 2, h / 2 + 4)
  })
}
const sprite = (tex, sx, sy) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  s.scale.set(sx, sy, 1); return s
}

const lerp = (a, b, t) => a + (b - a) * t
const KEYS = [ // fração do dia -> cores
  { t: -1,  sky: 0xf7d9b5, sun: 0xffd9a8, si: 2.0, hi: 0.9, lamp: 0.6 },
  { t: 0,   sky: 0xf7d9b5, sun: 0xffd9a8, si: 2.0, hi: 0.9, lamp: 0.6 },
  { t: 0.35, sky: 0xcfe7f0, sun: 0xfff4e0, si: 2.6, hi: 1.0, lamp: 0.2 },
  { t: 0.8, sky: 0xf4a96b, sun: 0xffb070, si: 1.9, hi: 0.8, lamp: 0.9 },
  { t: 1.0, sky: 0x2b2545, sun: 0x8f8cff, si: 0.55, hi: 0.5, lamp: 1.6 },
  { t: 9,   sky: 0x2b2545, sun: 0x8f8cff, si: 0.55, hi: 0.5, lamp: 1.6 },
]

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.r.shadowMap.enabled = true
    this.r.shadowMap.type = THREE.PCFSoftShadowMap
    this.r.toneMapping = THREE.ACESFilmicToneMapping
    this.r.toneMappingExposure = 1.05
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(C.cream)
    this.scene.fog = new THREE.Fog(C.cream, 26, 60)
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120)
    this.hemi = new THREE.HemisphereLight(0xfff1dd, 0x8a6a5a, 0.9)
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 })
    this.sun.shadow.bias = -0.0006
    this.scene.add(this.hemi, this.sun, this.sun.target)
    this.lamps = []
    this.scenery = new Scenery(this.scene)
    this.shelfViews = new Map(); this.boxViews = new Map(); this.actorViews = new Map(); this.ghosts = []
    this.staticG = null; this.builtLevel = -1
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2()
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.t = 0
    this.hover = null

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableRotate = false
    this.controls.enablePan = false
    this.controls.screenSpacePanning = false
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12
    this.controls.minDistance = 6; this.controls.maxDistance = 30

    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), std(C.mustard, { emissive: 0x6a4a00 }))
    this.marker.rotation.x = Math.PI; this.marker.visible = false; this.scene.add(this.marker)

    this.initInput()
    addEventListener('resize', () => this.resize())
    this.resize()
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    this.r.setSize(w, h, false)
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
  }

  frame() {
    const d = dims(game.level)
    const c = new THREE.Vector3(d.cols / 2 - 0.5, 0, d.rows / 2 + 0.5)
    this.controls.target.copy(c); this.base = c.clone()
    const dist = 8 + d.cols * 1.35
    this.camera.position.copy(c).add(new THREE.Vector3(0.5, 0.95, 0.9).normalize().multiplyScalar(dist))
    this.controls.update()
    this.sun.position.copy(c).add(new THREE.Vector3(-7, 13, 7)); this.sun.target.position.copy(c)
  }

  // ---------- estrutura estática da loja ----------
  buildShop() {
    if (this.staticG) this.scene.remove(this.staticG)
    const g = (this.staticG = new THREE.Group())
    this.lamps = []
    const { cols, rows, doorX } = dims(game.level)
    this.builtLevel = game.level

    // chão com tijolinhos de madeira
    const cv = document.createElement('canvas'); cv.width = cols * 64; cv.height = rows * 64
    const x = cv.getContext('2d')
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      x.fillStyle = (i + j) % 2 ? '#e6c9a0' : '#dcbb8e'; x.fillRect(i * 64, j * 64, 64, 64)
      x.strokeStyle = 'rgba(120,80,40,0.18)'; x.strokeRect(i * 64 + 1, j * 64 + 1, 62, 62)
    }
    const ft = new THREE.CanvasTexture(cv); ft.colorSpace = THREE.SRGBColorSpace; ft.anisotropy = 4
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }))
    floor.rotation.x = -Math.PI / 2; floor.position.set(cols / 2 - 0.5, 0, rows / 2 - 0.5); floor.receiveShadow = true
    g.add(floor)

    // área de estoque (tapete)
    const stock = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), std(0xb7c9b0))
    stock.rotation.x = -Math.PI / 2; stock.position.set(1, 0.01, 1); stock.receiveShadow = true; g.add(stock)
    const sl = sprite(tagTex('ESTOQUE 📦', '#f6e7cf'), 1.4, 0.44); sl.position.set(1, 0.15, 2.65); g.add(sl)

    // paredes (fundo e esquerda altas; frente e direita baixas para ver dentro)
    const wallC = 0xf2dcc0, trim = 0xb98a5a
    g.add(box(cols + 0.4, 2.4, 0.2, wallC, cols / 2 - 0.5, 1.2, -0.6))
    g.add(box(0.2, 2.4, rows + 0.4, wallC, -0.6, 1.2, rows / 2 - 0.5))
    g.add(box(cols + 0.4, 0.12, 0.26, trim, cols / 2 - 0.5, 0.06, -0.52))
    for (const [x0, x1] of [[-0.5, doorX - 0.5], [doorX + 0.5, cols - 0.5]]) {
      const w = x1 - x0; g.add(box(w, 0.55, 0.3, wallC, (x0 + x1) / 2, 0.275, rows))
      g.add(box(w, 0.08, 0.36, trim, (x0 + x1) / 2, 0.58, rows))
    }
    g.add(box(0.2, 0.55, rows + 0.7, wallC, cols - 0.4, 0.275, rows / 2 - 0.15))
    for (const dx of [-0.5, 0.5]) g.add(box(0.14, 1.4, 0.34, trim, doorX + dx, 0.7, rows))
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), std(C.coral)); mat.rotation.x = -Math.PI / 2; mat.position.set(doorX, 0.012, rows - 0.2); g.add(mat)

    // janelinha + letreiro no fundo
    const win = box(1.8, 1.0, 0.05, 0xbfe3ee, 3.3, 1.35, -0.48); win.material.emissive = new THREE.Color(0x3a6a7a); g.add(win)
    const sign = sprite(tagTex('🛍️ LOJINHA', '#ef8a77', '#fff7ea'), 2.6, 0.8); sign.position.set(cols / 2 - 0.5, 1.9, -0.45); g.add(sign)

    // balcão + caixa registradora
    const ct = counterTiles(game.level)
    const cx = (ct[0].x + ct[1].x) / 2, cz = ct[0].z
    const counter = new THREE.Group(); counter.userData = { kind: 'counter' }
    const cm = assets.make('counter')
    if (cm) counter.add(cm)
    else {
      counter.add(box(2, 0.85, 0.7, C.wood, 0, 0.425, 0)); counter.add(box(2.1, 0.08, 0.8, C.cream, 0, 0.89, 0))
      counter.add(box(0.4, 0.25, 0.3, C.plum, 0.5, 1.05, 0)); counter.add(box(0.3, 0.15, 0.02, 0x7fd6a8, 0.5, 1.15, 0.16))
    }
    const reg = assets.make('register'); if (reg) { reg.position.set(0.5, 0.93, 0); reg.rotation.y = Math.PI; counter.add(reg) }
    counter.position.set(cx, 0, cz); g.add(counter); this.counterG = counter

    // plantas e tapete decorativo
    for (const [px, pz] of [[cols - 1, 1], [0, rows - 1], [cols - 1, rows - 2]]) {
      const pl = assets.make('plant')
      const p = pl || new THREE.Group()
      if (!pl) {
        p.add(box(0.35, 0.3, 0.35, C.coral, 0, 0.15, 0))
        for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0x5f9f62)); s.position.set((i % 2 - 0.5) * 0.18, 0.5 + i * 0.07, (i > 1 ? 1 : -1) * 0.1); s.castShadow = true; p.add(s) }
      }
      p.position.set(px, 0, pz); g.add(p)
    }
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), std(0xe8a598)); rug.rotation.x = -Math.PI / 2; rug.position.set(cols / 2 - 0.5, 0.012, rows / 2 - 0.5); rug.receiveShadow = true; g.add(rug)

    // lâmpadas
    for (const [lx, lz] of [[cols / 2 - 0.5, 1.5], [cols / 2 - 0.5, rows - 2.5]]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); bulb.position.set(lx, 2.2, lz)
      const pl = new THREE.PointLight(0xffd9a0, 0, 9, 2); pl.position.set(lx, 2.0, lz)
      g.add(bulb, pl); this.lamps.push(pl)
    }
    this.decorate(g, cols, rows, doorX)
    this.scenery.build({ cols, rows, doorX })
    this.scene.add(g)
    this.frame()
  }

  decorate(g, cols, rows, doorX) {
    // lambri nas paredes
    g.add(box(cols + 0.4, 0.8, 0.24, 0xe3c4a0, cols / 2 - 0.5, 0.4, -0.6))
    g.add(box(0.24, 0.8, rows + 0.4, 0xe3c4a0, -0.6, 0.4, rows / 2 - 0.5))
    // quadros e relógio
    const frame = (x, w, h, col) => { g.add(box(w + 0.1, h + 0.1, 0.05, 0x7a5a3a, x, 1.5, -0.47)); g.add(box(w, h, 0.06, col, x, 1.5, -0.46)) }
    frame(1.3, 0.55, 0.7, 0xf2b8a8); frame(5.5, 0.9, 0.55, 0xa8d4c8); if (cols > 9) frame(9.2, 0.55, 0.7, 0xf2d58a)
    this.clock = sprite(this.clockTex(9, 0), 0.7, 0.7); this.clock.position.set(cols - 2, 1.75, -0.44); g.add(this.clock)
    // pendentes
    for (const l of this.lamps) {
      const cord = box(0.02, 0.5, 0.02, 0x3b2f4a, l.position.x, 2.45, l.position.z); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xef8a77, side: THREE.DoubleSide, roughness: 0.8 }))
      shade.position.set(l.position.x, 2.3, l.position.z); g.add(cord, shade)
    }
    // freezers na parede direita
    for (const t of decorTiles(game.level)) {
      if (t.x === 0) continue
      const f = assets.make('freezer') || (() => { const q = new THREE.Group(); q.add(box(0.5, 0.9, 0.9, 0xe8eef4, 0, 0.45, 0)); q.add(box(0.02, 0.6, 0.7, 0x9fd0e0, -0.26, 0.5, 0)); return q })()
      f.position.set(t.x + 0.15, 0, t.z); f.rotation.y = -Math.PI / 2; g.add(f)
    }
    // gacha, carrinho e cesta
    const gacha = assets.make('gacha'); if (gacha) { gacha.position.set(0.1, 0, rows - 3); gacha.rotation.y = Math.PI / 2; g.add(gacha) }
    const cart = assets.make('cart'); if (cart) { cart.position.set(doorX - 1.6, 0, rows - 1.2); cart.rotation.y = 0.5; g.add(cart) }
    for (let i = 0; i < 2; i++) { const b = assets.make('basket'); if (b) { b.position.set(doorX - 1.0, i * 0.2, rows - 0.4); b.rotation.y = i; g.add(b) } }
    const hf = assets.make('truck'); if (hf) { hf.position.set(2.6, 0, 2.5); hf.rotation.y = -0.6; g.add(hf) }
    // vitrines externas e no balcão
    const fl = assets.make('dFlowers'); if (fl) { fl.position.set(doorX + 1.9, 0, rows + 0.9); g.add(fl) }
    const fr = assets.make('dFruit'); if (fr) { fr.position.set(doorX - 2.3, 0, rows + 0.7); g.add(fr) }
    const br = assets.make('dBread'); if (br && this.counterG) { br.position.set(-0.55, 0.93, 0); this.counterG.add(br) }
  }
  clockTex(h, m) {
    return labelTex(`clk|${h}|${m}`, 128, 128, (c, w, hh) => {
      c.fillStyle = '#7a5a3a'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill()
      c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fill()
      c.strokeStyle = '#3b2f4a'; c.lineCap = 'round'
      const hand = (a, l, wd) => { c.lineWidth = wd; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); c.stroke() }
      hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 28, 7); hand(m / 60 * Math.PI * 2, 40, 4)
    })
  }

  // ---------- objetos dinâmicos ----------
  makeShelfView(s) {
    const gr = new THREE.Group(); gr.userData = { kind: 'shelf', id: s.id }
    const sm = assets.make('shelf')
    if (sm) gr.add(sm)
    else {
      gr.add(box(0.06, 1.05, 0.46, C.woodDark, -0.45, 0.525, 0)); gr.add(box(0.06, 1.05, 0.46, C.woodDark, 0.45, 0.525, 0))
      gr.add(box(0.9, 1.05, 0.04, C.wood, 0, 0.525, -0.21))
      for (const y of [0.05, 0.4, 0.72, 1.04]) gr.add(box(0.96, 0.05, 0.5, C.wood, 0, y, 0))
    }
    const items = new THREE.Group(); gr.add(items)
    const label = sprite(tagTex('—', '#cfc6b8'), 0.95, 0.3); label.position.set(0, 1.35, 0.05); gr.add(label)
    gr.position.set(s.x, 0, s.z)
    this.scene.add(gr)
    return { gr, items, label, key: '', pid: null, slots: [] }
  }
  fillShelfItems(v, pid) {
    v.items.clear(); v.slots = []
    if (!pid) return
    const boards = [0.075, 0.425, 0.745]
    for (const y of boards) for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const it = assets.makeItem(pid); it.position.set(-0.3 + c * 0.2, y, r ? 0.09 : -0.08); it.rotation.y = (Math.random() - 0.5) * 0.5
      v.items.add(it); v.slots.push(it)
    }
  }
  syncShelves(dt) {
    const alive = new Set(game.shelves.map((s) => s.id))
    for (const [id, v] of this.shelfViews) if (!alive.has(id)) { this.scene.remove(v.gr); this.shelfViews.delete(id) }
    for (const s of game.shelves) {
      let v = this.shelfViews.get(s.id)
      if (!v) { v = this.makeShelfView(s); this.shelfViews.set(s.id, v) }
      if (v.pid !== s.product) { v.pid = s.product; this.fillShelfItems(v, s.product) }
      v.slots.forEach((it, i) => (it.visible = i < s.count))
      const k = `${s.product}|${s.price}|${s.count}`
      if (k !== v.key) {
        v.key = k
        const p = s.product && PID[s.product]
        let tex
        if (!p) tex = tagTex('vazia', '#cfc6b8', '#6b6070')
        else if (s.price == null) tex = tagTex(`${p.emoji} sem preço!`, '#f4a09a')
        else if (s.count === 0) tex = tagTex(`${p.emoji} esgotado`, '#f4a09a')
        else tex = tagTex(`${p.emoji} ${money(s.price).slice(3)} · ${s.count}`, s.count <= 6 ? '#f8dfa2' : '#f6e7cf')
        v.label.material.map = tex; v.label.material.needsUpdate = true
      }
    }
  }
  makeBoxView(b) {
    const gr = new THREE.Group(); gr.userData = { kind: 'box', id: b.id }
    const closed = assets.make('box') || (() => { const g = new THREE.Group(); g.add(box(0.6, 0.4, 0.48, C.cardboard, 0, 0.2, 0)); g.add(box(0.14, 0.41, 0.49, 0xe6c590, 0, 0.2, 0)); return g })()
    const open = assets.make('boxOpen') || (() => {
      const g = new THREE.Group(); g.add(box(0.6, 0.36, 0.48, C.cardboard, 0, 0.18, 0))
      for (const [dz, rx] of [[-0.26, 0.9], [0.26, -0.9]]) { const f = box(0.6, 0.02, 0.24, 0xb98a55, 0, 0.42, dz); f.rotation.x = rx; g.add(f) }
      return g
    })()
    const peek = new THREE.Group(); open.add(peek)
    for (let i = 0; i < 4; i++) { const it = assets.makeItem(b.product); it.position.set(-0.17 + (i % 2) * 0.34, 0.3, i > 1 ? 0.08 : -0.08); peek.add(it) }
    gr.add(closed, open)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 24), new THREE.MeshBasicMaterial({ color: 0xffd35a, side: THREE.DoubleSide, transparent: true }))
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.visible = false; gr.add(ring)
    const label = sprite(tagTex('', '#fff'), 0.8, 0.25); label.position.y = 0.85; gr.add(label)
    gr.position.set(0, 0, 0)
    this.scene.add(gr)
    return { gr, closed, open, ring, label, key: '', inited: false }
  }
  syncBoxes(dt) {
    const alive = new Set(game.boxes.map((b) => b.id))
    for (const [id, v] of this.boxViews) if (!alive.has(id)) { this.scene.remove(v.gr); this.boxViews.delete(id) }
    const slots = boxSlots(game.boxes, game.level)
    for (const b of game.boxes) {
      let v = this.boxViews.get(b.id)
      if (!v) { v = this.makeBoxView(b); this.boxViews.set(b.id, v) }
      const p = slots.get(b.id)
      const sel = ui.selectedBox === b.id
      let tx = p.x, tz = p.z, ty = p.y
      if (sel) { tx = world.player.x; tz = world.player.z; ty = 1.05 }
      if (!v.inited) { v.gr.position.set(p.x, ty + (b.state === 'dock' ? 6 : 0), p.z); v.inited = true }
      v.gr.position.x = lerp(v.gr.position.x, tx, Math.min(1, dt * 12))
      v.gr.position.y = lerp(v.gr.position.y, ty, Math.min(1, dt * 8))
      v.gr.position.z = lerp(v.gr.position.z, tz, Math.min(1, dt * 12))
      v.closed.visible = b.state !== 'open'; v.open.visible = b.state === 'open'
      v.ring.visible = false; v.gr.scale.setScalar(sel ? 0.8 : 1)
      const k = `${b.product}|${b.count}|${b.state}`
      if (k !== v.key) {
        v.key = k
        const pr = PID[b.product]
        v.label.material.map = tagTex(`${pr.emoji} ${b.count}`, b.state === 'open' ? '#fbe6a8' : '#f6e7cf'); v.label.material.needsUpdate = true
        v.label.position.y = b.state === 'open' ? 0.95 : 0.8
      }
    }
  }
  makeActorView(a) {
    const gr = new THREE.Group()
    const hue = a.hue ?? 0.5
    const shirt = a.kind === 'player' ? C.coral : a.kind === 'staff' ? (a.role === 'cashier' ? C.mustard : C.teal) : new THREE.Color().setHSL(hue, 0.45, 0.68).getHex()
    const ch = a.kind === 'pet' ? assets.makeAnim(a.species) : assets.makeCharacter(a.kind === 'player' ? 0 : Math.floor((a.hue ?? Math.random()) * 10) + (a.kind === 'staff' ? 1 : 2))
    const body = new THREE.Group(); gr.add(body)
    let mixer = null, clips = {}
    if (ch) {
      ch.obj.traverse((o) => { if (o.isMesh) { o.castShadow = true } })
      body.add(ch.obj)
      if (ch.animations.length) {
        mixer = new THREE.AnimationMixer(ch.obj)
        for (const an of ch.animations) clips[an.name.toLowerCase()] = mixer.clipAction(an)
      }
    } else if (a.kind === 'pet') {
      const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 8), std(0xe8a060)); bd.rotation.x = Math.PI / 2; bd.position.y = 0.2; bd.castShadow = true
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), std(0xe8a060)); hd.position.set(0, 0.28, 0.22); body.add(bd, hd)
    } else {
      const sk = 0xf1c9a5
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.25, 4, 10), std(shirt)); torso.position.y = 0.36; torso.castShadow = true
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), std(sk)); head.position.y = 0.8; head.castShadow = true
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), std(a.kind === 'player' ? 0x3b2f4a : new THREE.Color().setHSL((hue * 3) % 1, 0.3, 0.25).getHex())); hair.position.y = 0.82; hair.rotation.x = -0.25
      const eyes = [-0.06, 0.06].map((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), std(0x2b2030)); e.position.set(x, 0.82, 0.15); return e })
      body.add(torso, head, hair, ...eyes)
      if (a.kind === 'staff') { const cap = box(0.34, 0.06, 0.34, a.role === 'cashier' ? 0xd9a43b : 0x4a8f85, 0, 0.97, 0); body.add(cap) }
    }
    if (a.kind === 'player') { const ar = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), std(C.mustard, { emissive: 0x6a4a00 })); ar.rotation.x = Math.PI; ar.position.y = 1.4; gr.add(ar); gr.userData.arrow = ar }
    const emo = sprite(emojiTex('🙂'), 0.5, 0.5); emo.position.y = 1.15; emo.visible = false; gr.add(emo)
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; gr.add(shadow)
    gr.position.set(a.x, 0, a.z)
    this.scene.add(gr)
    return { gr, body, emo, mixer, clips, emoKey: '', ph: Math.random() * 6 }
  }
  syncActors(dt) {
    const list = world.actors
    const alive = new Set(list.map((a) => a.id))
    for (const [id, v] of this.actorViews) if (!alive.has(id)) { this.scene.remove(v.gr); this.actorViews.delete(id) }
    for (const a of list) {
      let v = this.actorViews.get(a.id)
      if (!v) { v = this.makeActorView(a); this.actorViews.set(a.id, v) }
      v.gr.position.x = a.x; v.gr.position.z = a.z
      let d = a.face - v.gr.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d))
      v.gr.rotation.y += d * Math.min(1, dt * 12)
      if (v.mixer) {
        const want = a.moving ? (v.clips.walk || v.clips.sprint || v.clips.run) : (v.clips.idle || v.clips.static)
        if (want && v.cur !== want) { v.cur?.fadeOut(0.2); want.reset().fadeIn(0.2).play(); v.cur = want }
        v.mixer.update(dt)
      } else {
        v.ph += dt * (a.moving ? 11 : 2)
        v.body.position.y = a.moving ? Math.abs(Math.sin(v.ph)) * 0.05 : Math.sin(v.ph) * 0.008
        v.body.rotation.z = a.moving ? Math.sin(v.ph) * 0.06 : 0
      }
      if (a.emote) {
        if (v.emoKey !== a.emote) { v.emo.material.map = emojiTex(a.emote); v.emo.material.needsUpdate = true; v.emoKey = a.emote }
        v.emo.visible = true; v.emo.position.y = 1.15 + Math.sin(this.t * 4) * 0.03
      } else v.emo.visible = false
      if (v.gr.userData.arrow) v.gr.userData.arrow.position.y = 1.4 + Math.sin(this.t * 4) * 0.05
    }
  }
  syncGhosts() {
    if (!this.ghosts.length) {
      for (const s of SHELF_SLOTS) {
        const gr = new THREE.Group(); gr.userData = { kind: 'slot', slot: s }
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.5), new THREE.MeshBasicMaterial({ color: 0x7fd6a8, transparent: true, opacity: 0.45 }))
        m.position.y = 0.5; gr.add(m); gr.position.set(s.x, 0, s.z); gr.visible = false; this.scene.add(gr); this.ghosts.push(gr)
      }
    }
    for (const gr of this.ghosts) {
      const s = gr.userData.slot
      gr.visible = ui.placing && s.level <= game.level && !game.shelves.some((h) => h.x === s.x && h.z === s.z)
      if (gr.visible) gr.children[0].material.opacity = 0.35 + Math.sin(this.t * 4) * 0.12
    }
  }

  // ---------- horário do dia ----------
  applyTime() {
    let f = game.phase === 'open' ? game.clock / DAY_SECONDS : game.phase === 'closing' ? 0.97 : game.phase === 'night' ? 1.5 : 0
    let a = KEYS[0], b = KEYS[1]
    for (let i = 0; i < KEYS.length - 1; i++) if (f >= KEYS[i].t && f <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1] }
    const k = b.t === a.t ? 0 : (f - a.t) / (b.t - a.t)
    const col = new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), k)
    this.scene.background.copy(col); this.scene.fog.color.copy(col)
    this.sun.color.copy(new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), k))
    this.sun.intensity = lerp(a.si, b.si, k); this.hemi.intensity = lerp(a.hi, b.hi, k)
    const lamp = lerp(a.lamp, b.lamp, k)
    this.lamps.forEach((l) => (l.intensity = lamp * 14)); this.lampLevel = Math.max(0, lamp - 0.7)
  }

  // ---------- entrada ----------
  initInput() {
    let down = null
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
    c.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && e.button === 0) this.onClick?.(this.pick(e), e)
      down = null
    })
    c.addEventListener('pointermove', (e) => {
      ui.mouse.x = e.clientX; ui.mouse.y = e.clientY
      this.hover = this.pick(e)
      this.onHover?.(this.hover)
    })
    c.addEventListener('pointerleave', () => { this.hover = null; this.onHover?.(null) })
  }
  pick(e) {
    const r = this.canvas.getBoundingClientRect()
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.mouse, this.camera)
    const roots = [...[...this.shelfViews.values()].map((v) => v.gr), ...[...this.boxViews.values()].map((v) => v.gr), ...this.ghosts.filter((g) => g.visible)]
    if (this.counterG) roots.push(this.counterG)
    const hits = this.ray.intersectObjects(roots, true)
    for (const h of hits) {
      if (h.object.isSprite) continue
      let o = h.object
      while (o && !o.userData.kind) o = o.parent
      if (o) return { kind: o.userData.kind, id: o.userData.id, slot: o.userData.slot, obj: o }
    }
    const p = new THREE.Vector3()
    if (this.ray.ray.intersectPlane(this.floorPlane, p)) return { kind: 'floor', x: p.x, z: p.z }
    return null
  }

  update(dt) {
    this.t += dt
    if (this.builtLevel !== game.level) this.buildShop()
    this.syncShelves(dt); this.syncBoxes(dt); this.syncActors(dt); this.syncGhosts()
    this.applyTime()
    const h = this.hover
    let mo = h && h.obj && !ui.modal ? h.obj : null
    const tg = world.target
    if (!mo && tg) mo = tg.kind === 'box' ? this.boxViews.get(tg.id)?.gr : tg.kind === 'shelf' ? this.shelfViews.get(tg.id)?.gr : tg.kind === 'counter' ? this.counterG : null
    if (mo) {
      const b = new THREE.Box3().setFromObject(mo)
      this.marker.visible = true
      this.marker.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.45 + Math.sin(this.t * 6) * 0.05, (b.min.z + b.max.z) / 2)
    } else this.marker.visible = false
    // câmera acompanha o jogador suavemente
    const pl = world.player, tg2 = this.controls.target, bs = this.base
    if (bs) {
      const gx = bs.x + (pl.x - bs.x) * 0.55, gz = bs.z + (pl.z - bs.z) * 0.55
      const k = 1 - Math.exp(-dt * 4)
      const dx = (gx - tg2.x) * k, dz = (gz - tg2.z) * k
      tg2.x += dx; tg2.z += dz; this.camera.position.x += dx; this.camera.position.z += dz
    }
    this.controls.update()
    // relógio da parede + cenário animado
    const hh = 9 + (game.phase === 'open' ? (game.clock / DAY_SECONDS) * 12 : game.phase === 'prep' ? -0.5 : game.phase === 'night' ? 12 : 12)
    const hi = Math.floor(hh), mi = Math.floor((hh % 1) * 60 / 5) * 5
    if (this.clock && this.clockKey !== hi * 100 + mi) { this.clockKey = hi * 100 + mi; this.clock.material.map = this.clockTex(hi, mi); this.clock.material.needsUpdate = true }
    const dayF = game.phase === 'open' ? Math.sin(Math.min(1, game.clock / DAY_SECONDS) * Math.PI) * 0.9 + 0.1 : game.phase === 'prep' ? 0.5 : game.phase === 'closing' ? 0.15 : 0
    this.scenery.update(dt, dayF, this.lampLevel || 0)
    this.r.render(this.scene, this.camera)
  }
}
