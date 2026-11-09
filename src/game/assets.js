import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { PRODUCTS, PID } from './config.js'

// Coloque os .glb da Kenney em public/assets/kenney/{furniture,food,characters}.
// Se um arquivo não existir, o jogo usa um modelo procedural no lugar.
const BASE = '/assets/kenney/'
const MANIFEST = {
  register: { urls: ['shop/cash-register.glb'], fit: { w: 0.55 } },
  basket:   { urls: ['shop/shopping-basket.glb'], fit: { s: 0.4 } },
  freezer:  { urls: ['shop/freezers-standing.glb'], fit: { s: 1.0 } },
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
const CHARACTERS = ['shop/character-employee.glb', ...'abcdefghijklmnopqr'.split('').map((l) => `characters/character-${l}.glb`)]

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
