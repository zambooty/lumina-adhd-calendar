/**
 * Shared Google API auth header + error classification.
 * Avoids false-positive "missing scope" when the API is disabled or rate-limited.
 */

export function googleAuthHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  }
}

export type GoogleApiFailureKind =
  | 'unauthorized'
  | 'insufficient_scope'
  | 'api_disabled'
  | 'forbidden'
  | 'other'

export type GoogleApiFailure = {
  kind: GoogleApiFailureKind
  status: number
  message: string
  /** True only when reconnecting Google (new consent) is the right fix. */
  shouldClearToken: boolean
}

type GoogleErrorBody = {
  error?: {
    status?: string
    message?: string
    errors?: { reason?: string; message?: string; domain?: string }[]
    details?: { reason?: string; '@type'?: string }[]
  }
}

export async function classifyGoogleApiError(
  res: Response,
  label: string,
): Promise<GoogleApiFailure> {
  const status = res.status
  let body: GoogleErrorBody = {}
  try {
    body = (await res.json()) as GoogleErrorBody
  } catch {
    /* ignore */
  }

  const reasons = [
    ...(body.error?.errors?.map((e) => e.reason ?? '') ?? []),
    ...(body.error?.details?.map((d) => d.reason ?? '') ?? []),
    body.error?.status ?? '',
    body.error?.message ?? '',
  ]
    .join(' ')
    .toLowerCase()

  if (status === 401) {
    return {
      kind: 'unauthorized',
      status,
      message: `${label} access expired — reconnect Google.`,
      shouldClearToken: true,
    }
  }

  if (
    status === 403 &&
    /accessnotconfigured|service_disabled|api has not been used|not been enabled|accessNotConfigured/i.test(
      reasons,
    )
  ) {
    return {
      kind: 'api_disabled',
      status,
      message: `${label} API is not enabled on this Google Cloud project.`,
      shouldClearToken: false,
    }
  }

  if (
    status === 403 &&
    /insufficient|insufficientpermissions|access_denied|permission|scope/i.test(
      reasons,
    )
  ) {
    return {
      kind: 'insufficient_scope',
      status,
      message: `${label} is missing required OAuth scope — reconnect Google and allow Calendar + Gmail.`,
      shouldClearToken: true,
    }
  }

  if (status === 403) {
    // Unknown 403 — do NOT clear token (avoids reconnect loops for transient / project issues).
    return {
      kind: 'forbidden',
      status,
      message: `${label} returned 403 (${body.error?.message ?? 'forbidden'}). Check API enablement and scopes.`,
      shouldClearToken: false,
    }
  }

  return {
    kind: 'other',
    status,
    message: `${label} failed (${status}${body.error?.message ? `: ${body.error.message}` : ''}).`,
    shouldClearToken: false,
  }
}
