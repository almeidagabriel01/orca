import type { BrowserExtensionsBannerAssignmentReply } from '../../../shared/browser/extensions/browser-extensions-banner'
import type { ResourceViewAdmission } from '../../../shared/diagnostics/resource-view-admission'
import type { PerfNoticeSignals } from '../../../shared/diagnostics/perf-notice-signals'
import type { HeavyQueueAction } from '../../../shared/rpc-contract/diagnostics-params'
import type {
  HeavyJobMoveSource,
  HeavyJobTargetCheck,
  HeavyJobTargetRequest
} from '../../../shared/diagnostics/heavy-job-move-types'
import type { TelemetryConsentState } from '../../../shared/telemetry/telemetry-consent-types'
import type {
  MemorySnapshot,
  SessionProcessTree,
  HeavyCommandQueue,
  StatsSummary
} from '../../../shared/diagnostics/process-stats-types'

export type StatsApi = {
  getSummary: () => Promise<StatsSummary>
}

// Diagnostics IPC payloads; mirror the runtime types in `src/main/observability/{index,bundle}.ts`.
export type DiagnosticsStatusPayload = {
  readonly localFileEnabled: boolean
  readonly bundleEnabled: boolean
  readonly traceFilePath: string
  readonly traceFamilySize: number
  readonly disabledReason?:
    | 'do_not_track'
    | 'orca_telemetry_disabled'
    | 'orca_diagnostics_disabled'
    | 'ci'
}
export type DiagnosticsBundlePayload = {
  readonly bundleSubmissionId: string
  readonly bytes: number
  readonly spanCount: number
}
export type DiagnosticsUploadPayload =
  | {
      readonly ticketId: string
    }
  | {
      readonly canceled: true
    }

export type MemoryApi = {
  getSnapshot: (admission?: ResourceViewAdmission) => Promise<MemorySnapshot>
  getProcessTree: (
    sessionId: string,
    admission?: ResourceViewAdmission
  ) => Promise<SessionProcessTree | null>
  /** Controls this computer's vps-heavy queue; rejects with the script's message when it refuses. */
  heavyQueueAction: (action: HeavyQueueAction, admission?: ResourceViewAdmission) => Promise<void>
  /** This computer's vps-heavy queue, jobs named by workspace; null without one. */
  heavyQueue: () => Promise<HeavyCommandQueue | null>
  /** This computer's view of one of its heavy jobs, for moving it to another host. */
  heavyJobMoveSource: (
    pid: number,
    admission?: ResourceViewAdmission
  ) => Promise<HeavyJobMoveSource>
  /** Whether this computer can run a job moved here; prepare fast-forwards a clean checkout. */
  heavyJobTargetCheck: (
    request: HeavyJobTargetRequest,
    admission?: ResourceViewAdmission
  ) => Promise<HeavyJobTargetCheck>
  readPerfNoticeSignals: () => Promise<PerfNoticeSignals | null>
  countHiddenBrowserPages: (hiddenForMs: number) => Promise<number>
  resourceWindowVisible: () => Promise<boolean>
  onResourceWindowVisibility: (callback: (visible: boolean) => void) => () => void
}

export type DiagnosticsApi = {
  getStatus: () => Promise<DiagnosticsStatusPayload>
  collectBundle: (lookbackMinutes?: number) => Promise<DiagnosticsBundlePayload>
  openBundlePreview: (bundleSubmissionId: string) => Promise<void>
  discardBundlePreview: (bundleSubmissionId: string) => Promise<void>
  uploadBundle: (bundleSubmissionId: string) => Promise<DiagnosticsUploadPayload>
  deleteBundle: (ticketId: string) => Promise<void>
}

export type TelemetryApi = {
  /** Use lib/telemetry.ts; true means captured/already recorded today, void is a legacy reply. */
  telemetryTrack: (name: string, props: Record<string, unknown>) => Promise<boolean | void>
  /** Main permits at most five consent mutations per session. */
  telemetrySetOptIn: (optedIn: boolean) => Promise<void>
  /** Main retains upload payloads so the renderer cannot read or substitute arbitrary bytes. */
  diagnostics: DiagnosticsApi
  telemetryGetConsentState: () => Promise<TelemetryConsentState>
  /** Asks main which browser extensions banner this install follows. */
  telemetryAssignBrowserExtensionsBanner: () => Promise<BrowserExtensionsBannerAssignmentReply>
  /** Banner dismissal opts in without emitting telemetry_opted_in; shares the consent rate limit. */
  telemetryAcknowledgeBanner: () => Promise<void>
  stats: StatsApi
  memory: MemoryApi
}
