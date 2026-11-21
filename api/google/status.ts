import { GOOGLE_SCOPES, readGoogleEnv } from '../../server/googleEnv.js'
import {
  clientKeyFromRequest,
  rateLimitedResponse,
} from '../../server/googleTokenSecurity.js'
import { takeRateLimit } from '../../server/rateLimit.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * GET /api/google/status — whether Google secrets are bound; returns clientId
 * for GIS (public by design). No secrets. Light rate limit only — origin gate
 * stays on exchange/refresh where tokens move.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = takeRateLimit(
    `status:${clientKeyFromRequest(request)}`,
    120,
    60_000,
  )
  if (!limit.allowed) {
    const limited = rateLimitedResponse(limit)
    return new Response(limited.body, withCors(request, { status: limited.status, headers: limited.headers }))
  }

  const env = readGoogleEnv()
  return jsonWithCors(request, {
    configured: env.configured,
    demoMode: env.demoMode,
    clientId: env.clientId,
    hasClientSecret: env.hasClientSecret,
    scopes: GOOGLE_SCOPES,
  })
}

/** Cap cross-origin preflight. */
export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
