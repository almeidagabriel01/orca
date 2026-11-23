import type {
  RuntimeRepoList,
  RuntimeRepoSearchRefs
} from '../../shared/worktree/catalog/runtime-worktree-contracts'
import type { CommandHandler, HandlerContext } from '../dispatch/dispatch'
import { formatRepoList, formatRepoRefs, formatRepoShow } from './repo-format'
import { printResult } from '../output/command-result-output'
import type { BrowserProfileListResult } from '../../shared/browser/runtime/runtime-browser-contracts'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalRepoKind,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../arguments/flags'
import { resolveRepoPathArgument } from './repo-path-arguments'
import { RuntimeClientError } from '../runtime/connection/types'
import { attachCliErrorData } from '../workspaces/worktree-setup-decision-recovery'
import { resolveHostFlagTarget } from '../hosts/execution-host-flag'
import {
  applyRepoAgentDefaultsPatch,
  readRepoAgentDefaultsPatch,
  resolveRepoDefaultAccount
} from './repo-agent-defaults-flags'
import { normalizeProjectAgentLaunchDefaults } from '../../shared/agent-launch/choices/project-agent-launch-defaults'

/** `inherit` clears the pick; anything else must name a profile on the repo's Orca host. */
async function resolveBrowserProfileFlag(
  client: HandlerContext['client'],
  value: string
): Promise<string | null> {
  if (value === 'inherit') {
    return null
  }
  const { profiles } = (await client.call<BrowserProfileListResult>('browser.profileList')).result
  if (!profiles.some((profile) => profile.id === value)) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Browser profile ${value} was not found. Run \`orca tab profile list\` to see profile ids.`
    )
  }
  return value
}

async function setRepoHidden(
  { flags, client, json }: Pick<HandlerContext, 'flags' | 'client' | 'json'>,
  hidden: boolean
): Promise<void> {
  const host = await resolveHostFlagTarget(flags, client)
  const result = await client.call<{ repo: Record<string, unknown> }>('repo.setHidden', {
    repo: getRequiredStringFlag(flags, 'repo'),
    hidden,
    ...(host ? { repoHostId: host.id } : {})
  })
  printResult(result, json, formatRepoShow)
}

export const REPO_HANDLERS: Record<string, CommandHandler> = {
  'repo list': async ({ client, json }) => {
    const result = await client.call<RuntimeRepoList>('repo.list')
    printResult(result, json, formatRepoList)
  },
  'repo add': async ({ flags, client, cwd, json }) => {
    const repoPath = getRequiredStringFlag(flags, 'path')
    const kind = getOptionalRepoKind(flags)
    const result = await client
      .call<{ repo: Record<string, unknown> }>('repo.add', {
        path: resolveRepoPathArgument(repoPath, cwd, client.isRemote, 'Remote repo add'),
        ...(kind === undefined ? {} : { kind })
      })
      .catch((error: unknown) => {
        if (
          error instanceof RuntimeClientError &&
          kind !== 'folder' &&
          error.message.startsWith('Not a valid git repository:')
        ) {
          throw attachCliErrorData(error, {
            ...(error.data && typeof error.data === 'object' ? error.data : {}),
            nextSteps: [
              'This directory is not itself a Git repository (for example, a parent folder of separate Git repositories). To open it as a folder workspace without Git worktrees or source control, rerun this command with --kind folder.'
            ]
          })
        }
        throw error
      })
    printResult(result, json, formatRepoShow)
  },
  'repo show': async ({ flags, client, json }) => {
    const result = await client.call<{ repo: Record<string, unknown> }>('repo.show', {
      repo: getRequiredStringFlag(flags, 'repo')
    })
    const { repo: row } = result.result
    // null: every agent default follows the host's own settings.
    const repo = { ...row, agentLaunchDefaults: row.agentLaunchDefaults ?? null }
    printResult({ ...result, result: { ...result.result, repo } }, json, formatRepoShow)
  },
  'repo set': async ({ flags, client, json }) => {
    const repo = getRequiredStringFlag(flags, 'repo')
    const visibility = getOptionalStringFlag(flags, 'external-worktree-visibility')
    const browserProfile = getOptionalStringFlag(flags, 'browser-profile')
    const agentDefaultsPatch = readRepoAgentDefaultsPatch(flags)
    if (visibility === undefined && browserProfile === undefined && !agentDefaultsPatch) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Pass --external-worktree-visibility, --browser-profile, or a --default-agent/--default-model/--default-effort/--default-account flag.'
      )
    }
    if (
      visibility !== undefined &&
      visibility !== 'show' &&
      visibility !== 'hide' &&
      visibility !== 'inherit'
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        '--external-worktree-visibility must be show, hide, or inherit.'
      )
    }
    const browserProfileId =
      browserProfile === undefined
        ? undefined
        : await resolveBrowserProfileFlag(client, browserProfile)
    let agentLaunchDefaults: ReturnType<typeof applyRepoAgentDefaultsPatch> | undefined
    if (agentDefaultsPatch) {
      if (typeof agentDefaultsPatch.account === 'string') {
        agentDefaultsPatch.account = await resolveRepoDefaultAccount(
          client,
          agentDefaultsPatch.account
        )
      }
      // The host replaces the whole record, so merge into what it holds now, as Settings does.
      const current = await client.call<{ repo: Record<string, unknown> }>('repo.show', { repo })
      agentLaunchDefaults = applyRepoAgentDefaultsPatch(
        current.result.repo.agentLaunchDefaults,
        agentDefaultsPatch
      )
    }
    const result = await client.call<{ repo: Record<string, unknown> }>('repo.update', {
      repo,
      updates: {
        ...(visibility === undefined
          ? {}
          : { externalWorktreeVisibility: visibility === 'inherit' ? null : visibility }),
        ...(browserProfileId === undefined ? {} : { browserProfileId }),
        ...(agentLaunchDefaults === undefined ? {} : { agentLaunchDefaults })
      }
    })
    if (
      agentLaunchDefaults !== undefined &&
      JSON.stringify(
        normalizeProjectAgentLaunchDefaults(result.result.repo.agentLaunchDefaults) ?? null
      ) !== JSON.stringify(agentLaunchDefaults)
    ) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This Orca host did not save the project agent defaults; any other flags were applied. Update Orca on that host.'
      )
    }
    // A host from before per-repo browser profiles drops the field and still answers with its row.
    if (
      browserProfileId !== undefined &&
      (result.result.repo.browserProfileId ?? null) !== browserProfileId
    ) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        visibility === undefined
          ? 'This Orca host does not support per-repo browser profiles. Update Orca on that host.'
          : 'This Orca host does not support per-repo browser profiles, so only the worktree visibility was saved. Update Orca on that host.'
      )
    }
    printResult(result, json, formatRepoShow)
  },
  'repo hide': (context) => setRepoHidden(context, true),
  'repo unhide': (context) => setRepoHidden(context, false),
  'repo set-base-ref': async ({ flags, client, json }) => {
    const result = await client.call<{ repo: Record<string, unknown> }>('repo.setBaseRef', {
      repo: getRequiredStringFlag(flags, 'repo'),
      ref: getRequiredStringFlag(flags, 'ref')
    })
    printResult(result, json, formatRepoShow)
  },
  'repo search-refs': async ({ flags, client, json }) => {
    const result = await client.call<RuntimeRepoSearchRefs>('repo.searchRefs', {
      repo: getRequiredStringFlag(flags, 'repo'),
      query: getRequiredStringFlag(flags, 'query'),
      limit: getOptionalPositiveIntegerFlag(flags, 'limit')
    })
    printResult(result, json, formatRepoRefs)
  }
}
