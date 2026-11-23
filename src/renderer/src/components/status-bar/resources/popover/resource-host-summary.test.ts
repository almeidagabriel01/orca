import { describe, expect, it } from 'vitest'
import {
  parseHostMachineTotals,
  readRuntimeHostResources,
  type RuntimeHostResourceCall
} from '../../host-connections/runtime-host-resources'
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

async function read(environmentId: string, call: RuntimeHostResourceCall) {
  const result = await readRuntimeHostResources(environmentId, call)
  if (!result) {
    throw new Error('a wanted read returned nothing')
  }
  return result
}

const panes = {
  has: (paneKey: string) => paneKey === 'tab:agent',
  isRunningCommand: (paneKey: string) => paneKey === 'tab:command'
}

describe('buildResourceHostSummaries', () => {
  it('reports each host on its own numbers and keeps unsampled hosts unknown', async () => {
    const localSnapshot = {
      app: { cpu: 12, memory: 500 },
      host: { totalMemory: 16, usedMemory: 8, cpuCoreCount: 8, cpuUsagePercent: 25 },
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
      'env-b': await read('env-b', async () => ({
        app: { cpu: 3, memory: 70, main: { cpu: 2, memory: 40 } },
        worktrees: [
          {
            ...worktree([session('r1', 'tab:agent'), session('r2', null)]),
            chats: [
              { agentSessionId: 'c1', agent: 'claude', name: null, cpu: 1, memory: 5 },
              { agentSessionId: 'c2', agent: 'claude', name: 7, cpu: 1, memory: 5 }
            ]
          }
        ],
        chatsIncluded: true
      })),
      // Older headless servers count only their daemon, leaving main empty.
      'env-a': await read('env-a', async () => ({
        app: { cpu: 1, memory: 30, main: { cpu: 0, memory: 0 } },
        worktrees: []
      })),
      'env-c': await read('env-c', async () => {
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

    expect(hosts.map(({ id, machine }) => [id, machine?.cpuPercent, machine?.memory])).toEqual([
      ['local', 25, { used: 8, total: 16 }],
      ['env-a', null, null],
      ['env-b', null, null],
      ['env-c', undefined, undefined]
    ])
    expect(
      hosts.map(({ id, orca, counts, notice }) => ({ id, orca, counts, notice: !!notice }))
    ).toEqual([
      {
        id: 'local',
        orca: { cpu: 12, memory: 500 },
        counts: { terminals: 4, agents: 2, commands: 1 },
        notice: false
      },
      // A server that predates sending chats says its chat workers are missing.
      { id: 'env-a', orca: null, counts: { terminals: 0, agents: 0, commands: 0 }, notice: true },
      {
        id: 'env-b',
        orca: { cpu: 3, memory: 70 },
        counts: { terminals: 2, agents: 1, commands: 0 },
        notice: false
      },
      { id: 'env-c', orca: null, counts: null, notice: true }
    ])
    const envB = results['env-b']
    expect(envB.status === 'sampled' && envB.worktrees[0].chats).toEqual([
      { agentSessionId: 'c1', agent: 'claude', name: null, cpu: 1, memory: 5 }
    ])
  })
})

describe('parseHostMachineTotals', () => {
  it('reads every whole-machine total a current server sends', () => {
    expect(
      parseHostMachineTotals({
        totalMemory: 16,
        usedMemory: 12,
        cpuCoreCount: 8,
        loadAverage1m: 2,
        cpuUsagePercent: 37.5,
        swapTotal: 0,
        swapUsed: 0,
        diskTotal: 500,
        diskUsed: 200,
        loadAverage: [2, 1.5, 1],
        outsideOrca: [
          { name: 'harvey-harvey-1', kind: 'container', cpu: 4, memory: 90, processCount: 5 },
          { name: 'x', kind: 'daemon', cpu: 1, memory: 1, processCount: 1 },
          { name: 'y', kind: 'command', cpu: -1, memory: 1, processCount: 1 }
        ],
        heavyQueue: {
          readAt: 9_000,
          slots: 2,
          controls: true,
          jobs: [
            {
              pid: 7,
              status: 'running',
              slot: 1,
              position: 3,
              queuedAt: 1_000,
              startedAt: 2_000,
              cwd: '/w/app',
              command: 'x'.repeat(9_000),
              workspace: { worktreeId: 'app::/w/app', worktreeName: 'app', repoName: 'App' }
            },
            {
              pid: 8,
              status: 'waiting',
              slot: 0,
              position: 1,
              direct: true,
              queuedAt: 3_000,
              cwd: '/tmp',
              command: 'make',
              workspace: { worktreeId: 1 }
            },
            { pid: -1, status: 'waiting', queuedAt: 1, cwd: '/', command: 'bad' },
            { pid: 9, status: 'paused', queuedAt: 1, cwd: '/', command: 'bad' }
          ]
        }
      })
    ).toEqual({
      cpuPercent: 37.5,
      cpuCores: 8,
      memory: { used: 12, total: 16 },
      swap: { used: 0, total: 0 },
      disk: { used: 200, total: 500 },
      loadAverage: [2, 1.5, 1],
      outsideOrca: [
        { name: 'harvey-harvey-1', kind: 'container', cpu: 4, memory: 90, processCount: 5 }
      ],
      heavyQueue: {
        readAt: 9_000,
        slots: 2,
        controls: true,
        jobs: [
          {
            pid: 7,
            status: 'running',
            slot: 1,
            position: null,
            ordered: false,
            direct: false,
            extra: false,
            queuedAt: 1_000,
            startedAt: 2_000,
            cwd: '/w/app',
            command: 'x'.repeat(8_192),
            workspace: { worktreeId: 'app::/w/app', worktreeName: 'app', repoName: 'App' }
          },
          {
            pid: 8,
            status: 'waiting',
            slot: null,
            position: 1,
            ordered: false,
            direct: true,
            extra: false,
            queuedAt: 3_000,
            startedAt: null,
            cwd: '/tmp',
            command: 'make'
          }
        ]
      }
    })
  })

  it('keeps what an older server sends and leaves the rest unknown', () => {
    expect(
      parseHostMachineTotals({ totalMemory: 16, usedMemory: 4, cpuCoreCount: 2, loadAverage1m: 0 })
    ).toEqual({
      cpuPercent: null,
      cpuCores: 2,
      memory: { used: 4, total: 16 },
      swap: null,
      disk: null,
      loadAverage: null,
      outsideOrca: null,
      heavyQueue: null
    })
  })

  it('rejects impossible values field by field instead of showing them', () => {
    expect(
      parseHostMachineTotals({
        totalMemory: 0,
        usedMemory: 0,
        cpuCoreCount: 1.5,
        cpuUsagePercent: 140,
        swapTotal: 4,
        swapUsed: 5,
        diskTotal: 100,
        diskUsed: -1,
        loadAverage: [1, '2', 3]
      })
    ).toEqual({
      cpuPercent: null,
      cpuCores: null,
      memory: null,
      swap: null,
      disk: null,
      loadAverage: null,
      outsideOrca: null,
      heavyQueue: null
    })
    expect(parseHostMachineTotals('garbage').memory).toBeNull()
  })
})
