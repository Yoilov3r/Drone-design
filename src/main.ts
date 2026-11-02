import './style.css'
import * as THREE from 'three'
import {
  BatteryMedium,
  Boxes,
  createIcons,
  Layers,
  Maximize2,
  Orbit,
  Pause,
  Play,
  Power,
  RotateCcw,
  ScanLine,
  Scissors,
  Wind,
} from 'lucide'
import { StudioScene, type WindMode } from './scene'
import { Drone, DroneSim, DR, DRONE_FLOW } from './drone/drone'
import { CUT_PROJ } from './core/cut'
import { GLOW_TIME } from './core/glow'
import { makeNoise3D, NOISE3D } from './core/noise'

type ViewMode = 'flight' | 'exploded' | 'cut' | 'sensor'
type PartId = 'airframe' | 'battery' | 'avionics' | 'rtk' | 'motor' | 'gimbal' | 'vision'

interface PartInfo {
  index: string
  title: string
  copy: string
  anchor: string
  offset: THREE.Vector3
}

const DEMO_DURATION = 28
const GRAVITY = 9.80665
const WHOLE_OFFSET = new THREE.Vector3(1.95, 1.5, 2.75)
const UI_ICONS = {
  BatteryMedium,
  Boxes,
  Layers,
  Maximize2,
  Orbit,
  Pause,
  Play,
  Power,
  RotateCcw,
  ScanLine,
  Scissors,
  Wind,
}

const PART_INFO: Record<PartId, PartInfo> = {
  airframe: {
    index: '01 / AIRFRAME',
    title: '机身与折叠臂',
    copy: '0.9 m 对角轴距 · 碳纤维承力结构',
    anchor: 'body',
    offset: WHOLE_OFFSET,
  },
  battery: {
    index: '02 / POWER',
    title: '双电池仓',
    copy: '12S 双路供电 · 526 Wh 可用能量',
    anchor: 'battery',
    offset: new THREE.Vector3(-0.5, 0.52, 1.2),
  },
  avionics: {
    index: '03 / AVIONICS',
    title: '飞控与计算',
    copy: 'IMU 减振舱 · 任务计算机 · 250 Hz 控制律',
    anchor: 'fc',
    offset: new THREE.Vector3(0.82, 0.56, 1.08),
  },
  rtk: {
    index: '04 / POSITION',
    title: 'RTK 天线',
    copy: '双天线定向 · 厘米级定位链路',
    anchor: 'rtk',
    offset: new THREE.Vector3(0.54, 0.7, 1.05),
  },
  motor: {
    index: '05 / PROPULSION',
    title: '动力单元',
    copy: '4 × 无刷电机 · 21 in 折叠桨 · 电子调速器',
    anchor: 'm0',
    offset: new THREE.Vector3(1.15, 0.55, 1.15),
  },
  gimbal: {
    index: '06 / PAYLOAD',
    title: '增稳云台',
    copy: '三轴机械增稳 · 俯仰轴主动补偿',
    anchor: 'gimbal',
    offset: new THREE.Vector3(1.1, 0.12, 1.15),
  },
  vision: {
    index: '07 / PERCEPTION',
    title: '六向感知',
    copy: '6 × 视觉模组 · 下视辅助 · 前向激光雷达',
    anchor: 'eyes',
    offset: new THREE.Vector3(1.2, 0.48, 1.25),
  },
}

const PICK_PARTS: { part: PartId; anchor: string }[] = [
  { part: 'airframe', anchor: 'body' },
  { part: 'battery', anchor: 'battery' },
  { part: 'avionics', anchor: 'fc' },
  { part: 'avionics', anchor: 'compute' },
  { part: 'rtk', anchor: 'rtk' },
  { part: 'motor', anchor: 'm0' },
  { part: 'motor', anchor: 'm1' },
  { part: 'motor', anchor: 'm2' },
  { part: 'motor', anchor: 'm3' },
  { part: 'gimbal', anchor: 'gimbal' },
  { part: 'vision', anchor: 'eyes' },
]

