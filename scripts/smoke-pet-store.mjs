import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173'
const OUT = '/opt/cursor/artifacts/smoke-pet-store'
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

  // Seed XP + spark so hatchling aisles + a paid color are reachable
  await page.evaluate(() => {
    const KEY = 'lumen_adhd_companion_v2'
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    s.pet = {
      ...(s.pet || {}),
      name: 'Blink',
      eventsPulled: 2,
      eventsScheduled: 2,
    }
    s.petStore = {
      ...(s.petStore || {}),
      spark: 80,
      ownedItemIds: s.petStore?.ownedItemIds || [
        'animal-blink',
        'skin-classic',
        'clothes-none',
        'color-teal',
        'companion-none',
      ],
      equipped: s.petStore?.equipped || {
        animalId: 'animal-blink',
        skinId: 'skin-classic',
        clothesId: 'clothes-none',
        colorId: 'color-teal',
        companionId: 'companion-none',
      },
      seenCatalogVersion: 0,
      promptedItemIds: [],
    }
    localStorage.setItem(KEY, JSON.stringify(s))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  // New-item prompt may appear after growth unlocks
  const prompt = page.locator('.pet-store-prompt')
  const promptVisible = (await prompt.count()) > 0
  note(`new-item prompt: ${promptVisible}`)
  if (promptVisible) {
    await page.screenshot({ path: `${OUT}/00-prompt.png`, fullPage: true })
    await page.getByRole('button', { name: /open store/i }).click()
    await page.waitForTimeout(300)
  } else {
    await page.getByRole('button', { name: /open menu/i }).click()
    await page.waitForTimeout(250)
    await page
      .locator('.app-menu-list-item')
      .filter({ hasText: 'Pet store' })
      .first()
      .click()
    await page.waitForTimeout(300)
  }

  await page.screenshot({ path: `${OUT}/01-store.png`, fullPage: true })

  const sparkText = await page.locator('.pet-store-spark').innerText()
  note(`wallet: ${sparkText}`)
  const sparkOk = /spark/i.test(sparkText)

  const tabs = await page.locator('.pet-store-tab').count()
  note(`store tabs: ${tabs}`)

  await page.getByRole('tab', { name: /Colors/i }).click()
  await page.waitForTimeout(200)
  const buyBtn = page.getByRole('button', { name: /Buy ·/i }).first()
  if (await buyBtn.count()) {
    await buyBtn.click({ force: true })
    await page.waitForTimeout(400)
    note('purchased a color')
  } else {
    note('no paid colors visible')
  }

  const equipped = await page.locator('.pet-store-tile.is-equipped').count()
  note(`equipped tiles: ${equipped}`)

  await page.getByRole('tab', { name: /Animals/i }).click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/02-animals.png`, fullPage: true })

  await page.getByRole('tab', { name: /Pet-for-pet/i }).click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/03-companions.png`, fullPage: true })

  const ok = sparkOk && tabs >= 5 && equipped >= 1
  if (!ok) {
    console.error('SMOKE FAIL', log.join(' | '))
    process.exit(1)
  }
  console.log('SMOKE OK')
  await browser.close()
} catch (err) {
  console.error('SMOKE FAIL', err)
  try {
    await page.screenshot({ path: `${OUT}/fail.png`, fullPage: true })
  } catch {
    /* ignore */
  }
  await browser.close()
  process.exit(1)
}
