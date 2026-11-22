import { describe, expect, it } from 'vitest'
import { readRuntimeHostResources } from '../../host-connections/runtime-host-resources'
import { buildResourceHostSummaries } from './resource-host-summary'

const session = (sessionId: string, paneKey: string | null) => ({
  sessionId,
  paneKey,
  pid: 1,
  cpu: 1,
  memory: 10
})

const worktree = (sessions: ReturnType<typeof session>[]) => ({
  worktreeId: 'repo::/w',
  worktreeName: 'w',
  repoId: 'repo',
  repoName: 'repo',
  cpu: 1,
  memory: 10,
  sessions,
  history: []
})

const panes = {
  has: (paneKey: string) => paneKey === 'tab:agent',
  isRunningCommand: (paneKey: string) => paneKey === 'tab:command'
}

describe('buildResourceHostSummaries', () => {
  it('reports each host on its own numbers and keeps unsampled hosts unknown', async () => {
    const localSnapshot = {
      app: { cpu: 12, memory: 500 },
      worktrees: [
        worktree([
          session('daemon-agent', null),
          session('hook-agent', 'tab:agent'),
          session('cmd', 'tab:command'),
          session('shell', 'tab:shell')
        ])
      ]
    }
    const results = {
      'env-b': await readRuntimeHostResources('env-b', async () => ({
        app: { cpu: 3, memory: 70, main: { cpu: 2, memory: 40 } },
        worktrees: [worktree([session('r1', 'tab:agent'), session('r2', null)])]
      })),
      // Older headless servers count only their daemon, leaving main empty.
      'env-a': await readRuntimeHostResources('env-a', async () => ({
        app: { cpu: 1, memory: 30, main: { cpu: 0, memory: 0 } },
        worktrees: []
      })),
      'env-c': await readRuntimeHostResources('env-c', async () => {
        throw new Error('timeout')
      })
    }

    const hosts = buildResourceHostSummaries(
      {
        localSnapshot,
        localDaemonSessions: [
          { id: 'daemon-agent', paneKey: undefined, agentOwnership: 'present' }
        ],
        runtimeResults: results,
        runtimeHostLabel: (id) => `Server ${id}`,
        panes
      },
      (_key, fallback, values) => `${fallback}|${JSON.stringify(values ?? {})}`
    )

    expect(
      hosts.map(({ id, orca, counts, notice }) => ({ id, orca, counts, notice: !!notice }))
    ).toEqual([
      {
        id: 'local',
        orca: { cpu: 12, memory: 500 },
        counts: { terminals: 4, agents: 2, commands: 1 },
        notice: false
      },
      { id: 'env-a', orca: null, counts: { terminals: 0, agents: 0, commands: 0 }, notice: false },
      {
        id: 'env-b',
        orca: { cpu: 3, memory: 70 },
        counts: { terminals: 2, agents: 1, commands: 0 },
        notice: false
      },
      { id: 'env-c', orca: null, counts: null, notice: true }
    ])
  })
})
