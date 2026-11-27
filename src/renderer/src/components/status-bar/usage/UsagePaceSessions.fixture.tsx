import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import { NotificationsPane } from '../../settings/notifications/NotificationsPane'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { ProviderSegment } from './StatusBarProviderSegment'
import { buildUsageRowChips, type UsageRowChip } from '../composition/status-bar-usage-chips'
import {
  type AccountReadingMemory,
  withRememberedAccountReadings
} from '../composition/usage-account-memory'
import { ProviderDetailsMenu } from './ProviderDetailsMenu'
import { formatTimeAgo } from './provider-usage-panel'
import { UsageRow } from './UsageRosterPanel'
import { UsageActivityRing, UsageRowSessionsScope } from './usage-agent-sessions-view'
import type { UsageAgentSession } from './usage-account-sessions'

const NOW = Date.now()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function win(usedPercent: number, windowMinutes: number, resetsInMs: number): RateLimitWindow {
  return {
    usedPercent,
    windowMinutes,
    resetsAt: NOW + resetsInMs,
    resetDescription: null
  }
}

// Week 3 days in: 70% used runs ahead of pace, 20% runs behind.
const AHEAD: ProviderRateLimits = {
  provider: 'claude',
  session: win(64, 300, 2 * HOUR),
  weekly: win(70, 10_080, 4 * DAY),
  updatedAt: NOW - MIN,
  error: null,
  status: 'ok'
}
const BEHIND: ProviderRateLimits = {
  ...AHEAD,
  provider: 'codex',
  session: win(10, 300, 1 * HOUR),
  weekly: win(20, 10_080, 4 * DAY)
}

function session(
  key: string,
  state: UsageAgentSession['state'],
  title: string,
  workspaceId: string,
  agoMs: number,
  model?: string
): UsageAgentSession {
  return {
    key,
    provider: 'claude',
    account: { kind: 'selected' },
    state,
    title,
    workspaceId,
    since: NOW - agoMs,
    ...(model ? { model } : {}),
    open: { kind: 'chat', workspaceId, sessionId: key }
  }
}

const SESSIONS: UsageAgentSession[] = [
  session('a', 'waiting', 'Approve migration plan', 'repo::/feat-a', 3 * MIN, 'claude-opus-5-5'),
  session('b', 'working', 'Port usage pace', 'repo::/feat-a', 12 * MIN, 'claude-opus-5-5'),
  session('c', 'working', 'Jarvis', 'repo::/bots', 41 * MIN),
  session('d', 'recent', 'Fix flaky test', 'repo::/feat-b', 25 * MIN, 'claude-sonnet-5-5')
]

// Personal runs ahead of pace with agents working, work runs behind with one waiting, the last idle.
function ChipStrip({
  mode,
  compact = false,
  agents = true
}: {
  mode: StatusBarUsageMode
  compact?: boolean
  agents?: boolean
}): React.JSX.Element {
  return (
    <div className="flex h-9 items-center gap-4 whitespace-nowrap bg-background px-3 text-xs">
      {[
        { id: 'personal', p: AHEAD, sessions: SESSIONS },
        { id: 'work', p: BEHIND, sessions: [SESSIONS[0]!] },
        { id: 'idle', p: AHEAD, sessions: [] }
      ].map(({ id, p, sessions }, index) => (
        <ProviderSegment
          key={id}
          p={p}
          accountLabel={index === 0 ? 'personal' : 'work'}
          selected={index === 0}
          display="used"
          mode={mode}
          compact={compact}
          sessions={agents ? sessions : []}
        />
      ))}
      <ProviderSegment p={BEHIND} display="used" mode={mode} compact={compact} />
    </div>
  )
}

export const chips = defineFixture({
  width: 1040,
  render: () => <ChipStrip mode="verbose" />
})

export const chipsIdle = defineFixture({
  width: 1040,
  render: () => <ChipStrip mode="verbose" agents={false} />
})

export const chipsNarrow = defineFixture({
  width: 560,
  render: () => <ChipStrip mode="verbose" compact />
})

export const chipsCompact = defineFixture({
  width: 640,
  render: () => <ChipStrip mode="compact" />
})

