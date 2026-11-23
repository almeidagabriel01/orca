import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }))

import { findForkBuildFailure } from './updater-fork-upstream'

const REPO = 'owner/fork'
const issue = (version: string, url = `https://github.com/${REPO}/issues/7`) => ({
  title: `Sync com o Orca original falhou: v${version}`,
  html_url: url
})
const run = (conclusion: string | null, url = `https://github.com/${REPO}/actions/runs/1`) => ({
  conclusion,
  html_url: url
})

describe('findForkBuildFailure', () => {
  it('is a failure only when an issue names the version or a latest run failed', () => {
    expect(findForkBuildFailure(REPO, '1.4.272', [run('success'), run(null)], [])).toBeNull()
    expect(findForkBuildFailure(REPO, '1.4.272', [undefined, undefined], null)).toBeNull()
    expect(findForkBuildFailure(REPO, '1.4.272', [run('success')], [issue('1.4.271')])).toBeNull()
    expect(findForkBuildFailure(REPO, '1.4.272', [run('success')], [issue('1.4.272')])).toEqual({
      url: `https://github.com/${REPO}/issues/7`
    })
    expect(findForkBuildFailure(REPO, '1.4.272', [run('success'), run('failure')], [])).toEqual({
      url: `https://github.com/${REPO}/actions/runs/1`
    })
  })

  it('links only to the fork', () => {
    expect(
      findForkBuildFailure(REPO, '1.4.272', [run('failure', 'https://evil.example/x')], [])
    ).toEqual({ url: null })
    expect(
      findForkBuildFailure(
        REPO,
        '1.4.272',
        [],
        [issue('1.4.272', `https://github.com/${REPO}.evil/issues/1`)]
      )
    ).toEqual({ url: null })
  })
})
