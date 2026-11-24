import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:5173'
const OUT = '/opt/cursor/artifacts/smoke-daily-todos'
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

  // Hero → enter
  const enter = page.getByRole('button', { name: /enter|start|begin|open/i }).first()
  if (await enter.count()) {
    await enter.click()
    await page.waitForTimeout(400)
  } else {
    // Fallback: any primary CTA on hero
    const cta = page.locator('.hero button, .btn-primary').first()
    if (await cta.count()) await cta.click()
  }

  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true })
  note('home loaded')

  // Open sandwich menu
  await page.getByRole('button', { name: /open menu/i }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/02-menu.png`, fullPage: true })

  // Daily todos
  await page.getByRole('button', { name: /daily todos/i }).click()
  await page.waitForTimeout(250)
  await page.getByLabel('New todo title').fill('Smoke meds')
  await page.locator('.daily-todo-repeat-select').selectOption('daily')
  await page.getByRole('button', { name: /^add$/i }).click()
  await page.waitForTimeout(300)
  const todoVisible = await page.getByText('Smoke meds').count()
  note(`daily todo visible: ${todoVisible > 0}`)
  await page.screenshot({ path: `${OUT}/03-daily-todos.png`, fullPage: true })

  // Back → task groups
  await page.getByRole('button', { name: /back to menu/i }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /task groups/i }).click()
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Health 3 presets', exact: true }).click()
  await page.waitForTimeout(200)
  await page.locator('.task-groups-preset').first().getByRole('button', { name: /^daily$/i }).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/04-task-groups.png`, fullPage: true })
  note('pulled health preset to daily')

  // Agenda (may need two backs: detail → groups list → menu)
  for (let i = 0; i < 2; i++) {
    const back = page.getByRole('button', { name: /back to menu|all groups/i })
    if (await back.count()) {
      await back.first().click()
      await page.waitForTimeout(200)
    }
  }
  await page.getByRole('button', { name: /agenda & review/i }).click()
  await page.waitForTimeout(300)
  const month = await page.getByLabel('Monthly task review').count()
  note(`monthly review present: ${month > 0}`)
  await page.screenshot({ path: `${OUT}/05-agenda.png`, fullPage: true })

  // Close menu, confirm home daily strip
  await page.getByLabel('Back to menu').click()
  await page.waitForTimeout(200)
  await page.getByLabel('Close menu').last().click()
  await page.waitForTimeout(300)
  const homeTodos = await page.getByLabel("Today’s todos").count()
  note(`home daily strip: ${homeTodos > 0}`)
  await page.screenshot({ path: `${OUT}/06-home-daily.png`, fullPage: true })

  const failed = log.some((l) => l.includes(': false'))
  if (failed) {
    console.error('SMOKE FAILED\n' + log.join('\n'))
    process.exit(1)
  }
  console.log('SMOKE OK\n' + log.join('\n'))
} finally {
  await browser.close()
}
