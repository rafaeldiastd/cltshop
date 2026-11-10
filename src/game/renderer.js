import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toRaw } from 'vue'
import { game, ui, money, settings } from './state.js'
import { world } from './world.js'
import { PID, DAY_SECONDS } from './config.js'
import { dims, boxSlots, stockRoom, onFloor, isUsable, backPartner, DIRS, planKey } from './layout.js'
import { nextPlan } from './build.js'
import * as assets from './assets.js'
import { Scenery } from './scenery.js'
import { checkoutGuide } from './editor.js'

const C = { wood: 0xc9955c, woodDark: 0x9a6a3f, cream: 0xf6e7cf, plum: 0x3b2f4a, teal: 0x6fb3a8, coral: 0xef8a77, mustard: 0xf2c25b, cardboard: 0xc89a63 }
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o })
const box = (w, h, d, color, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color))
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true
  return m
}

// ---------- desempenho: várias peças simples viram uma malha só, com a cor em cada vértice ----------
const bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })
const bakeable = (m) => m.isMesh && m.visible && m.material.isMeshStandardMaterial && !m.material.transparent && !m.material.map && m.material.side === THREE.FrontSide && m.material.emissive.getHex() === 0
function colored(m) {
  const g = m.geometry.clone().applyMatrix4(m.matrixWorld)
  const n = g.attributes.position.count, cols = new Float32Array(n * 3), c = m.material.color
  for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  return g
}
const templates = new Map()
// mesma peça repetida (prateleira, freezer, caixa): monta uma vez e reaproveita
function baked(key, build) {
  if (!templates.has(key)) {
    const g = new THREE.Group(); build(g); g.updateMatrixWorld(true)
    const list = []; g.traverse((m) => { if (bakeable(m)) list.push(m) })
    templates.set(key, mergeGeometries(list.map(colored)))
  }
  const m = new THREE.Mesh(templates.get(key), bakedMat); m.castShadow = true; m.receiveShadow = true
  return m
}
// estrutura fixa da loja: filhos diretos do grupo, sem mexer em portas e móveis
function bakeChildren(group) {
  group.updateMatrixWorld(true)
  for (const cast of [true, false]) {
    const list = group.children.filter((m) => bakeable(m) && m.castShadow === cast)
    if (list.length < 2) continue
    const mesh = new THREE.Mesh(mergeGeometries(list.map(colored)), bakedMat); mesh.castShadow = cast; mesh.receiveShadow = true
    list.forEach((m) => group.remove(m))
    group.add(mesh)
  }
}
// clique testa uma caixa invisível por objeto em vez de cada triângulo
const hitGeo = new THREE.BoxGeometry(1, 1, 1), hitMat = new THREE.MeshBasicMaterial()
function addHit(gr, w, h, d, y = h / 2) {
  const m = new THREE.Mesh(hitGeo, hitMat); m.scale.set(w, h, d); m.position.y = y; m.visible = false; m.userData.noOutline = true
  gr.add(m); gr.userData.hit = m
}
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1)
const itemAt = (x, y, z, spin = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, spin), ONE)
const SHADOW_EVERY = 30 // quadros entre atualizações das sombras

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
// etiqueta com texto e, opcionalmente, a miniatura de um produto à esquerda
function tagTex(text, bg, fg = '#3b2f4a', pid = null) {
  return labelTex(`tag|${text}|${bg}|${fg}|${pid}`, 256, 80, (g, w, h) => {
    g.fillStyle = bg; rr(g, 4, 4, w - 8, h - 8, 28)
    g.fillStyle = fg; g.font = '700 38px system-ui, -apple-system, sans-serif'
    g.textAlign = 'left'; g.textBaseline = 'middle'
    const icon = pid ? 58 : 0, gap = pid ? 6 : 0, tw = g.measureText(text).width
    const x = (w - icon - gap - tw) / 2
    if (pid) g.drawImage(assets.productIcon(pid), x, (h - icon) / 2, icon, icon)
    g.fillText(text, x + icon + gap, h / 2 + 2)
  })
}
function emojiTex(e) {
  return labelTex('emo|' + e, 96, 96, (g, w) => {
    g.fillStyle = 'rgba(255,246,230,0.95)'; g.beginPath(); g.arc(w / 2, 42, 38, 0, 7); g.fill()
    g.beginPath(); g.moveTo(w / 2 - 12, 74); g.lineTo(w / 2 + 12, 74); g.lineTo(w / 2, 94); g.fill() // ponta do balão
    g.font = '50px "Segoe UI Emoji", "Apple Color Emoji", system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, w / 2, 46)
  })
}
const glowTex = () => labelTex('glow', 128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
})
const sprite = (tex, sx, sy) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  s.scale.set(sx, sy, 1); return s
}

