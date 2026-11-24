import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { PetLooks } from '../../lib/petLooks'
import { createBlinkPet, type PetAnimMood } from './createBlinkPet'

type Props = {
  looks: PetLooks
  /** 'idle' | 'tap' | 'happy' — parent drives celebrations. */
  mood: PetAnimMood
  reducedMotion: boolean
  /** Pixel size hint — fab stays tiny. */
  size?: 'fab' | 'panel' | 'hero'
  className?: string
  onTap?: () => void
  'aria-label'?: string
}

const DPR_CAP: Record<NonNullable<Props['size']>, number> = {
  fab: 1.25,
  panel: 1.5,
  hero: 1.75,
}

/**
 * Lightweight three.js canvas — no R3F, Cap/mobile-friendly DPR + pause offscreen.
 */
export function PetWebGLCanvas({
  looks,
  mood,
  reducedMotion,
  size = 'panel',
  className = '',
  onTap,
  'aria-label': ariaLabel,
}: Props) {
  const hostRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const looksRef = useRef(looks)
  const moodRef = useRef(mood)
  const reducedRef = useRef(reducedMotion)
  const moodPulse = useRef(0)

  useEffect(() => {
    looksRef.current = looks
    moodRef.current = mood
    reducedRef.current = reducedMotion
  }, [looks, mood, reducedMotion])

  // Bump pulse so the loop sees tap/happy even if same string repeats.
  useEffect(() => {
    if (mood === 'tap' || mood === 'happy') moodPulse.current += 1
  }, [mood])

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    let disposed = false
    let raf = 0
    let visible = true

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: size !== 'fab',
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40)
    camera.position.set(0, 0.35, size === 'fab' ? 3.4 : 3.1)

    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x1a2030, 0.95)
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(2.2, 3.2, 2.5)
    const fill = new THREE.DirectionalLight(0x3dffd4, 0.35)
    fill.position.set(-2, 1.2, -1)
    scene.add(hemi, key, fill)

    // Soft ground ring (glass orbit vibe — not purple glow)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(looksRef.current.secondary),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.85
    scene.add(ring)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.84
    scene.add(shadow)

    const pet = createBlinkPet(looksRef.current)
    pet.root.position.y = -0.15
    scene.add(pet.root)

    const clock = new THREE.Clock()
    let lastPulse = moodPulse.current
    let lastMood: PetAnimMood = 'idle'

    function resize() {
      const el = hostRef.current
      if (!el) return
      const w = el.clientWidth || 120
      const h = el.clientHeight || 120
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[size])
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting)
      },
      { threshold: 0.05 },
    )
    io.observe(host)

    function frame() {
      if (disposed) return
      raf = requestAnimationFrame(frame)
      if (!visible) return

      const elapsed = clock.getElapsedTime()
      pet.applyLooks(looksRef.current)

      let drive: PetAnimMood = 'idle'
      if (moodPulse.current !== lastPulse) {
        lastPulse = moodPulse.current
        drive = moodRef.current
        lastMood = drive
      } else if (lastMood !== 'idle') {
        // keep feeding idle after burst; createBlinkPet latches until timers end
        drive = 'idle'
        lastMood = 'idle'
      }

      const shadowScale = pet.tick(elapsed, drive, reducedRef.current)
      shadow.scale.setScalar(shadowScale)
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.color.set(looksRef.current.secondary)
        ring.material.opacity = reducedRef.current
          ? 0.22
          : 0.28 + Math.sin(elapsed * 1.4) * 0.08
      }
      if (!reducedRef.current) {
        ring.rotation.z = elapsed * 0.25
      }

      renderer.render(scene, camera)
    }

    raf = requestAnimationFrame(frame)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      pet.dispose()
      ring.geometry.dispose()
      ;(ring.material as THREE.Material).dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      renderer.dispose()
    }
  }, [size])

  const interactive = Boolean(onTap)
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      ref={hostRef as never}
      type={interactive ? 'button' : undefined}
      className={`pet-webgl ${className}`.trim()}
      aria-label={ariaLabel}
      onClick={onTap}
    >
      <canvas ref={canvasRef} className="pet-webgl-canvas" />
    </Tag>
  )
}