const VIEW_OFFSET: Record<ViewMode, THREE.Vector3> = {
  flight: WHOLE_OFFSET,
  exploded: new THREE.Vector3(2.15, 1.48, 2.95),
  cut: new THREE.Vector3(0.7, 0.66, 2.3),
  sensor: new THREE.Vector3(2.35, 1.05, 2.75),
}

function required<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing required element: ${selector}`)
  return element
}

const formatTime = (t: number) => {
  const seconds = Math.max(0, Math.floor(t))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

const damp = (current: number, target: number, speed: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * dt))

function setFlightCommand(time: number, out: THREE.Vector3) {
  if (time < 2.8) {
    out.set(0, 0.35, 0)
    return
  }
  if (time < 6.5) {
    out.set(0, THREE.MathUtils.lerp(0.35, DR.hoverY, smooth(2.8, 6.5, time)), 0)
    return
  }
  if (time < 10.4) {
    const settle = smooth(6.5, 10.4, time)
    out.set(0.045 * Math.sin(time * 0.55) * settle, DR.hoverY + 0.018 * settle, 0)
    return
  }
  if (time < 14.3) {
    const k = smooth(10.4, 14.3, time)
    out.set(0.7 * k, THREE.MathUtils.lerp(DR.hoverY, 1.9, k), 0.36 * k)
    return
  }
  if (time < 18.5) {
    const k = smooth(14.3, 18.5, time)
    out.set(0.7 + 0.04 * Math.sin(time * 0.9), THREE.MathUtils.lerp(1.9, 1.76, k), THREE.MathUtils.lerp(0.36, -0.4, k))
    return
  }
  if (time < 22.6) {
    const k = smooth(18.5, 22.6, time)
    out.set(THREE.MathUtils.lerp(0.7, 0, k), THREE.MathUtils.lerp(1.76, 1.84, k), THREE.MathUtils.lerp(-0.4, 0, k))
    return
  }
  if (time < 25.2) {
    out.set(0, 1.75, 0)
    return
  }
  const k = smooth(25.2, 27.65, time)
  out.set(0, THREE.MathUtils.lerp(DR.hoverY, 0.35, k), 0)
}

function setWind(time: number, mode: WindMode, out: THREE.Vector3) {
  if (mode === 'wind') {
    out.set(-7.2, 0.08 * Math.sin(time * 1.2), 1.05 + 0.35 * Math.sin(time * 0.72))
    return
  }
  if (mode === 'gust') {
    const gust = 0.55 + 0.28 * Math.sin(time * 1.9) + 0.17 * Math.sin(time * 0.63 + 1.2)
    out.set(-(7.1 + gust * 3.7), 0.24 * Math.sin(time * 2.2), 2.2 * Math.sin(time * 0.74))
    return
  }
  out.set(0.24 * Math.sin(time * 0.8), 0.03 * Math.sin(time * 1.7), 0.16 * Math.cos(time * 0.61))
}

function phaseAt(time: number) {
  if (time < 2.8) return { label: '陆上待机', state: '待机' }
  if (time < 6.5) return { label: '垂直起飞', state: '起飞' }
  if (time < 10.4) return { label: '定点悬停', state: '悬停' }
  if (time < 14.3) return { label: '航点进场', state: '导航' }
  if (time < 18.5) return { label: '抗风修正', state: '抗风' }
  if (time < 22.6) return { label: '自动返航', state: '返航' }
  if (time < 25.2) return { label: '悬停校准', state: '校准' }
  if (time < 27.65) return { label: '自动降落', state: '降落' }
  return { label: '任务完成', state: '完成' }
}

const propulsionIsActive = (time: number) => time >= 2.75 && time < 27.75

NOISE3D.value = makeNoise3D(64)
createIcons({ icons: UI_ICONS })

const studio = new StudioScene(required<HTMLDivElement>('#webgl'))
const drone = new Drone()
studio.scene.add(drone.root, drone.air)
drone.cut.collect(drone.root)
drone.hollowSkins()
drone.cut.amount = 0
drone.cut.update()

const sim = new DroneSim()
sim.p.set(0, 0.35, 0)
sim.v.set(0, 0, 0)
sim.target.copy(sim.p)
const simulationBase = new THREE.Vector3()
const simulationTarget = new THREE.Vector3()
const simulationWind = new THREE.Vector3()

const playToggle = required<HTMLButtonElement>('#play-toggle')
const loader = required<HTMLDivElement>('#loader')
const timeline = required<HTMLInputElement>('#timeline')
const timelineCurrent = required<HTMLElement>('#timeline-current')
const explodeRange = required<HTMLInputElement>('#explode-range')
const explodeValue = required<HTMLElement>('#explode-value')
const cutToggle = required<HTMLButtonElement>('#cut-toggle')
const cameraReset = required<HTMLButtonElement>('#camera-reset')
const resetView = required<HTMLButtonElement>('#reset-view')
const flightReset = required<HTMLButtonElement>('#flight-reset')
const flightState = required<HTMLElement>('#flight-state')
const flightPhase = required<HTMLElement>('#flight-phase')
const partToast = required<HTMLDivElement>('#part-toast')
const toastIndex = required<HTMLElement>('#toast-index')
const toastTitle = required<HTMLElement>('#toast-title')
const toastCopy = required<HTMLElement>('#toast-copy')
const viewButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.view-mode'))
const partRows = Array.from(document.querySelectorAll<HTMLButtonElement>('.part-row'))
const windButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-wind]'))
const hotspotButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.hotspot'))

let playing = true
let demoTime = 0
let energyUsedWh = 0
let currentWindMode: WindMode = 'calm'
let viewMode: ViewMode = 'flight'
let selectedPart: PartId = 'airframe'
let explosion = 0
let explosionTarget = 0
let cutAmount = 0
let cutTarget = 0
let sensorAmount = 0
let sensorTarget = 0
let followPart: PartId = 'airframe'
let toastTimer = 0
let elapsed = 0
const performanceClock = new THREE.Clock()
let dragStart = new THREE.Vector2()
let dragMoved = false
const propAngles = [0, 0, 0, 0]
const propOmega = [0, 0, 0, 0]
const pointer = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const lastFocus = new THREE.Vector3()
let cameraTween: {
  fromPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  offset: THREE.Vector3
  elapsed: number
  duration: number
} | null = null

function anchorWorld(name: string) {
  const anchor = drone.anchors[name]
  if (!anchor) return drone.root.position.clone()
  const [object, local] = anchor
  object.updateWorldMatrix(true, false)
  return object.localToWorld(local.clone())
}

function focusPoint(part: PartId) {
  if (part === 'airframe') return drone.root.position.clone().add(new THREE.Vector3(0, 0.06, 0))
  return anchorWorld(PART_INFO[part].anchor)
}

function beginCameraMove(part: PartId, offset: THREE.Vector3) {
  followPart = part
  cameraTween = {
    fromPosition: studio.camera.position.clone(),
    fromTarget: studio.controls.target.clone(),
    offset: offset.clone(),
    elapsed: 0,
    duration: 0.82,
  }
  lastFocus.copy(focusPoint(part))
}

function updateCamera(dt: number) {
  const point = focusPoint(followPart)
  if (cameraTween) {
    cameraTween.elapsed += dt
    const k = smooth(0, 1, Math.min(1, cameraTween.elapsed / cameraTween.duration))
    const desiredPosition = point.clone().add(cameraTween.offset)
    studio.camera.position.lerpVectors(cameraTween.fromPosition, desiredPosition, k)
    studio.controls.target.lerpVectors(cameraTween.fromTarget, point, k)
    if (cameraTween.elapsed >= cameraTween.duration) cameraTween = null
  } else {
    const delta = point.clone().sub(lastFocus)
    if (delta.lengthSq() < 0.25) {
      studio.camera.position.add(delta)
      studio.controls.target.add(delta)
    }
  }
  lastFocus.copy(point)
}

function setPart(part: PartId, showToast = true) {
  selectedPart = part
  partRows.forEach((row) => row.classList.toggle('is-active', row.dataset.part === part))
  beginCameraMove(part, PART_INFO[part].offset)
  if (!showToast) return
  toastIndex.textContent = PART_INFO[part].index
  toastTitle.textContent = PART_INFO[part].title
  toastCopy.textContent = PART_INFO[part].copy
  partToast.classList.add('is-visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => partToast.classList.remove('is-visible'), 3200)
}

function setViewMode(mode: ViewMode) {
  viewMode = mode
  viewButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === mode))
  cutToggle.classList.toggle('is-active', mode === 'cut')
  explosionTarget = mode === 'exploded' ? 1 : 0
  cutTarget = mode === 'cut' ? 0.76 : 0
  sensorTarget = mode === 'sensor' ? 1 : 0
  explodeRange.value = String(explosionTarget)
  explodeRange.style.setProperty('--range', `${explosionTarget * 100}%`)
  explodeValue.textContent = `${Math.round(explosionTarget * 100)}%`
  beginCameraMove(selectedPart, VIEW_OFFSET[mode])
}

function setWindMode(mode: WindMode) {
  currentWindMode = mode
  windButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.wind === mode))
}

function setPlayIcon(isPlaying: boolean) {
  playToggle.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}"></i>`
  createIcons({ icons: UI_ICONS })
  playToggle.title = isPlaying ? '暂停飞行演示' : '播放飞行演示'
}

