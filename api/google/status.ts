import { GOOGLE_SCOPES, readGoogleEnv } from '../../server/googleEnv.js'

/** GET /api/google/status — whether Google secrets are bound; returns clientId for GIS. */
export async function GET(_request: Request): Promise<Response> {
  const env = readGoogleEnv()
  return Response.json(
    {
      configured: env.configured,
      demoMode: env.demoMode,
      clientId: env.clientId,
      hasClientSecret: env.hasClientSecret,
      scopes: GOOGLE_SCOPES,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    },
  )
}