const lerp = (a, b, t) => a + (b - a) * t
const BACK_SHIFT = 0.25 // metade da profundidade da prateleira
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
    this.r.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    this.r.shadowMap.enabled = true
    this.r.shadowMap.autoUpdate = false // o sol não se move: as sombras só precisam de atualização de vez em quando
    this.r.shadowMap.needsUpdate = true
    this.shadowTick = 0
    this.r.shadowMap.type = THREE.PCFShadowMap
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
    this.shelfViews = new Map(); this.boxViews = new Map(); this.actorViews = new Map(); this.decorViews = new Map()
    this.doors = []
    this.editTiles = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }))
      m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m)
      const label = sprite(tagTex('', '#fff'), 1.05, 0.33); label.visible = false; this.scene.add(label)
      label.material.depthTest = false; label.renderOrder = 10 // o nome aparece mesmo com gente ou móvel na frente
      m.userData.label = label
      return m
    })
    this.staticG = null; this.builtKey = ''; this.arrowKey = ''
    this.tmpColor = new THREE.Color()
    this.pendingMove = null
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2()
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.t = 0
    this.hover = null

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableRotate = false
    this.controls.enablePan = true
    this.controls.screenSpacePanning = false // arrastar move a visão pelo chão, sem girar
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.12
    this.controls.minDistance = 6; this.controls.maxDistance = 30

    this.initOutline()
    this.initInput()
    addEventListener('resize', () => this.resize())
    this.resize()
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight
    this.r.setSize(w, h, false)
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
    const px = this.r.getDrawingBufferSize(new THREE.Vector2())
    this.maskRT.setSize(px.x, px.y)
    const thickness = 2.5 * this.r.getPixelRatio()
    this.outlineMat.uniforms.texel.value.set(thickness / px.x, thickness / px.y)
  }

  // ---------- contorno branco do que está selecionado ----------
  // Desenha só os objetos selecionados numa máscara e pinta de branco a faixa logo em volta dela, por cima da cena.
  initOutline() {
    this.maskRT = new THREE.WebGLRenderTarget(1, 1, { samples: 2 })
    this.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    this.outlineMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { tMask: { value: this.maskRT.texture }, texel: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tMask; uniform vec2 texel; varying vec2 vUv;
        void main() {
          float inside = texture2D(tMask, vUv).r, edge = 0.0;
          for (int i = 0; i < 16; i++) {
            float a = float(i) * 0.3926991;
            edge = max(edge, texture2D(tMask, vUv + vec2(cos(a), sin(a)) * texel).r);
          }
          float alpha = edge * (1.0 - inside);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }`,
    })
    this.outlineScene = new THREE.Scene()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.outlineMat); quad.frustumCulled = false
    this.outlineScene.add(quad)
    this.outlineCam = new THREE.Camera()
    this.clearColor = new THREE.Color()
  }
  selectedObjects(mo) {
    const held = ui.held
    return [...new Set([
      mo,
      held && (held.kind === 'shelf' ? this.shelfViews.get(held.id)?.gr : held.kind === 'decor' ? this.decorViews.get(held.id) : held.kind === 'cafe' ? this.cafeG : this.counterG),
      ui.panelShelf != null && this.shelfViews.get(ui.panelShelf)?.gr,
      ui.panelCafe && this.cafeG,
      ui.selectedBox != null && this.boxViews.get(ui.selectedBox)?.gr,
    ])].filter(Boolean)
  }
  renderOutline(objs) {
    if (!objs.length) return
    const { r, scene, camera } = this
    const meshes = []
    for (const o of objs) o.traverse((c) => { if (c.isMesh && !c.userData.noOutline) meshes.push(c) })
    meshes.forEach((m) => m.layers.enable(1))
    const bg = scene.background, alpha = r.getClearAlpha()
    r.getClearColor(this.clearColor)
    scene.background = null; scene.overrideMaterial = this.maskMat
    camera.layers.set(1)
    r.setRenderTarget(this.maskRT)
    r.setClearColor(0x000000, 0); r.clear()
    r.render(scene, camera)
    r.setRenderTarget(null)
    r.setClearColor(this.clearColor, alpha)
    camera.layers.set(0)
    scene.background = bg; scene.overrideMaterial = null
    meshes.forEach((m) => m.layers.disable(1))
    r.autoClear = false
    r.render(this.outlineScene, this.outlineCam)
    r.autoClear = true
  }

  frame() {
    const d = dims(game.plan)
    const c = new THREE.Vector3(d.cols / 2 - 0.5, 0, d.rows / 2 + 0.5)
    this.controls.target.copy(c); this.base = c.clone(); this.follow = c.clone()
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
    this.doors = []
    this.signKey = null
    const { cols, rows, doorX } = dims(game.plan)
    this.builtKey = planKey(game.plan)

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

    // grade do modo layout
    const pts = []
    for (let x = 0; x < cols; x++) for (let z = 0; z < rows; z++) {
      if (!onFloor(game.plan, x, z)) continue
      const a = x - 0.5, b = x + 0.5, c = z - 0.5, d = z + 0.5, y = 0.025
      pts.push(a, y, c, b, y, c, b, y, c, b, y, d, b, y, d, a, y, d, a, y, d, a, y, c)
    }
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    this.gridG = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x3b2f4a, transparent: true, opacity: 0.3 }))
    this.gridG.visible = false; g.add(this.gridG)

    // paredes (fundo e esquerda altas; frente e direita baixas para ver dentro)
    const wallC = 0xf2dcc0, trim = 0xb98a5a

    // sala do estoque: piso próprio, paredes baixas para enxergar as caixas e porta na parede direita
    const room = stockRoom(game.plan)
    const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(room.cols, room.rows), std(0xb7c9b0))
    roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.set((room.cols - 1) / 2, 0.012, (room.rows - 1) / 2); roomFloor.receiveShadow = true; g.add(roomFloor)
    const H = 0.85, T = 0.14
    const roomWall = (x0, z0, x1, z1) => {
      const w = Math.abs(x1 - x0) || T, d = Math.abs(z1 - z0) || T, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
      g.add(box(w, H, d, wallC, cx, H / 2, cz)); g.add(box(w + 0.05, 0.07, d + 0.05, trim, cx, H + 0.035, cz))
    }
    const dz = room.door.z
    roomWall(-0.5, room.wallZ, room.wallX + T / 2, room.wallZ)
    roomWall(room.wallX, -0.5, room.wallX, dz - 0.5)
    if (dz + 0.5 < room.wallZ - 0.01) roomWall(room.wallX, dz + 0.5, room.wallX, room.wallZ)
    for (const s of [-0.5, 0.5]) g.add(box(0.14, 1.45, 0.14, trim, room.wallX, 0.725, dz + s))
    g.add(box(0.14, 0.1, 1.14, trim, room.wallX, 1.5, dz))
    this.addDoor(g, room.wallX, dz - 0.44, 'z', 0.88, 1.35, 0xd9b48a, 1.7, (a) => a.kind === 'player' || a.role === 'stocker') // cliente passando por perto não abre

    g.add(box(cols + 0.4, 2.4, 0.2, wallC, cols / 2 - 0.5, 1.2, -0.6))
    g.add(box(0.2, 2.4, rows + 0.4, wallC, -0.6, 1.2, rows / 2 - 0.5))
    g.add(box(cols + 0.4, 0.12, 0.26, trim, cols / 2 - 0.5, 0.06, -0.52))
    for (const [x0, x1] of [[-0.5, doorX - 0.5], [doorX + 0.5, cols - 0.5]]) {
      const w = x1 - x0; g.add(box(w, 0.55, 0.3, wallC, (x0 + x1) / 2, 0.275, rows))
      g.add(box(w, 0.08, 0.36, trim, (x0 + x1) / 2, 0.58, rows))
    }
    g.add(box(0.2, 0.55, rows + 0.7, wallC, cols - 0.4, 0.275, rows / 2 - 0.15))
    // porta da loja: é aqui que se abre o dia
    const doorG = (this.doorG = new THREE.Group()); doorG.userData = { kind: 'door' }
    for (const dx of [-0.5, 0.5]) doorG.add(box(0.14, 1.4, 0.34, trim, doorX + dx, 0.7, rows))
    this.addDoor(doorG, doorX - 0.43, rows, 'x', 0.86, 1.3, 0x6fb3a8, -1.7)
    const doorHit = box(1.2, 2.1, 0.5, trim, doorX, 1.05, rows); doorHit.visible = false; doorG.add(doorHit); doorG.userData.hit = doorHit
    this.doorSign = sprite(tagTex('FECHADO', '#f4a09a'), 1.5, 0.47); this.doorSign.position.set(doorX, 1.75, rows); doorG.add(this.doorSign)
    g.add(doorG)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), std(C.coral)); mat.rotation.x = -Math.PI / 2; mat.position.set(doorX, 0.012, rows - 0.2); g.add(mat)

    // janelinha no fundo
    const win = box(1.8, 1.0, 0.05, 0xbfe3ee, 3.3, 1.35, -0.48); win.material.emissive = new THREE.Color(0x3a6a7a); g.add(win)

    // caixa: só a registradora, num pedestal de um lugar
    const counter = new THREE.Group(); counter.userData = { kind: 'counter' }
    counter.add(box(0.9, 0.78, 0.72, C.wood, 0, 0.39, 0)); counter.add(box(0.96, 0.06, 0.78, C.cream, 0, 0.81, 0))
    const reg = assets.make('register')
    if (reg) { reg.position.set(0, 0.84, 0); reg.rotation.y = Math.PI; counter.add(reg) }
    else { counter.add(box(0.4, 0.25, 0.3, C.plum, 0, 0.97, 0)); counter.add(box(0.3, 0.15, 0.02, 0x7fd6a8, 0, 1.07, 0.16)) }
    // sinal de atendimento: verde com alguém no caixa, vermelho sem ninguém, apagado com a loja fechada
    counter.add(box(0.04, 0.66, 0.04, C.plum, 0.44, 1.17, -0.34))
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0x6b6570, toneMapped: false }))
    lamp.position.set(0.44, 1.56, -0.34)
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }))
    lampGlow.scale.set(0.75, 0.75, 1); lampGlow.position.copy(lamp.position)
    counter.add(lamp, lampGlow)
    addHit(counter, 1, 1.5, 0.82, 0.75)
    this.regLamp = { lamp, glow: lampGlow, key: null }
    g.add(counter); this.counterG = counter

    // tapete decorativo
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), std(0xe8a598)); rug.rotation.x = -Math.PI / 2; rug.position.set(cols / 2 - 0.5, 0.012, rows / 2 - 0.5); rug.receiveShadow = true; g.add(rug)

    // lâmpadas
    for (const [lx, lz] of [[cols / 2 - 0.5, 1.5], [cols / 2 - 0.5, rows - 2.5]]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); bulb.position.set(lx, 2.2, lz)
      const pl = new THREE.PointLight(0xffd9a0, 0, 9, 2); pl.position.set(lx, 2.0, lz)
      g.add(bulb, pl); this.lamps.push(pl)
    }
    this.decorate(g, cols, rows, doorX)
    bakeChildren(g)
    this.scenery.build({ cols, rows, doorX })
    this.scene.add(g)
    this.frame()
    this.r.shadowMap.needsUpdate = true
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
    // cestas na entrada e vitrines externas
    for (let i = 0; i < 2; i++) { const b = assets.make('basket'); if (b) { b.position.set(doorX - 1.0, i * 0.2, rows - 0.4); b.rotation.y = i; g.add(b) } }
    const fl = assets.make('dFlowers'); if (fl) { fl.position.set(doorX + 1.9, 0, rows + 0.9); g.add(fl) }
    const fr = assets.make('dFruit'); if (fr) { fr.position.set(doorX - 2.3, 0, rows + 0.7); g.add(fr) }
  }
  // porta com dobradiça: abre sozinha quando alguém chega perto
  addDoor(parent, x, z, axis, w, h, color, open, who = () => true) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0, z)
    pivot.add(axis === 'x' ? box(w, h, 0.05, color, w / 2, h / 2, 0) : box(0.05, h, w, color, 0, h / 2, w / 2))
    const glass = 0xcfe7f0
    pivot.add(axis === 'x' ? box(w * 0.6, h * 0.35, 0.07, glass, w / 2, h * 0.68, 0) : box(0.07, h * 0.35, w * 0.6, glass, 0, h * 0.68, w / 2))
    parent.add(pivot)
    this.doors.push({ pivot, open, who, cx: axis === 'x' ? x + w / 2 : x, cz: axis === 'x' ? z : z + w / 2 })
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
    gr.add(s.fridge ? this.makeFreezerModel() : baked('shelf', (g) => {
      g.add(box(0.06, 1.05, 0.46, C.woodDark, -0.45, 0.525, 0)); g.add(box(0.06, 1.05, 0.46, C.woodDark, 0.45, 0.525, 0))
      g.add(box(0.9, 1.05, 0.04, C.wood, 0, 0.525, -0.21))
      for (const y of [0.05, 0.4, 0.72, 1.04]) g.add(box(0.96, 0.05, 0.5, C.wood, 0, y, 0))
    }))
    const items = new THREE.Group(); gr.add(items)
    const label = sprite(tagTex('—', '#cfc6b8'), 0.95, 0.3); label.position.set(0, s.fridge ? 0.95 : 1.35, 0.05); gr.add(label)
    if (s.fridge) addHit(gr, 0.96, 0.6, 0.72); else addHit(gr, 0.98, 1.15, 0.54)
    this.scene.add(gr)
    return { gr, items, label, key: '', pid: null, inst: [], fridge: !!s.fridge }
  }
  // coloca o móvel no lugar salvo, ou na posição da mão se estiver sendo movido
  place(gr, kind, o) {
    const h = ui.held, q = h && h.kind === kind && (kind === 'counter' || h.id === o.id) ? h : o
    gr.position.set(q.x, q === h ? 0.1 : 0, q.z)
    gr.rotation.y = ((q.rot || 0) * Math.PI) / 2
  }
  // freezer horizontal aberto por dentro, com tampa de vidro (o modelo pronto é um bloco fechado)
  makeFreezerModel() {
    const body = 0xe8eef4, trim = 0x8fa6b8
    const shell = baked('freezer', (g) => {
      g.add(box(0.92, 0.07, 0.66, 0xbcd7e6, 0, 0.035, 0))
      for (const z of [-0.305, 0.305]) { g.add(box(0.92, 0.42, 0.05, body, 0, 0.21, z)); g.add(box(0.96, 0.03, 0.08, trim, 0, 0.435, z)) }
      for (const x of [-0.435, 0.435]) { g.add(box(0.05, 0.42, 0.56, body, x, 0.21, 0)); g.add(box(0.08, 0.03, 0.66, trim, x, 0.435, 0)) }
      g.add(box(0.03, 0.02, 0.58, trim, 0, 0.44, 0))
    })
    this.glassGeo ||= new THREE.BoxGeometry(0.84, 0.01, 0.56)
    this.glassMat ||= new THREE.MeshStandardMaterial({ color: 0xdff1f8, transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false })
    const glass = new THREE.Mesh(this.glassGeo, this.glassMat)
    glass.position.y = 0.44
    const g = new THREE.Group(); g.add(shell, glass)
    return g
  }
  // cafeteria: balcão com máquina de café e vitrine de doces
  makeCafeView(id) {
    const g = new THREE.Group(); g.userData = { kind: 'cafe', id }
    g.add(box(0.94, 0.8, 0.72, 0x7a5a3a, 0, 0.4, 0)); g.add(box(1, 0.06, 0.78, C.cream, 0, 0.83, 0))
    const machine = new THREE.Group(); machine.position.set(-0.24, 0.86, -0.1)
    machine.add(box(0.36, 0.34, 0.26, 0xb9c2cc, 0, 0.17, 0)); machine.add(box(0.38, 0.05, 0.28, C.plum, 0, 0.36, 0)); machine.add(box(0.3, 0.04, 0.14, C.plum, 0, 0.03, 0.17))
    for (const x of [-0.08, 0.08]) { const head = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), std(C.plum)); head.position.set(x, 0.2, 0.15); head.castShadow = true; machine.add(head) }
    g.add(machine)
    const cup = assets.make('cupCoffee'); if (cup) { cup.position.set(-0.3, 1.26, -0.1); g.add(cup) }
    const shop = new THREE.Group(); shop.position.set(0.24, 0.86, 0.08)
    shop.add(box(0.42, 0.03, 0.46, C.woodDark, 0, 0.015, 0))
    const croissant = assets.make('croissant'); if (croissant) { croissant.position.set(-0.1, 0.03, -0.1); shop.add(croissant) }
    const pie = assets.make('pie'); if (pie) { pie.position.set(0.1, 0.03, -0.08); shop.add(pie) }
    for (const [x, z] of [[-0.12, 0.1], [-0.03, 0.12], [0.06, 0.1], [0.14, 0.13]]) { const bread = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std(0xe6b866)); bread.position.set(x, 0.07, z); bread.castShadow = true; shop.add(bread) }
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.46), new THREE.MeshStandardMaterial({ color: 0xdff1f8, transparent: true, opacity: 0.16, roughness: 0.1, depthWrite: false }))
    glass.position.y = 0.15; shop.add(glass)
    g.add(shop)
    addHit(g, 1, 1.3, 0.82, 0.65)
    this.scene.add(g)
    return g
  }
  makeDecorView(d) {
    const gr = new THREE.Group(); gr.userData = { kind: 'decor', id: d.id }
    let model = assets.make(d.type)
    if (!model) {
      model = new THREE.Group()
      if (d.type === 'plant') {
        model.add(box(0.35, 0.3, 0.35, C.coral, 0, 0.15, 0))
        for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0x5f9f62)); s.position.set((i % 2 - 0.5) * 0.18, 0.5 + i * 0.07, (i > 1 ? 1 : -1) * 0.1); s.castShadow = true; model.add(s) }
      } else if (d.type === 'computer') { // mesinha com notebook
        model.add(box(0.8, 0.62, 0.56, C.woodDark, 0, 0.31, 0)); model.add(box(0.9, 0.05, 0.64, C.wood, 0, 0.645, 0))
        model.add(box(0.5, 0.03, 0.34, 0x4a4458, 0, 0.685, 0.05)); model.add(box(0.5, 0.32, 0.03, 0x4a4458, 0, 0.86, -0.13))
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), new THREE.MeshBasicMaterial({ color: 0x8fe3d0, toneMapped: false }))
        screen.position.set(0, 0.86, -0.112); model.add(screen)
      } else if (d.type === 'radio') { // rádio antigo em cima de um banquinho
        model.add(box(0.48, 0.5, 0.48, C.woodDark, 0, 0.25, 0)); model.add(box(0.54, 0.04, 0.54, C.wood, 0, 0.52, 0))
        const set = new THREE.Group(); set.position.y = 0.54; set.userData.radio = true
        set.add(box(0.46, 0.28, 0.18, C.coral, 0, 0.14, 0))
        const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 18), std(C.plum)); speaker.rotation.x = Math.PI / 2; speaker.position.set(-0.11, 0.14, 0.095); set.add(speaker)
        set.add(box(0.15, 0.08, 0.02, C.cream, 0.12, 0.18, 0.095)); set.add(box(0.05, 0.05, 0.02, C.mustard, 0.12, 0.08, 0.095))
        const antenna = box(0.012, 0.36, 0.012, C.plum, 0.18, 0.44, -0.04); antenna.rotation.z = -0.25; set.add(antenna)
        model.add(set)
      } else if (d.type === 'camera') { // câmera de segurança num poste
        model.add(box(0.32, 0.06, 0.32, C.plum, 0, 0.03, 0)); model.add(box(0.06, 1.5, 0.06, 0x6b6570, 0, 0.78, 0))
        const head = new THREE.Group(); head.position.set(0, 1.6, 0.08); head.rotation.x = 0.35
        head.add(box(0.2, 0.18, 0.42, 0xe8eef4, 0, 0, 0)); head.add(box(0.14, 0.12, 0.05, C.plum, 0, 0, 0.23))
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe5352b, toneMapped: false })); led.position.set(0.06, 0.1, 0.12); head.add(led)
        model.add(head)
      } else if (d.type === 'cafeTable') { // mesinha redonda com dois banquinhos
        const round = (rt, rb, h, color, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), std(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; model.add(m) }
        round(0.28, 0.28, 0.04, C.cream, 0, 0.62, 0); round(0.03, 0.03, 0.6, C.plum, 0, 0.31, 0); round(0.14, 0.16, 0.03, C.plum, 0, 0.015, 0)
        for (const x of [-0.36, 0.36]) { round(0.11, 0.11, 0.04, C.coral, x, 0.38, 0); round(0.025, 0.025, 0.36, C.plum, x, 0.18, 0) }
      }
      else model.add(box(0.5, 0.7, 0.5, C.teal, 0, 0.35, 0))
    }
    gr.add(model)
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    addHit(gr, Math.max(0.5, Math.min(1, size.x)), Math.max(0.5, size.y), Math.max(0.5, Math.min(1, size.z)))
    this.scene.add(gr)
    return gr
  }
  syncDecor() {
    const alive = new Set(game.decor.map((d) => d.id))
    for (const [id, gr] of this.decorViews) if (!alive.has(id)) { this.scene.remove(gr); this.decorViews.delete(id) }
    for (const d of game.decor) {
      let gr = this.decorViews.get(d.id)
      if (!gr) { gr = this.makeDecorView(d); this.decorViews.set(d.id, gr) }
      this.place(gr, 'decor', d)
      if (d.type === 'radio') { // o rádio balança no ritmo enquanto toca
        const set = gr.children[0].children.find((c) => c.userData.radio)
        if (set) set.scale.y = settings.musicOn || ui.externalPlaying ? 1 + Math.abs(Math.sin(this.t * 4.6)) * 0.05 : 1
      }
    }
    if (this.counterG) this.place(this.counterG, 'counter', game.register)
    if (game.cafe) {
      if (!this.cafeG) this.cafeG = this.makeCafeView(game.cafe.id)
      this.place(this.cafeG, 'cafe', game.cafe)
    } else if (this.cafeG) { this.scene.remove(this.cafeG); this.cafeG = null }
  }
  syncDoors(dt) {
    for (const d of this.doors) {
      const near = world.actors.some((a) => d.who(a) && Math.hypot(a.x - d.cx, a.z - d.cz) < 1.1)
      d.pivot.rotation.y = lerp(d.pivot.rotation.y, near ? d.open : 0, Math.min(1, dt * 9))
    }
    if (this.doorSign && this.signKey !== game.phase) {
      this.signKey = game.phase
      const [text, bg] = game.phase === 'open' ? ['ABERTO', '#b9e4c4'] : game.phase === 'closing' ? ['FECHANDO', '#f8dfa2'] : game.phase === 'lunch' ? ['ALMOÇO', '#f8dfa2'] : ['FECHADO', '#f4a09a']
      this.doorSign.material.map = tagTex(text, bg); this.doorSign.material.needsUpdate = true
    }
  }
  // posição na tela do balão de roubo (o botão em si é da interface)
  syncTheft() {
    const c = world.activeTheft
    if (!c) { if (ui.theft) ui.theft = null; return }
    const p = new THREE.Vector3(c.x, 1.6, c.z).project(this.camera)
    ui.theft = { x: ((p.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - p.y) / 2) * this.canvas.clientHeight, left: c.theft.t / 3 }
  }
  syncLamp() {
    const L = this.regLamp
    if (!L) return
    const live = game.phase === 'open' || game.phase === 'closing'
    const state = !live ? 'off' : world.registerStaffed() ? 'on' : 'idle'
    if (L.key === state) return
    L.key = state
    const c = state === 'on' ? 0x2fd36a : state === 'idle' ? 0xe5352b : 0x6b6570
    L.lamp.material.color.setHex(c)
    L.glow.material.color.setHex(c)
    L.glow.material.opacity = state === 'off' ? 0 : 0.55
  }
  syncEditor() {
    if (this.gridG) this.gridG.visible = ui.editing
    // com nada na mão, o modo layout mostra onde fica a fila do caixa atual
    const list = ui.held?.preview || (ui.editing && game.register ? checkoutGuide(game.register, world.queueTiles) : [])
    this.editTiles.forEach((m, i) => {
      const t = list[i], label = m.userData.label
      m.visible = !!t
      label.visible = !!t?.label
      if (t) { m.position.set(t.x, 0.03, t.z); m.material.color.setHex(t.c); m.material.opacity = t.o }
      if (t?.label) {
        label.position.set(t.x, 0.42, t.z)
        if (m.userData.text !== t.label) { m.userData.text = t.label; label.material.map = tagTex(t.label, '#3b2f4a', '#fff4e0'); label.material.needsUpdate = true }
      }
    })
  }
  // modo construção: área nova em verde, estoque em amarelo e a posição na tela dos controles de cada parede
  syncBuild() {
    if (!this.buildFloor) {
      const geo = new THREE.PlaneGeometry(1, 1)
      const make = (color, opacity) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false }))
        m.rotation.x = -Math.PI / 2; m.visible = false; this.scene.add(m)
        return m
      }
      this.buildFloor = [0, 1, 2, 3].map(() => make(0x7fd6a8, 0.6))
      this.buildRoom = make(0xf2c25b, 0.5)
    }
    const b = ui.build
    if (!b) {
      for (const m of [...this.buildFloor, this.buildRoom]) m.visible = false
      if (ui.buildArrows.length) { ui.buildArrows = []; this.arrowKey = '' }
      return
    }
    const area = (m, x0, z0, x1, z1) => {
      m.visible = x1 > x0 && z1 > z0
      if (m.visible) { m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); m.scale.set(x1 - x0, z1 - z0, 1) }
    }
    const { cols, rows } = game.plan, st = nextPlan(b).stock
    const x0 = -0.5 - b.w, x1 = cols - 0.5 + b.e, z0 = -0.5 - b.n, z1 = rows - 0.5 + b.s
    const [west, east, back, front] = this.buildFloor
    area(west, x0, z0, -0.5, z1); area(east, cols - 0.5, z0, x1, z1); area(back, -0.5, z0, cols - 0.5, -0.5); area(front, -0.5, rows - 0.5, cols - 0.5, z1)
    area(this.buildRoom, x0, z0, x0 + st.cols, z0 + st.rows)
    const r = this.canvas.getBoundingClientRect(), v = new THREE.Vector3()
    const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2
    const list = [
      ['w', x0 - 0.6, midZ], ['e', x1 + 0.6, midZ], ['n', midX, z0 - 0.6], ['s', midX, z1 + 0.6],
      ['stockCols', x0 + st.cols, z0 + st.rows / 2], ['stockRows', x0 + st.cols / 2, z0 + st.rows],
    ].map(([wall, x, z]) => {
      v.set(x, 0.9, z).project(this.camera)
      return { wall, x: Math.round(Math.max(80, Math.min(r.width - 80, r.left + ((v.x + 1) / 2) * r.width))), y: Math.round(Math.max(90, Math.min(r.height - 200, r.top + ((1 - v.y) / 2) * r.height))) }
    })
    // se dois controles se encostam (tela estreita, paredes próximas), o de depois desce
    list.forEach((a, i) => { for (const o of list.slice(0, i)) if (Math.abs(a.x - o.x) < 100 && Math.abs(a.y - o.y) < 36) a.y = o.y + 36 })
    const key = list.map((a) => a.x + ',' + a.y).join(';')
    if (key !== this.arrowKey) { this.arrowKey = key; ui.buildArrows = list }
  }
  fillShelfItems(v, pid) {
    for (const m of v.inst) m.dispose()
    v.items.clear(); v.inst = []
    if (!pid) return
    const spin = () => (Math.random() - 0.5) * 0.5, slots = []
    if (v.fridge) { // dentro do freezer, em duas camadas abaixo do vidro
      for (let layer = 0; layer < 2; layer++) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) slots.push(itemAt(-0.3 + c * 0.2, 0.08 + layer * 0.14, -0.18 + r * 0.18, spin()))
    } else {
      for (const y of [0.075, 0.425, 0.745]) for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) slots.push(itemAt(-0.3 + c * 0.2, y, r ? 0.09 : -0.08, spin()))
    }
    const g = assets.makeItemInstances(pid, slots)
    v.items.add(g); v.inst = g.children
  }
  syncShelves(dt) {
    const shelves = toRaw(game.shelves)
    const alive = new Set(shelves.map((s) => s.id))
    for (const [id, v] of this.shelfViews) if (!alive.has(id)) { for (const m of v.inst) m.dispose(); this.scene.remove(v.gr); this.shelfViews.delete(id) }
    // inclui a prateleira na mão, para já mostrar a união ao posicionar
    const held = ui.held?.kind === 'shelf' ? toRaw(ui.held) : null
    const poses = shelves.map((s) => (held?.id === s.id ? { ...s, x: held.x, z: held.z, rot: held.rot } : s))
    const atTile = new Map(poses.map((p) => [p.x + ',' + p.z, p]))
    for (const [i, s] of shelves.entries()) {
      let v = this.shelfViews.get(s.id)
      if (!v) { v = this.makeShelfView(s); this.shelfViews.set(s.id, v) }
      this.place(v.gr, 'shelf', s)
      // de costas uma para a outra, encostam no meio; a etiqueta segue no centro do lugar
      const [dx, dz] = DIRS[((poses[i].rot || 0) + 2) % 4]
      const behind = atTile.get(poses[i].x + dx + ',' + (poses[i].z + dz))
      const joined = !s.fridge && behind && backPartner(poses[i], [behind])
      if (joined) { v.gr.position.x += dx * BACK_SHIFT; v.gr.position.z += dz * BACK_SHIFT }
      v.label.position.z = joined ? 0.05 + BACK_SHIFT : 0.05
      if (v.pid !== s.product) { v.pid = s.product; this.fillShelfItems(v, s.product) }
      for (const m of v.inst) m.count = Math.min(s.count, m.instanceMatrix.count)
      const k = `${s.product}|${s.price}|${s.count}`
      if (k !== v.key) {
        v.key = k
        const p = s.product && PID[s.product]
        let tex
        if (!p) tex = tagTex('vazia', '#cfc6b8', '#6b6070')
        else if (s.price == null) tex = tagTex('sem preço', '#f4a09a', undefined, s.product)
        else if (s.count === 0) tex = tagTex('esgotado', '#f4a09a', undefined, s.product)
        else tex = tagTex(`${money(s.price).slice(3)} · ${s.count}`, s.count <= 6 ? '#f8dfa2' : '#f6e7cf', undefined, s.product)
        v.label.material.map = tex; v.label.material.needsUpdate = true
      }
    }
  }
  makeBoxView(b) {
    const gr = new THREE.Group(); gr.userData = { kind: 'box', id: b.id }
    const closed = baked('boxClosed', (g) => { g.add(box(0.6, 0.4, 0.48, C.cardboard, 0, 0.2, 0)); g.add(box(0.14, 0.41, 0.49, 0xe6c590, 0, 0.2, 0)) })
    const open = baked('boxOpen', (g) => {
      g.add(box(0.6, 0.36, 0.48, C.cardboard, 0, 0.18, 0))
      for (const [dz, rx] of [[-0.26, 0.9], [0.26, -0.9]]) { const f = box(0.6, 0.02, 0.24, 0xb98a55, 0, 0.42, dz); f.rotation.x = rx; g.add(f) }
    })
    const peek = new THREE.Group(); open.add(peek)
    gr.add(closed, open)
    const label = sprite(tagTex('', '#fff'), 0.8, 0.25); label.position.y = 0.85; gr.add(label)
    addHit(gr, 0.66, 0.5, 0.56)
    gr.position.set(0, 0, 0)
    this.scene.add(gr)
    return { gr, closed, open, peek, peekPid: null, label, key: '', inited: false }
  }
  syncBoxes(dt) {
    const boxes = toRaw(game.boxes)
    const alive = new Set(boxes.map((b) => b.id))
    for (const [id, v] of this.boxViews) if (!alive.has(id)) { this.scene.remove(v.gr); this.boxViews.delete(id) }
    const slots = boxSlots(boxes, game.plan)
    for (const b of boxes) {
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
      const isOpen = b.state === 'open' || b.state === 'empty'
      v.closed.visible = !isOpen; v.open.visible = isOpen
      if (v.peekPid !== b.product) { // a caixa pode trocar de conteúdo: mostra o produto atual
        v.peekPid = b.product
        v.peek.traverse((o) => o.isInstancedMesh && o.dispose())
        v.peek.clear()
        if (b.product) v.peek.add(assets.makeItemInstances(b.product, [0, 1, 2, 3].map((i) => itemAt(-0.17 + (i % 2) * 0.34, 0.3, i > 1 ? 0.08 : -0.08))))
      }
      v.gr.scale.setScalar(sel ? 0.8 : 1)
      const k = `${b.product}|${b.count}|${b.state}`
      if (k !== v.key) {
        v.key = k
        v.label.material.map = b.state === 'empty' ? tagTex('vazia', '#e8dcc8') : tagTex(String(b.count), b.state === 'open' ? '#fbe6a8' : '#f6e7cf', undefined, b.product)
        v.label.material.needsUpdate = true
        v.label.position.y = isOpen ? 0.95 : 0.8
      }
    }
  }
  makeActorView(a) {
    const gr = new THREE.Group()
    const hue = a.hue ?? 0.5
    const shirt = a.kind === 'player' ? C.coral : a.kind === 'staff' ? (a.role === 'cashier' ? C.mustard : C.teal) : new THREE.Color().setHSL(hue, 0.45, 0.68).getHex()
    const ch = a.kind === 'pet' ? assets.makeAnim(a.species) : a.kind === 'player' ? assets.makeCharacter(settings.character) : assets.makeNpc(a.kind === 'staff', a.hue ?? Math.random())
    const body = new THREE.Group(); gr.add(body)
    let mixer = null, clips = {}
    if (ch) {
      if (a.kind === 'player') assets.putHat(ch.obj, settings.hat, settings.hatColor)
      else if (a.kind === 'staff') assets.putHat(ch.obj, 'cap', a.role === 'cashier' ? '#f2c25b' : a.role === 'barista' ? '#ef8a77' : '#6fb3a8')
      else if (a.thief) assets.putHat(ch.obj, 'beanie', '#3b2f4a')
      ch.obj.traverse((o) => { if (o.isMesh) o.castShadow = false }) // quem anda usa a sombra redonda no chão
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
    const tag = sprite(tagTex('', '#b9e4c4'), 1.05, 0.33); tag.visible = false; gr.add(tag)
    if (a.kind === 'pet') { // área de clique maior que o bichinho
      Object.assign(gr.userData, { kind: 'pet', id: a.id })
      addHit(gr, 0.8, 0.8, 0.8)
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }))
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.userData.noOutline = true; gr.add(shadow)
    gr.position.set(a.x, 0, a.z)
    this.scene.add(gr)
    return { gr, body, emo, tag, mixer, clips, emoKey: '', tagKey: '', ph: Math.random() * 6 }
  }
  syncActors(dt) {
    const list = world.actors
    const alive = new Set(list.map((a) => a.id))
    for (const [id, v] of this.actorViews) if (!alive.has(id)) { this.scene.remove(v.gr); this.actorViews.delete(id) }
    for (const a of list) {
      let v = this.actorViews.get(a.id)
      const skin = a.kind === 'player' ? `${settings.character}|${settings.hat}|${settings.hatColor}` : a.kind === 'pet' ? a.species : ''
      if (v && v.skin !== skin) { this.scene.remove(v.gr); v = null }
      if (!v) { v = this.makeActorView(a); v.skin = skin; this.actorViews.set(a.id, v) }
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
      // balão com o valor pago: sobe devagar acima da emoção
      v.tag.visible = !!a.bubble
      if (a.bubble) {
        if (v.tagKey !== a.bubble) { v.tag.material.map = tagTex('+ ' + a.bubble, '#b9e4c4', '#245c43'); v.tag.material.needsUpdate = true; v.tagKey = a.bubble }
        v.tag.position.y = 1.6 + (2.6 - a.bubbleT) * 0.12
      }
      if (v.gr.userData.arrow) v.gr.userData.arrow.position.y = 1.4 + Math.sin(this.t * 4) * 0.05
    }
  }

  // ---------- horário do dia ----------
  applyTime() {
    let f = game.phase === 'open' || game.phase === 'lunch' ? game.clock / DAY_SECONDS : game.phase === 'closing' ? 0.97 : game.phase === 'night' ? 1.5 : 0
    let a = KEYS[0], b = KEYS[1]
    for (let i = 0; i < KEYS.length - 1; i++) if (f >= KEYS[i].t && f <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1] }
    const k = b.t === a.t ? 0 : (f - a.t) / (b.t - a.t)
    this.scene.background.setHex(a.sky).lerp(this.tmpColor.setHex(b.sky), k)
    this.scene.fog.color.copy(this.scene.background)
    this.sun.color.setHex(a.sun).lerp(this.tmpColor.setHex(b.sun), k)
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
      if (down && e.button === 0 && (ui.held || Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6)) this.onClick?.(this.pick(e), e)
      down = null
    })
    c.addEventListener('pointermove', (e) => {
      ui.mouse.x = e.clientX; ui.mouse.y = e.clientY
      this.pendingMove = e // processado uma vez por quadro, por mais eventos que o mouse dispare
    })
    c.addEventListener('pointerleave', () => { this.pendingMove = null; this.hover = null; this.onHover?.(null) })
  }
  pick(e) {
    if (ui.build) return null // durante a obra os cliques são dos controles das paredes
    const r = this.canvas.getBoundingClientRect()
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.mouse, this.camera)
    // com um móvel na mão só interessa o chão; fora do modo layout a decoração não é clicável
    if (!(ui.editing && ui.held)) {
      const hits = []
      const add = (g) => { if (g?.userData.hit) hits.push(g.userData.hit) }
      for (const v of this.shelfViews.values()) add(v.gr)
      add(this.counterG); add(this.cafeG)
      if (ui.editing) for (const g of this.decorViews.values()) add(g)
      else {
        for (const v of this.boxViews.values()) add(v.gr)
        add(this.doorG)
        for (const p of world.pets) add(this.actorViews.get(p.id)?.gr)
        for (const d of toRaw(game.decor)) if (isUsable(d)) add(this.decorViews.get(d.id))
      }
      for (const h of this.ray.intersectObjects(hits, false)) {
        let o = h.object
        while (o && !o.userData.kind) o = o.parent
        if (o) return { kind: o.userData.kind, id: o.userData.id, obj: o }
      }
    }
    const p = new THREE.Vector3()
    if (this.ray.ray.intersectPlane(this.floorPlane, p)) return { kind: 'floor', x: p.x, z: p.z }
    return null
  }

  // a câmera segue o jogador; o que a pessoa arrastou fica somado em cima desse movimento
  shiftView(dx, dz) {
    const t = this.controls.target
    t.x += dx; t.z += dz
    this.camera.position.x += dx; this.camera.position.z += dz
  }
  updateCamera(dt) {
    const pl = world.player, f = this.follow, t = this.controls.target, b = this.base
    const k = 1 - Math.exp(-dt * 4)
    const dx = (b.x + (pl.x - b.x) * 0.55 - f.x) * k, dz = (b.z + (pl.z - b.z) * 0.55 - f.z) * k
    f.x += dx; f.z += dz
    this.shiftView(dx, dz)
    // andar pelo teclado ou pedir para centralizar traz a visão de volta
    if (world.keys.size || ui.recenter) {
      const back = 1 - Math.exp(-dt * 5)
      this.shiftView((f.x - t.x) * back, (f.z - t.z) * back)
      if (Math.hypot(f.x - t.x, f.z - t.z) < 0.05) ui.recenter = false
    }
    // limite para não perder a loja de vista
    const { cols, rows } = dims(game.plan), mx = cols * 0.8, mz = rows * 0.8
    const ox = t.x - f.x, oz = t.z - f.z
    this.shiftView(Math.max(-mx, Math.min(mx, ox)) - ox, Math.max(-mz, Math.min(mz, oz)) - oz)
    this.controls.enablePan = !ui.held // com um móvel na mão, o mouse é do móvel
    this.controls.update()
    const panned = Math.hypot(t.x - f.x, t.z - f.z) > 0.6
    if (panned !== ui.panned) ui.panned = panned
  }

  update(dt) {
    this.t += dt
    if (this.builtKey !== planKey(game.plan)) this.buildShop()
    if (this.pendingMove) {
      const e = this.pendingMove
      this.pendingMove = null
      this.hover = this.pick(e)
      this.onHover?.(this.hover)
    }
    this.shadowTick = (this.shadowTick + 1) % (ui.held ? 3 : SHADOW_EVERY)
    if (!this.shadowTick) this.r.shadowMap.needsUpdate = true
    this.syncShelves(dt); this.syncDecor(); this.syncBoxes(dt); this.syncActors(dt); this.syncDoors(dt); this.syncLamp(); this.syncEditor()
    this.applyTime()
    this.syncTheft()
    const h = this.hover
    let mo = h && h.obj && !ui.modal ? h.obj : null
    const tg = world.target
    if (!mo && tg) mo = tg.kind === 'box' ? this.boxViews.get(tg.id)?.gr : tg.kind === 'shelf' ? this.shelfViews.get(tg.id)?.gr : tg.kind === 'counter' ? this.counterG : tg.kind === 'door' ? this.doorG : tg.kind === 'cafe' ? this.cafeG : tg.kind === 'pet' ? this.actorViews.get(tg.id)?.gr : tg.kind === 'decor' ? this.decorViews.get(tg.id) : null
    const selection = this.selectedObjects(mo)
    this.updateCamera(dt)
    this.syncBuild()
    // relógio da parede + cenário animado
    const hh = 9 + (game.phase === 'open' || game.phase === 'lunch' ? (game.clock / DAY_SECONDS) * 12 : game.phase === 'prep' ? -0.5 : game.phase === 'night' ? 12 : 12)
    const hi = Math.floor(hh), mi = Math.floor((hh % 1) * 60 / 5) * 5
    if (this.clock && this.clockKey !== hi * 100 + mi) { this.clockKey = hi * 100 + mi; this.clock.material.map = this.clockTex(hi, mi); this.clock.material.needsUpdate = true }
    const dayF = game.phase === 'open' || game.phase === 'lunch' ? Math.sin(Math.min(1, game.clock / DAY_SECONDS) * Math.PI) * 0.9 + 0.1 : game.phase === 'prep' ? 0.5 : game.phase === 'closing' ? 0.15 : 0
    this.scenery.update(dt, dayF, this.lampLevel || 0)
    this.r.render(this.scene, this.camera)
    this.renderOutline(selection)
  }
}
