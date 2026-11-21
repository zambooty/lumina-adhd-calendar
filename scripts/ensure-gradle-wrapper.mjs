/**
 * Ensure android/gradle/wrapper/gradle-wrapper.jar exists for local Cap builds.
 *
 * The jar is gitignored so it stays out of the Cursor web publish package
 * (binary-in-package review note). Properties stay in git to pin the Gradle
 * distribution; this script restores the small official wrapper jar when missing.
 *
 * Run: node scripts/ensure-gradle-wrapper.mjs
 * Wired into: npm run android:debug
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const propsPath = join(
  root,
  'android/gradle/wrapper/gradle-wrapper.properties',
)
const jarPath = join(root, 'android/gradle/wrapper/gradle-wrapper.jar')

function readDistributionVersion() {
  const raw = readFileSync(propsPath, 'utf8')
  const match = raw.match(
    /distributionUrl=.*gradle-(\d+\.\d+(?:\.\d+)?)(?:-.*)?\.zip/,
  )
  if (!match) {
    throw new Error(
      `Could not parse Gradle version from ${propsPath}`,
    )
  }
  return match[1]
}

async function download(url, dest) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'lumina-ensure-gradle-wrapper' },
  })
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} → ${res.status}`)
  }
  await mkdir(dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

if (existsSync(jarPath)) {
  console.log('gradle-wrapper.jar present — ok')
  process.exit(0)
}

const version = readDistributionVersion()
// Official wrapper jar from the matching Gradle tag (not the full distribution).
const url = `https://raw.githubusercontent.com/gradle/gradle/v${version}/gradle/wrapper/gradle-wrapper.jar`
console.log(`gradle-wrapper.jar missing — fetching Gradle ${version} wrapper…`)
console.log(url)

try {
  await download(url, jarPath)
  if (!existsSync(jarPath)) {
    throw new Error('download finished but jar still missing')
  }
  console.log('gradle-wrapper.jar restored')
} catch (err) {
  console.error(
    'Failed to restore gradle-wrapper.jar.',
    err instanceof Error ? err.message : err,
  )
  console.error(
    'Install Gradle locally and run: cd android && gradle wrapper --gradle-version',
    version,
  )
  process.exit(1)
}
