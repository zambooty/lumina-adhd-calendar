import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173'
const OUT = '/opt/cursor/artifacts/smoke-mood-checkins'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const log = []
function note(msg) {
  log.push(msg)
  console.log(msg)
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  // Onboarding: Meet → Continue → Skip for now (or Open calendar)
  const continueBtn = page.getByRole('button', { name: /^continue$/i })
  if (await continueBtn.count()) {
    await continueBtn.click()
  }
  const skip = page.getByRole('button', { name: /skip for now/i })
  try {
    await skip.waitFor({ state: 'visible', timeout: 5000 })
    await skip.click()
  } catch {
    const openCal = page.getByRole('button', { name: /open calendar|open my calendar/i })
    await openCal.first().waitFor({ state: 'visible', timeout: 5000 })
    await openCal.first().click()
  }
  await page.getByRole('button', { name: /open menu/i }).waitFor({
    state: 'visible',
    timeout: 8000,
  })
  await page.waitForTimeout(400)

  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true })
  const feelPrompt = await page.getByLabel('Feeling check-in').count()
  note(`home feeling strip: ${feelPrompt > 0}`)

  // First check-in from home strip (may already be expanded if no prior check-ins)
  const checkInBtn = page.getByRole('button', { name: /^check in$/i })
  if (await checkInBtn.count()) {
    await checkInBtn.click()
    await page.waitForTimeout(250)
  }

  await page.getByRole('button', { name: /feeling good/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^happy$/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /up/i }).filter({ hasText: '4' }).click()
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${OUT}/02-after-first-checkin.png`, fullPage: true })

  const tinted = await page.locator('.month-cell.has-mood-tint, .year-cell.has-mood-tint, .week-dayhead.has-mood-tint').count()
  note(`calendar tint after 1 check-in: ${tinted > 0}`)

  // Second check-in same day → gradient
  await page.getByRole('button', { name: /^again$/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /tired \/ foggy/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /brain fog/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /low/i }).filter({ hasText: '2' }).click()
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${OUT}/03-after-second-checkin.png`, fullPage: true })

  const gradientCell = await page.evaluate(() => {
    const el = document.querySelector('.month-cell.has-mood-tint')
    if (!el) return null
    const bg = getComputedStyle(el).backgroundImage
    return bg.includes('linear-gradient') && bg.includes('90deg')
  })
  note(`same-day left-to-right gradient: ${gradientCell === true}`)

  // Menu → Feelings & energy
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /feelings & energy/i }).click()
  await page.waitForTimeout(300)
  const todayList = await page.getByLabel("Today’s check-ins").count()
  note(`menu feelings today list: ${todayList > 0}`)
  await page.screenshot({ path: `${OUT}/04-menu-feelings.png`, fullPage: true })

  // Energy step visible on new flow
  await page.getByRole('button', { name: /stressed/i }).first().click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: /^anxious$/i }).click()
  const energyLabel = page.locator('#feel-energy-label')
  try {
    await energyLabel.waitFor({ state: 'visible', timeout: 4000 })
    note('energy prompt after feeling: true')
  } catch {
    note('energy prompt after feeling: false')
  }
  await page.screenshot({ path: `${OUT}/05-energy-step.png`, fullPage: true })
  await page.getByRole('button', { name: /steady/i }).click()
  await page.waitForTimeout(400)

  const failed = log.some((l) => l.includes(': false'))
  if (failed) {
    console.error('SMOKE FAILED\n' + log.join('\n'))
    process.exit(1)
  }
  console.log('SMOKE OK\n' + log.join('\n'))
} finally {
  await browser.close()
}
