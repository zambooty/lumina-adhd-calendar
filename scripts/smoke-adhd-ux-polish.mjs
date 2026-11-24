/**
 * ADHD UX polish smoke: home calendar-first, collapsed mood, Esc day sheet,
 * store prompt deferred during Pull, touch targets, short Pull copy.
 * Usage: node scripts/smoke-adhd-ux-polish.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const base = process.argv[2] || 'http://127.0.0.1:5173/'
const out = '/opt/cursor/artifacts/smoke-adhd-ux-polish'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const failures = []

function ok(label, cond, detail = '') {
  if (cond) console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`)
  else {
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`)
    failures.push(label)
  }
}

await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })

// Onboarding: Meet → accounts → skip into home
if (await page.locator('.onboarding-screen').count()) {
  const continueBtn = page.getByRole('button', { name: /^Continue$/i })
  if (await continueBtn.count()) {
    await continueBtn.first().click()
  }
  await page.getByRole('button', { name: /Skip for now/i }).waitFor({
    state: 'visible',
    timeout: 5000,
  })
  ok(
    'no Soon accounts row',
    (await page.locator('.onboarding-account-row.is-soon').count()) === 0,
  )
  await page.getByRole('button', { name: /Skip for now/i }).click()
  await page.waitForSelector('.mix-home', { timeout: 8000 })
}

ok('home shell', (await page.locator('.mix-home').count()) === 1)

// Calendar should appear before feeling strip in DOM
const order = await page.evaluate(() => {
  const cal = document.querySelector('.calendar-primary')
  const feel = document.querySelector('.mix-feel, .feeling-checkin')
  if (!cal || !feel) return { cal: !!cal, feel: !!feel, before: false }
  return {
    cal: true,
    feel: true,
    before: !!(
      cal.compareDocumentPosition(feel) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
  }
})
ok('calendar before mood', order.cal && order.feel && order.before)

// Compact mood collapsed: Check in CTA, not 6 vibe chips
const vibeChips = page.locator('.feel-cat-chip')
ok('mood collapsed on home', (await vibeChips.count()) === 0)
ok(
  'check-in CTA',
  (await page.getByRole('button', { name: /Check in|Again/i }).count()) >= 1,
)

// Calendar tabs reachable without huge scroll
const month = page.getByRole('tab', { name: 'Month' })
await month.scrollIntoViewIfNeeded()
const mbox = await month.boundingBox()
ok('month tab visible', !!mbox && mbox.y < 700, `y=${mbox?.y}`)

// Open day sheet → Esc closes
await page.evaluate(() => window.scrollTo(0, 0))
await month.click()
await page.waitForTimeout(200)
const dayCell = page.locator('.month-cell:not(.is-outside)').first()
await dayCell.click()
await page.waitForTimeout(350)
ok('day sheet open', (await page.locator('.cal-sheet').count()) === 1)
await page.keyboard.press('Escape')
try {
  await page.locator('.cal-sheet').waitFor({ state: 'hidden', timeout: 2500 })
  ok('Esc closes day sheet', true)
} catch {
  ok(
    'Esc closes day sheet',
    (await page.locator('.cal-sheet').count()) === 0,
  )
}

// Touch targets: btn-sm / Pull / menu ≥ 44
const sizes = await page.evaluate(() => {
  const pull = document.querySelector('.topbar-pull')
  const menu = document.querySelector('.menu-trigger')
  const measure = (el) =>
    el ? { h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) } : null
  return { pull: measure(pull), menu: measure(menu) }
})
ok('Pull ≥44px', sizes.pull && sizes.pull.h >= 44, JSON.stringify(sizes.pull))
ok('Menu ≥44px', sizes.menu && sizes.menu.h >= 44, JSON.stringify(sizes.menu))

// Menu short hints
await page.getByRole('button', { name: 'Open menu' }).click()
await page.waitForTimeout(350)
const habitHint = await page
  .locator('.app-menu-list-item', { hasText: 'Habits' })
  .locator('.app-menu-list-hint')
  .textContent()
ok(
  'short habit hint',
  !!habitHint && !/keywords/i.test(habitHint) && habitHint.length < 40,
  habitHint || '',
)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Pull sheet short lead; no store prompt while Pull open
await page.locator('.topbar-pull').click()
await page.waitForTimeout(800)
ok('pull sheet open', (await page.locator('.pull-sheet').count()) === 1)
const lead = await page.locator('.pull-sheet-lead').textContent()
ok(
  'short pull lead',
  !!lead && !/arrow keys/i.test(lead) && lead.length < 60,
  lead || '',
)
ok(
  'no store prompt during Pull',
  (await page.locator('.pet-store-prompt').count()) === 0,
)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

await page.screenshot({ path: `${out}/01-home.png`, fullPage: true })
console.log(`shots → ${out}`)

await browser.close()
if (failures.length) {
  console.error(`FAILED: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('ALL PASS')
