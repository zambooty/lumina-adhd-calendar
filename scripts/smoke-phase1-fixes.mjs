/**
 * Verify Phase 1 smoke fixes: menu, Week/Month/Year tabs, day sheet date.
 * Usage: node scripts/smoke-phase1-fixes.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'

const base = process.argv[2] || 'http://127.0.0.1:5173/'
const out = '/opt/cursor/artifacts/smoke-phase1-fixes'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const failures = []

function ok(label, cond, detail = '') {
  if (cond) console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`)
  else {
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
  }
}

await page.goto(base, { waitUntil: 'networkidle' })
const hero = page.getByRole('button', { name: /calendar|enter|start|open/i })
if (await hero.count()) {
  await hero.first().click()
  await page.waitForTimeout(400)
}

// Clear prior local state sheets
await page.evaluate(() => window.scrollTo(0, 420))
await page.waitForTimeout(250)
const menu = page.getByRole('button', { name: 'Open menu' })
const mbox = await menu.boundingBox()
ok('menu sticky visible', mbox && mbox.y >= 0 && mbox.y < 120, `y=${mbox?.y}`)
await page.mouse.click(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2)
await page.waitForTimeout(400)
ok('menu opens', (await page.locator('.app-menu-root').count()) === 1)
ok(
  'menu no titled header',
  (await page.locator('.app-menu-screen h1, .app-menu-screen .brand-mark').count()) === 0,
)
const scroll = page.locator('.app-menu-scroll')
ok(
  'menu vertical scroll',
  (await scroll.evaluate((el) => getComputedStyle(el).overflowY)).includes('auto'),
)
await page.screenshot({ path: `${out}/01-menu.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
ok(
  'menu closes',
  (await page.locator('.app-menu-root').count()) === 0 ||
    !(await page.locator('.app-menu-root').isVisible()),
)

await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(200)

const week = page.getByRole('tab', { name: 'Week' })
const month = page.getByRole('tab', { name: 'Month' })
const year = page.getByRole('tab', { name: 'Year' })

await week.scrollIntoViewIfNeeded()
const wbox = await week.boundingBox()
await page.mouse.click(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2)
await page.waitForTimeout(300)
ok(
  'Week tab',
  (await week.getAttribute('aria-selected')) === 'true' &&
    (await page.locator('.week-grid').count()) === 1,
)
await page.screenshot({ path: `${out}/02-week.png` })

const ybox = await year.boundingBox()
await page.mouse.click(ybox.x + ybox.width / 2, ybox.y + ybox.height / 2)
await page.waitForTimeout(300)
ok(
  'Year tab',
  (await year.getAttribute('aria-selected')) === 'true' &&
    (await page.locator('.year-grid').count()) === 1,
)
await page.screenshot({ path: `${out}/03-year.png` })

const mtab = await month.boundingBox()
await page.mouse.click(mtab.x + mtab.width / 2, mtab.y + mtab.height / 2)
await page.waitForTimeout(300)
ok(
  'Month tab',
  (await month.getAttribute('aria-selected')) === 'true' &&
    (await page.locator('.month-grid').count()) === 1,
)

const cell = page.locator('.month-cell[data-date="2026-11-24"]')
ok('Nov 24 cell present', (await cell.count()) === 1)
await cell.scrollIntoViewIfNeeded()
const cbox = await cell.boundingBox()
await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height * 0.65)
await page.waitForTimeout(400)
const title = await page.locator('#cal-sheet-title').innerText()
ok('day sheet matches Nov 24', /Today|Tuesday\s*[·•]\s*Nov 24/i.test(title), `title="${title}"`)
await page.screenshot({ path: `${out}/04-day24.png` })

await page.getByRole('button', { name: 'Close' }).click()
await page.waitForSelector('#cal-sheet-title', { state: 'detached', timeout: 5000 })
await page.waitForTimeout(200)

const cell21 = page.locator('.month-cell[data-date="2026-11-21"]')
await cell21.scrollIntoViewIfNeeded()
const b21 = await cell21.boundingBox()
await page.mouse.click(b21.x + b21.width / 2, b21.y + b21.height / 2)
await page.waitForSelector('#cal-sheet-title', { timeout: 5000 })
const title21 = await page.locator('#cal-sheet-title').innerText()
ok(
  'day sheet matches Nov 21',
  /Saturday\s*[·•]\s*Nov 21/i.test(title21),
  `title="${title21}"`,
)
await page.screenshot({ path: `${out}/05-day21.png` })

// Sticky still after calendar interaction
await page.evaluate(() => window.scrollTo(0, 500))
await page.waitForTimeout(250)
const menu2 = page.getByRole('button', { name: 'Open menu' })
const m2 = await menu2.boundingBox()
ok('menu sticky after deep scroll', m2 && m2.y >= 0 && m2.y < 120, `y=${m2?.y}`)
await page.mouse.click(m2.x + m2.width / 2, m2.y + m2.height / 2)
await page.waitForTimeout(400)
ok('menu opens after scroll', (await page.locator('.app-menu-root').isVisible()))
await page.screenshot({ path: `${out}/06-menu-after-scroll.png` })

writeFileSync(
  `${out}/summary.json`,
  JSON.stringify({ base, failures, pass: failures.length === 0 }, null, 2),
)

await browser.close()
if (failures.length) {
  console.error(`SMOKE FAIL (${failures.length}): ${failures.join(', ')}`)
  process.exit(1)
}
console.log('SMOKE OK')
