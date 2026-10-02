import { useEffect, useRef } from "react"
import * as THREE from "three"

import type { Settings } from "./ShapeRenderer"

// Slightly lower geometry detail than the individual renderer.
// This lets us show multiple identities at the same time.
const BLOB_CFGS: [number, number, number, number, number][] = [
  [1.10, 3,  0.00,  0.00,  0.00],
  [0.62, 2,  1.55,  0.80,  0.10],
  [0.52, 2, -1.30, -0.90,  0.20],
  [0.48, 2, -0.75,  1.40, -0.40],
  [0.40, 2,  1.20, -1.10,  0.50],
  [0.44, 2, -1.55,  0.35,  0.45],
]

function triNoise(
  x: number,
  y: number,
  z: number,
  f: number,
  t: number
) {
  return (
    Math.sin(x * f + t) *
    Math.cos(y * f + t * 0.73) *
    Math.sin(z * f + t * 1.31)
  )
}

type IdentityBlob = {
  mesh: THREE.Mesh
  geo: THREE.BufferGeometry
  mat: THREE.MeshStandardMaterial
  orig: Float32Array

  bx: number
  by: number
  bz: number

  isCenter: boolean
}

type IdentityObject = {
  group: THREE.Group
  blobs: IdentityBlob[]
  settings: Settings

  time: number
  basePosition: THREE.Vector3
  phase: number
}

