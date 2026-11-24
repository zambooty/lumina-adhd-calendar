/**
 * ADHD-friendly duration display.
 * Never show 60+ minutes as minutes — use hour units (e.g. 1hr, 2hr).
 * Days are used at 24hr+.
 */
export function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(Math.abs(totalMinutes)))
  if (mins >= 24 * 60) {
    const d = Math.round(mins / (24 * 60))
    return `${d}d`
  }
  if (mins >= 60) {
    const h = Math.round(mins / 60)
    return `${h}hr`
  }
  return `${mins}m`
}

/** Human leave-countdown copy using the same duration rule. */
export function formatLeaveIn(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'Leave now'
  if (minutesUntil === 1) return 'Leave in 1 minute'
  if (minutesUntil < 60) return `Leave in ${minutesUntil} minutes`
  const label = formatDurationMinutes(minutesUntil)
  return `Leave in ${label}`
}
