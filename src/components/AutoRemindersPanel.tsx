import type { ReminderOffset, ReminderStack } from '../types'
import { formatDurationMinutes } from '../lib/duration'
import { uid } from '../lib/id'
import {
  AUTO_REMINDER_PRESETS,
  leaveOffset,
  presetBlurb,
  withLeaveBuffer,
} from '../lib/reminders'

type Props = {
  stacks: ReminderStack[]
  defaultStackId: string
  onSetDefault: (id: string) => void
  onUpdateStack: (stack: ReminderStack) => void
}

const LEAVE_BUFFERS = [8, 15, 20] as const

/**
 * Friendlier auto-reminders UI — presets + light leave-now controls.
 * Keeps ReminderStack under the hood for notifications / leave-now.
 */
export function AutoRemindersPanel({
  stacks,
  defaultStackId,
  onSetDefault,
  onUpdateStack,
}: Props) {
  const active = stacks.find((s) => s.id === defaultStackId) ?? stacks[0]
  const leave = active ? leaveOffset(active.offsets) : undefined
  const leaveOn = Boolean(leave)
  const leaveMins = leave?.minutesBefore ?? 15

  function setLeaveEnabled(on: boolean) {
    if (!active) return
    const withoutLeave = active.offsets.filter((o) => !/leave/i.test(o.label))
    if (!on) {
      onUpdateStack({ ...active, offsets: withoutLeave })
      return
    }
    const nextLeave: ReminderOffset = {
      id: leave?.id ?? uid('off'),
      label: 'Leave now',
      minutesBefore: leaveMins,
    }
    onUpdateStack({
      ...active,
      offsets: [...withoutLeave, nextLeave],
    })
  }

  function setLeaveBuffer(minutes: number) {
    if (!active) return
    onUpdateStack(withLeaveBuffer(active, minutes))
  }

  return (
    <div className="section-content auto-reminders">
      <p className="auto-reminders-lead">
        Sensible defaults fire before each event. Pick a vibe, tweak leave-now —
        no stack chrome.
      </p>

      <div
        className="auto-reminders-presets"
        role="radiogroup"
        aria-label="Auto reminder style"
      >
        {AUTO_REMINDER_PRESETS.map((preset) => {
          const stack = stacks.find((s) => s.id === preset.id)
          if (!stack) return null
          const selected = stack.id === defaultStackId
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`auto-reminders-preset${selected ? ' is-selected' : ''}`}
              onClick={() => onSetDefault(stack.id)}
            >
              <span className="auto-reminders-preset-name">{preset.label}</span>
              <span className="auto-reminders-preset-blurb">
                {presetBlurb(stack)}
              </span>
            </button>
          )
        })}
      </div>

      {active && (
        <>
          <div className="auto-reminders-summary" aria-live="polite">
            <p className="auto-reminders-summary-label">You&apos;ll hear from us</p>
            <div className="auto-reminders-chips">
              {active.offsets
                .slice()
                .sort((a, b) => b.minutesBefore - a.minutesBefore)
                .map((o) => (
                  <span
                    key={o.id}
                    className={`auto-reminders-chip${
                      /leave/i.test(o.label) ? ' auto-reminders-chip--leave' : ''
                    }`}
                  >
                    {/leave/i.test(o.label)
                      ? `Leave · ${formatDurationMinutes(o.minutesBefore)} before`
                      : formatDurationMinutes(o.minutesBefore) + ' before'}
                  </span>
                ))}
            </div>
          </div>

          <div className="auto-reminders-controls">
            <label className="toggle auto-reminders-toggle">
              <input
                type="checkbox"
                checked={leaveOn}
                onChange={(e) => setLeaveEnabled(e.target.checked)}
              />
              <span>Leave-now nudge</span>
            </label>

            {leaveOn && (
              <div
                className="auto-reminders-buffers"
                role="group"
                aria-label="Leave-now buffer"
              >
                <span className="auto-reminders-buffers-label">
                  Leave buffer
                </span>
                <div className="auto-reminders-buffer-row">
                  {LEAVE_BUFFERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`auto-reminders-buffer${
                        leaveMins === m ? ' is-selected' : ''
                      }`}
                      aria-pressed={leaveMins === m}
                      onClick={() => setLeaveBuffer(m)}
                    >
                      {formatDurationMinutes(m)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
