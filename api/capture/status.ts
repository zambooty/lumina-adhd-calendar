import { readCaptureEnv } from '../../server/captureEnv.js'

/** GET /api/capture/status — which optional capture providers are bound (booleans only). */
export async function GET(_request: Request): Promise<Response> {
  const env = readCaptureEnv()
  return Response.json(
    {
      twilioConfigured: env.twilioConfigured,
      whisperConfigured: env.whisperConfigured,
      imapLiveConfigured: env.imapLiveConfigured,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
      },
    },
  )
}