function rebuildSimulation(time: number) {
  sim.p.set(0, 0.35, 0)
  sim.v.set(0, 0, 0)
  sim.tilt.set(0, 0)
  sim.rate.set(0, 0)
  sim.integ.set(0, 0, 0)
  sim.target.copy(sim.p)
  energyUsedWh = 0
  propAngles.fill(0)
  propOmega.fill(0)

  const step = 1 / 60
  const steps = Math.ceil(time / step)
  for (let i = 1; i <= steps; i++) {
    const at = Math.min(time, i * step)
    setFlightCommand(at, simulationTarget)
    setWind(at, currentWindMode, simulationWind)
    sim.target.copy(simulationTarget)
    sim.step(step, simulationWind, DR.mass)
    const watts = propulsionIsActive(at) ? sim.watts() : DR.avionics
    energyUsedWh += (watts * step) / 3600
  }
  setFlightCommand(time, simulationTarget)
  sim.target.copy(simulationTarget)
  setWind(time, currentWindMode, simulationWind)
}

function advanceSimulation(dt: number) {
  demoTime += dt
  if (demoTime >= DEMO_DURATION) {
    demoTime = 0
    rebuildSimulation(0)
  }
  setFlightCommand(demoTime, simulationTarget)
  setWind(demoTime, currentWindMode, simulationWind)
  sim.target.copy(simulationTarget)
  sim.step(dt, simulationWind, DR.mass)
  const watts = propulsionIsActive(demoTime) ? sim.watts() : DR.avionics
  energyUsedWh += (watts * dt) / 3600
  for (let i = 0; i < 4; i++) {
    const omega = propulsionIsActive(demoTime) ? (sim.rpm(i) * Math.PI * 2) / 60 : 0
    propOmega[i] = omega
    propAngles[i] += omega * dt
  }
}

