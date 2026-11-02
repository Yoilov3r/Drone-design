import * as THREE from 'three'
import type { CutState } from './cut'

export const GLOW_TIME = { value: 0 }

const VERT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
attribute float aS;
varying float vS;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vS = aS;
}
`

const FRAG = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
varying float vS;
uniform vec3 uColor;
uniform float uTime, uSpeed, uScale, uEmph, uBase, uRate;
void main() {
  #include <clipping_planes_fragment>
  float ph = vS / uScale - uTime * uSpeed * uRate;
  float pulse = pow(0.5 + 0.5 * sin(ph * 6.2831853), 6.0);
  float I = (uBase + pulse) * uEmph;
  gl_FragColor = vec4(uColor * I, 1.0);
}
`

interface GlowLineOpts {
  color: THREE.ColorRepresentation
  emph: { value: number }
  rate?: { value: number }
  speed?: number
  scale?: number
  base?: number
}

export function glowLineMaterial(cut: CutState, o: GlowLineOpts) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uTime: GLOW_TIME,
      uSpeed: { value: o.speed ?? 1 },
      uScale: { value: o.scale ?? 0.25 },
      uEmph: o.emph,
      uBase: { value: o.base ?? 0.35 },
      uRate: o.rate ?? { value: 1 },
    },
    clipping: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  m.clippingPlanes = cut.planes
  m.clipIntersection = cut.intersect
  return m
}
