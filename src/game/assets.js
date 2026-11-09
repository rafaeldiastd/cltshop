import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { PRODUCTS, PID, DECOR } from './config.js'

// Coloque os .glb da Kenney em public/assets/kenney/{furniture,food,characters}.
// Se um arquivo não existir, o jogo usa um modelo procedural no lugar.
const BASE = '/assets/kenney/'
const MANIFEST = {
  register: { urls: ['shop/cash-register.glb'], fit: { w: 0.78 } },
  basket:   { urls: ['shop/shopping-basket.glb'], fit: { s: 0.4 } },
  chest:    { urls: ['shop/freezer.glb'], fit: { w: 0.94 } },
  mannequin: { urls: ['shop/mannequin.glb'], fit: { h: 1.15 } },
  bottles:  { urls: ['shop/bottle-return.glb'], fit: { h: 1.05 } },
  column:   { urls: ['shop/column.glb'], fit: { h: 1.3 } },
  dFruit:   { urls: ['shop/display-fruit.glb'], fit: { s: 0.9 } },
  dBread:   { urls: ['shop/display-bread.glb'], fit: { s: 0.9 } },
  dFlowers: { urls: ['shop/display-flowers.glb'], fit: { s: 1.2 } },
  cart:     { urls: ['shop/shopping-cart.glb'], fit: { s: 0.8 } },
  truck:    { urls: ['shop/hand-truck.glb'], fit: { s: 0.8 } },
  gacha:    { urls: ['shop/gacha-machine.glb'], fit: { s: 1.0 } },
  car0:     { urls: ['cars/sedan.glb'], fit: { s: 2.0 } },
  car1:     { urls: ['cars/taxi.glb'], fit: { s: 2.0 } },
  car2:     { urls: ['cars/delivery.glb'], fit: { s: 2.4 } },
  car3:     { urls: ['cars/suv.glb'], fit: { s: 2.1 } },
  car4:     { urls: ['cars/hatchback-sports.glb'], fit: { s: 1.9 } },
  cat:      { urls: ['pets/animal-cat.glb'], fit: { s: 0.5 } },
  dog:      { urls: ['pets/animal-dog.glb'], fit: { s: 0.6 } },
  tree0:    { urls: ['nature/CommonTree_1.gltf'], fit: { h: 3.2 } },
  tree1:    { urls: ['nature/CommonTree_2.gltf'], fit: { h: 3.6 } },
  tree2:    { urls: ['nature/CommonTree_3.gltf'], fit: { h: 2.8 } },
  bush0:    { urls: ['nature/Bush_Common.gltf'], fit: { s: 1.0 } },
  bush1:    { urls: ['nature/Bush_Common_Flowers.gltf'], fit: { s: 1.0 } },
  flower0:  { urls: ['nature/Flower_3_Group.gltf'], fit: { s: 0.7 } },
  flower1:  { urls: ['nature/Flower_4_Group.gltf'], fit: { s: 0.7 } },
  grass:    { urls: ['nature/Grass_Common_Tall.gltf'], fit: { s: 0.7 } },
  rock:     { urls: ['nature/Rock_Medium_1.gltf'], fit: { s: 0.9 } },
}
// só o estilo Mini: jogador e NPCs usam o mesmo modelo, e os chapéus dão a variedade
const CHARACTERS = ['shop/character-employee.glb']

const loader = new GLTFLoader()
const store = new Map()
const chars = []

function prepare(scene, fit) {
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const k = fit.s ? fit.s / Math.max(size.x, size.y, size.z) : fit.w ? fit.w / Math.max(size.x, size.z) : fit.h ? fit.h / size.y : 1
  scene.scale.multiplyScalar(k)
  const b2 = new THREE.Box3().setFromObject(scene)
  const c = b2.getCenter(new THREE.Vector3())
  scene.position.set(-c.x, -b2.min.y, -c.z)
  const g = new THREE.Group()
  g.add(scene)
  return g
}

async function tryLoad(urls, fit) {
  for (const u of urls) {
    try {
      const res = await fetch(BASE + u)
      if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) continue
      const gltf = await loader.parseAsync(await res.arrayBuffer(), BASE + u.slice(0, u.lastIndexOf('/') + 1))
      return { scene: prepare(gltf.scene, fit), animations: gltf.animations }
    } catch (e) { /* tenta o próximo */ }
  }
  return null
}

