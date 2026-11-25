// Contract for moving a heavy-queue job to another host. The job's wrapper on the source host stays the
// owner: it runs the same argv on the target through ssh and relays output and exit code to its caller.

/** Why a job cannot run on the other host; shown as the disabled reason (never hover-only). */
export type HeavyJobMoveBlockerCode =
  | 'queue_unavailable' // the host has no queue script or an older one without move-host
  | 'job_gone'
  | 'no_argv' // job from an older script: its argv was not recorded
  | 'already_moved'
  | 'not_git'
  | 'no_remote'
  | 'detached_head'
  | 'uncommitted_changes' // source checkout has changes not committed
  | 'unpushed_commits' // source commit is not on any remote branch
  | 'no_peer' // source host has no ssh peer that reaches the target host
  | 'project_missing' // no repo with the same remote on the target host
  | 'no_checkout_on_branch'
  | 'commit_unreachable' // target cannot reach the commit even after fetch
  | 'checkout_dirty' // target checkout is behind and has local changes
  | 'checkout_diverged' // target checkout has commits the source does not
  | 'directory_missing' // relative dir does not exist in the target checkout
  | 'executable_missing'
  | 'script_missing' // package.json script / Makefile target missing on the target
  | 'docker_unavailable'
  | 'host_unreachable'
  | 'unsupported_host' // paired server on an older Orca without these methods

export type HeavyJobMoveBlocker = {
  code: HeavyJobMoveBlockerCode
  /** The concrete subject: branch, executable, script, path... */
  detail?: string
}

/** What the source host knows about one of its jobs; answered by the host that runs the job. */
export type HeavyJobMoveSource = {
  pid: number
  argv: string[] | null
  group: string | null
  /** Normalized remote URL of the job's checkout (same key Orca uses to merge a project across hosts). */
  remoteUrl: string | null
  branch: string | null
  commit: string | null
  /** cwd relative to the checkout root, '' for the root; never starts with '/' or contains '..'. */
  relativeDir: string | null
  blockers: HeavyJobMoveBlocker[]
}

/** Sent to the target host; it resolves its own checkout. Validated at that trust boundary. */
export type HeavyJobTargetRequest = {
  remoteUrl: string
  branch: string
  commit: string
  relativeDir: string
  argv: string[]
  /** true right before moving: fast-forwards a clean checkout that is behind. false only checks. */
  prepare: boolean
}

export type HeavyJobTargetCheck = {
  /** Absolute cwd on the target host when ok. */
  cwd: string | null
  /** Hostname the target's queue script reports, to pick the source's ssh peer. */
  hostname: string | null
  blockers: HeavyJobMoveBlocker[]
}

/** One ssh peer configured in the source host's queue script (~/.config/vps-heavy/peers). */
export type HeavyQueuePeer = {
  name: string
  alias: string
  /** Hostname the peer's script reported on the last verify; null when never reached. */
  hostname: string | null
}
