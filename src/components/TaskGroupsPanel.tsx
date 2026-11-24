import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import type { TaskGroup, TaskGroupItem } from '../types'

type Props = {
  groups: TaskGroup[]
  onPullToDaily: (groupId: string, item: TaskGroupItem) => void
  onPullToCalendar: (groupId: string, item: TaskGroupItem) => void
}

export function TaskGroupsPanel({
  groups,
  onPullToDaily,
  onPullToCalendar,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? groups.find((g) => g.id === openId) : null

  return (
    <div className="task-groups">
      <p className="task-groups-intro">
        Pull a preset into today&apos;s list or onto the calendar. Groups are
        extensible — seeds cover the basics.
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.ul
            key="list"
            className="task-groups-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="task-groups-item"
                  style={{ ['--group-color' as string]: g.color }}
                  onClick={() => setOpenId(g.id)}
                >
                  <span
                    className="task-groups-swatch"
                    style={{ background: g.color }}
                    aria-hidden
                  />
                  <span className="task-groups-copy">
                    <strong>{g.label}</strong>
                    <span>{g.items.length} presets</span>
                  </span>
                  <span className="task-groups-chevron" aria-hidden>
                    →
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : (
          <motion.div
            key={open.id}
            className="task-groups-detail"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm task-groups-back"
              onClick={() => setOpenId(null)}
            >
              ← All groups
            </button>
            <header className="task-groups-detail-head">
              <span
                className="task-groups-swatch task-groups-swatch--lg"
                style={{ background: open.color }}
                aria-hidden
              />
              <div>
                <h3>{open.label}</h3>
                <p>Tap Daily or Calendar for each preset.</p>
              </div>
            </header>
            <ul className="task-groups-presets">
              {open.items.map((item) => (
                <li key={item.id} className="task-groups-preset">
                  <div className="task-groups-preset-copy">
                    <strong style={{ color: item.color }}>{item.title}</strong>
                    <span>
                      {item.defaultRepeat === 'none'
                        ? 'One-time'
                        : `Repeats ${item.defaultRepeat}`}
                    </span>
                  </div>
                  <div className="task-groups-preset-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onPullToDaily(open.id, item)}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onPullToCalendar(open.id, item)}
                    >
                      Calendar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
