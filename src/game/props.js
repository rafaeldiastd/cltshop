import * as THREE from 'three'

// Objetos do cenário externo, montados com formas simples (sem modelos prontos): moto, prédios vizinhos e mobiliário de rua.
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o })
const tex = (w, h, draw, repeat) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  draw(cv.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat) }
  return t
}
const part = (group, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; group.add(o); return o
}
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const cyl = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s)

// ---------- moto de entrega: scooter vermelha com baú amarelo "ZAP"; frente em +z, comprimento ~1,5 ----------
export function makeMoto() {
  const m = new THREE.Group()
  const red = std(0xd9453d, { roughness: 0.5 }), redIn = std(0xd9453d, { roughness: 0.5, side: THREE.DoubleSide })
  const dark = std(0x24202c), black = std(0x1a1620), metal = std(0xa8a5b4, { metalness: 0.5, roughness: 0.4 }), cream = std(0xf6e7cf)
  const yellow = std(0xf2c25b, { roughness: 0.6 }), yellowDark = std(0xd9a43b)
  // rodas: pneu, aro e cubo
  for (const z of [0.55, -0.55]) {
    part(m, cyl(0.21, 0.1, 20), dark, 0, 0.21, z, 0, 0, Math.PI / 2)
    part(m, cyl(0.125, 0.11, 16), metal, 0, 0.21, z, 0, 0, Math.PI / 2)
    part(m, cyl(0.045, 0.14, 8), black, 0, 0.21, z, 0, 0, Math.PI / 2)
  }
  // paralamas: meio cilindro sobre cada roda
  const fender = new THREE.CylinderGeometry(0.25, 0.25, 0.13, 16, 1, true, 0, Math.PI)
  part(m, fender, redIn, 0, 0.21, 0.55, 0, 0, Math.PI / 2)
  part(m, new THREE.CylinderGeometry(0.25, 0.25, 0.13, 16, 1, true, 0, Math.PI), redIn, 0, 0.23, -0.55, 0, 0, Math.PI / 2)
  // garfo dianteiro e coluna de direção
  for (const x of [-0.075, 0.075]) part(m, bx(0.03, 0.5, 0.03), metal, x, 0.46, 0.5, -0.3, 0, 0)
  // assoalho, escudo das pernas e carenagem traseira
  part(m, bx(0.34, 0.06, 0.5), dark, 0, 0.23, 0.02)
  part(m, bx(0.34, 0.05, 0.46), red, 0, 0.27, 0.02)
  part(m, bx(0.34, 0.5, 0.07), red, 0, 0.55, 0.36, -0.22, 0, 0)
  part(m, new THREE.CapsuleGeometry(0.16, 0.34, 5, 12), red, 0, 0.42, -0.32, Math.PI / 2, 0, 0)
  part(m, bx(0.4, 0.02, 0.3), cream, 0, 0.255, 0.02) // faixa clara no assoalho
  // banco e apoio
  part(m, bx(0.3, 0.09, 0.5), black, 0, 0.62, -0.3)
  part(m, bx(0.3, 0.14, 0.05), black, 0, 0.72, -0.56)
  // guidão, manoplas, retrovisores e farol
  part(m, cyl(0.02, 0.5, 8), metal, 0, 0.88, 0.4, 0, 0, Math.PI / 2)
  for (const x of [-0.27, 0.27]) {
    part(m, cyl(0.03, 0.1, 8), black, x, 0.88, 0.4, 0, 0, Math.PI / 2)
    part(m, bx(0.015, 0.14, 0.015), metal, x * 0.9, 0.96, 0.4)
    part(m, bx(0.09, 0.055, 0.02), metal, x * 0.95, 1.04, 0.4)
  }
  part(m, bx(0.3, 0.2, 0.16), red, 0, 0.88, 0.47)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff4c8, toneMapped: false }))
  head.position.set(0, 0.88, 0.56); m.add(head)
  part(m, bx(0.24, 0.12, 0.04), std(0xbfe3ee, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, 1.0, 0.43, -0.4, 0, 0) // para-brisa
  // escapamento e cavalete
  part(m, cyl(0.035, 0.5, 8), metal, 0.18, 0.22, -0.38, Math.PI / 2, 0, 0)
  part(m, bx(0.02, 0.2, 0.02), metal, -0.16, 0.12, -0.15, 0, 0, 0.5)
  // bagageiro e baú de entrega
  part(m, bx(0.4, 0.03, 0.46), metal, 0, 0.78, -0.62)
  part(m, bx(0.46, 0.42, 0.46), yellow, 0, 1.0, -0.62)
  part(m, bx(0.48, 0.05, 0.48), yellowDark, 0, 1.23, -0.62)
  part(m, bx(0.47, 0.05, 0.47), yellowDark, 0, 0.84, -0.62)
  const decal = tex(128, 80, (c, w, h) => {
    c.fillStyle = '#3b2f4a'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill()
    c.fillStyle = '#f2c25b'; c.font = '800 44px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ZAP', w / 2, h / 2 + 3)
  })
  const decalMat = new THREE.MeshBasicMaterial({ map: decal, transparent: true })
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.21), decalMat); d.position.set(s * 0.232, 1.0, -0.62); d.rotation.y = s * Math.PI / 2; m.add(d) }
  // lanterna traseira
  const tail = new THREE.Mesh(bx(0.14, 0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0xff4a3c, toneMapped: false }))
  tail.position.set(0, 0.8, -0.87); m.add(tail)
  return m
}

