/**
 * Restore Cap debug keystore for local/agent APK builds (never for web publish).
 * Copies a private media keystore when present. Credentials must come from
 * environment variables into gitignored android/local.properties — this script
 * never embeds passwords.
 *
 * Usage: node scripts/ensure-debug-keystore.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const destDir = join(root, 'android', 'keystore')
const dest = join(destDir, 'lumina-debug.keystore')
const localProps = join(root, 'android', 'local.properties')

const candidates = [
  process.env.LUMINA_DEBUG_KEYSTORE_PATH,
  '/cursor/stores/bc-41f53592-19bc-4014-9034-344b0a9ba614/media/android-signing/lumina-debug.keystore',
].filter(Boolean)

function upsertLocalProps(updates) {
  const next = new Map()
  if (existsSync(localProps)) {
    for (const line of readFileSync(localProps, 'utf8').split(/\r?\n/)) {
      const m = /^([^=]+)=(.*)$/.exec(line)
      if (m) next.set(m[1].trim(), m[2])
      else if (line.trim()) next.set(line, null)
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v != null && String(v).length > 0) next.set(k, String(v))
  }
  const out = []
  for (const [k, v] of next) {
    out.push(v == null ? k : `${k}=${v}`)
  }
  writeFileSync(localProps, `${out.join('\n')}\n`)
}

mkdirSync(destDir, { recursive: true })

if (!existsSync(dest)) {
  let source = null
  for (const c of candidates) {
    if (c && existsSync(c)) {
      source = c
      break
    }
  }
  if (!source) {
    console.warn(
      'No lumina-debug.keystore found. Cap debug builds will use the machine default keystore (in-place updates may conflict). Place the shared keystore at android/keystore/lumina-debug.keystore and set lumina.debug.* in android/local.properties (gitignored).',
    )
  } else {
    copyFileSync(source, dest)
    console.log(`Restored lumina-debug.keystore from private media`)
  }
} else {
  console.log('lumina-debug.keystore present — ok')
}

upsertLocalProps({
  'lumina.debug.storeFile': 'keystore/lumina-debug.keystore',
  'lumina.debug.storePassword': process.env.LUMINA_DEBUG_STORE_PASSWORD || '',
  'lumina.debug.keyAlias': process.env.LUMINA_DEBUG_KEY_ALIAS || '',
  'lumina.debug.keyPassword': process.env.LUMINA_DEBUG_KEY_PASSWORD || '',
})
