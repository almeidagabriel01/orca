// Proves a heavy queue row survives huge commands and project names: run with
// `vps-heavy node config/scripts/runtime-verification/resources/check-heavy-queue-row-fit.mjs`.
import { chromium } from 'playwright-core'
import { ensureFixtureServer } from '../../component-fixtures/fixture-server-client.mjs'

const FIXTURE = 'status-bar/resources/popover/resource-heavy-queue-extremes'
const CASES = [
  'wide',
  'wideExpanded',
  'narrow',
  'narrowExpanded',
  'widePt',
  'narrowPt',
  'stopConfirmPt',
  'narrowStopConfirmPt'
]

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
            // Why a canvas: computed colours come back as oklch() or color(), not only rgb().
            const paint = document.createElement('canvas').getContext('2d', {
              willReadFrequently: true
            })
            const rgba = (value) => {
              paint.clearRect(0, 0, 1, 1)
              paint.fillStyle = value
              paint.fillRect(0, 0, 1, 1)
              const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
              return { r, g, b, a: a / 255 }
            }
            // The card's painted colour: every translucent background from the page down, stacked.
            const backdrop = (element) => {
              const chain = []
              for (let node = element; node; node = node.parentElement) {
                chain.unshift(rgba(getComputedStyle(node).backgroundColor))
              }
              return chain.reduce(
                (under, over) => ({
                  r: over.r * over.a + under.r * (1 - over.a),
                  g: over.g * over.a + under.g * (1 - over.a),
                  b: over.b * over.a + under.b * (1 - over.a)
                }),
                { r: 255, g: 255, b: 255 }
              )
            }
            const luminance = ({ r, g, b }) => {
              const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
              return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
            }
            rows.forEach((row, index) => {
              const menu = row.querySelector('[data-queue-menu]')
              const menuBox = menu?.getBoundingClientRect()
              if (!menu || menuBox.width < 24 || menuBox.height < 24) {
                out.push(`row ${index}: no visible actions button of at least 24px`)
              } else {
                const back = backdrop(menu)
                const fg = rgba(getComputedStyle(menu).color)
                const ink = {
                  r: fg.r * fg.a + back.r * (1 - fg.a),
                  g: fg.g * fg.a + back.g * (1 - fg.a),
                  b: fg.b * fg.a + back.b * (1 - fg.a)
                }
                const [hi, lo] = [luminance(ink), luminance(back)].sort((a, b) => b - a)
                const ratio = (hi + 0.05) / (lo + 0.05)
                if (ratio < 3) {
                  out.push(`row ${index}: actions button contrast ${ratio.toFixed(2)} < 3`)
                }
              }
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
                // Why skip the confirmation: its Keep/Stop buttons sit under the command on purpose.
                if (
                  button !== command &&
                  !button.querySelector('.lucide-copy') &&
                  !button.closest('[role="group"]')
                ) {
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
