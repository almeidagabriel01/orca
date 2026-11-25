import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { RepositoryAgentDefaultsSection } from './RepositoryAgentDefaultsSection'
import { RepositoryAgentTrustSection } from './RepositoryAgentTrustSection'

const repo: Repo = {
  id: 'project-defaults',
  path: '/projects/example',
  displayName: 'Example project',
  badgeColor: '',
  addedAt: 1
}
export const before = defineFixture({
  width: 640,
  render: () => <RepositoryAgentTrustSection repo={repo} updateRepo={() => {}} />
})
export const inherited = defineFixture({
  width: 640,
  render: () => <RepositoryAgentDefaultsSection repo={repo} updateRepo={() => {}} />
})
export const projectOverrides = defineFixture({
  width: 640,
  render: () => (
    <RepositoryAgentDefaultsSection
      repo={{
        ...repo,
        agentLaunchDefaults: {
          defaultTuiAgent: 'codex',
          agentLaunchChoices: { codex: { model: 'gpt-5.4', options: { effort: 'high' } } }
        }
      }}
      updateRepo={() => {}}
    />
  )
})
export const surfaceTerminalOverride = defineFixture({
  width: 640,
  render: () => (
    <RepositoryAgentDefaultsSection
      repo={{
        ...repo,
        agentLaunchDefaults: { defaultTuiAgent: 'codex', defaultSurface: 'terminal' }
      }}
      updateRepo={() => {}}
    />
  )
})
export const surfaceBlankAgent = defineFixture({
  width: 640,
  render: () => (
    <RepositoryAgentDefaultsSection
      repo={{ ...repo, agentLaunchDefaults: { defaultTuiAgent: 'blank' } }}
      updateRepo={() => {}}
    />
  )
})
export const narrow = defineFixture({
  width: 360,
  render: () => (
    <RepositoryAgentDefaultsSection
      repo={{
        ...repo,
        agentLaunchDefaults: { defaultTuiAgent: 'codex', defaultSurface: 'terminal' }
      }}
      updateRepo={() => {}}
    />
  )
})
