import { motion } from 'framer-motion'

type Props = {
  onEnter: () => void
}

export function Hero({ onEnter }: Props) {
  return (
    <section className="hero-screen" aria-label="Welcome">
      <div className="hero-orb" aria-hidden />
      <div>
        <motion.h1
          className="hero-brand"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          LUMINA
        </motion.h1>
        <motion.p
          className="hero-tag"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
        >
          ADHD calendar companion — auto-capture appointments, auto reminders,
          grow your glow pet.
        </motion.p>
        <motion.div
          className="hero-cta"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          <button type="button" className="btn btn-primary" onClick={onEnter}>
            Open my calendar
          </button>
        </motion.div>
      </div>
    </section>
  )
}