function updateTelemetry() {
  const phase = phaseAt(demoTime)
  const speed = sim.v.length()
  const windSpeed = simulationWind.length()
  const active = propulsionIsActive(demoTime)
  const battery = Math.max(0, 100 - (energyUsedWh / (DR.battery * DR.usable)) * 100)

  required<HTMLElement>('#altitude').textContent = Math.max(0, sim.p.y - 0.35).toFixed(2)
  required<HTMLElement>('#speed').textContent = speed.toFixed(2)
  required<HTMLElement>('#pitch').textContent = `${(sim.tilt.x * 180 / Math.PI).toFixed(1)}°`
  required<HTMLElement>('#roll').textContent = `${(sim.tilt.y * 180 / Math.PI).toFixed(1)}°`
  required<HTMLElement>('#wind-speed').textContent = windSpeed.toFixed(1)
  required<HTMLElement>('#thrust-total').textContent = `${(sim.thrust.reduce((a, b) => a + b, 0) / GRAVITY).toFixed(1)} kgf`
  required<HTMLElement>('#power').textContent = Math.round(active ? sim.watts() : DR.avionics).toLocaleString('zh-CN')
  required<HTMLElement>('#battery-level').textContent = battery.toFixed(1)
  required<HTMLElement>('#energy-bar').style.width = `${battery}%`

  for (let i = 0; i < 4; i++) {
    const rpm = active ? sim.rpm(i) : 0
    required<HTMLElement>(`#rpm-${i}`).textContent = Math.round(rpm).toLocaleString('zh-CN')
    required<HTMLElement>(`#bar-${i}`).style.width = `${THREE.MathUtils.clamp(rpm / 3600, 0, 1) * 100}%`
  }

  flightState.textContent = playing ? phase.state : '已暂停'
  flightPhase.textContent = phase.label
  timelineCurrent.textContent = formatTime(demoTime)
  timeline.value = String(demoTime)
  timeline.style.setProperty('--progress', `${(demoTime / DEMO_DURATION) * 100}%`)
}

