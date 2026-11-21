import { format, isValid, parseISO } from 'date-fns'

/** Parse ISO safely — invalid values never throw. */
export function safeParseIso(value: string): Date | null {
  try {
    const d = parseISO(value)
    return isValid(d) ? d : null
  } catch {
    return null
  }
}

export function safeFormatIso(
  value: string,
  pattern: string,
  fallback = 'Time TBD',
): string {
  const d = safeParseIso(value)
  if (!d) return fallback
  try {
    return format(d, pattern)
  } catch {
    return fallback
  }
}
