import { GOOGLE_SCOPES, readGoogleEnv } from '../../server/googleEnv.js'
import {
  NO_STORE,
  clientKeyFromRequest,
  rateLimitedResponse,
} from '../../server/googleTokenSecurity.js'
import { takeRateLimit } from '../../server/rateLimit.js'

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
    return rateLimitedResponse(limit)
  }

  const env = readGoogleEnv()
  return Response.json(
    {
      configured: env.configured,
      demoMode: env.demoMode,
      clientId: env.clientId,
      hasClientSecret: env.hasClientSecret,
      scopes: GOOGLE_SCOPES,
    },
    { headers: NO_STORE },
  )
}
