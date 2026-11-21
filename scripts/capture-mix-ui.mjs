/**
 * Capture Unified Mix UI screenshots for the Project media/ folder.
 * Run: node scripts/capture-mix-ui.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.MIX_URL || 'http://127.0.0.1:4173'
const OUT = process.env.MIX_OUT || '/cursor/stores/bc-41f53592-19bc-4014-9034-344b0a9ba614/media'

function at(dayOffset, hour, minute = 0) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString()
}

function endOf(startIso, minutes) {
  return new Date(+new Date(startIso) + minutes * 60_000).toISOString()
}

const stacks = [
  {
    id: 'stack_adhd_default',
    name: 'ADHD default stack',
    offsets: [
      { id: 'off_1d', label: '1 day before', minutesBefore: 1440 },
      { id: 'off_2h', label: '2 hours before', minutesBefore: 120 },
      { id: 'off_30m', label: '30 min before', minutesBefore: 30 },
      { id: 'off_leave', label: 'Leave now', minutesBefore: 15 },
    ],
  },
]

const dentistStart = at(0, 10, 30)
const seed = {
  events: [
    {
      id: 'evt_dentist',
      title: 'Dentist follow-up',
      start: dentistStart,
      end: endOf(dentistStart, 30),
      color: '#3dffd4',
      reminderStackId: 'stack_adhd_default',
      createdAt: new Date().toISOString(),
      sourceLabel: 'Calendar',
    },
    {
      id: 'evt_focus',
      title: 'Focus block',
      start: at(0, 13, 0),
      end: endOf(at(0, 13, 0), 90),
      color: '#ffb020',
      reminderStackId: 'stack_adhd_default',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt_walk',
      title: 'Walk · Blink',
      start: at(0, 17, 30),
      end: endOf(at(0, 17, 30), 40),
      color: '#c8ff4d',
      reminderStackId: 'stack_adhd_default',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt_sync',
      title: 'Team sync',
      start: at(3, 9, 0),
      end: endOf(at(3, 9, 0), 45),
      color: '#4db8ff',
      reminderStackId: 'stack_adhd_default',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt_meds',
      title: 'Meds refill',
      start: at(5, 12, 0),
      end: endOf(at(5, 12, 0), 30),
      color: '#ff5c6c',
      reminderStackId: 'stack_adhd_default',
      createdAt: new Date().toISOString(),
    },
  ],
  candidates: [
    {
      id: 'cand_hair',
      title: 'Haircut',
      start: at(2, 11, 0),
      end: endOf(at(2, 11, 0), 45),
      source: 'texts',
      sourceLabel: 'Texts',
      rawSnippet: 'Haircut Sat 11am',
      confidence: 0.92,
      status: 'pending',
      color: '#3dffd4',
    },
  ],
  defaultStackId: 'stack_adhd_default',
  stacks,
  pet: {
    name: 'Blink',
    eventsPulled: 12,
    eventsScheduled: 8,
  },
  autoAddHighConfidence: true,
  hasSeenHero: true,
  seededAt: new Date().toISOString(),
  dismissedKeys: [],
}

async function seedAndShot(page, viewport, filename, after) {
  await page.setViewportSize(viewport)
  await page.addInitScript((state) => {
    localStorage.setItem('lumen_adhd_companion_v2', JSON.stringify(state))
  }, seed)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.mix-now', { timeout: 10000 })
  if (after) await after(page)
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.join(OUT, filename),
    fullPage: false,
  })
  console.log('wrote', filename)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await seedAndShot(page, { width: 1280, height: 860 }, 'ship-mix-desktop-shell.png')
  await seedAndShot(page, { width: 360, height: 800 }, 'ship-mix-android-shell.png')
  await seedAndShot(
    page,
    { width: 360, height: 800 },
    'ship-mix-android-pull.png',
    async (p) => {
      await p.click('.topbar-pull')
      await p.waitForSelector('.pull-decision', { timeout: 8000 })
      await p.waitForTimeout(300)
    },
  )

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
