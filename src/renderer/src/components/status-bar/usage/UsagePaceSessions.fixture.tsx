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
import { UsageChipActivity, UsageRowSessionsScope } from './usage-agent-sessions-view'
import type { UsageAgentSession } from './usage-account-sessions'

const NOW = Date.now()
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function win(usedPercent: number, windowMinutes: number, resetsInMs: number): RateLimitWindow {
  return { usedPercent, windowMinutes, resetsAt: NOW + resetsInMs, resetDescription: null }
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

function ChipStrip({ mode }: { mode: StatusBarUsageMode }): React.JSX.Element {
  return (
    <div className="flex h-9 items-center gap-4 whitespace-nowrap bg-background px-3 text-xs">
      {[
        { id: 'personal', p: AHEAD, sessions: SESSIONS },
        { id: 'work', p: BEHIND, sessions: [SESSIONS[0]!] },
        { id: 'idle', p: AHEAD, sessions: [] }
      ].map(({ id, p, sessions }, index) => (
        <span key={id} className="relative inline-flex">
          <ProviderSegment
            p={p}
            accountLabel={index === 0 ? 'personal' : 'work'}
            selected={index === 0}
            display="used"
            mode={mode}
          />
          <UsageChipActivity sessions={sessions} />
        </span>
      ))}
      <ProviderSegment p={BEHIND} display="used" mode={mode} />
    </div>
  )
}

export const chips = defineFixture({ width: 880, render: () => <ChipStrip mode="verbose" /> })

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
      settings={{ ...defaults, notifications: { ...defaults.notifications, enabled: true } }}
      updateSettings={() => {}}
    />
  )
})
