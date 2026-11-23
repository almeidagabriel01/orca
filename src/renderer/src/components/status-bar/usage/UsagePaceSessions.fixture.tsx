import { defineFixture } from '../../../component-fixtures/component-fixture'
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

export const chips = defineFixture({
  width: 640,
  render: () => (
    <div className="flex items-center gap-4 bg-background p-3 text-xs">
      {[
        { id: 'gabriel', p: AHEAD, sessions: SESSIONS },
        { id: 'gestao', p: BEHIND, sessions: [SESSIONS[0]!] },
        { id: 'idle', p: AHEAD, sessions: [] }
      ].map(({ id, p, sessions }, index) => (
        <span key={id} className="relative inline-flex">
          <ProviderSegment
            p={p}
            accountLabel={index === 0 ? 'gabriel' : 'gestao'}
            selected={index === 0}
            display="used"
            mode="verbose"
          />
          <UsageChipActivity sessions={sessions} />
        </span>
      ))}
      <ProviderSegment p={BEHIND} display="used" mode="verbose" />
    </div>
  )
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
        accountLabel="gabriel"
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
