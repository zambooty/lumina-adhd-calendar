import { readCaptureEnv } from '../../server/captureEnv.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  NO_STORE,
  captureStatusRateLimit,
  clientKeyFromRequest,
  rateLimitedResponse,
} from '../../server/captureSecurity.js'

/**
 * GET /api/capture/status — which optional capture providers are bound
 * (booleans only). Speech-to-text additionally requires a verified Google
 * access token on POST /transcribe (not a forgeable Origin/CSRF token).
 */
export async function GET(request: Request): Promise<Response> {
  const env = readCaptureEnv()
  const google = readGoogleEnv()
  const clientKey = clientKeyFromRequest(request)
  const limit = captureStatusRateLimit(clientKey)
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  return Response.json(
    {
      twilioConfigured: env.twilioConfigured,
      whisperConfigured: env.whisperConfigured,
      imapLiveConfigured: env.imapLiveConfigured,
      /** Client must Connect Google; server verifies the access token. */
      sttRequiresGoogle: true,
      googleConfigured: google.configured,
    },
    {
      headers: {
        ...NO_STORE,
      },
    },
  )
}