// ---------- prédio vizinho: fachada para a rua (+z) com janelas, porta, toldo listrado e letreiro ----------
export function makeBuilding({ x0, x1, zBack, zFront, h, wall, roof, awning, sign }) {
  const g = new THREE.Group()
  const w = x1 - x0, d = zFront - zBack, cx = (x0 + x1) / 2, cz = (zBack + zFront) / 2
  part(g, bx(w, h, d), std(wall), cx, h / 2, cz)
  part(g, bx(w + 0.3, 0.14, d + 0.3), std(roof), cx, h + 0.07, cz) // laje do telhado
  part(g, bx(w + 0.2, 0.28, 0.12), std(wall), cx, h + 0.28, zFront + 0.02) // platibanda da frente
  part(g, bx(1.1, 0.5, 0.9), std(0xb9c2cc), cx - w * 0.25, h + 0.39, cz - d * 0.2) // ar-condicionado no telhado
  part(g, bx(w, 0.18, 0.05), std(0x6b6570), cx, 0.09, zFront + 0.03) // rodapé
  // vitrines e porta
  const glass = std(0xbfe3ee, { roughness: 0.2, metalness: 0.1 }), frame = std(0x3b2f4a)
  const fz = zFront + 0.03, doorW = 0.9
  const slots = Math.max(2, Math.round(w / 2.2)), doorSlot = Math.floor(slots / 2)
  for (let i = 0; i < slots; i++) {
    const x = x0 + (w / slots) * (i + 0.5)
    if (i === doorSlot) {
      part(g, bx(doorW + 0.12, 1.95, 0.06), frame, x, 0.98, fz)
      part(g, bx(doorW, 1.8, 0.07), std(0x8a5a3a), x, 0.95, fz + 0.01)
      part(g, bx(0.6, 0.9, 0.08), glass, x, 1.1, fz + 0.02)
    } else {
      part(g, bx(w / slots * 0.76, 1.3, 0.06), frame, x, 1.3, fz)
      part(g, bx(w / slots * 0.76 - 0.14, 1.16, 0.08), glass, x, 1.3, fz + 0.01)
      part(g, bx(w / slots * 0.76 + 0.1, 0.07, 0.14), std(0xcfc6b4), x, 0.62, fz + 0.04) // peitoril
    }
  }
  // toldo listrado
  const stripes = tex(128, 32, (c, ww, hh) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff4e0' : awning; c.fillRect(i * (ww / 8), 0, ww / 8, hh) } })
  const aw = part(g, bx(w * 0.9, 0.06, 0.85), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 }), cx, 2.15, zFront + 0.45, 0.4, 0, 0)
  aw.castShadow = true
  // letreiro
  const signT = tex(256, 64, (c, ww, hh) => {
    c.fillStyle = '#3b2f4a'; c.fillRect(0, 0, ww, hh)
    c.strokeStyle = '#f2c25b'; c.lineWidth = 3; c.strokeRect(6, 6, ww - 12, hh - 12)
    c.fillStyle = '#f6e7cf'; c.font = '800 34px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sign, ww / 2, hh / 2 + 2)
  })
  const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3.2, w * 0.6), 0.8), new THREE.MeshBasicMaterial({ map: signT, toneMapped: false }))
  board.position.set(cx, Math.min(h - 0.5, 2.85), zFront + 0.045); g.add(board)
  return g
}

// ---------- mobiliário de rua ----------
export function makeBench() {
  const g = new THREE.Group(), wood = std(0xb98552), iron = std(0x3b2f4a)
  part(g, bx(1.3, 0.06, 0.38), wood, 0, 0.44, 0)
  part(g, bx(1.3, 0.3, 0.05), wood, 0, 0.7, 0.18, -0.12, 0, 0)
  for (const x of [-0.55, 0.55]) { part(g, bx(0.05, 0.44, 0.34), iron, x, 0.22, 0); part(g, bx(0.05, 0.42, 0.05), iron, x, 0.66, 0.19, -0.12, 0, 0) }
  return g
}
export function makeBin() {
  const g = new THREE.Group()
  part(g, new THREE.CylinderGeometry(0.2, 0.17, 0.62, 12), std(0x4f9d5b), 0, 0.31, 0)
  part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), std(0x3b2f4a), 0, 0.64, 0)
  part(g, bx(0.2, 0.03, 0.02), std(0xf6e7cf), 0, 0.42, 0.185)
  return g
}
export function makeBikeRack() {
  const g = new THREE.Group(), metal = std(0xa8a5b4, { metalness: 0.5, roughness: 0.4 })
  for (let i = 0; i < 3; i++) { const t = part(g, new THREE.TorusGeometry(0.22, 0.025, 6, 14, Math.PI), metal, (i - 1) * 0.42, 0.02, 0, 0, 0, 0); t.rotation.set(0, 0, 0) }
  return g
}
export function makeHydrant() {
  const g = new THREE.Group(), red = std(0xd9453d)
  part(g, cyl(0.1, 0.4, 10), red, 0, 0.22, 0)
  part(g, new THREE.SphereGeometry(0.11, 10, 8), red, 0, 0.44, 0)
  part(g, cyl(0.04, 0.26, 8), red, 0, 0.3, 0, 0, 0, Math.PI / 2)
  return g
}
export function makePlanter(color = 0x5f9f62) {
  const g = new THREE.Group()
  part(g, bx(0.9, 0.34, 0.4), std(0xc9955c), 0, 0.17, 0)
  for (let i = 0; i < 4; i++) part(g, new THREE.IcosahedronGeometry(0.2, 1), std(color), -0.3 + i * 0.2, 0.46 + (i % 2) * 0.05, 0)
  return g
}
