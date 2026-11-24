// Proves a worker dock row's parts never overlap or spill sideways, wide and narrow: run with
// `vps-heavy node config/scripts/runtime-verification/native-chat/check-worker-dock-row-fit.mjs`.
import { chromium } from 'playwright-core'
import { ensureFixtureServer } from '../../component-fixtures/fixture-server-client.mjs'

const FIXTURE = 'native-chat/tools/tasks/dock/NativeChatWorkerDock'
// endedWork* holds a mixed roster (workers and a subagent) whose rows carry the longest status line.
const CASES = [
  'endedWorkOpen',
  'endedWorkNarrowOpen',
  'endedWorkOpenPt',
  'endedWorkNarrowOpenPt',
  'botHomeChatOpen',
  'botHomeChatNarrowOpen',
  'botHomeChatSmallOpen'
]
const PARTS = {
  name: '[data-worker-dock-name]',
  title: '[data-worker-dock-title]',
  status: '[data-worker-dock-state]',
  reason: '[data-worker-dock-reason]',
  model: '[data-worker-dock-model]',
  time: '[data-worker-dock-age]',
  action: '[data-worker-dock-action]'
}

const { url } = await ensureFixtureServer()
const browser = await chromium.launch({ headless: true })
const failures = []
let checked = 0
try {
  for (const theme of ['light', 'dark']) {
    for (const name of CASES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } })
      // Why long: the first page compiles the fixture bundle cold.
      page.setDefaultTimeout(120_000)
      try {
        await page.goto(`${url}/fixtures.html?id=${FIXTURE}:${name}&theme=${theme}`)
        await page.waitForFunction(() => document.documentElement.dataset.fixtureState === 'ready')
        const problems = await page.evaluate((parts) => {
          const out = []
          const rows = [...document.querySelectorAll('[data-worker-dock-row]')]
          if (rows.length < 3) {
            out.push(`expected at least 3 rows, got ${rows.length}`)
          }
          for (const row of rows) {
            const id = row.getAttribute('data-worker-dock-row')
            const box = row.getBoundingClientRect()
            const found = Object.entries(parts).flatMap(([part, selector]) =>
              [...row.querySelectorAll(selector)].map((element) => ({
                part,
                cut: element.scrollWidth > element.clientWidth + 1,
                rect: element.getBoundingClientRect()
              }))
            )
            // The status is the point of a row: it may wrap, never end in an ellipsis.
            for (const status of row.querySelectorAll(parts.status)) {
              if (status.scrollWidth > status.clientWidth + 1) {
                out.push(`${id}: status cut ("${status.textContent}")`)
              }
            }
            // The lead row's Show is its own button; a plain row's open target is the whole row.
            if (row.hasAttribute('data-worker-dock-lead')) {
              const show = row.querySelector('[data-worker-dock-open]')
              if (show) {
                found.push({ part: 'show', rect: show.getBoundingClientRect() })
              }
            }
            const shown = found.filter(({ rect }) => rect.width > 0 && rect.height > 0)
            if (!shown.some(({ part }) => part === 'name')) {
              out.push(`${id}: name not drawn`)
            }
            for (const { part, rect, cut } of shown) {
              if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
                out.push(`${id}: ${part} leaves the row`)
              }
              // A short name like Agent is narrow on its own; squeezed means cut below 40px.
              if (part === 'name' && cut && rect.width < 40) {
                out.push(`${id}: name squeezed to ${rect.width}px`)
              }
            }
            for (let i = 0; i < shown.length; i++) {
              for (let j = i + 1; j < shown.length; j++) {
                const a = shown[i].rect
                const b = shown[j].rect
                const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
                const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                if (x > 0.5 && y > 0.5) {
                  out.push(`${id}: ${shown[i].part} overlaps ${shown[j].part}`)
                }
              }
            }
          }
          for (const element of [
            ...document.querySelectorAll('[data-native-chat-background-tasks]'),
            ...document.querySelectorAll('[data-native-chat-background-tasks] [role="region"]'),
            document.scrollingElement
          ]) {
            if (element.scrollWidth > element.clientWidth + 1) {
              out.push(
                `${element.getAttribute('role') ?? element.tagName} scrolls sideways: ${element.scrollWidth} > ${element.clientWidth}`
              )
            }
          }
          return out
        }, PARTS)
        checked++
        for (const problem of problems) {
          failures.push(`${name} (${theme}): ${problem}`)
        }
      } finally {
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
}
console.log(
  `${failures.length ? 'FAIL' : 'PASS'}: ${checked - new Set(failures.map((f) => f.split(':')[0])).size}/${checked} worker dock row fit cases`
)
for (const failure of failures) {
  console.error(failure)
}
process.exitCode = failures.length ? 1 : 0
