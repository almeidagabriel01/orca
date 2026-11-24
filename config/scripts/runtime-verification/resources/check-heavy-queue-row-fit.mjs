// Proves a heavy queue row survives huge commands and project names: run with
// `vps-heavy node config/scripts/runtime-verification/resources/check-heavy-queue-row-fit.mjs`.
import { chromium } from 'playwright-core'
import { ensureFixtureServer } from '../../component-fixtures/fixture-server-client.mjs'

const FIXTURE = 'status-bar/resources/popover/resource-heavy-queue-extremes'
const CASES = ['wide', 'wideExpanded', 'narrow', 'narrowExpanded']

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
        const problems = await page.evaluate((expanded) => {
          const out = []
          const cards = [...document.querySelectorAll('[data-host-card]')]
          if (cards.length === 0) {
            out.push('no host card rendered')
          }
          for (const card of cards) {
            const box = card.getBoundingClientRect()
            if (card.scrollWidth > card.clientWidth + 1) {
              out.push(`card overflows sideways: ${card.scrollWidth} > ${card.clientWidth}`)
            }
            const rows = [...card.querySelectorAll('[data-queue-row]')]
            if (rows.length < 4) {
              out.push(`expected 4 queue rows, got ${rows.length}`)
            }
            rows.forEach((row, index) => {
              const place = row.querySelector('[data-queue-place]').getBoundingClientRect()
              if (place.width < 60) {
                out.push(`row ${index}: workspace squeezed to ${place.width}px`)
              }
              const command = row.querySelector('[data-queue-command]')
              const commandBox = command.getBoundingClientRect()
              const line = Number.parseFloat(getComputedStyle(command).lineHeight)
              if (!expanded && commandBox.height > 2 * line + 1) {
                out.push(`row ${index}: folded command is ${commandBox.height}px, over two lines`)
              }
              if (expanded && command.scrollHeight > command.clientHeight + 1) {
                out.push(`row ${index}: expanded command is still clipped`)
              }
              for (const button of row.querySelectorAll('button')) {
                const b = button.getBoundingClientRect()
                if (b.width === 0) {
                  continue // the other form of the actions (wide icons or narrow menu) is hidden
                }
                if (b.left < box.left - 0.5 || b.right > box.right + 0.5) {
                  out.push(`row ${index}: "${button.getAttribute('aria-label')}" leaves the card`)
                }
                if (button !== command && button.getAttribute('aria-label') !== 'Copy command') {
                  if (b.bottom > commandBox.top + 0.5) {
                    out.push(
                      `row ${index}: "${button.getAttribute('aria-label')}" is off the workspace line`
                    )
                  }
                  if (b.left < place.right - 0.5) {
                    out.push(
                      `row ${index}: "${button.getAttribute('aria-label')}" covers the workspace`
                    )
                  }
                }
              }
            })
          }
          const root = document.scrollingElement
          if (root.scrollWidth > root.clientWidth + 1) {
            out.push('page scrolls sideways')
          }
          return out
        }, name.endsWith('Expanded'))
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
  `${failures.length ? 'FAIL' : 'PASS'}: ${checked - new Set(failures.map((f) => f.split(':')[0])).size}/${checked} heavy queue fit cases`
)
for (const failure of failures) {
  console.error(failure)
}
process.exitCode = failures.length ? 1 : 0
