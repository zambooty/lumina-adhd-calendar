import type { ReminderStack } from '../types'
import { uid } from '../lib/id'

type Props = {
  stacks: ReminderStack[]
  defaultStackId: string
  onSetDefault: (id: string) => void
  onUpdateStack: (stack: ReminderStack) => void
}

export function ReminderStackEditor({
  stacks,
  defaultStackId,
  onSetDefault,
  onUpdateStack,
}: Props) {
  const active = stacks.find((s) => s.id === defaultStackId) ?? stacks[0]

  function updateOffset(
    offsetId: string,
    patch: Partial<{ label: string; minutesBefore: number }>,
  ) {
    if (!active) return
    onUpdateStack({
      ...active,
      offsets: active.offsets.map((o) =>
        o.id === offsetId ? { ...o, ...patch } : o,
      ),
    })
  }

  function addOffset() {
    if (!active) return
    onUpdateStack({
      ...active,
      offsets: [
        ...active.offsets,
        {
          id: uid('off'),
          label: 'New nudge',
          minutesBefore: 20,
        },
      ],
    })
  }

  function removeOffset(offsetId: string) {
    if (!active) return
    onUpdateStack({
      ...active,
      offsets: active.offsets.filter((o) => o.id !== offsetId),
    })
  }

  return (
    <div className="section-content stack-editor">
      <label className="event-meta" htmlFor="default-stack">
        Default template
      </label>
      <select
        id="default-stack"
        className="select"
        value={defaultStackId}
        onChange={(e) => onSetDefault(e.target.value)}
      >
        {stacks.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {active && (
        <>
          <p className="event-meta section-gap">
            Editing <strong style={{ color: 'var(--cyan)' }}>{active.name}</strong>
          </p>
          {active.offsets.map((o) => (
            <div className="stack-row" key={o.id}>
              <input
                aria-label="Label"
                value={o.label}
                onChange={(e) => updateOffset(o.id, { label: e.target.value })}
              />
              <input
                aria-label="Minutes before"
                type="number"
                min={1}
                style={{ maxWidth: 88 }}
                value={o.minutesBefore}
                onChange={(e) =>
                  updateOffset(o.id, {
                    minutesBefore: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeOffset(o.id)}
                aria-label="Remove reminder"
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addOffset}>
            + Add reminder
          </button>
        </>
      )}
    </div>
  )
}