export async function loadAssets() {
  const jobs = []
  for (const [k, m] of Object.entries(MANIFEST)) jobs.push(tryLoad(m.urls, m.fit).then((r) => r && store.set(k, r)))
  for (const p of PRODUCTS) jobs.push(tryLoad([`food/${p.model}.glb`], { s: 0.17 }).then((r) => r && store.set('food:' + p.id, r)))
  const cj = CHARACTERS.map((u) => tryLoad([u], { h: 0.95 }))
  await Promise.all([...jobs, ...cj])
  for (const p of cj) { const r = await p; if (r) chars.push(r) }
  return { models: store.size, characters: chars.length }
}

export const has = (k) => store.has(k)
export const make = (k) => (store.has(k) ? skClone(store.get(k).scene) : null)
export function makeAnim(k) {
  if (!store.has(k)) return null
  const r = store.get(k)
  return { obj: skClone(r.scene), animations: r.animations }
}
export const charCount = () => chars.length
export function makeCharacter(i) {
  if (!chars.length) return null
  const c = chars[i % chars.length]
  return { obj: skClone(c.scene), animations: c.animations }
}

// miniaturas do seletor de personagem (geradas uma vez, em um contexto WebGL temporário)
let thumbs = null
export function characterThumbs(size = 112) {
  if (thumbs) return thumbs
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  r.setPixelRatio(1); r.setSize(size, size, false)
  const scene = new THREE.Scene()
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(1, 2, 3)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb09a8a, 1.6), sun)
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 10); cam.position.set(0.55, 0.95, 2.1); cam.lookAt(0, 0.5, 0)
  thumbs = chars.map((c) => {
    const o = skClone(c.scene)
    posed(o, c.animations)
    scene.add(o); r.render(scene, cam); scene.remove(o)
    return r.domElement.toDataURL('image/png')
  })
  r.dispose(); r.forceContextLoss()
  return thumbs
}
// miniatura de cada produto a partir do próprio modelo 3D (para a interface e as etiquetas)
function studio(size = 96) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  r.setPixelRatio(1); r.setSize(size, size, false)
  const scene = new THREE.Scene()
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(1, 3, 2)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb09a8a, 1.8), sun)
  const cam = new THREE.PerspectiveCamera(24, 1, 0.01, 10)
  return {
    shot(obj) {
      const bounds = new THREE.Box3().setFromObject(obj)
      const c = bounds.getCenter(new THREE.Vector3()), s = bounds.getSize(new THREE.Vector3())
      const d = Math.max(s.x, s.y, s.z)
      cam.position.set(c.x + d * 0.9, c.y + d * 1.4, c.z + d * 2.2); cam.lookAt(c)
      scene.add(obj); r.render(scene, cam); scene.remove(obj)
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
      canvas.getContext('2d').drawImage(r.domElement, 0, 0)
      return { canvas, url: canvas.toDataURL('image/png') }
    },
    close() { r.dispose(); r.forceContextLoss() },
  }
}
let products = null, decorShots = null
function renderProducts() {
  if (products) return products
  const s = studio()
  products = Object.fromEntries(PRODUCTS.map((p) => [p.id, s.shot(makeItem(p.id))]))
  s.close()
  return products
}
export const productIcon = (id) => renderProducts()[id].canvas
export const productThumb = (id) => renderProducts()[id].url
// null quando o item não tem modelo 3D (a planta é desenhada à mão)
export function decorThumb(type) {
  if (!decorShots) {
    const s = studio()
    decorShots = {}
    for (const [k, d] of Object.entries(DECOR)) if (d.price && store.has(k)) decorShots[k] = s.shot(make(k)).url
    s.close()
  }
  return decorShots[type] || null
}

function posed(obj, animations) {
  const clip = animations.find((a) => a.name.toLowerCase() === 'idle') || animations[0]
  if (!clip) return null
  const mixer = new THREE.AnimationMixer(obj)
  mixer.clipAction(clip).play(); mixer.update(0)
  return mixer
}
export { posed as poseCharacter }

