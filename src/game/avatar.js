// Monta o personagem do jogador a partir das partes do Mini Characters.
// Todos os modelos têm o mesmo esqueleto (root, pernas, tronco, braços, cabeça), a cabeça e o corpo
// em malhas separadas e a mesma textura de paleta. Então dá para:
//  - trocar a cabeça: a malha da cabeça de um modelo é presa ao esqueleto do corpo de outro;
//  - trocar cores: as coordenadas de textura de cada região (pele, cabelo, olhos, blusa, calça)
//    passam para outra célula da paleta, sem criar textura nova.
import * as THREE from 'three'
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { charByUrl, putHat, poseCharacter } from './assets.js'
import { partUrl } from './avatarData.js'

// o funcionário da loja usa a paleta do pacote Mini Shop, com outra arrumação:
// estas são as células equivalentes na paleta dos personagens
const EMPLOYEE_CELLS = { '3.5': '2.9', '2.5': '2.1', '2.3': '3.15', '2.9': '2.5', '2.4': '2.0', '3.3': '3.11' }
// modelos sem a face padrão (220 vértices de pele na cabeça): pele indicada à mão
const SKIN_OVERRIDE = { soldier: '2.1', alien: '1.5', knight: null, robot: null }
const GROUP = { root: 'torso', torso: 'torso', 'arm-left': 'arms', 'arm-right': 'arms', 'leg-left': 'legs', 'leg-right': 'legs', head: 'head' }
const cellOf = (u, v) => `${Math.floor(v * 4)}.${Math.floor(u * 16)}`

let atlas = null // material com a paleta dos personagens, usado por todas as partes

function meshes(root) {
  let head = null, body = null
  root.traverse((o) => { if (o.isSkinnedMesh) { if (o.name === 'head-mesh') head = o; else body = o } })
  return { head, body }
}
function dominant(cells, skip) {
  const n = {}
  for (const c of cells) if (c && !skip.has(c)) n[c] = (n[c] || 0) + 1
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

// análise de cada modelo (feita uma vez): célula e região de cada vértice
const analysis = new Map()
function analyze(id) {
  if (analysis.has(id)) return analysis.get(id)
  const src = charByUrl(partUrl(id))
  if (!src) return null
  const { head, body } = meshes(src.scene)
  if (!head || !body) return null
  if (!atlas && id !== 'employee') atlas = body.material
  const read = (mesh) => {
    const uv = mesh.geometry.attributes.uv, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight
    const cells = [], groups = []
    for (let i = 0; i < uv.count; i++) {
      let c = cellOf(uv.getX(i), uv.getY(i))
      if (id === 'employee') c = EMPLOYEE_CELLS[c] || c
      cells.push(c)
      let best = 0
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
      groups.push(GROUP[mesh.skeleton.bones[si.getComponent(i, best)]?.name] || 'torso')
    }
    return { cells, groups }
  }
  const h = read(head), b = read(body)
  // pele: a face padrão tem 220 vértices numa célula só
  const count = {}
  for (const c of h.cells) count[c] = (count[c] || 0) + 1
  let skin = Object.keys(count).find((c) => count[c] === 220) || null
  if (id in SKIN_OVERRIDE) skin = SKIN_OVERRIDE[id]
  // olhos: células escuras coladas na frente do rosto, na altura dos olhos
  const pos = head.geometry.attributes.position
  const eyes = h.cells.map((c, i) => /^3\.[67]$/.test(c) && pos.getZ(i) > 0.15 && pos.getZ(i) < 0.18 && pos.getY(i) > 0.38 && pos.getY(i) < 0.56 && Math.abs(pos.getX(i)) < 0.14)
  const noSkin = new Set([skin])
  const a = {
    id, src, head: h, body: b, skin, eyes,
    hair: dominant(h.cells.filter((_, i) => !eyes[i]), noSkin),
    top: dominant(b.cells.filter((_, i) => b.groups[i] !== 'legs'), noSkin),
    bottom: dominant(b.cells.filter((_, i) => b.groups[i] === 'legs'), noSkin),
  }
  analysis.set(id, a)
  return a
}

// troca a célula mantendo a posição dentro dela (e a versão lisa/degradê da cor)
function retarget(from, to) {
  if (!to || to === from) return from
  const [r, c] = to.split('.').map(Number)
  return `${r}.${c - (c % 2) + (Number(from.split('.')[1]) % 2)}`
}
function recolor(mesh, info, part, pick, src) {
  const geo = mesh.geometry.clone()
  const uv = geo.attributes.uv
  const raw = src.geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    const cell = info.cells[i]
    const target = retarget(cell, pick(cell, i))
    const [r0, c0] = cellOf(raw.getX(i), raw.getY(i)).split('.').map(Number)
    const [r1, c1] = target.split('.').map(Number)
    if (r0 !== r1 || c0 !== c1) uv.setXY(i, raw.getX(i) + (c1 - c0) / 16, raw.getY(i) + (r1 - r0) / 4)
  }
  uv.needsUpdate = true
  mesh.geometry = geo
  if (atlas) mesh.material = atlas
}

