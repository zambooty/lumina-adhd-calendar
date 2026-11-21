import type { Plugin } from 'vite'
import { GOOGLE_SCOPES, readGoogleEnv } from './server/googleEnv.js'

/**
 * Local Vite middleware mirroring Cursor host `/api/google/*` route handlers
 * so demo/live mode works the same in `npm run dev`.
 */
async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function attachGoogleApi(
  middlewares: {
    use: (fn: (
      req: import('http').IncomingMessage,
      res: import('http').ServerResponse,
      next: (err?: unknown) => void,
    ) => void) => void
  },
) {
  middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith('/api/google/')) {
      next()
      return
    }

    if (url === '/api/google/status' && req.method === 'GET') {
      const env = readGoogleEnv()
      const body = JSON.stringify({
        configured: env.configured,
        demoMode: env.demoMode,
        clientId: env.clientId,
        hasClientSecret: env.hasClientSecret,
        scopes: GOOGLE_SCOPES,
      })
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'private, no-store')
      res.end(body)
      return
    }

    if (url === '/api/google/exchange' && req.method === 'POST') {
      const origin = req.headers.origin
      const host = req.headers.host
      if (
        !origin ||
        !host ||
        (() => {
          try {
            return new URL(origin).host !== host
          } catch {
            return true
          }
        })()
      ) {
        res.statusCode = 403
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'forbidden_origin' }))
        return
      }

      let parsed: { code?: string; redirectUri?: string } = {}
      try {
        parsed = JSON.parse(await readBody(req)) as {
          code?: string
          redirectUri?: string
        }
      } catch {
        res.statusCode = 400
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'invalid_json' }))
        return
      }

      const env = readGoogleEnv()
      if (!env.configured || !env.clientId) {
        res.statusCode = 503
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({ error: 'google_not_configured', demoMode: true }),
        )
        return
      }
      if (!env.hasClientSecret) {
        res.statusCode = 503
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'client_secret_missing' }))
        return
      }

      const secret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
      const params = new URLSearchParams({
        code: (parsed.code ?? '').trim(),
        client_id: env.clientId,
        client_secret: secret,
        redirect_uri: parsed.redirectUri?.trim() || 'postmessage',
        grant_type: 'authorization_code',
      })
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })
        const payload = (await tokenRes.json()) as Record<string, unknown>
        res.statusCode = tokenRes.ok ? 200 : 502
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'private, no-store')
        if (!tokenRes.ok) {
          res.end(
            JSON.stringify({
              error: 'token_exchange_failed',
              details: payload.error ?? tokenRes.statusText,
            }),
          )
          return
        }
        res.end(
          JSON.stringify({
            accessToken: payload.access_token,
            expiresIn: payload.expires_in,
            scope: payload.scope,
            tokenType: payload.token_type,
            refreshToken: payload.refresh_token ?? null,
          }),
        )
      } catch (err) {
        res.statusCode = 502
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            error: 'token_exchange_failed',
            details: err instanceof Error ? err.message : 'unknown',
          }),
        )
      }
      return
    }

    next()
  })
}

export function googleApiPlugin(): Plugin {
  return {
    name: 'lumina-google-api',
    configureServer(server) {
      attachGoogleApi(server.middlewares)
    },
    configurePreviewServer(server) {
      attachGoogleApi(server.middlewares)
    },
  }
}