function updateHotspots() {
  for (const button of hotspotButtons) {
    const part = button.dataset.part as PartId
    if (!part || !PART_INFO[part]) continue
    const point = anchorWorld(PART_INFO[part].anchor).project(studio.camera)
    const visible = point.z > -1 && point.z < 1
    const rect = studio.renderer.domElement.getBoundingClientRect()
    button.style.left = `${(point.x * 0.5 + 0.5) * rect.width}px`
    button.style.top = `${(-point.y * 0.5 + 0.5) * rect.height}px`
    button.style.opacity = visible ? '1' : '0'
    button.style.pointerEvents = visible ? 'auto' : 'none'
  }
}

function pickPart(event: PointerEvent) {
  if (dragMoved) return
  const rect = studio.renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, studio.camera)
  const hit = raycaster
    .intersectObject(drone.root, true)
    .find((intersection) => intersection.object instanceof THREE.Mesh && !intersection.object.userData.fluid)
  if (!hit) return

  let bestPart: PartId = 'airframe'
  let bestDistance = Infinity
  for (const candidate of PICK_PARTS) {
    const point = anchorWorld(candidate.anchor)
    const distance = point.distanceToSquared(hit.point)
    if (distance < bestDistance) {
      bestDistance = distance
      bestPart = candidate.part
    }
  }
  setPart(bestPart)
}

function resetAll() {
  playing = true
  demoTime = 0
  energyUsedWh = 0
  setPlayIcon(true)
  setWindMode('calm')
  viewMode = 'flight'
  selectedPart = 'airframe'
  explosion = 0
  explosionTarget = 0
  cutAmount = 0
  cutTarget = 0
  sensorAmount = 0
  sensorTarget = 0
  propAngles.fill(0)
  propOmega.fill(0)
  partRows.forEach((row) => row.classList.toggle('is-active', row.dataset.part === 'airframe'))
  viewButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === 'flight'))
  windButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.wind === 'calm'))
  cutToggle.classList.remove('is-active')
  explodeRange.value = '0'
  explodeRange.style.setProperty('--range', '0%')
  explodeValue.textContent = '0%'
  partToast.classList.remove('is-visible')
  rebuildSimulation(0)
  beginCameraMove('airframe', WHOLE_OFFSET)
}

playToggle.addEventListener('click', () => {
  playing = !playing
  setPlayIcon(playing)
})

timeline.addEventListener('input', () => {
  demoTime = Number(timeline.value)
  rebuildSimulation(demoTime)
  updateTelemetry()
})

viewButtons.forEach((button) => {
  button.addEventListener('click', () => setViewMode(button.dataset.view as ViewMode))
})

partRows.forEach((row) => {
  row.addEventListener('click', () => setPart(row.dataset.part as PartId))
})

hotspotButtons.forEach((button) => {
  button.addEventListener('click', () => setPart(button.dataset.part as PartId))
})

windButtons.forEach((button) => {
  button.addEventListener('click', () => setWindMode(button.dataset.wind as WindMode))
})

explodeRange.addEventListener('input', () => {
  explosionTarget = Number(explodeRange.value)
  explodeRange.style.setProperty('--range', `${explosionTarget * 100}%`)
  explodeValue.textContent = `${Math.round(explosionTarget * 100)}%`
  if (explosionTarget > 0.01 && viewMode !== 'exploded') {
    viewMode = 'exploded'
    viewButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === 'exploded'))
    cutTarget = 0
    sensorTarget = 0
    cutToggle.classList.remove('is-active')
  }
})