// av: { head, body, skin, hair, eyes, top, bottom, hat, hatColor, face }
export function makeAvatar(av) {
  if (!atlas) analyze('male-a') // garante o material com a paleta dos personagens
  const B = analyze(av.body), H = analyze(av.head) || B
  if (!B) return null
  const obj = skClone(B.src.scene)
  const { head: oldHead, body } = meshes(obj)
  // cabeça de outro modelo presa ao esqueleto deste corpo (os ossos têm os mesmos nomes)
  const srcHead = meshes(H.src.scene).head
  let head = oldHead
  if (H !== B) {
    const bones = {}
    obj.traverse((o) => { if (o.isBone) bones[o.name] = o })
    head = new THREE.SkinnedMesh(srcHead.geometry, srcHead.material)
    head.name = 'head-mesh'
    head.castShadow = oldHead.castShadow; head.receiveShadow = oldHead.receiveShadow
    head.bind(new THREE.Skeleton(srcHead.skeleton.bones.map((b) => bones[b.name]), srcHead.skeleton.boneInverses), srcHead.bindMatrix)
    // caixa calculada no carregamento (antes da escala): recalcular agora aplicaria a escala duas vezes
    if (srcHead.boundingBox) head.boundingBox = srcHead.boundingBox.clone()
    if (srcHead.boundingSphere) head.boundingSphere = srcHead.boundingSphere.clone()
    oldHead.parent.add(head)
    oldHead.removeFromParent()
  }
  // pele única para cabeça e mãos (com partes de modelos diferentes, vale a da cabeça)
  const skin = av.skin || H.skin
  recolor(head, H.head, H, (c, i) => (c === H.skin ? skin : H.eyes[i] ? av.eyes : c === H.hair ? av.hair : null), srcHead)
  recolor(body, B.body, B, (c, i) => {
    if (c === B.skin) return skin
    const g = B.body.groups[i]
    if (g !== 'legs' && c === B.top) return av.top
    if (g === 'legs' && c === B.bottom) return av.bottom
    return null
  }, meshes(B.src.scene).body)
  putHat(obj, av.hat, av.hatColor)
  putFace(obj, head, H, av.face)
  return { obj, animations: B.src.animations }
}

// óculos e bigode: presos ao osso da cabeça, na frente dos olhos
function putFace(obj, head, H, type) {
  if (!type || type === 'none') return
  const bone = obj.getObjectByName('head')
  if (!bone) return
  obj.updateMatrixWorld(true)
  // centro dos olhos na pose original do modelo (sem olhos detectados, como no robô, a frente do rosto na altura dos olhos)
  const pos = head.geometry.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3()
  let n = 0
  for (let i = 0; i < pos.count; i++) if (H.eyes[i]) { c.add(v.fromBufferAttribute(pos, i)); n++ }
  if (!n) {
    let maxZ = -Infinity
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.38 && pos.getY(i) < 0.56) maxZ = Math.max(maxZ, pos.getZ(i))
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.38 && pos.getY(i) < 0.56 && pos.getZ(i) > maxZ - 0.01) { c.add(v.fromBufferAttribute(pos, i)); n++ }
  }
  if (!n) return
  c.divideScalar(n)
  c.x = 0
  // do espaço do modelo para o espaço do osso da cabeça (a mesma conta do esqueleto na pose original)
  const hi = head.skeleton.bones.findIndex((b) => b.name === 'head')
  c.applyMatrix4(head.bindMatrix).applyMatrix4(head.skeleton.boneInverses[hi])
  const ws = bone.getWorldScale(new THREE.Vector3())
  const g = new THREE.Group()
  const dark = new THREE.MeshStandardMaterial({ color: 0x38383d, roughness: 0.6 })
  const add = (geo, x, y, z, m = dark) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o }
  const s = 0.26 // tamanho do rosto em unidades do jogo (os modelos têm ~0,95 de altura)
  if (type === 'glasses' || type === 'sunglasses') {
    const lens = type === 'sunglasses' ? dark : new THREE.MeshStandardMaterial({ color: 0xd0e8ff, transparent: true, opacity: 0.35 })
    for (const x of [-1, 1]) {
      add(new THREE.TorusGeometry(s * 0.17, s * 0.03, 6, 16), x * s * 0.27, 0, 0.012)
      add(new THREE.CircleGeometry(s * 0.17, 16), x * s * 0.27, 0, 0.01, lens)
    }
    add(new THREE.BoxGeometry(s * 0.2, s * 0.04, s * 0.04), 0, s * 0.03, 0.012)
  } else if (type === 'mustache') {
    const brown = new THREE.MeshStandardMaterial({ color: 0x5b3a2e, roughness: 0.9 })
    for (const x of [-1, 1]) { const m = add(new THREE.CapsuleGeometry(s * 0.07, s * 0.18, 4, 8), x * s * 0.11, -s * 0.3, 0.03, brown); m.rotation.z = Math.PI / 2 + x * 0.35 }
  }
  g.position.copy(c)
  g.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z)
  bone.add(g)
}

// miniaturas das partes para o criador: cabeça (de perto) e corpo (sem a cabeça), geradas uma vez
let partShots = null
export function partThumbs(ids, size = 96) {
  if (partShots) return partShots
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  r.setPixelRatio(1); r.setSize(size, size, false)
  const scene = new THREE.Scene()
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(1, 2, 3)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb09a8a, 1.6), sun)
  const headCam = new THREE.PerspectiveCamera(24, 1, 0.1, 10); headCam.position.set(0.35, 0.95, 1.5); headCam.lookAt(0, 0.74, 0)
  const bodyCam = new THREE.PerspectiveCamera(24, 1, 0.1, 10); bodyCam.position.set(0.45, 0.6, 1.7); bodyCam.lookAt(0, 0.3, 0)
  partShots = { head: {}, body: {} }
  for (const id of ids) {
    const ch = makeAvatar({ head: id, body: id, hat: 'none', face: 'none' })
    if (!ch) continue
    poseCharacter(ch.obj, ch.animations)
    scene.add(ch.obj)
    const { head } = meshes(ch.obj)
    r.render(scene, headCam); partShots.head[id] = r.domElement.toDataURL('image/png')
    head.visible = false
    r.render(scene, bodyCam); partShots.body[id] = r.domElement.toDataURL('image/png')
    scene.remove(ch.obj)
  }
  r.dispose(); r.forceContextLoss()
  return partShots
}

export { poseCharacter }
