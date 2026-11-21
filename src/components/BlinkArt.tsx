import { motion } from 'framer-motion'
import type { PetStage } from '../types'

type Props = {
  stage: PetStage
  mood: 'idle' | 'hover' | 'tap'
}

/** Hand-drawn SVG Blink — big expressive eyes, stage-specific flair. */
export function BlinkArt({ stage, mood }: Props) {
  const eyeScale = mood === 'tap' ? 0.85 : mood === 'hover' ? 1.12 : 1
  const browY = mood === 'tap' ? -2 : mood === 'hover' ? -4 : 0
  const mouth = mood === 'tap' ? 'open' : mood === 'hover' ? 'smirk' : 'cute'

  if (stage === 'egg') {
    return (
      <svg viewBox="0 0 120 120" className="blink-svg" aria-hidden>
        <defs>
          <radialGradient id="eggGlow" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#fff6c8" />
            <stop offset="45%" stopColor="#3dffd4" />
            <stop offset="100%" stopColor="#1a6b5c" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="64" rx="34" ry="42" fill="url(#eggGlow)" stroke="#9dffef" strokeWidth="2" />
        <ellipse cx="48" cy="48" rx="10" ry="6" fill="#ffffff" opacity="0.35" />
        <Eyes cx={60} cy={58} scale={eyeScale} browY={browY} sparkle />
        <Mouth cx={60} cy={78} kind={mouth} />
        <motion.g
          animate={{ rotate: [0, 8, -6, 0], y: [0, -2, 0] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <path d="M78 28 Q88 18 96 28" fill="none" stroke="#c8ff4d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="96" cy="28" r="3" fill="#ffb020" />
        </motion.g>
      </svg>
    )
  }

  if (stage === 'hatchling') {
    return (
      <svg viewBox="0 0 120 120" className="blink-svg" aria-hidden>
        <defs>
          <radialGradient id="chick" cx="45%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff59a" />
            <stop offset="70%" stopColor="#ffb020" />
            <stop offset="100%" stopColor="#ff5c6c" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="72" rx="36" ry="28" fill="url(#chick)" />
        <circle cx="60" cy="48" r="28" fill="url(#chick)" />
        <ellipse cx="28" cy="58" rx="10" ry="7" fill="#ffb020" transform="rotate(-20 28 58)" />
        <ellipse cx="92" cy="58" rx="10" ry="7" fill="#ffb020" transform="rotate(20 92 58)" />
        <Eyes cx={60} cy={46} scale={eyeScale * 1.05} browY={browY} sparkle />
        <polygon points="60,56 52,62 68,62" fill="#ff5c6c" />
        <Mouth cx={60} cy={68} kind={mouth} />
        <motion.g
          animate={{ rotate: [0, 12, -10, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ transformOrigin: '88px 30px' }}
        >
          <path d="M82 34 Q92 18 102 32" fill="none" stroke="#3dffd4" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </svg>
    )
  }

  // cub / glowfox / legend share fox body with escalating glam
  const coat =
    stage === 'legend'
      ? ['#fff', '#3dffd4', '#c8ff4d']
      : stage === 'glowfox'
        ? ['#ffd6a8', '#ff5c6c', '#ffb020']
        : ['#ffc98a', '#ff8a4c', '#3dffd4']

  return (
    <svg viewBox="0 0 120 120" className="blink-svg" aria-hidden>
      <defs>
        <linearGradient id="foxCoat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={coat[0]} />
          <stop offset="55%" stopColor={coat[1]} />
          <stop offset="100%" stopColor={coat[2]} />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* ears */}
      <motion.g
        animate={{ rotate: mood === 'hover' ? [0, -8, 6, 0] : [0, -4, 3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ transformOrigin: '38px 28px' }}
      >
        <polygon points="28,48 38,14 52,42" fill="url(#foxCoat)" stroke="#fff" strokeWidth="1.5" />
        <polygon points="34,42 38,24 44,40" fill="#ff5c6c" opacity="0.85" />
      </motion.g>
      <motion.g
        animate={{ rotate: mood === 'hover' ? [0, 8, -6, 0] : [0, 4, -3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.2 }}
        style={{ transformOrigin: '82px 28px' }}
      >
        <polygon points="92,48 82,14 68,42" fill="url(#foxCoat)" stroke="#fff" strokeWidth="1.5" />
        <polygon points="86,42 82,24 76,40" fill="#ff5c6c" opacity="0.85" />
      </motion.g>
      {/* head + body */}
      <ellipse cx="60" cy="78" rx="34" ry="24" fill="url(#foxCoat)" filter="url(#softGlow)" />
      <circle cx="60" cy="52" r="30" fill="url(#foxCoat)" filter="url(#softGlow)" />
      {/* cheeks */}
      <circle cx="38" cy="58" r="7" fill="#ff5c6c" opacity="0.45" />
      <circle cx="82" cy="58" r="7" fill="#ff5c6c" opacity="0.45" />
      <Eyes cx={60} cy={48} scale={eyeScale * 1.1} browY={browY} sparkle />
      {/* snout */}
      <ellipse cx="60" cy="64" rx="10" ry="7" fill="#fff8e8" />
      <ellipse cx="60" cy="62" rx="3.5" ry="2.5" fill="#1a1020" />
      <Mouth cx={60} cy={72} kind={mouth} />
      {/* glam extras */}
      {(stage === 'glowfox' || stage === 'legend') && (
        <motion.g
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ transformOrigin: '60px 30px' }}
        >
          <path d="M60 18 L63 28 L74 28 L65 34 L68 44 L60 38 L52 44 L55 34 L46 28 L57 28 Z" fill="#c8ff4d" />
        </motion.g>
      )}
      {stage === 'legend' && (
        <>
          <motion.circle
            cx="20"
            cy="40"
            r="4"
            fill="#3dffd4"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.circle
            cx="100"
            cy="50"
            r="3"
            fill="#ffb020"
            animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: 0.4 }}
          />
        </>
      )}
      {/* fluffy tail tip */}
      <motion.path
        d="M94 86 Q112 70 108 96 Q100 104 90 94"
        fill="#fff"
        stroke={coat[2]}
        strokeWidth="2"
        animate={{ rotate: [0, 10, -8, 0] }}
        transition={{ duration: 2.1, repeat: Infinity }}
        style={{ transformOrigin: '94px 90px' }}
      />
    </svg>
  )
}

