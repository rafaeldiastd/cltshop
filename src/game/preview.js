import * as THREE from 'three'
import * as assets from './assets.js'

// personagem girando no menu de customização
export class CharacterPreview {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.r.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.scene = new THREE.Scene()
    const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(1, 2, 3)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb09a8a, 1.6), sun)
    this.cam = new THREE.PerspectiveCamera(26, canvas.clientWidth / canvas.clientHeight, 0.1, 10)
    this.cam.position.set(0, 0.85, 2.7); this.cam.lookAt(0, 0.56, 0)
    this.obj = null
    this.mixer = null
    let last = performance.now()
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t
      if (this.obj) this.obj.rotation.y += dt * 0.8
      this.mixer?.update(dt)
      this.r.render(this.scene, this.cam)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }
  show(index, hat, color) {
    const rot = this.obj?.rotation.y ?? 0.4
    if (this.obj) this.scene.remove(this.obj)
    const ch = assets.makeCharacter(index)
    if (!ch) return
    assets.putHat(ch.obj, hat, color)
    this.obj = ch.obj
    this.obj.rotation.y = rot
    this.mixer = assets.poseCharacter(ch.obj, ch.animations)
    this.scene.add(this.obj)
  }
  dispose() {
    cancelAnimationFrame(this.raf)
    this.r.dispose(); this.r.forceContextLoss()
  }
}