export function CollectiveRenderer({
    identities,
    background = "#000000",
    onSelectIdentity,
  }: {
    identities: Settings[]
    background?: string
    onSelectIdentity?: (settings: Settings) => void
  }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "default",
    })

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.5)
    )

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    )

    container.appendChild(renderer.domElement)

    // ─── Scene ─────────────────────────────────────────

    const scene = new THREE.Scene()

    scene.background =
      new THREE.Color(background)

    const camera =
      new THREE.PerspectiveCamera(
        42,
        container.clientWidth /
          container.clientHeight,
        0.1,
        100
      )

    camera.position.set(0, 0, 14)

    // ─── Lights ────────────────────────────────────────

    scene.add(
      new THREE.AmbientLight(
        0xfafaf8,
        0.65
      )
    )

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        2
      )

    key.position.set(4, 7, 5)

    scene.add(key)

    const fill =
      new THREE.DirectionalLight(
        0xc0d0ff,
        0.5
      )

    fill.position.set(-5, -3, -4)

    scene.add(fill)

    // ─── Positions for identities ──────────────────────

    const positions = [
      [-4.4,  2.4,  0],
      [ 0.0,  2.8, -1],
      [ 4.2,  2.0,  0],

      [-3.2, -1.0, -1],
      [ 0.6, -0.5,  0],
      [ 4.0, -1.5, -1],

      [-4.5, -4.0, -2],
      [-0.8, -3.7, -1],
      [ 3.2, -4.1, -2],

      [ 0.0,  5.5, -3],
      [-6.5,  0.0, -3],
      [ 6.4,  0.0, -3],
    ]

    // We show the latest 12 identities.
    const visibleIdentities =
      identities.slice(-12)

    const identityObjects:
      IdentityObject[] =
      visibleIdentities.map(
        (settings, identityIndex) => {
          const group =
            new THREE.Group()

          scene.add(group)

          const position =
            positions[
              identityIndex %
                positions.length
            ]

          const basePosition =
            new THREE.Vector3(
              position[0],
              position[1],
              position[2]
            )

          group.position.copy(
            basePosition
          )

          const blobs =
            BLOB_CFGS.map(
              ([
                radius,
                detail,
                bx,
                by,
                bz,
              ]) => {
                const geo =
                  new THREE.IcosahedronGeometry(
                    radius,
                    detail
                  )

                const mat =
                  new THREE.MeshStandardMaterial(
                    {
                      color:
                        new THREE.Color(
                          settings.color
                        ),
                      roughness:
                        0.08 +
                        settings.texture *
                          0.84,
                      metalness: 0.06,
                    }
                  )

                const mesh =
                  new THREE.Mesh(
                    geo,
                    mat
                  )

                mesh.userData.identityIndex = identityIndex

                group.add(mesh)

                const orig =
                  new Float32Array(
                    geo.attributes
                      .position
                      .array as Float32Array
                  )

                return {
                  mesh,
                  geo,
                  mat,
                  orig,
                  bx,
                  by,
                  bz,

                  isCenter:
                    bx === 0 &&
                    by === 0 &&
                    bz === 0,
                }
              }
            )

          // Collective scale.
          // Keeps the relationship between
          // Subtle and Bold but makes all
          // identities fit in the scene.
          group.scale.setScalar(0.42)

          return {
            group,
            blobs,
            settings,

            time:
              identityIndex * 0.8,

            basePosition,

            phase:
              identityIndex * 1.73,
          }
        }
      )

    // ─── Animation ─────────────────────────────────────

    let animId: number

    const animate = () => {
      animId =
        requestAnimationFrame(animate)

      identityObjects.forEach(
        (identity, identityIndex) => {
          const s =
            identity.settings

          identity.time += 0.0035

          const time =
            identity.time

          const energyCurve =
            Math.pow(
              s.movement,
              1.6
            )

          const freq =
            1.6 +
            s.sharpness * 3.5

          const dAmp =
            s.deformation * 0.44

          const rBlend =
            1.0 -
            s.roundness * 0.74

          const scale =
            0.42 +
            s.size * 0.92

          const textureAmp =
            s.texture * 0.16

          // ─── Individual blobs ────────────────

          identity.blobs.forEach(
            (b, idx) => {
              b.mesh.visible =
                idx <
                Math.round(
                  s.quantity
                )

              if (!b.mesh.visible)
                return

              const pos =
                b.geo.attributes
                  .position
                  .array as Float32Array

              const orig =
                b.orig

              const t =
                time +
                idx * 1.73

              for (
                let i = 0;
                i < pos.length;
                i += 3
              ) {
                const ox =
                  orig[i]

                const oy =
                  orig[i + 1]

                const oz =
                  orig[i + 2]

                const len =
                  Math.sqrt(
                    ox * ox +
                      oy * oy +
                      oz * oz
                  ) || 1

                const nx =
                  ox / len

                const ny =
                  oy / len

                const nz =
                  oz / len

                // Animated deformation
                const n1 =
                  triNoise(
                    nx,
                    ny,
                    nz,
                    freq,
                    t
                  )

                const smoothD =
                  n1 * dAmp

                const sharpD =
                  Math.sign(n1) *
                  Math.pow(
                    Math.abs(n1),
                    0.22
                  ) *
                  dAmp

                const deformationDetail =
                  (
                    smoothD *
                      s.roundness +
                    sharpD *
                      (1 -
                        s.roundness)
                  ) *
                  rBlend

                // Static surface texture
                const textureNoise =
                  triNoise(
                    nx,
                    ny,
                    nz,
                    8.0 +
                      s.texture *
                        7.0,
                    0.75
                  )

                const surfaceTexture =
                  textureNoise *
                  textureAmp

                const total =
                  deformationDetail +
                  surfaceTexture

                pos[i] =
                  ox +
                  nx * total

                pos[i + 1] =
                  oy +
                  ny * total

                pos[i + 2] =
                  oz +
                  nz * total
              }

              b.geo.attributes.position.needsUpdate =
                true

              b.geo.computeVertexNormals()

              if (!b.isCenter) {
                const sp =
                  0.55 +
                  s.spacing *
                    1.55

                b.mesh.position.set(
                  b.bx * sp,
                  b.by * sp,
                  b.bz * sp
                )
              }

              // Size
              b.mesh.scale.setScalar(
                scale
              )

              // Color
              b.mat.color.set(
                s.color
              )

              // Surface
              b.mat.roughness =
                0.08 +
                s.texture *
                  0.84
            }
          )

          // ─── Energy / rotation ───────────────

          const rotationSpeed =
            0.0035 +
            energyCurve *
              0.032

          identity.group.rotation.y +=
            rotationSpeed

          identity.group.rotation.x =
            Math.sin(
              time * 4 +
                identity.phase
            ) *
            energyCurve *
            0.07

          identity.group.rotation.z =
            Math.sin(
              time * 5.5 +
                identity.phase
            ) *
            energyCurve *
            0.05

          // ─── Very subtle floating ────────────

          identity.group.position.y =
            identity.basePosition.y +
            Math.sin(
              time * 1.5 +
                identityIndex
            ) *
              0.12
        }
      )

      renderer.render(
        scene,
        camera
      )
    }

    // ─── Identity selection ─────────────────────────────────────────────

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const handlePointerDown = (event: PointerEvent) => {
  const rect =
    renderer.domElement.getBoundingClientRect()

  pointer.x =
    ((event.clientX - rect.left) /
      rect.width) *
      2 -
    1

  pointer.y =
    -(
      (event.clientY - rect.top) /
      rect.height
    ) *
      2 +
    1

  raycaster.setFromCamera(
    pointer,
    camera
  )

  const intersections =
    raycaster.intersectObjects(
      scene.children,
      true
    )

  for (const hit of intersections) {
    const identityIndex =
      hit.object.userData.identityIndex

    if (
      typeof identityIndex === "number"
    ) {
      const selected =
        visibleIdentities[
          identityIndex
        ]

      if (selected) {
        onSelectIdentity?.(
          selected
        )
      }

      break
    }
  }
}

renderer.domElement.addEventListener(
  "pointerdown",
  handlePointerDown
)

    animate()

    // ─── Resize ────────────────────────────────────────

    const ro =
      new ResizeObserver(() => {
        const w =
          container.clientWidth

        const h =
          container.clientHeight

        camera.aspect = w / h

        camera.updateProjectionMatrix()

        renderer.setSize(w, h)
      })

    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)

      ro.disconnect()

      identityObjects.forEach(
        (identity) => {
          identity.blobs.forEach(
            (b) => {
              b.geo.dispose()
              b.mat.dispose()
            }
          )
        }
      )

      renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown
      )

      renderer.dispose()

      if (
        container.contains(
          renderer.domElement
        )
      ) {
        container.removeChild(
          renderer.domElement
        )
      }
    }
  }, [identities, background])

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  )
}