export const row = defineFixture({
  width: 440,
  render: () => (
    <div className="bg-popover p-3">
      <UsageRow
        p={AHEAD}
        display="used"
        state={{ kind: 'usage', statusLabel: null }}
        showSignInAction={false}
        now={NOW}
        accountLabel="personal"
        selected
        sessions={SESSIONS}
      />
    </div>
  )
})

export const rowBehind = defineFixture({
  width: 440,
  render: () => (
    <div className="bg-popover p-3">
      <UsageRow
        p={BEHIND}
        display="used"
        state={{ kind: 'usage', statusLabel: null }}
        showSignInAction={false}
        now={NOW}
        accountLabel="work"
        sessions={[]}
      />
    </div>
  )
})

export const details = defineFixture({
  width: 520,
  render: () => (
    <UsageRowSessionsScope sessions={SESSIONS} owner={{ kind: 'local' }}>
      <ProviderDetailsMenu provider={AHEAD} ariaLabel="Claude" open />
    </UsageRowSessionsScope>
  )
})

const defaults = getDefaultSettings('/home/fixture')

export const alertToggle = defineFixture({
  width: 720,
  render: () => (
    <NotificationsPane
      settings={{
        ...defaults,
        notifications: { ...defaults.notifications, enabled: true }
      }}
      updateSettings={() => {}}
    />
  )
})

const RING_PROVIDERS = [
  'claude',
  'codex',
  'gemini',
  'opencode-go',
  'kimi',
  'minimax',
  'grok',
  'zcode',
  'muse',
  'cursor'
] as const

/** Smallest gap allowed between a painted logo and the inner edge of its ring. */
const RING_CLEARANCE_PX = 2

/**
 * Layout check for every provider: the painted outline (points along each SVG shape, or an image
 * tile's corners) is centered on the ring within half a pixel and stays 2px inside its stroke.
 */
