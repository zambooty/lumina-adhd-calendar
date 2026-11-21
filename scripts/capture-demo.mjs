import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const MEDIA = '/cursor/stores/self/media'
const ARTIFACTS = '/cursor/stores/self/artifacts'
const URL = 'http://127.0.0.1:5173/'

await mkdir(MEDIA, { recursive: true })
await mkdir(ARTIFACTS, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
  recordVideo: { dir: MEDIA, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()

// Clear storage so hero shows
await page.goto(URL)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('.hero-brand')
await page.waitForTimeout(900)
await page.screenshot({
  path: path.join(MEDIA, 'hero_lumina_brand.png'),
  fullPage: false,
})
await page.screenshot({
  path: path.join(ARTIFACTS, 'hero_lumina_brand.png'),
  fullPage: false,
})

await page.getByRole('button', { name: 'Open my calendar' }).click()
await page.waitForSelector('.brand-mark')
await page.waitForTimeout(700)
await page.screenshot({
  path: path.join(MEDIA, 'main_calendar_inbox_pet.png'),
  fullPage: true,
})
await page.screenshot({
  path: path.join(ARTIFACTS, 'main_calendar_inbox_pet.png'),
  fullPage: true,
})

await page.getByRole('button', { name: 'Pull from sources' }).first().click()
await page.waitForTimeout(1200)
await page.screenshot({
  path: path.join(MEDIA, 'after_pull_sources.png'),
  fullPage: true,
})
await page.screenshot({
  path: path.join(ARTIFACTS, 'after_pull_sources.png'),
  fullPage: true,
})

await page.getByRole('button', { name: /Blink the/ }).click({ force: true })
await page.waitForTimeout(500)

const addBtn = page.getByRole('button', { name: 'Add to calendar' }).first()
if (await addBtn.count()) {
  await addBtn.click()
  await page.waitForTimeout(800)
}

await page.screenshot({
  path: path.join(MEDIA, 'after_schedule_pet_growth.png'),
  fullPage: true,
})
await page.screenshot({
  path: path.join(ARTIFACTS, 'after_schedule_pet_growth.png'),
  fullPage: true,
})

await context.close()
await browser.close()
console.log('Screenshots written to', MEDIA)