export const HATS = [
  { id: 'none', name: 'Sem chapéu' },
  { id: 'cap', name: 'Boné' },
  { id: 'beanie', name: 'Gorro' },
  { id: 'straw', name: 'Chapéu' },
  { id: 'crown', name: 'Coroa' },
]
export const HAT_COLORS = ['#ef8a77', '#6fb3a8', '#f2c25b', '#5b4a6e', '#f6e7cf', '#7fa6c9']
const NPC_HATS = ['none', 'cap', 'beanie', 'straw', 'cap', 'beanie']
export const npcLook = (h) => [NPC_HATS[Math.floor(h * NPC_HATS.length) % NPC_HATS.length], HAT_COLORS[Math.floor(h * 97) % HAT_COLORS.length]]

// medidas em unidades do jogo; a base do chapéu fica em y = 0
function makeHat(type, color) {
  const g = new THREE.Group()
  const col = mat(color), add = (geo, x, y, z, m = col) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o }
  const R = 0.2
  const dome = new THREE.SphereGeometry(R, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  if (type === 'cap') {
    add(dome, 0, -0.03, 0)
    add(new THREE.BoxGeometry(R * 1.5, 0.03, R * 1.15), 0, -0.02, R * 1.3)
  } else if (type === 'beanie') {
    add(dome, 0, -0.01, 0)
    add(new THREE.CylinderGeometry(R * 1.04, R * 1.08, 0.08, 18), 0, -0.02, 0, mat(0xfff4e0))
    add(new THREE.SphereGeometry(0.06, 10, 8), 0, R + 0.03, 0, mat(0xfff4e0))
  } else if (type === 'straw') {
    add(new THREE.CylinderGeometry(R * 2, R * 2.05, 0.03, 22), 0, 0, 0, mat(0xe8cf94))
    add(new THREE.CylinderGeometry(R * 0.92, R, 0.16, 18), 0, 0.09, 0, mat(0xe8cf94))
    add(new THREE.CylinderGeometry(R * 1.01, R * 1.02, 0.05, 18), 0, 0.04, 0)
  } else if (type === 'crown') {
    const gold = mat(0xf2c25b, { metalness: 0.3, roughness: 0.4 })
    add(new THREE.CylinderGeometry(R, R, 0.08, 18), 0, 0.02, 0, gold)
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.ConeGeometry(0.05, 0.11, 6), Math.sin(a) * R * 0.86, 0.11, Math.cos(a) * R * 0.86, gold) }
    add(new THREE.SphereGeometry(0.035, 8, 6), 0, 0.03, R + 0.01, mat(color))
  }
  return g
}
// o chapéu vai preso no osso da cabeça para acompanhar a animação
export function putHat(obj, type, color) {
  if (!type || type === 'none') return
  const head = obj.getObjectByName('head')
  if (!head) return
  obj.updateWorldMatrix(true, true)
  const top = new THREE.Box3().setFromObject(obj).max.y
  const wp = head.getWorldPosition(new THREE.Vector3()), ws = head.getWorldScale(new THREE.Vector3())
  const hat = makeHat(type, color)
  hat.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z)
  hat.position.y = (top - wp.y) / ws.y
  head.add(hat)
}

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o })
const shared = {}
const m = (color) => (shared[color] ||= mat(color))

export function makeItem(pid) {
  const k = make('food:' + pid)
  if (k) return k
  const p = PID[pid]
  const g = new THREE.Group()
  let mesh
  switch (p.shape) {
    case 'sphere': mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), m(p.color)); mesh.position.y = 0.075; break
    case 'box': mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), m(p.color)); mesh.position.y = 0.09
      { const cap = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.05, 0.105), m(0x5d8fd6)); cap.position.y = 0.16; g.add(cap) } break
    case 'loaf': mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.13, 4, 8), m(p.color)); mesh.rotation.z = Math.PI / 2; mesh.position.y = 0.06; break
    case 'flat': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12), m(p.color)); mesh.position.y = 0.02; break
    case 'long': mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 4, 8), m(p.color)); mesh.rotation.z = Math.PI / 2; mesh.position.y = 0.04; break
    case 'wedge': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 3), m(p.color)); mesh.position.y = 0.04; break
    case 'torus': mesh = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 8, 14), m(p.color)); mesh.rotation.x = Math.PI / 2; mesh.position.y = 0.035; break
    case 'cake': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), m(p.color)); mesh.position.y = 0.05
      { const top = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m(0xd9453d)); top.position.y = 0.12; g.add(top) } break
    default: mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), m(p.color)); mesh.position.y = 0.05
  }
  mesh.castShadow = true
  g.add(mesh)
  return g
}

export { mat, m as sharedMat }
