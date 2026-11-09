import * as THREE from 'three'
import * as assets from './assets.js'

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o })
const rnd = (a, b) => a + Math.random() * (b - a)
const shadowAll = (o) => o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true } })

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  draw(cv.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat) }
  return t
}
const glowTex = () => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
  gr.addColorStop(0, 'rgba(255,230,170,1)'); gr.addColorStop(1, 'rgba(255,200,120,0)')
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
})

// cenário externo: calçada, rua com carros, árvores, arbustos, postes, luz da janela e partículas de poeira
export class Scenery {
  constructor(scene) {
    this.scene = scene
    this.group = null
    this.cars = []
    this.glows = []
    this.shaft = null
    this.motes = null
    this.carTimer = 1
    this.t = 0
  }

  place(obj, x, z, s = 1, ry = Math.random() * 6.28, y = 0) {
    obj.position.set(x, y, z); obj.rotation.y = ry; obj.scale.multiplyScalar(s); shadowAll(obj); this.group.add(obj)
    return obj
  }

  build({ cols, rows, doorX }) {
    if (this.group) this.scene.remove(this.group)
    const g = (this.group = new THREE.Group())
    this.cars = []; this.glows = []
    const cx = cols / 2 - 0.5
    this.d = { cols, rows, doorX, cx }

    // chão de grama com manchas
    const grassT = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#9dbd7e'; c.fillRect(0, 0, w, h)
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${90 + Math.random() * 40},${140 + Math.random() * 50},90,0.28)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rnd(4, 16), 0, 7); c.fill() }
    }, [14, 14])
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 }))
    grass.rotation.x = -Math.PI / 2; grass.position.set(cx, -0.03, rows / 2); grass.receiveShadow = true; g.add(grass)

    // calçada de pedras
    const walkT = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#dccfb8'; c.fillRect(0, 0, w, h)
      for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#d3c4aa' : '#e3d7c1'; c.fillRect(x * 64 + (y ? 32 : 0) % 64, y * 64, 62, 62) }
      c.strokeStyle = 'rgba(100,80,60,.15)'; c.strokeRect(0, 0, w, h)
    }, [(cols + 18) / 2, 1.3])
    const side = new THREE.Mesh(new THREE.PlaneGeometry(cols + 18, 2.6), new THREE.MeshStandardMaterial({ map: walkT, roughness: 1 }))
    side.rotation.x = -Math.PI / 2; side.position.set(cx, -0.005, rows + 1.2); side.receiveShadow = true; g.add(side)
    const curb = new THREE.Mesh(new THREE.BoxGeometry(cols + 18, 0.1, 0.18), std(0xb9ab94)); curb.position.set(cx, 0.03, rows + 2.55); curb.receiveShadow = true; g.add(curb)

    // rua com faixas
    const roadT = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#4b4863'; c.fillRect(0, 0, w, h)
      for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3) }
    }, [14, 2])
    const road = new THREE.Mesh(new THREE.PlaneGeometry(cols + 40, 8), new THREE.MeshStandardMaterial({ map: roadT, roughness: 1 }))
    road.rotation.x = -Math.PI / 2; road.position.set(cx, -0.012, rows + 6.6); road.receiveShadow = true; g.add(road)
    for (let i = -14; i < cols + 14; i += 2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.1), new THREE.MeshBasicMaterial({ color: 0xf2e6c4 }))
      dash.rotation.x = -Math.PI / 2; dash.position.set(i + 0.5, -0.005, rows + 6.6); g.add(dash)
    }
    this.laneZ = [rows + 5.3, rows + 7.9]

    // caminho de pedras até a porta
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 10), std(0xcfc3ad)); st.position.set(doorX + (i - 1) * 0.0, 0.0, rows + 0.1); st.visible = false; g.add(st)
    }

    // árvores
    const trees = [[-4.5, -1], [-6, 3.5], [-3.6, rows - 0.5], [cols + 3.5, 0], [cols + 5, 4], [cols + 3.2, rows - 1], [cx - 5, -4], [cx + 4, -4.5], [1, -5.5], [cols, -6], [-8, rows + 1.6], [cols + 7, rows + 1.6], [cx - 9, -2], [cx + 9, -2]]
    trees.forEach(([x, z], i) => {
      const t = assets.make('tree' + (i % 3))
      if (t) this.place(t, x, z, rnd(0.85, 1.15))
      else {
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.2, 8), std(0x8a5a3a)); tr.position.set(x, 0.6, z); tr.castShadow = true
        const lv = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), std(0x6fa96b)); lv.position.set(x, 1.8, z); lv.castShadow = true
        g.add(tr, lv)
      }
    })
    // arbustos e flores
    const bushes = [[-1.7, 0.6], [-1.7, 3.2], [-1.7, rows - 1], [cols + 0.55, 0.5], [cols + 0.6, 3], [cols + 0.6, rows - 2], [doorX - 4.6, rows + 2.3], [doorX + 4.4, rows + 2.3], [-5, rows + 2.3], [cols + 4, rows + 2.3]]
    bushes.forEach(([x, z], i) => {
      const b = assets.make('bush' + (i % 2))
      if (b) this.place(b, x, z, rnd(0.8, 1.1))
      else { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), std(0x5f9f62)); m.position.set(x, 0.35, z); m.castShadow = true; g.add(m) }
    })
    for (let i = 0; i < 26; i++) {
      const x = rnd(-9, cols + 9), z = rnd(-7, rows - 1)
      if (x > -1.2 && x < cols + 0.2 && z > -1 && z < rows + 0.5) continue
      const k = Math.random()
      const o = assets.make(k < 0.4 ? 'flower0' : k < 0.7 ? 'flower1' : k < 0.85 ? 'grass' : 'rock')
      if (o) this.place(o, x, z, rnd(0.8, 1.3))
    }

    // postes de luz
    for (const x of [-3, cols + 2.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), std(0x3b2f4a)); pole.position.set(x, 1.3, rows + 2.35); pole.castShadow = true
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), std(0x3b2f4a)); arm.position.set(x, 2.58, rows + 2.15)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); bulb.position.set(x, 2.5, rows + 1.95)
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))
      glow.scale.set(2.2, 2.2, 1); glow.position.copy(bulb.position)
      g.add(pole, arm, bulb, glow); this.glows.push(glow)
    }

    // luz entrando pela janela
    const gt = canvasTex(8, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h) })
    const geo = new THREE.BufferGeometry()
    const v = [2.4, 1.85, -0.4, 4.2, 1.85, -0.4, 5.7, 0.03, 3.4, 3.9, 0.03, 3.4]
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    this.shaft = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: gt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.3 }))
    g.add(this.shaft)

    // partículas de poeira
    const N = 60, pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd(0, cols - 1); pos[i * 3 + 1] = rnd(0.2, 2); pos[i * 3 + 2] = rnd(0, rows - 1) }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.06, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }))
    g.add(this.motes)

    this.scene.add(g)
  }

  spawnCar() {
    const dir = Math.random() < 0.5 ? 1 : -1
    const k = Math.floor(Math.random() * 5)
    const car = new THREE.Group()
    const m = assets.make('car' + k)
    if (m) { m.rotation.y = 0; car.add(m) }
    else {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.9), std([0xef8a77, 0x6fb3a8, 0xf2c25b, 0x8f8cff, 0xe8eef8][k])); b.position.y = 0.4; b.castShadow = true
      const c = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.8), std(0xcfe7f0)); c.position.set(-0.1, 0.8, 0); car.add(b, c)
      car.userData.fallback = true
    }
    const { cols } = this.d
    const z = this.laneZ[dir > 0 ? 1 : 0]
    car.position.set(dir > 0 ? -14 : cols + 14, 0, z)
    // modelos Kenney olham para +z: gira para andar em x
    car.rotation.y = car.userData.fallback ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2
    car.userData.v = dir * rnd(2.2, 3.4)
    this.group.add(car); this.cars.push(car)
  }

  update(dt, daylight, lampLevel) {
    if (!this.group) return
    this.t += dt
    this.carTimer -= dt
    if (this.carTimer <= 0 && this.cars.length < 4) { this.spawnCar(); this.carTimer = rnd(4, 11) }
    const { cols } = this.d
    for (const c of [...this.cars]) {
      c.position.x += c.userData.v * dt
      if (c.position.x > cols + 16 || c.position.x < -16) { this.group.remove(c); this.cars.splice(this.cars.indexOf(c), 1) }
    }
    this.glows.forEach((gl, i) => { gl.material.opacity = Math.min(1, lampLevel * 0.9) * (0.9 + Math.sin(this.t * 2 + i) * 0.05) })
    if (this.shaft) this.shaft.material.opacity = 0.32 * daylight
    if (this.motes) {
      const p = this.motes.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        p.setY(i, p.getY(i) + Math.sin(this.t * 0.6 + i) * 0.1 * dt)
        p.setX(i, p.getX(i) + Math.cos(this.t * 0.3 + i * 2) * 0.12 * dt)
      }
      p.needsUpdate = true
      this.motes.material.opacity = 0.25 + 0.4 * daylight
    }
  }
}
