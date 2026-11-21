import { readCaptureEnv } from '../../server/captureEnv.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  captureStatusRateLimit,
  clientKeyFromRequest,
  rateLimitedResponse,
} from '../../server/captureSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

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
    const limited = rateLimitedResponse(limit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  return jsonWithCors(request, {
    twilioConfigured: env.twilioConfigured,
    whisperConfigured: env.whisperConfigured,
    imapLiveConfigured: env.imapLiveConfigured,
    /** Client must Connect Google; server verifies the access token. */
    sttRequiresGoogle: true,
    googleConfigured: google.configured,
  })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
