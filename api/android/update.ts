import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
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
import {
  fetchLatestGithubAndroidRelease,
  githubAuthConfigured,
  resolveFromManifest,
  type AndroidLatestManifest,
} from '../../server/androidUpdate.js'

async function loadStaticManifest(): Promise<AndroidLatestManifest | null> {
  try {
    const path = join(process.cwd(), 'public', 'android-latest.json')
    const raw = await readFile(path, 'utf8')
    const json = JSON.parse(raw) as AndroidLatestManifest
    if (
      typeof json.versionCode === 'number' &&
      typeof json.tag === 'string' &&
      typeof json.apkAsset === 'string'
    ) {
      return json
    }
  } catch {
    /* missing / invalid — GitHub-only path */
  }
  return null
}

/**
 * GET /api/android/update — latest Cap APK metadata for in-app updates.
 * Tries GitHub Releases (token optional), falls back to public/android-latest.json.
 */
export async function GET(request: Request): Promise<Response> {
  // Metadata is cached in androidUpdate.ts; keep this blunt against fans.
  const limit = takeRateLimit(
    `android-update:${clientKeyFromRequest(request)}`,
    30,
    60_000,
  )
  if (!limit.allowed) {
    const limited = rateLimitedResponse(limit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  const github = await fetchLatestGithubAndroidRelease()
  if (github.ok) {
    return jsonWithCors(request, {
      ...github,
      githubAuthConfigured: githubAuthConfigured(),
    })
  }

  const manifest = await loadStaticManifest()
  if (manifest) {
    const resolved = resolveFromManifest(manifest)
    return jsonWithCors(request, {
      ...resolved,
      githubAuthConfigured: githubAuthConfigured(),
      githubFallbackError: github.error,
      githubFallbackHint: github.hint,
    })
  }

  return jsonWithCors(
    request,
    {
      ok: false,
      error: github.error,
      hint: github.hint,
      githubAuthConfigured: githubAuthConfigured(),
    },
    { status: 404 },
  )
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
