import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173'
const OUT = '/opt/cursor/artifacts/smoke-goals-journal'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const log = []
function note(msg) {
  log.push(msg)
  console.log(msg)
}

async function dismissOnboarding() {
  const continueBtn = page.getByRole('button', { name: /^continue$/i })
  if (await continueBtn.count()) {
    await continueBtn.click()
  }
  const skip = page.getByRole('button', { name: /skip for now|open calendar/i })
  await skip.first().waitFor({ state: 'visible', timeout: 10000 })
  await skip.first().click()
  await page.getByRole('button', { name: /open menu/i }).waitFor({
    state: 'visible',
    timeout: 10000,
  })
}

try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await dismissOnboarding()
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: /open menu/i }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/01-menu.png`, fullPage: true })

  async function openSection(label) {
    await page.locator('.app-menu-list-item').filter({ hasText: label }).first().click()
    await page.waitForTimeout(250)
  }

  // Goals — weekly + hygiene group
  await openSection('Goals')
  const goalPrompt = await page.locator('.goals-prompt').count()
  note(`goals prompt visible: ${goalPrompt > 0}`)
  await page.getByLabel('Link task group').selectOption('hygiene')
  await page.getByRole('button', { name: /set .* goal/i }).click()
  await page.waitForTimeout(300)
  const goalCard = await page.locator('.goals-card').count()
  note(`goal card created: ${goalCard > 0}`)
  await page.screenshot({ path: `${OUT}/02-goals.png`, fullPage: true })

  // Journal with feeling prompt
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await openSection('Journal')
  await page.getByRole('button', { name: /feeling prompt/i }).click()
  await page.waitForTimeout(150)
  await page.locator('.journal-feeling-cat').filter({ hasText: 'Calm' }).click()
  await page.locator('.journal-feeling-chip').filter({ hasText: 'Peaceful' }).click()
  await page.locator('.journal-energy-chip').filter({ hasText: 'Buzzing' }).click()
  await page.getByLabel('Journal entry').fill(
    'Feeling grateful and focused after a short walk. Proud of a tiny win.',
  )
  await page.waitForTimeout(150)
  const kw = await page.locator('.journal-keyword').count()
  note(`keyword recognition: ${kw > 0}`)
  await page.getByRole('button', { name: /save entry/i }).click()
  await page.waitForTimeout(300)
  const entry = await page.locator('.journal-card').count()
  note(`journal entry saved: ${entry > 0}`)
  await page.screenshot({ path: `${OUT}/03-journal.png`, fullPage: true })

  // Seed a completed todo via daily list so reports have completion data
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await openSection('Daily todos')
  await page.getByLabel('New todo title').fill('Smoke habit check')
  await page.getByRole('button', { name: /^add$/i }).click()
  await page.waitForTimeout(200)
  await page.locator('.daily-todo-check').first().click({ force: true })
  await page.waitForTimeout(200)

  // Habits & reports
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await openSection('Habits & reports')
  await page.waitForTimeout(200)
  const avgEnergy = await page.getByText(/avg energy/i).count()
  const moods = await page.locator('.habits-subhead').filter({ hasText: /^Moods$/i }).count()
  const keywords = await page.locator('.habits-subhead').filter({ hasText: /^Keywords$/i }).count()
  const mostDone = await page.locator('.habits-subhead').filter({ hasText: /most completed/i }).count()
  note(`reports avg energy: ${avgEnergy > 0}`)
  note(`reports moods: ${moods > 0}`)
  note(`reports keywords: ${keywords > 0}`)
  note(`reports most completed: ${mostDone > 0}`)
  await page.screenshot({ path: `${OUT}/04-habits-reports.png`, fullPage: true })

  // Agenda event completion surface (may be empty — just open)
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await openSection('Agenda & review')
  await page.waitForTimeout(250)
  const agenda = await page.locator('.agenda-view').count()
  note(`agenda with completion wiring: ${agenda > 0}`)
  await page.screenshot({ path: `${OUT}/05-agenda.png`, fullPage: true })

  const failed = log.some((l) => l.includes(': false'))
  if (failed) {
    console.error('SMOKE FAILED\n' + log.join('\n'))
    process.exit(1)
  }
  console.log('SMOKE OK\n' + log.join('\n'))
} finally {
  await browser.close()
}