cutToggle.addEventListener('click', () => setViewMode(viewMode === 'cut' ? 'flight' : 'cut'))
cameraReset.addEventListener('click', () => beginCameraMove(selectedPart, VIEW_OFFSET[viewMode]))
resetView.addEventListener('click', () => {
  setPart('airframe')
  beginCameraMove('airframe', VIEW_OFFSET[viewMode])
})
flightReset.addEventListener('click', resetAll)

studio.renderer.domElement.addEventListener('pointerdown', (event) => {
  dragStart.set(event.clientX, event.clientY)
  dragMoved = false
})
studio.renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.buttons && dragStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) dragMoved = true
})
studio.renderer.domElement.addEventListener('pointerup', pickPart)

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !(event.target instanceof HTMLInputElement)) {
    event.preventDefault()
    playing = !playing
    setPlayIcon(playing)
  }
})

setFlightCommand(0, simulationTarget)
setWind(0, currentWindMode, simulationWind)
sim.target.copy(simulationTarget)
drone.update(sim, simulationBase, 0, propAngles, propOmega, 0)
studio.scene.updateMatrixWorld(true)
lastFocus.copy(focusPoint('airframe'))
studio.controls.target.copy(lastFocus)
studio.camera.position.copy(lastFocus).add(WHOLE_OFFSET)
updateTelemetry()

function animate() {
  const dt = Math.min(0.05, Math.max(0.001, performanceClock.getDelta()))
  elapsed += dt

  if (playing) advanceSimulation(dt)
  else {
    setFlightCommand(demoTime, simulationTarget)
    setWind(demoTime, currentWindMode, simulationWind)
    sim.target.copy(simulationTarget)
  }

  explosion = damp(explosion, explosionTarget, 6.5, dt)
  cutAmount = damp(cutAmount, cutTarget, 6.2, dt)
  sensorAmount = damp(sensorAmount, sensorTarget, 6.5, dt)

  const active = propulsionIsActive(demoTime)
  DRONE_FLOW.air.value = damp(DRONE_FLOW.air.value, active ? (viewMode === 'sensor' ? 0.2 : 0.66) : 0.035, 4.5, dt)
  DRONE_FLOW.tip.value = damp(DRONE_FLOW.tip.value, active ? 0.5 : 0.02, 4.5, dt)
  DRONE_FLOW.power.value = damp(DRONE_FLOW.power.value, active && viewMode !== 'flight' ? 0.72 : 0.08, 5, dt)
  DRONE_FLOW.signal.value = damp(DRONE_FLOW.signal.value, active ? (viewMode === 'sensor' ? 0.85 : 0.24) : 0.04, 5, dt)
  DRONE_FLOW.sense.value = damp(DRONE_FLOW.sense.value, 0.05 + sensorAmount * 0.95, 6, dt)
  DRONE_FLOW.wind.value = damp(DRONE_FLOW.wind.value, currentWindMode === 'calm' ? 0.03 : currentWindMode === 'gust' ? 0.92 : 0.62, 4, dt)
  DRONE_FLOW.rate.value = playing ? 1 : 0.15

  const senseMaterial = drone.senseMeshes[0]?.material as THREE.MeshBasicMaterial | undefined
  if (senseMaterial) senseMaterial.opacity = 0.012 + sensorAmount * 0.105

  drone.update(sim, simulationBase, explosion, propAngles, propOmega, elapsed)
  drone.cut.amount = cutAmount
  drone.cut.update()
  GLOW_TIME.value = elapsed

  sim.target.copy(simulationTarget)
  const windSpeed = simulationWind.length()
  studio.updateWind(dt, windSpeed, currentWindMode)
  updateCamera(dt)
  updateTelemetry()

  studio.controls.update()
  studio.scene.updateMatrixWorld(true)
  CUT_PROJ.value.copy(studio.camera.projectionMatrix)
  updateHotspots()
  studio.renderer.render(studio.scene, studio.camera)
}

setPlayIcon(true)
studio.renderer.setAnimationLoop(animate)
window.setTimeout(() => loader.classList.add('is-hidden'), 420)

window.addEventListener('beforeunload', () => studio.dispose())
