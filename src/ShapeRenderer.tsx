import { useEffect, useRef } from "react"
import * as THREE from "three"

export interface Settings {
  roundness: number
  sharpness: number
  spacing: number
  size: number
  deformation: number
  texture: number
  color: string
}

// Blob configs: [radius, detail, baseX, baseY, baseZ]
const BLOB_CFGS: [number, number, number, number, number][] = [
  [1.10, 6,  0.00,  0.00,  0.00],
  [0.62, 5,  1.55,  0.80,  0.10],
  [0.52, 5, -1.30, -0.90,  0.20],
  [0.48, 5, -0.75,  1.40, -0.40],
  [0.40, 4,  1.20, -1.10,  0.50],
]

function triNoise(x: number, y: number, z: number, f: number, t: number) {
  return Math.sin(x * f + t) * Math.cos(y * f + t * 0.73) * Math.sin(z * f + t * 1.31)
}

export function ShapeRenderer(p: { settings: Settings; background: string; onWebglError?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<Settings>(p.settings)

  useEffect(() => { settingsRef.current = p.settings }, [p.settings])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const testCanvas = document.createElement("canvas")
    const gl = testCanvas.getContext("webgl2") ?? testCanvas.getContext("webgl")
    if (!gl) { p.onWebglError?.(); return }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "default" })
    } catch {
      p.onWebglError?.()
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(p.background)
    const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.1, 100)

    scene.add(new THREE.AmbientLight(0xfafaf8, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 2.0)
    key.position.set(4, 7, 5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xc0d0ff, 0.55)
    fill.position.set(-5, -3, -4)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xfff0e0, 0.35)
    rim.position.set(0, -6, -5)
    scene.add(rim)

    let spherical = { theta: 0.4, phi: Math.PI / 2, radius: 7.5 }
    let dragging = false, lastX = 0, lastY = 0
    let vTheta = 0, vPhi = 0, autoSpin = true

    const onDown = (e: PointerEvent) => {
      dragging = true; autoSpin = false
      lastX = e.clientX; lastY = e.clientY
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      vTheta = -(e.clientX - lastX) * 0.006
      vPhi   = -(e.clientY - lastY) * 0.006
      spherical.theta += vTheta
      spherical.phi    = Math.max(0.18, Math.min(Math.PI - 0.18, spherical.phi + vPhi))
      lastX = e.clientX; lastY = e.clientY
    }
    const onUp = () => { dragging = false }
    const onWheel = (e: WheelEvent) => {
      spherical.radius = Math.max(4, Math.min(14, spherical.radius + e.deltaY * 0.01))
    }
    renderer.domElement.addEventListener("pointerdown", onDown)
    renderer.domElement.addEventListener("pointermove", onMove)
    renderer.domElement.addEventListener("pointerup",   onUp)
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true })

    const group = new THREE.Group()
    scene.add(group)

    type Blob = {
      mesh: THREE.Mesh
      geo: THREE.BufferGeometry
      mat: THREE.MeshStandardMaterial
      orig: Float32Array
      bx: number; by: number; bz: number
      isCenter: boolean
    }

    const blobs: Blob[] = BLOB_CFGS.map(([radius, detail, bx, by, bz]) => {
      const geo  = new THREE.IcosahedronGeometry(radius, detail)
      const mat  = new THREE.MeshStandardMaterial({
        color: new THREE.Color(settingsRef.current.color),
        roughness: 0.22,
        metalness: 0.06,
      })
      const mesh = new THREE.Mesh(geo, mat)
      group.add(mesh)
      const orig = new Float32Array(geo.attributes.position.array as Float32Array)
      return { mesh, geo, mat, orig, bx, by, bz, isCenter: bx === 0 && by === 0 && bz === 0 }
    })

    let animId: number
    let time = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      time += 0.007

      const s      = settingsRef.current
      const freq   = 1.6 + s.sharpness * 3.5
      const dAmp   = s.deformation * 0.44
      const tAmp   = s.texture * 0.14
      const rBlend = 1.0 - s.roundness * 0.74
      const scale  = 0.42 + s.size * 0.92

      blobs.forEach((b, idx) => {
        const pos  = b.geo.attributes.position.array as Float32Array
        const orig = b.orig
        const t    = time + idx * 1.73

        for (let i = 0; i < pos.length; i += 3) {
          const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2]
          const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1
          const nx = ox / len, ny = oy / len, nz = oz / len

          const n1 = triNoise(nx, ny, nz, freq, t)
          const n2 = triNoise(nx, ny, nz, freq * 2.8, t * 1.45) * 0.38

          const smoothD = n1 * dAmp + n2 * tAmp
          const sharpD  = Math.sign(n1) * Math.pow(Math.abs(n1), 0.22) * dAmp + n2 * tAmp
          const total   = (smoothD * s.roundness + sharpD * (1 - s.roundness)) * rBlend

          pos[i]     = ox + nx * total
          pos[i + 1] = oy + ny * total
          pos[i + 2] = oz + nz * total
        }

        b.geo.attributes.position.needsUpdate = true
        b.geo.computeVertexNormals()

        if (!b.isCenter) {
          const sp = 0.55 + s.spacing * 1.55
          b.mesh.position.set(b.bx * sp, b.by * sp, b.bz * sp)
        }

        b.mesh.scale.setScalar(scale)
        b.mat.color.set(s.color)
        b.mat.roughness = 0.10 + s.texture * 0.52
      })

      if (autoSpin) {
        spherical.theta += 0.003
      } else if (!dragging) {
        vTheta *= 0.88; vPhi *= 0.88
        spherical.theta += vTheta
        spherical.phi    = Math.max(0.18, Math.min(Math.PI - 0.18, spherical.phi + vPhi))
        if (Math.abs(vTheta) < 0.0001 && Math.abs(vPhi) < 0.0001) autoSpin = true
      }

      const { theta, phi, radius } = spherical
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta),
      )
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }

    animate()

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.domElement.removeEventListener("pointerdown", onDown)
      renderer.domElement.removeEventListener("pointermove", onMove)
      renderer.domElement.removeEventListener("pointerup",   onUp)
      renderer.domElement.removeEventListener("wheel", onWheel)
      blobs.forEach((b) => { b.geo.dispose(); b.mat.dispose() })
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [p.background])

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
}
