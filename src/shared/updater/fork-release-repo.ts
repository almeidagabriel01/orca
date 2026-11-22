// Vite defines this for fork builds; other bundles (CLI, tests) never see it, so read it through typeof.
declare const ORCA_FORK_RELEASE_REPO: string | undefined

/** The fork's GitHub repo, baked in by its release workflow (ORCA_DESKTOP_UPDATE_REPOSITORY); empty upstream. */
export const FORK_RELEASE_REPO: string =
  typeof ORCA_FORK_RELEASE_REPO === 'string' ? ORCA_FORK_RELEASE_REPO : ''

/** Upstream publishes the agent-state rules and remote policies every build reads, forks included. */
export const UPSTREAM_RELEASE_REPO = 'stablyai/orca'
