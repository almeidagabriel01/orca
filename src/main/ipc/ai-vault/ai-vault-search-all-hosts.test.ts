import { describe, expect, it } from 'vitest'
import type {
  AiVaultSearchHit,
  AiVaultSearchResponse
} from '../../../shared/ai-vault/search/ai-vault-search-types'
import type { ExecutionHostId } from '../../../shared/execution-host/execution-host'
import { searchAllExecutionHosts } from './ai-vault-search-all-hosts'

function hit(overrides: Partial<AiVaultSearchHit> = {}): AiVaultSearchHit {
  return {
    agent: 'claude',
    sessionId: 'session-1',
    title: 'Synced chat',
    cwd: '/work/app',
    branch: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 2,
    score: 1,
    source: { presence: 'present', filePath: '/home/u/.claude/projects/app/session-1.jsonl' },
    evidence: null,
    ...overrides
  }
}

function leg(executionHostId: ExecutionHostId, hits: AiVaultSearchHit[]) {
  const response: AiVaultSearchResponse = {
    kind: 'results',
    hits,
    page: { cursor: null, hasMore: false },
    generation: 1,
    truncated: { candidates: false, snippets: 0, query: false, freshness: false },
    durationMs: 0
  }
  return { executionHostId, search: () => Promise.resolve(response) }
}

describe('searchAllExecutionHosts', () => {
  it('shows a synced conversation once, from the host that recorded it', async () => {
    const response = await searchAllExecutionHosts({ query: 'synced' }, [
      leg('local', [hit({ recordedOnOtherMachine: true })]),
      leg('ssh:vps', [hit()])
    ])
    expect(response.kind === 'results' && response.hits.map((h) => h.executionHostId)).toEqual([
      'ssh:vps'
    ])
  })
})