export const ringCentering = defineFixture({
  width: 560,
  render: () => (
    <div className="flex flex-col gap-3 bg-background p-3 text-xs">
      {(['working', 'waiting', 'idle'] as const).map((state) => (
        <div key={state} className="flex items-center gap-4">
          <span className="w-14 text-muted-foreground">{state}</span>
          {RING_PROVIDERS.map((provider) => (
            <span key={provider} data-ring-provider={provider} className="inline-flex">
              <UsageActivityRing
                provider={provider}
                sessions={
                  state === 'idle' ? [] : [session(provider, state, provider, 'repo::/a', MIN)]
                }
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  ),
  interact: (frame) => {
    const misses = new Set<string>()
    for (const box of frame.querySelectorAll<HTMLElement>('[data-usage-activity]')) {
      const name = box.closest('[data-ring-provider]')?.getAttribute('data-ring-provider')
      const ring = box.getBoundingClientRect()
      const cx = ring.left + ring.width / 2
      const cy = ring.top + ring.height / 2
      const svg = box.querySelector('svg')
      const img = box.querySelector('img')
      // Painted outline: points along every visible SVG shape, or an image tile's four corners.
      const points: { x: number; y: number }[] = []
      if (svg) {
        for (const shape of svg.querySelectorAll<SVGGeometryElement>(
          'path, rect, circle, ellipse, polygon, polyline, line'
        )) {
          // Why mask shapes count: a masked group paints only where its mask shape is.
          if (shape.closest('[mask], clipPath, pattern')) {
            continue
          }
          const m = shape.getScreenCTM()!
          const length = shape.getTotalLength()
          for (let i = 0; i <= 200; i++) {
            const pt = shape.getPointAtLength((length * i) / 200)
            points.push({ x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f })
          }
        }
      } else if (img) {
        const r = img.getBoundingClientRect()
        points.push(
          { x: r.left, y: r.top },
          { x: r.right, y: r.top },
          { x: r.left, y: r.bottom },
          { x: r.right, y: r.bottom }
        )
      }
      if (points.length === 0) {
        continue
      }
      const xs = points.map((pt) => pt.x)
      const ys = points.map((pt) => pt.y)
      const dx = (Math.min(...xs) + Math.max(...xs)) / 2 - cx
      const dy = (Math.min(...ys) + Math.max(...ys)) / 2 - cy
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        misses.add(`${name} off center dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`)
      }
      const stroke = box.querySelector<HTMLElement>('.absolute')
      if (!stroke) {
        continue
      }
      const inner = ring.width / 2 - Number.parseFloat(getComputedStyle(stroke).borderTopWidth)
      const reach = Math.max(...points.map((pt) => Math.hypot(pt.x - cx, pt.y - cy)))
      if (inner - reach < RING_CLEARANCE_PX - 0.01) {
        misses.add(`${name} only ${(inner - reach).toFixed(2)}px inside the ring`)
      }
    }
    if (misses.size > 0) {
      throw new Error(`Ring layout: ${[...misses].join('; ')}`)
    }
  }
})

// The account's usage read on the VPS, then the workspace moves to a Mac that never ran it.
const MAC_NEVER_RAN: ProviderRateLimits = {
  provider: 'claude',
  session: null,
  weekly: null,
  updatedAt: 0,
  error: 'stale',
  status: 'error',
  usageMetadata: { failureKind: 'stale-token' }
}

function hostChips(gabriel: ProviderRateLimits): UsageRowChip[] {
  const gestao: ProviderRateLimits = { ...AHEAD, session: null, weekly: win(32, 10_080, 4 * DAY) }
  return buildUsageRowChips({
    providers: [gabriel],
    accounts: 'all',
    accountsByProvider: {
      claude: [
        { key: 'g', selected: true, reading: null, name: { email: 'gabriel@example.com' } },
        { key: 's', selected: false, reading: gestao, name: { email: 'gestao@example.com' } }
      ]
    }
  })
}

function HostStrip({ label, chips }: { label: string; chips: UsageRowChip[] }): React.JSX.Element {
  return (
    <div className="flex h-8 items-center gap-3 whitespace-nowrap text-xs">
      <span className="w-64 shrink-0 text-muted-foreground">{label}</span>
      {chips.map((chip) => (
        <ProviderSegment
          key={chip.id}
          p={chip.p}
          accountLabel={chip.accountLabel}
          selected={chip.selected}
          display="used"
          mode="verbose"
          sessions={[]}
          readOn={chip.readOn}
        />
      ))}
      {chips.map((chip) =>
        chip.readOn ? (
          <span key={`${chip.id}-tip`} className="text-[10px] text-muted-foreground">
            tooltip: “Updated {formatTimeAgo(chip.readOn.at)} on {chip.readOn.host}”
          </span>
        ) : null
      )}
    </div>
  )
}

/** What Orca remembers after the VPS read the account `agoMs` ago, as a restart restores it. */
function restoredAfter(agoMs: number): AccountReadingMemory {
  const read = NOW - agoMs
  const p: ProviderRateLimits = {
    ...AHEAD,
    updatedAt: read,
    // A 5h session read 3h ago with 1h left has reset by now; the week has not.
    session: { ...AHEAD.session!, resetsAt: read + Math.min(agoMs, 4 * HOUR) - MIN }
  }
  return new Map([['claude:gabriel@example.com', { p, host: 'vps' }]])
}

export const hostSwitch = defineFixture({
  width: 1180,
  render: () => (
    <div className="flex flex-col bg-background px-3 py-2">
      <HostStrip label="VPS workspace (live)" chips={hostChips(AHEAD)} />
      <HostStrip label="Mac cold start, before" chips={hostChips(MAC_NEVER_RAN)} />
      <HostStrip
        label="Mac cold start, read 20 min ago"
        chips={withRememberedAccountReadings(
          hostChips(MAC_NEVER_RAN),
          new Map([
            [
              'claude:gabriel@example.com',
              { p: { ...AHEAD, updatedAt: NOW - 20 * MIN }, host: 'vps' }
            ]
          ]),
          'this device',
          NOW
        )}
      />
      <HostStrip
        label="Mac cold start, read 3h ago"
        chips={withRememberedAccountReadings(
          hostChips(MAC_NEVER_RAN),
          restoredAfter(3 * HOUR),
          'this device',
          NOW
        )}
      />
    </div>
  )
})
