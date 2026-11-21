import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const MEDIA = '/cursor/stores/self/media'
const URL = process.env.LUMINA_URL || 'http://127.0.0.1:5173/'

await mkdir(MEDIA, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function capture(label, contextOptions) {
  const context = await browser.newContext({
    ...contextOptions,
    colorScheme: 'dark',
  })
  const page = await context.newPage()
  await page.goto(URL)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.waitForSelector('.hero-brand')
  await page.waitForTimeout(600)
  await page.screenshot({
    path: path.join(MEDIA, `${label}-hero.png`),
    fullPage: false,
  })

  await page.getByRole('button', { name: 'Open my calendar' }).click()
  await page.waitForSelector('.brand-mark')
  await page.waitForTimeout(700)
  await page.screenshot({
    path: path.join(MEDIA, `${label}-main.png`),
    fullPage: true,
  })

  // Ensure no white-screen / empty root after enter
  const bg = await page.evaluate(() => {
    const body = getComputedStyle(document.body).backgroundColor
    const root = document.getElementById('root')
    return {
      body,
      rootChildren: root?.childElementCount ?? 0,
      shell: Boolean(document.querySelector('.app-shell')),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }
  })
  console.log(label, bg)

  await page.getByRole('button', { name: 'Pull from sources' }).first().click()
  await page.waitForTimeout(1400)
  await page.screenshot({
    path: path.join(MEDIA, `${label}-after-pull.png`),
    fullPage: true,
  })

  await context.close()
}

await capture('mobile-390', {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: devices['iPhone 13'].userAgent,
})

await capture('mobile-360', {
  viewport: { width: 360, height: 740 },
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 5'].userAgent,
})

await browser.close()
console.log('Mobile screenshots written to', MEDIA)
