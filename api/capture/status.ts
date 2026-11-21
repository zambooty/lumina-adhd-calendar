import { readCaptureEnv } from '../../server/captureEnv.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  captureStatusRateLimit,
  clientKeyFromRequest,
  rateLimitedResponse,
  readTranscribeAllowlist,
  whisperSpendEnabled,
} from '../../server/captureSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * GET /api/capture/status — which optional capture providers are bound
 * (booleans only). Speech-to-text spend requires a Whisper key + allowlist
 * + verified Google token for an allowlisted account.
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

  const allowlist = readTranscribeAllowlist()
  const spendEnabled = whisperSpendEnabled(env.whisperConfigured)

  return jsonWithCors(request, {
    twilioConfigured: env.twilioConfigured,
    /** Key bound — does not mean public spend is open. */
    whisperKeyBound: env.whisperConfigured,
    /**
     * Client-facing: audio upload STT is available only when key + allowlist
     * are configured. Paste transcript always works without this.
     */
    whisperConfigured: spendEnabled,
    whisperSpendEnabled: spendEnabled,
    whisperAllowlistConfigured: allowlist.configured,
    imapLiveConfigured: env.imapLiveConfigured,
    /** Client must Connect Google; server verifies the access token. */
    sttRequiresGoogle: true,
    sttRequiresAllowlist: true,
    googleConfigured: google.configured,
  })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
