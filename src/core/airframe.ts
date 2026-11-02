import * as THREE from 'three'
import type { P2 } from './geometry'

export interface Sec {
  x: number
  y: number
  w: number
  wb?: number
  t: number
  b: number
  n: number
  nb: number
}

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e)

export function loft(
  secs: Sec[],
  paint: (x: number, y: number, z: number) => number,
  steps = 10,
  ring = 72,
) {
  const keys: (keyof Sec)[] = ['x', 'y', 'w', 'wb', 't', 'b', 'n', 'nb']
  const S = secs.map((s) => ({ ...s, wb: s.wb ?? s.w }))
  const at = (i: number) => S[Math.max(0, Math.min(S.length - 1, i))]
  const rows: Sec[] = []

  for (let i = 0; i < S.length - 1; i++) {
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      const o = {} as Record<string, number>
      for (const key of keys) {
        o[key] = cr(
          at(i - 1)[key] as number,
          at(i)[key] as number,
          at(i + 1)[key] as number,
          at(i + 2)[key] as number,
          t,
        )
      }
      rows.push(o as unknown as Sec)
    }
  }
  rows.push(S[S.length - 1])

  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()

  for (const r of rows) {
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const up = ss(-0.45, 0.45, sa)
      const w = r.wb! + (r.w - r.wb!) * up
      const n = r.nb + (r.n - r.nb) * up
      const y = r.y + sp(sa, 2 / n) * (sa > 0 ? r.t : r.b)
      const z = w * sp(ca, 2 / n)
      pos.push(r.x, y, z)
      c.setHex(paint(r.x, y, z))
      col.push(c.r, c.g, c.b)
    }
  }

  const R = rows.length
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j
      const b = i * ring + ((j + 1) % ring)
      const cc = a + ring
      const d = b + ring
      idx.push(a, b, cc, b, d, cc)
    }
  }

  for (const [row, flip] of [
    [0, true],
    [R - 1, false],
  ] as const) {
    const base = pos.length / 3
    const r = rows[row]
    pos.push(r.x, r.y, 0)
    c.setHex(paint(r.x, r.y, 0))
    col.push(c.r, c.g, c.b)
    for (let j = 0; j < ring; j++) {
      const a = row * ring + j
      const b = row * ring + ((j + 1) % ring)
      if (flip) idx.push(base, b, a)
      else idx.push(base, a, b)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function foil(t: number, m: number, n = 22): P2[] {
  const up: P2[] = []
  const lo: P2[] = []
  for (let i = 0; i <= n; i++) {
    const u = (1 - Math.cos((Math.PI * i) / n)) / 2
    const yt =
      5 *
      t *
      (0.2969 * Math.sqrt(u) -
        0.126 * u -
        0.3516 * u * u +
        0.2843 * u ** 3 -
        0.1036 * u ** 4)
    const yc = m * 4 * u * (1 - u)
    const th = Math.atan(m * 4 * (1 - 2 * u))
    up.push([u - yt * Math.sin(th), yc + yt * Math.cos(th)])
    lo.push([u + yt * Math.sin(th), yc - yt * Math.cos(th)])
  }
  return [...up.reverse(), ...lo.slice(1)]
}

export interface WingAt {
  x: number
  y: number
  c: number
  a: number
}

export function wing(
  z0: number,
  z1: number,
  n: number,
  f: (z: number) => WingAt,
  profIn: P2[],
  invert = true,
) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const prof = invert ? profIn : profIn.slice().reverse()
  const P = prof.length

  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    const { x, y, c, a } = f(z)
    const dx = -Math.cos(a)
    const dy = Math.sin(a)
    const nx = Math.sin(a)
    const ny = Math.cos(a)
    for (let j = 0; j < P; j++) {
      const [u, v0] = prof[j]
      const v = invert ? -v0 : v0
      pos.push(x + (dx * u + nx * v) * c, y + (dy * u + ny * v) * c, z)
      uv.push(z * 30, u * c * 30)
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < P; j++) {
      const a = i * P + j
      const b = i * P + ((j + 1) % P)
      const c = a + P
      const d = b + P
      idx.push(a, c, b, b, c, d)
    }
  }

  for (const [row, flip] of [
    [0, true],
    [n, false],
  ] as const) {
    const base = pos.length / 3
    let cx = 0
    let cy = 0
    for (let j = 0; j < P; j++) {
      cx += pos[(row * P + j) * 3]
      cy += pos[(row * P + j) * 3 + 1]
    }
    pos.push(cx / P, cy / P, pos[row * P * 3 + 2])
    uv.push(0, 0)
    for (let j = 0; j < P; j++) {
      const a = row * P + j
      const b = row * P + ((j + 1) % P)
      if (flip) idx.push(base, a, b)
      else idx.push(base, b, a)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function strut(a: THREE.Vector3, b: THREE.Vector3, w: number, t: number) {
  const d = new THREE.Vector3().subVectors(b, a)
  const len = d.length()
  const g = new THREE.CylinderGeometry(1, 1, len, 14, 1)
  g.scale(w / 2, 1, t / 2)
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    d.normalize(),
  )
  g.applyQuaternion(q)
  const m = a.clone().add(b).multiplyScalar(0.5)
  g.translate(m.x, m.y, m.z)
  return g
}

export function carbonTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const cell = 16
  for (let i = 0; i < 128 / cell; i++) {
    for (let j = 0; j < 128 / cell; j++) {
      const horiz = ((i + j) >> 1) % 2 === 0
      const grad = horiz
        ? g.createLinearGradient(0, j * cell, 0, (j + 1) * cell)
        : g.createLinearGradient(i * cell, 0, (i + 1) * cell, 0)
      grad.addColorStop(0, '#0b0c0e')
      grad.addColorStop(0.5, horiz ? '#2b2e33' : '#1f2226')
      grad.addColorStop(1, '#0b0c0e')
      g.fillStyle = grad
      g.fillRect(i * cell, j * cell, cell, cell)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
