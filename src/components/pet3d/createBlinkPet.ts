/**
 * Procedural Blink mesh — lightweight primitives, no external models.
 * Cosmetics from Sparks store tint materials + attach accessories.
 */
import * as THREE from 'three'
import type { PetLooks } from '../../lib/petLooks'
import { stageScale } from '../../lib/petLooks'

export type PetAnimMood = 'idle' | 'tap' | 'happy'

export type BlinkPetHandle = {
  root: THREE.Group
  applyLooks: (looks: PetLooks) => void
  /** Advance animation; returns shadow scale hint. */
  tick: (elapsed: number, mood: PetAnimMood, reducedMotion: boolean) => number
  dispose: () => void
}

function hexColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex)
  } catch {
    return new THREE.Color('#3dffd4')
  }
}

function mat(
  color: string,
  opts?: { metalness?: number; roughness?: number; emissive?: string; emissiveIntensity?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hexColor(color),
    metalness: opts?.metalness ?? 0.18,
    roughness: opts?.roughness ?? 0.42,
    emissive: hexColor(opts?.emissive ?? color),
    emissiveIntensity: opts?.emissiveIntensity ?? 0.12,
  })
}

export function createBlinkPet(initial: PetLooks): BlinkPetHandle {
  const root = new THREE.Group()
  const bodyGroup = new THREE.Group()
  root.add(bodyGroup)

  const disposables: THREE.Object3D[] = []
  const materials: THREE.Material[] = []

  let looks = initial
  let pupilL: THREE.Mesh | null = null
  let pupilR: THREE.Mesh | null = null
  let pupilBase = { x: 0.18, y: 0.5, z: 0.3 }
  let companion: THREE.Object3D | null = null
  let tapUntil = 0
  let happyUntil = 0

  function track<T extends THREE.Object3D>(obj: T): T {
    disposables.push(obj)
    return obj
  }

  function trackMat<T extends THREE.Material>(m: T): T {
    materials.push(m)
    return m
  }

  function clearBody() {
    while (bodyGroup.children.length) {
      const child = bodyGroup.children[0]
      bodyGroup.remove(child)
    }
    for (const m of materials) m.dispose()
    materials.length = 0
    for (const obj of disposables) {
      obj.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose()
        }
      })
    }
    disposables.length = 0
    pupilL = pupilR = null
    companion = null
  }

  function addEyes(parent: THREE.Group, y: number, spread: number, size: number) {
    const white = trackMat(mat('#ffffff', { metalness: 0.05, roughness: 0.35, emissiveIntensity: 0.02 }))
    const pupil = trackMat(mat('#12081a', { metalness: 0.2, roughness: 0.5, emissiveIntensity: 0 }))
    const highlight = trackMat(mat('#ffffff', { emissiveIntensity: 0.4 }))

    const eyeL = track(new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), white))
    const eyeR = track(new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), white))
    eyeL.position.set(-spread, y, size * 1.6)
    eyeR.position.set(spread, y, size * 1.6)
    eyeL.scale.set(1, 1.08, 0.85)
    eyeR.scale.set(1, 1.08, 0.85)
    parent.add(eyeL, eyeR)

    pupilL = track(new THREE.Mesh(new THREE.SphereGeometry(size * 0.48, 12, 10), pupil))
    pupilR = track(new THREE.Mesh(new THREE.SphereGeometry(size * 0.48, 12, 10), pupil))
    pupilBase = { x: spread, y: y - 0.02, z: size * 2.05 }
    pupilL.position.set(-pupilBase.x, pupilBase.y, pupilBase.z)
    pupilR.position.set(pupilBase.x, pupilBase.y, pupilBase.z)
    parent.add(pupilL, pupilR)

    const hlL = track(new THREE.Mesh(new THREE.SphereGeometry(size * 0.16, 8, 8), highlight))
    const hlR = track(new THREE.Mesh(new THREE.SphereGeometry(size * 0.16, 8, 8), highlight))
    hlL.position.set(-spread - size * 0.2, y + size * 0.25, size * 2.35)
    hlR.position.set(spread - size * 0.15, y + size * 0.25, size * 2.35)
    parent.add(hlL, hlR)
  }

  function addClothes(parent: THREE.Group, accent: string) {
    if (looks.clothes === 'scarf') {
      const scarf = track(
        new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.08, 10, 24),
          trackMat(mat(looks.tip, { metalness: 0.1, roughness: 0.55, emissiveIntensity: 0.2 })),
        ),
      )
      scarf.rotation.x = Math.PI / 2.2
      scarf.position.y = 0.15
      parent.add(scarf)
    } else if (looks.clothes === 'hoodie') {
      const hood = track(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.72, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
          trackMat(mat(looks.secondary, { metalness: 0.08, roughness: 0.65, emissiveIntensity: 0.08 })),
        ),
      )
      hood.position.y = 0.55
      parent.add(hood)
      const torso = track(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.62, 0.55, 16),
          trackMat(mat(looks.secondary, { roughness: 0.7, emissiveIntensity: 0.06 })),
        ),
      )
      torso.position.y = -0.15
      parent.add(torso)
    } else if (looks.clothes === 'crown') {
      const band = track(
        new THREE.Mesh(
          new THREE.TorusGeometry(0.28, 0.04, 8, 20),
          trackMat(mat('#ffb020', { metalness: 0.55, roughness: 0.28, emissive: '#ffb020', emissiveIntensity: 0.25 })),
        ),
      )
      band.rotation.x = Math.PI / 2
      band.position.y = 0.95
      parent.add(band)
      for (let i = 0; i < 3; i++) {
        const spike = track(
          new THREE.Mesh(
            new THREE.ConeGeometry(0.06, 0.18, 6),
            trackMat(mat(accent, { metalness: 0.5, roughness: 0.3, emissiveIntensity: 0.3 })),
          ),
        )
        const a = ((i - 1) * Math.PI) / 5
        spike.position.set(Math.sin(a) * 0.22, 1.08, Math.cos(a) * 0.08)
        parent.add(spike)
      }
    }
  }

  function addCompanion(parent: THREE.Group) {
    if (looks.companion === 'none') return
    const pivot = track(new THREE.Group())
    pivot.name = 'companion-pivot'
    let mesh: THREE.Mesh
    if (looks.companion === 'moth') {
      mesh = track(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 10, 8),
          trackMat(mat('#fbbf24', { emissive: '#fbbf24', emissiveIntensity: 0.45 })),
        ),
      )
      const wingL = track(
        new THREE.Mesh(
          new THREE.CircleGeometry(0.14, 8),
          trackMat(mat('#fde68a', { emissiveIntensity: 0.2 })),
        ),
      )
      const wingR = wingL.clone()
      wingL.position.set(-0.12, 0.02, 0)
      wingR.position.set(0.12, 0.02, 0)
      mesh.add(wingL, wingR)
    } else if (looks.companion === 'egg') {
      mesh = track(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 10),
          trackMat(mat('#fef08a', { emissiveIntensity: 0.2 })),
        ),
      )
      mesh.scale.set(0.85, 1.15, 0.85)
    } else {
      mesh = track(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 10),
          trackMat(mat('#38bdf8', { metalness: 0.4, roughness: 0.25, emissive: '#38bdf8', emissiveIntensity: 0.5 })),
        ),
      )
    }
    mesh.position.set(0.85, 0.35, 0.2)
    pivot.add(mesh)
    parent.add(pivot)
    companion = pivot
  }

  function buildEgg() {
    const shell = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 24, 18),
        trackMat(
          mat(looks.accent, {
            metalness: looks.skin === 'glass' ? 0.35 : 0.15,
            roughness: looks.skin === 'midnight' ? 0.7 : 0.38,
            emissiveIntensity: 0.18,
          }),
        ),
      ),
    )
    shell.scale.set(0.85, 1.15, 0.85)
    bodyGroup.add(shell)
    const gloss = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        trackMat(mat('#ffffff', { metalness: 0.1, roughness: 0.2, emissiveIntensity: 0.5 })),
      ),
    )
    gloss.position.set(-0.22, 0.35, 0.45)
    gloss.scale.set(1, 0.55, 0.4)
    bodyGroup.add(gloss)
    addEyes(bodyGroup, 0.1, 0.22, 0.14)
    addClothes(bodyGroup, looks.accent)
    addCompanion(bodyGroup)
  }

  function buildHatchling() {
    const body = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 20, 16),
        trackMat(mat(looks.accent, { emissiveIntensity: 0.16 })),
      ),
    )
    body.scale.set(1.05, 0.85, 1)
    body.position.y = -0.15
    bodyGroup.add(body)
    const head = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 20, 16),
        trackMat(mat(looks.accent, { emissiveIntensity: 0.14 })),
      ),
    )
    head.position.y = 0.45
    bodyGroup.add(head)
    const beak = track(
      new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.18, 6),
        trackMat(mat('#ff5c6c', { emissiveIntensity: 0.15 })),
      ),
    )
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.38, 0.4)
    bodyGroup.add(beak)
    addEyes(bodyGroup, 0.5, 0.16, 0.12)
    addClothes(bodyGroup, looks.accent)
    addCompanion(bodyGroup)
  }

  function buildCreature() {
    const coat = trackMat(
      mat(looks.accent, {
        metalness: looks.skin === 'candy' ? 0.28 : 0.16,
        roughness: looks.skin === 'aurora' ? 0.32 : 0.45,
        emissive: looks.secondary,
        emissiveIntensity: looks.stage === 'legend' ? 0.28 : 0.14,
      }),
    )
    const tipMat = trackMat(mat(looks.tip, { emissiveIntensity: 0.22 }))

    // ears — shape by animal
    const earGeo =
      looks.animal === 'bunny'
        ? new THREE.CapsuleGeometry(0.1, 0.45, 4, 8)
        : looks.animal === 'cat'
          ? new THREE.ConeGeometry(0.16, 0.32, 5)
          : looks.animal === 'dragon'
            ? new THREE.ConeGeometry(0.14, 0.4, 6)
            : new THREE.ConeGeometry(0.18, 0.38, 5)

    const earL = track(new THREE.Mesh(earGeo, coat))
    const earR = track(new THREE.Mesh(earGeo, coat))
    if (looks.animal === 'bunny') {
      earL.position.set(-0.22, 1.05, 0)
      earR.position.set(0.22, 1.05, 0)
    } else {
      earL.position.set(-0.32, 0.95, 0)
      earR.position.set(0.32, 0.95, 0)
      earL.rotation.z = 0.35
      earR.rotation.z = -0.35
    }
    bodyGroup.add(earL, earR)

    const innerL = track(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), tipMat))
    const innerR = track(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), tipMat))
    innerL.position.set(-0.32, 0.88, 0.06)
    innerR.position.set(0.32, 0.88, 0.06)
    if (looks.animal !== 'bunny') bodyGroup.add(innerL, innerR)

    const head = track(new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 18), coat))
    head.position.y = 0.48
    bodyGroup.add(head)

    const body = track(
      new THREE.Mesh(new THREE.SphereGeometry(0.55, 22, 16), coat),
    )
    body.scale.set(1.05, 0.78, 0.95)
    body.position.y = -0.05
    bodyGroup.add(body)

    // snout
    const snout = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        trackMat(mat('#fff8e8', { emissiveIntensity: 0.05 })),
      ),
    )
    snout.position.set(0, 0.35, 0.42)
    snout.scale.set(1, 0.75, 1.1)
    bodyGroup.add(snout)
    const nose = track(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        trackMat(mat('#1a1020', { emissiveIntensity: 0 })),
      ),
    )
    nose.position.set(0, 0.38, 0.55)
    bodyGroup.add(nose)

    // cheeks
    const cheekMat = trackMat(mat('#ff5c6c', { emissiveIntensity: 0.15 }))
    const cheekL = track(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cheekMat))
    const cheekR = track(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), cheekMat))
    cheekL.position.set(-0.32, 0.38, 0.3)
    cheekR.position.set(0.32, 0.38, 0.3)
    bodyGroup.add(cheekL, cheekR)

    // tail
    const tail = track(
      new THREE.Mesh(
        looks.animal === 'dragon'
          ? new THREE.ConeGeometry(0.12, 0.7, 6)
          : new THREE.SphereGeometry(0.22, 12, 10),
        looks.animal === 'dragon' ? tipMat : coat,
      ),
    )
    if (looks.animal === 'dragon') {
      tail.position.set(0.55, -0.1, -0.35)
      tail.rotation.z = -1.1
      tail.rotation.x = 0.4
    } else {
      tail.position.set(0.55, -0.15, -0.35)
      tail.scale.set(0.7, 0.9, 1.4)
    }
    bodyGroup.add(tail)

    if (looks.stage === 'glowfox' || looks.stage === 'legend') {
      const star = track(
        new THREE.Mesh(
          new THREE.OctahedronGeometry(0.12, 0),
          trackMat(mat(looks.tip, { metalness: 0.4, emissiveIntensity: 0.55 })),
        ),
      )
      star.position.set(0, 1.15, 0)
      bodyGroup.add(star)
    }

    if (looks.animal === 'dragon') {
      const hornL = track(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), tipMat))
      const hornR = track(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), tipMat))
      hornL.position.set(-0.12, 0.95, 0.1)
      hornR.position.set(0.12, 0.95, 0.1)
      bodyGroup.add(hornL, hornR)
    }

    addEyes(bodyGroup, 0.52, 0.18, 0.13)
    addClothes(bodyGroup, looks.accent)
    addCompanion(bodyGroup)
  }

  function rebuild() {
    clearBody()
    const s = stageScale(looks.stage)
    bodyGroup.scale.setScalar(s)
    if (looks.stage === 'egg') buildEgg()
    else if (looks.stage === 'hatchling') buildHatchling()
    else buildCreature()
  }

  rebuild()

  return {
    root,
    applyLooks(next) {
      const same =
        next.stage === looks.stage &&
        next.animal === looks.animal &&
        next.skin === looks.skin &&
        next.clothes === looks.clothes &&
        next.companion === looks.companion &&
        next.accent === looks.accent &&
        next.secondary === looks.secondary &&
        next.tip === looks.tip
      looks = next
      if (!same) rebuild()
    },
    tick(elapsed, mood, reducedMotion) {
      if (mood === 'tap') tapUntil = elapsed + 0.55
      if (mood === 'happy') happyUntil = elapsed + 0.9

      const inTap = elapsed < tapUntil
      const inHappy = elapsed < happyUntil

      if (reducedMotion) {
        bodyGroup.position.y = 0
        bodyGroup.rotation.set(0.12, 0.2, 0)
        bodyGroup.scale.setScalar(stageScale(looks.stage))
        return 1
      }

      const breathe = 1 + Math.sin(elapsed * 2.1) * 0.035
      let y = Math.sin(elapsed * 1.6) * 0.06
      let rotY = Math.sin(elapsed * 0.7) * 0.35
      let rotX = 0.15 + Math.sin(elapsed * 1.1) * 0.05
      let squash = breathe

      if (inHappy) {
        const t = 1 - (happyUntil - elapsed) / 0.9
        const bounce = Math.sin(t * Math.PI * 2) * (1 - t) * 0.45
        y += Math.abs(bounce)
        squash = breathe + bounce * 0.15
        rotY += Math.sin(t * Math.PI * 4) * 0.25 * (1 - t)
      } else if (inTap) {
        const t = 1 - (tapUntil - elapsed) / 0.55
        y += Math.sin(t * Math.PI) * 0.28
        squash = breathe + Math.sin(t * Math.PI) * 0.12
        rotY += Math.sin(t * Math.PI * 3) * 0.4
        rotX += Math.sin(t * Math.PI * 2) * 0.15
      }

      bodyGroup.position.y = y
      bodyGroup.rotation.set(rotX, rotY, Math.sin(elapsed * 0.9) * 0.04)
      const base = stageScale(looks.stage)
      bodyGroup.scale.set(base * squash, base * (2 - squash) * 0.5 + base * 0.5, base * squash)

      // pupil glance
      if (pupilL && pupilR) {
        const gx = Math.sin(elapsed * 0.9) * 0.03
        const gy = Math.cos(elapsed * 1.3) * 0.015
        pupilL.position.set(-pupilBase.x + gx, pupilBase.y + gy, pupilBase.z)
        pupilR.position.set(pupilBase.x + gx, pupilBase.y + gy, pupilBase.z)
      }

      if (companion) {
        companion.rotation.y = elapsed * 1.2
        companion.position.y = Math.sin(elapsed * 2.4) * 0.08
      }

      return 0.85 + Math.abs(y) * 0.4
    },
    dispose() {
      clearBody()
      root.clear()
    },
  }
}
