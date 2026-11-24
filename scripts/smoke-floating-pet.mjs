import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173'
const OUT = '/opt/cursor/artifacts/smoke-floating-pet'
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
  await page.waitForTimeout(400)

  const fab = page.getByRole('button', { name: /open .* pet screen/i }).last()
  await fab.waitFor({ state: 'visible', timeout: 8000 })
  note(`floating pet fab visible: ${await fab.isVisible()}`)
  await page.screenshot({ path: `${OUT}/01-home-fab.png`, fullPage: true })

  await fab.click()
  await page.waitForTimeout(500)
  const dialog = page.getByRole('dialog', { name: /pet screen/i })
  await dialog.waitFor({ state: 'visible', timeout: 5000 })
  note(`pet screen open: ${await dialog.isVisible()}`)

  const speech = page.locator('.pet-speech-bubble')
  await speech.first().waitFor({ state: 'visible', timeout: 4000 })
  note(`speech bubble: ${await speech.first().innerText()}`)
  await page.screenshot({ path: `${OUT}/02-pet-screen.png`, fullPage: true })

  const boop = page.getByRole('button', { name: /boop /i })
  await boop.waitFor({ state: 'visible', timeout: 4000 })
  note(`boop cta: ${await boop.isVisible()}`)
  const webgl = await page.locator('.pet-webgl, .pet-webgl-canvas, .pet-stage3d-figure').count()
  note(`pet stage nodes: ${webgl}`)

  // Mood check-in → moodsLogged XP
  await page.getByRole('button', { name: /^close$/i }).click()
  await page.waitForTimeout(300)

  const checkInBtn = page.getByRole('button', { name: /^check in$/i })
  if (await checkInBtn.count()) {
    await checkInBtn.click()
    await page.waitForTimeout(200)
  }
  await page.getByRole('button', { name: /feeling good/i }).click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: /^happy$/i }).click()
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: /up/i }).filter({ hasText: '4' }).click()
  await page.waitForTimeout(900)

  const xpAfterMood = await page.locator('.floating-pet-fab-xp').innerText()
  note(`xp after mood: ${xpAfterMood}`)

  // Complete a daily todo for task XP via menu
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.waitForTimeout(250)
  await page.locator('.app-menu-list-item').filter({ hasText: 'Daily todos' }).first().click()
  await page.waitForTimeout(250)
  const menu = page.getByRole('dialog', { name: /^menu$/i })
  await menu.getByLabel('New todo title').fill('Pet XP task')
  await menu.getByRole('button', { name: /^add$/i }).click()
  await page.waitForTimeout(400)
  const todoRow = menu.locator('.daily-todo-row').filter({ hasText: 'Pet XP task' })
  await todoRow.first().waitFor({ state: 'visible', timeout: 5000 })
  await todoRow.getByRole('button', { name: /mark done/i }).click({ force: true })
  await page.waitForTimeout(500)

  // Back to list, then close menu
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await page.locator('.app-menu-dismiss').click()
  await page.waitForTimeout(500)

  const pet = await page.evaluate(() => {
    const raw = localStorage.getItem('lumen_adhd_companion_v2')
    if (!raw) return null
    return JSON.parse(raw).pet
  })
  note(`pet after growth: ${JSON.stringify(pet)}`)

  await page.locator('.floating-pet-fab').click()
  await page.waitForTimeout(500)
  const xpMeta = page.locator('.xp-meta').first()
  await xpMeta.waitFor({ state: 'visible', timeout: 4000 })
  const xpText = await xpMeta.innerText()
  note(`xp meta after growth: ${xpText}`)
  await page.getByRole('button', { name: /boop /i }).click()
  await page.waitForTimeout(400)
  note(`speech after boop: ${await page.locator('.pet-speech-bubble').first().innerText()}`)
  await page.screenshot({ path: `${OUT}/03-after-growth.png`, fullPage: true })

  const moodsOk = pet?.moodsLogged >= 1
  const tasksOk = pet?.tasksCompleted >= 1
  const xpOk = Number(xpAfterMood) >= 1 && /XP\s*\d+/i.test(xpText)
  const ok = webgl >= 1 && xpOk && moodsOk && tasksOk
  if (!ok) {
    console.error('SMOKE FAIL', log)
    process.exit(1)
  }
  console.log('SMOKE OK')
} catch (err) {
  console.error('SMOKE FAIL', err)
  await page.screenshot({ path: `${OUT}/fail.png`, fullPage: true }).catch(() => {})
  process.exit(1)
} finally {
  await browser.close()
}
