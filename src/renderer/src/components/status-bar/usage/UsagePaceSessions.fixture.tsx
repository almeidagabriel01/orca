import { defineFixture } from '../../../component-fixtures/component-fixture'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import type { StatusBarUsageMode } from '../../../../../shared/status-bar/status-bar-usage-mode'
import { NotificationsPane } from '../../settings/notifications/NotificationsPane'
import type {
  ProviderRateLimits,
  RateLimitWindow
} from '../../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { ProviderSegment } from './StatusBarProviderSegment'
import { ProviderDetailsMenu } from './ProviderDetailsMenu'
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
  'antigravity',
  'minimax',
  'grok',
  'zcode',
  'muse',
  'cursor'
] as const

/**
 * Layout check: every provider glyph sits on its ring's center. interact() measures the painted
 * glyph (SVG content bbox) against the ring box and fails the shot past half a pixel.
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
    const misses: string[] = []
    for (const box of frame.querySelectorAll<HTMLElement>('[data-usage-activity]')) {
      const ring = box.getBoundingClientRect()
      const svg = box.querySelector('svg')
      let cx: number
      let cy: number
      if (svg) {
        // Painted content, not the element box: a glyph off-center in its viewBox shows here.
        const content = svg.getBBox()
        const matrix = svg.getScreenCTM()!
        cx = matrix.a * (content.x + content.width / 2) + matrix.e
        cy = matrix.d * (content.y + content.height / 2) + matrix.f
      } else {
        const img = box.querySelector('img')
        if (!img) {
          continue
        }
        const rect = img.getBoundingClientRect()
        cx = rect.left + rect.width / 2
        cy = rect.top + rect.height / 2
      }
      const dx = cx - (ring.left + ring.width / 2)
      const dy = cy - (ring.top + ring.height / 2)
      const name = box.closest('[data-ring-provider]')?.getAttribute('data-ring-provider')
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        misses.push(`${name} dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`)
      }
    }
    if (misses.length > 0) {
      throw new Error(`Glyphs off their ring's center: ${[...new Set(misses)].join('; ')}`)
    }
  }
})
