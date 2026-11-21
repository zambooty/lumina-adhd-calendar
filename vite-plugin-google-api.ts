import type { Plugin } from 'vite'
import {
  POST as exchangePost,
  OPTIONS as exchangeOptions,
} from './api/google/exchange.js'
import {
  POST as refreshPost,
  OPTIONS as refreshOptions,
} from './api/google/refresh.js'
import {
  GET as statusGet,
  OPTIONS as statusOptions,
} from './api/google/status.js'
import {
  GET as captureStatusGet,
  OPTIONS as captureStatusOptions,
} from './api/capture/status.js'
import {
  POST as captureTranscribePost,
  OPTIONS as captureTranscribeOptions,
} from './api/capture/transcribe.js'
import { POST as captureTwilioSmsPost } from './api/capture/twilio-sms.js'

/**
 * Local Vite middleware mirroring Cursor host `/api/google/*` and
 * `/api/capture/*` route handlers so demo/live mode works the same in
 * `npm run dev`.
 *
 * Delegates to the same api/* handlers used in production so origin
 * allowlist, redirect_uri checks, rate limits, and error sanitization stay
 * in sync.
 */

async function readBody(req: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function requestUrlFor(req: import('http').IncomingMessage): string {
  const host = req.headers.host || '127.0.0.1'
  const proto =
    (typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0]?.trim()
      : null) || 'http'
  return `${proto}://${host}${req.url ?? '/'}`
}

function toFetchHeaders(
  req: import('http').IncomingMessage,
): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }
  return headers
}

async function toRequest(
  req: import('http').IncomingMessage,
): Promise<Request> {
  const method = (req.method || 'GET').toUpperCase()
  const headers = toFetchHeaders(req)
  const url = requestUrlFor(req)
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers })
  }
  const body = await readBody(req)
  return new Request(url, { method, headers, body })
}

async function writeResponse(
  res: import('http').ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
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

    try {
      if (url === '/api/google/status' && req.method === 'OPTIONS') {
        await writeResponse(res, statusOptions(await toRequest(req)))
        return
      }
      if (url === '/api/google/status' && req.method === 'GET') {
        await writeResponse(res, await statusGet(await toRequest(req)))
        return
      }
      if (url === '/api/google/exchange' && req.method === 'OPTIONS') {
        await writeResponse(res, exchangeOptions(await toRequest(req)))
        return
      }
      if (url === '/api/google/exchange' && req.method === 'POST') {
        await writeResponse(res, await exchangePost(await toRequest(req)))
        return
      }
      if (url === '/api/google/refresh' && req.method === 'OPTIONS') {
        await writeResponse(res, refreshOptions(await toRequest(req)))
        return
      }
      if (url === '/api/google/refresh' && req.method === 'POST') {
        await writeResponse(res, await refreshPost(await toRequest(req)))
        return
      }
    } catch {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'private, no-store')
      res.end(JSON.stringify({ error: 'internal_error' }))
      return
    }

    next()
  })
}

function attachCaptureApi(
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
    if (!url.startsWith('/api/capture/')) {
      next()
      return
    }

    try {
      if (url === '/api/capture/status' && req.method === 'OPTIONS') {
        await writeResponse(res, captureStatusOptions(await toRequest(req)))
        return
      }
      if (url === '/api/capture/status' && req.method === 'GET') {
        await writeResponse(res, await captureStatusGet(await toRequest(req)))
        return
      }
      if (url === '/api/capture/twilio-sms' && req.method === 'POST') {
        await writeResponse(res, await captureTwilioSmsPost(await toRequest(req)))
        return
      }
      if (url === '/api/capture/transcribe' && req.method === 'OPTIONS') {
        await writeResponse(res, captureTranscribeOptions(await toRequest(req)))
        return
      }
      if (url === '/api/capture/transcribe' && req.method === 'POST') {
        await writeResponse(res, await captureTranscribePost(await toRequest(req)))
        return
      }
    } catch {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'private, no-store')
      res.end(JSON.stringify({ error: 'internal_error' }))
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
      attachCaptureApi(server.middlewares)
    },
    configurePreviewServer(server) {
      attachGoogleApi(server.middlewares)
      attachCaptureApi(server.middlewares)
    },
  }
}
