import { readCaptureEnv } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import {
  NO_STORE,
  captureStatusRateLimit,
  clientKeyFromRequest,
  mintCaptureToken,
  rateLimitedResponse,
} from '../../server/captureSecurity.js'

/**
 * GET /api/capture/status — which optional capture providers are bound
 * (booleans only) + short-lived captureToken for POST /transcribe.
 *
 * Origin-gated when issuing a token so only allowlisted same-origin browser
 * flows can mint one (CSRF / trivial script resistance).
 */
export async function GET(request: Request): Promise<Response> {
  const env = readCaptureEnv()
  const clientKey = clientKeyFromRequest(request)
  const limit = captureStatusRateLimit(clientKey)
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  const allowed = isAllowedRequestOrigin(request)
  // Always return booleans; only mint a spendable token for allowlisted
  // origins when Whisper is actually configured (route disabled otherwise).
  let captureToken: string | null = null
  if (allowed && env.whisperConfigured) {
    captureToken = mintCaptureToken(clientKey)
  }

  return Response.json(
    {
      twilioConfigured: env.twilioConfigured,
      whisperConfigured: env.whisperConfigured,
      imapLiveConfigured: env.imapLiveConfigured,
      captureToken,
      captureTokenTtlSec: captureToken ? 300 : 0,
    },
    {
      headers: {
        ...NO_STORE,
      },
    },
  )
}
