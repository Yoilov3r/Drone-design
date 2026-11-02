import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export type WindMode = 'calm' | 'wind' | 'gust'

const CYAN = new THREE.Color(0x72dce3)
const WARM = new THREE.Color(0xffb06b)

function dashedCircle(radius: number, color: number, opacity: number) {
  const points: THREE.Vector3[] = []
  const segments = 144
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0.026, Math.sin(a) * radius))
  }
  const material = new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity,
    dashSize: 0.05,
    gapSize: 0.035,
    depthWrite: false,
  })
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material)
  line.computeLineDistances()
  return line
}

function createVisualStage() {
  const group = new THREE.Group()
  group.name = 'industrial-test-bay'

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x15191b,
    roughness: 0.82,
    metalness: 0.22,
  })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 16), floorMaterial)
  floor.position.y = -0.07
  floor.receiveShadow = true
  group.add(floor)

  const grid = new THREE.GridHelper(14, 56, 0x4b5558, 0x293033)
  grid.position.y = 0.002
  const gridMaterial = grid.material as THREE.LineBasicMaterial
  gridMaterial.transparent = true
  gridMaterial.opacity = 0.24
  gridMaterial.depthWrite = false
  group.add(grid)

  const padMaterial = new THREE.MeshStandardMaterial({
    color: 0x22272a,
    roughness: 0.64,
    metalness: 0.58,
  })
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.46, 0.035, 96), padMaterial)
  pad.position.y = -0.002
  pad.receiveShadow = true
  group.add(pad)

  const innerDisk = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x111416,
      roughness: 0.88,
      metalness: 0.18,
    }),
  )
  innerDisk.position.y = 0.018
  innerDisk.receiveShadow = true
  group.add(innerDisk)

  group.add(dashedCircle(1.12, 0x89969a, 0.32))
  group.add(dashedCircle(0.7, 0xff7a1d, 0.78))
  group.add(dashedCircle(0.39, 0x546165, 0.46))

  const markingMaterial = new THREE.MeshBasicMaterial({
    color: 0xf0a46f,
    transparent: true,
    opacity: 0.72,
  })
  for (const z of [-0.16, 0.16]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.002, 0.045), markingMaterial)
    bar.position.set(0, 0.028, z)
    group.add(bar)
  }
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.002, 0.32), markingMaterial)
  stem.position.y = 0.028
  group.add(stem)

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x5e7075,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
  })
  for (const radius of [2, 2.24]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.008, 128).rotateX(-Math.PI / 2),
      ringMaterial,
    )
    ring.position.y = 0.008
    group.add(ring)
  }

  const tickMaterial = new THREE.LineBasicMaterial({
    color: 0x5a676b,
    transparent: true,
    opacity: 0.45,
  })
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2
    const long = i % 3 === 0
    const inner = long ? 2.07 : 2.13
    const outer = 2.23
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(angle) * inner, 0.02, Math.sin(angle) * inner),
      new THREE.Vector3(Math.cos(angle) * outer, 0.02, Math.sin(angle) * outer),
    ])
    group.add(new THREE.Line(geometry, tickMaterial))
  }

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x242a2d,
    metalness: 0.82,
    roughness: 0.38,
  })
  for (const [index, [x, z]] of [
    [-3.15, -2.6],
    [3.15, -2.6],
    [-3.15, 2.6],
    [3.15, 2.6],
  ].entries()) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.7, 0.055), frameMaterial)
    post.position.set(x, 1.35, z)
    post.castShadow = true
    group.add(post)
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.14, 0.035),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? WARM : CYAN }),
    )
    light.position.set(x, 2.15, z)
    group.add(light)
  }
  for (const z of [-2.6, 2.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.35, 0.045, 0.045), frameMaterial)
    rail.position.set(0, 2.7, z)
    group.add(rail)
  }

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshBasicMaterial({
      color: 0x121618,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
    }),
  )
  backdrop.position.set(0, 2.2, -4.4)
  group.add(backdrop)

  const backGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.025),
    new THREE.MeshBasicMaterial({
      color: 0xff7a1d,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  backGlow.position.set(0, 0.14, -4.35)
  group.add(backGlow)

  return group
}

export class StudioScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  readonly stage: THREE.Group
  readonly windMaterial: THREE.LineBasicMaterial
  readonly particles: THREE.Points
  private readonly particleVelocity: number[] = []
  private readonly container: HTMLElement
  private readonly observer: ResizeObserver
  private particleTravel = 0

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.localClippingEnabled = true
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(this.renderer.domElement)

    this.scene.fog = new THREE.Fog(0x0b0d0e, 5.8, 16)
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 40)
    this.camera.position.set(1.95, 1.92, 2.75)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0.72, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.enablePan = true
    this.controls.panSpeed = 0.55
    this.controls.rotateSpeed = 0.68
    this.controls.zoomSpeed = 0.8
    this.controls.minDistance = 0.45
    this.controls.maxDistance = 8
    this.controls.minPolarAngle = 0.16
    this.controls.maxPolarAngle = Math.PI * 0.49
    this.controls.update()

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.scene.environment = pmrem.fromScene(room, 0.035).texture
    this.scene.environmentIntensity = 0.72
    room.dispose()
    pmrem.dispose()

    this.scene.add(new THREE.HemisphereLight(0xa9c1c8, 0x08090a, 1.12))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.14))

    const key = new THREE.DirectionalLight(0xfff1df, 3.8)
    key.position.set(3.4, 5.2, 3.8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -4
    key.shadow.camera.right = 4
    key.shadow.camera.top = 4
    key.shadow.camera.bottom = -4
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 12
    key.shadow.bias = -0.00035
    key.shadow.normalBias = 0.018
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x79bfdc, 2.45)
    rim.position.set(-3.4, 3.1, -3.2)
    this.scene.add(rim)

    const fill = new THREE.PointLight(0xff9e5a, 11, 7, 2)
    fill.position.set(1.8, 1.15, -2.1)
    this.scene.add(fill)

    this.stage = createVisualStage()
    this.scene.add(this.stage)

    const windGroup = new THREE.Group()
    windGroup.name = 'wind-field'
    this.windMaterial = new THREE.LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    for (let k = 0; k < 11; k++) {
      const y = 0.35 + (k % 4) * 0.47
      const z = -1.18 + Math.floor(k / 4) * 0.72 + (k % 3) * 0.08
      const points: THREE.Vector3[] = []
      for (let i = 0; i < 18; i++) {
        const u = i / 17
        points.push(new THREE.Vector3(
          -3.1 + u * 6.2,
          y + Math.sin(u * Math.PI * 2.4 + k) * 0.035,
          z + Math.sin(u * Math.PI + k * 0.7) * 0.05,
        ))
      }
      windGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.windMaterial))
    }
    this.scene.add(windGroup)

    const particleCount = 110
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = -3 + Math.random() * 6
      particlePositions[i * 3 + 1] = 0.28 + Math.random() * 2.1
      particlePositions[i * 3 + 2] = -1.55 + Math.random() * 3.1
      this.particleVelocity.push(0.72 + Math.random() * 0.9)
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    this.particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: CYAN,
        size: 0.018,
        transparent: true,
        opacity: 0,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.particles.frustumCulled = false
    this.scene.add(this.particles)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)
  }

  updateWind(dt: number, speed: number, mode: WindMode) {
    const visible = mode === 'calm' ? 0.025 : THREE.MathUtils.clamp(speed / 8, 0.2, 1)
    this.windMaterial.opacity = THREE.MathUtils.lerp(this.windMaterial.opacity, 0.05 + visible * 0.17, 0.08)
    const pointMaterial = this.particles.material as THREE.PointsMaterial
    pointMaterial.opacity = THREE.MathUtils.lerp(pointMaterial.opacity, mode === 'calm' ? 0.01 : 0.2 + visible * 0.38, 0.08)
    pointMaterial.size = mode === 'gust' ? 0.025 : 0.017

    if (mode !== 'calm') {
      this.particleTravel += dt * speed * (mode === 'gust' ? 1.45 : 1)
      const position = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
      const array = position.array as Float32Array
      for (let i = 0; i < this.particleVelocity.length; i++) {
        const stride = i * 3
        array[stride] -= dt * speed * this.particleVelocity[i] * (mode === 'gust' ? 1.35 : 1)
        array[stride + 1] += Math.sin(this.particleTravel * 0.7 + i) * dt * 0.035
        if (array[stride] < -3.05) {
          array[stride] = 3.05
          array[stride + 1] = 0.3 + Math.random() * 2.05
          array[stride + 2] = -1.55 + Math.random() * 3.1
        }
      }
      position.needsUpdate = true
    }
  }

  render() {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.observer.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
  }
}
