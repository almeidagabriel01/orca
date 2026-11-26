import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../../shared/repository/repo-types'
import {
  buildSettingsProjectList,
  getSettingsEntryHostSelection,
  getSettingsProjectHostRepo
} from './settings-project-list'

const identity = {
  canonicalKey: 'github.com/acme/app',
  remoteName: 'origin',
  remoteUrl: 'git@github.com:acme/app.git'
}
const row = (id: string, path: string, extra: Partial<Repo>): Repo => ({
  id,
  path,
  displayName: 'app',
  badgeColor: '',
  addedAt: 0,
  kind: 'git',
  gitRemoteIdentity: identity,
  ...extra
})
// One project set up on this machine and on a paired server, each with its own record.
const local = row('repo-local', '/Users/me/app', {
  agentLaunchDefaults: { defaultTuiAgent: 'claude', defaultSurface: 'chat' }
})
const server = row('repo-server', '/home/me/app', { executionHostId: 'runtime:env-vps' })

describe('project settings pane with a host chosen in Settings', () => {
  it("shows only that host's record, never another host's", () => {
    const [project] = buildSettingsProjectList([local, server])
    expect(project.setups).toHaveLength(2)
    const pick = (repos: Repo[]) => {
      const selection = getSettingsEntryHostSelection(project, {}, {}, 'runtime:env-vps')
      return getSettingsProjectHostRepo(project, repos, selection.hostId, selection.setupId)
    }
    expect(pick([local, server])).toBe(server)
    // The server's row not loaded yet: nothing, not this machine's row.
    expect(pick([local])).toBeUndefined()
  })
})