function Eyes({
  cx,
  cy,
  scale,
  browY,
  sparkle,
}: {
  cx: number
  cy: number
  scale: number
  browY: number
  sparkle?: boolean
}) {
  const eyeR = 11 * scale
  const pupilR = 5.2 * scale
  return (
    <g>
      {/* brows */}
      <path
        d={`M${cx - 22} ${cy - 16 + browY} Q${cx - 14} ${cy - 22 + browY} ${cx - 6} ${cy - 15 + browY}`}
        fill="none"
        stroke="#1a1020"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d={`M${cx + 6} ${cy - 15 + browY} Q${cx + 14} ${cy - 24 + browY} ${cx + 22} ${cy - 16 + browY}`}
        fill="none"
        stroke="#1a1020"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* whites */}
      <ellipse cx={cx - 12} cy={cy} rx={eyeR} ry={eyeR * 1.05} fill="#fff" />
      <ellipse cx={cx + 12} cy={cy} rx={eyeR} ry={eyeR * 1.05} fill="#fff" />
      {/* pupils */}
      <motion.g
        animate={{ x: [0, 1.5, -1, 0], y: [0, 0.5, -0.5, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <circle cx={cx - 12} cy={cy + 1} r={pupilR} fill="#12081a" />
        <circle cx={cx + 12} cy={cy + 1} r={pupilR} fill="#12081a" />
        <circle cx={cx - 14} cy={cy - 2} r={2.2} fill="#fff" />
        <circle cx={cx + 10} cy={cy - 2} r={2.2} fill="#fff" />
        {sparkle && (
          <>
            <circle cx={cx - 9} cy={cy + 4} r={1.2} fill="#3dffd4" />
            <circle cx={cx + 15} cy={cy + 4} r={1.2} fill="#c8ff4d" />
          </>
        )}
      </motion.g>
    </g>
  )
}

function Mouth({ cx, cy, kind }: { cx: number; cy: number; kind: string }) {
  if (kind === 'open') {
    return <ellipse cx={cx} cy={cy} rx="7" ry="5" fill="#1a1020" />
  }
  if (kind === 'smirk') {
    return (
      <path
        d={`M${cx - 8} ${cy} Q${cx + 2} ${cy + 8} ${cx + 10} ${cy - 1}`}
        fill="none"
        stroke="#1a1020"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    )
  }
  return (
    <path
      d={`M${cx - 7} ${cy} Q${cx} ${cy + 7} ${cx + 7} ${cy}`}
      fill="none"
      stroke="#1a1020"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  )
}
