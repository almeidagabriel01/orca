import { useState } from 'react'
import { defineFixture } from '../../../../../component-fixtures/component-fixture'
import { i18n, loadRendererUiLanguage } from '@/i18n/i18n'
import { workerDockClearable } from '../../../../../../../shared/orchestration/dock/worker-dock'
import type { AgentSessionBackgroundTask } from '../../../../../../../shared/agent-session/background-tasks/agent-session-background-task-wire'
import { nativeChatAppearanceStyle } from '../../../appearance/native-chat-appearance-style'
import { NativeChatBackgroundTasksStatus } from '../NativeChatBackgroundTasksStatus'
import { NativeChatWorkerDockFrame } from './NativeChatWorkerDockFrame'
import type { WorkerDockRowView } from './WorkerDockRow'
import { NativeChatComposerField } from '../../../composer/editor/NativeChatComposerField'
import { FloatingTerminalToggleButton } from '../../../../floating-terminal/trigger/FloatingTerminalToggleButton'
import { FLOATING_TERMINAL_TRIGGER_POSITION_STORAGE_KEY } from '../../../../floating-terminal/trigger/floating-terminal-trigger-position'

// A bot's Home Chat that started three workers with `orca orchestration worker-start`.
const SOURCE = '6c3f8e4a-ad5b-4a9c-9e37-2f4d8a0b3c59'
const minutes = (count: number) => Date.now() - count * 60_000

function worker(
  index: number,
  name: string,
  title: string,
  state: WorkerDockRowView['state'],
  startedMinutesAgo: number,
  extra: Partial<WorkerDockRowView> = {}
): WorkerDockRowView {
  return {
    kind: 'worker',
    id: `dock:${index}`,
    dispatchId: `ctx_bot_${index}`,
    source: SOURCE,
    name,
    title,
    model: 'gpt-6.1-sol',
    state,
    changedAt: minutes(startedMinutesAgo),
    startedAt: minutes(startedMinutesAgo),
    reason: null,
    settlement: null,
    resultId: null,
    stoppable: state !== 'needs-you',
    ownerActionsAvailable: true,
    ...extra
  }
}

const ask = worker(3, 'ORCA-20', 'Migrate the orders schema', 'needs-you', 6, {
  changedAt: minutes(1),
  question: 'Approve: run the migration against the staging copy of the orders database?'
})
// A long question clamps to three lines; the full text stays in the row's tooltip.
const longAsk = {
  ...ask,
  question:
    'Approve: run the migration against the staging copy of the orders database? It rewrites about 2.4 million rows and holds a table lock for roughly 40 seconds.'
}
const failed = worker(4, 'ORCA-21', 'Split the dock read model', 'failed', 8, {
  changedAt: minutes(3),
  reason: 'Typecheck failed: 3 errors in worker-dock-read.ts',
  settlement: 'settled:ctx_bot_4',
  resultId: 'result:ctx_bot_4'
})
const rows = [
  worker(1, 'ORCA-18', 'Fix streaming journal amplification', 'running', 12),
  worker(2, 'ORCA-19', 'Fix repeated worktree catalog scans', 'running', 9),
  ask,
  failed
]
const longRows = [
  longAsk,
  failed,
  ...[
    'Cache the branch list per repository',
    'Drop the duplicate status poll',
    'Batch the sidebar badge writes',
    'Stream the diff instead of buffering it',
    'Reuse the parsed config between tabs',
    'Coalesce terminal resize events',
    'Skip hidden pane layout passes',
    'Index session history by worktree',
    'Defer the plugin manifest scan',
    'Trim the startup font preload',
    'Share one watcher per repository',
    'Avoid re-sorting the unchanged roster'
  ].map((title, index) => worker(10 + index, `ORCA-${30 + index}`, title, 'running', 4 + index))
]

function dock(
  expanded: boolean,
  list: readonly WorkerDockRowView[],
  extra: {
    settledTasks?: AgentSessionBackgroundTask[]
    onClearAll?: () => void
    onWorkerAction?: (row: WorkerDockRowView, action: 'stop' | 'clear') => void
    sessionId?: string
  } = {}
) {
  const workerRows = new Map(list.map((row) => [row.id, row]))
  const workerIdentities = list.map(
    ({ id, state, changedAt, settlement, ownerActionsAvailable }) => ({
      id,
      state,
      changedAt,
      settlement,
      ownerActionsAvailable
    })
  )
  return (
    <NativeChatWorkerDockFrame>
      <NativeChatBackgroundTasksStatus
        sessionId={extra.sessionId ?? SOURCE}
        tasks={[]}
        settledTasks={extra.settledTasks ?? []}
        supportsTaskStop
        offersStopAll={false}
        stoppingTaskIds={new Set()}
        stoppingAll={false}
        indicatorActive
        isVisible
        expanded={expanded}
        onExpandedChange={() => {}}
        onStop={() => {}}
        workerRows={workerRows}
        workerIdentities={workerIdentities}
        onClearAll={extra.onClearAll}
        onWorkerAction={extra.onWorkerAction}
      />
    </NativeChatWorkerDockFrame>
  )
}

function botChat(
  expanded: boolean,
  list: readonly WorkerDockRowView[] = rows,
  note = 'Both fix workers are running in parallel; ORCA-20 needs your approval.'
) {
  return (
    <div
      className="native-chat-appearance flex flex-col gap-2 bg-chat-canvas p-3"
      style={nativeChatAppearanceStyle({})}
    >
      <p className="text-xs text-muted-foreground">Perf Issue · Home Chat</p>
      <p className="text-sm text-chat-foreground">{note}</p>
      <div className="rounded-xl border border-chat-composer-border bg-chat-composer-surface p-1.5 shadow-xs">
        {dock(expanded, list)}
        <p className="px-2 py-2 text-sm text-muted-foreground">
          Ask anything, / for commands, @ for context
        </p>
      </div>
    </div>
  )
}

const noop = () => {}
const ime = { isComposing: () => false, ownsKeyDown: () => false, reset: noop, setComposing: noop }

// The real message box and floating panel button in a full-height chat pane; the shot's window
// width decides where the button lands, so capture it with the viewport set to the fixture width.
function composerChat(expanded: boolean) {
  return (
    <div
      data-native-chat-root=""
      className="native-chat-appearance flex h-[calc(100vh-2rem)] flex-col bg-chat-canvas"
      style={nativeChatAppearanceStyle({})}
    >
      <div className="min-h-0 flex-1 space-y-2 p-3">
        <p className="text-xs text-muted-foreground">Perf Issue · Home Chat</p>
        <p className="text-sm text-chat-foreground">
          Both fix workers are running in parallel; ORCA-20 needs your approval.
        </p>
      </div>
      <NativeChatComposerField
        dock={dock(expanded, rows)}
        draftScopeKey="fixture:worker-dock-composer"
        textareaRef={{ current: null }}
        draft="Ship both fixes once ORCA-20 is approved"
        disabled={false}
        hasPty
        canSend
        autocomplete={{ mode: 'none' }}
        mentionFiles={{ files: [], loading: false, failed: false }}
        activeSuggestion={0}
        notices={[]}
        imageAttachments={[]}
        sendButtonDisabled={false}
        isWorking={false}
        hasDraft
        attachDisabled={false}
        dictationDisabled={false}
        isDictating={false}
        isDictationHoldMode={false}
        imeEnterGesture={ime}
        onDraftChange={noop}
        onTextareaSelect={noop}
        onKeyDown={noop}
        onImeSettled={noop}
        onPaste={noop}
        pickerListboxId="fixture-worker-dock-picker"
        onChoosePickerItem={noop}
        onRetrySkills={noop}
        onChooseMentionFile={noop}
        onRemoveImageAttachment={noop}
        onAttach={noop}
        onDictationToggle={noop}
        onDictationHoldStart={noop}
        onDictationHoldEnd={noop}
        onSend={noop}
        sessionOptionsSurface={null}
        sessionOptionsSnapshot={[]}
      />
      <FloatingTerminalToggleButton open={false} onToggle={noop} />
    </div>
  )
}

// A position the user dragged the button to, right over Send at the box's bottom right.
function savePositionOverSend() {
  localStorage.setItem(
    FLOATING_TERMINAL_TRIGGER_POSITION_STORAGE_KEY,
    JSON.stringify({ anchorX: 'right', anchorY: 'bottom', offsetX: 18, offsetY: 22 })
  )
}
function forgetSavedPosition() {
  localStorage.removeItem(FLOATING_TERMINAL_TRIGGER_POSITION_STORAGE_KEY)
}

// Scrolls the roster part-way, then waits out its 100 ms settle so the shot shows where it rests.
async function scrollMidway(frame: HTMLElement) {
  const viewport = frame.querySelector<HTMLElement>(
    '[data-native-chat-background-tasks] [role="region"]'
  )
  if (!viewport) {
    throw new Error('Worker roster viewport not found')
  }
  viewport.scrollTop = Math.round((viewport.scrollHeight - viewport.clientHeight) / 2)
  viewport.dispatchEvent(new Event('scroll'))
  await new Promise((resolve) => setTimeout(resolve, 400))
}

export const botHomeChatFolded = defineFixture({ width: 720, render: () => botChat(false) })

export const botHomeChatOpen = defineFixture({ width: 720, render: () => botChat(true) })

export const botHomeChatNarrowFolded = defineFixture({ width: 390, render: () => botChat(false) })

export const botHomeChatNarrowOpen = defineFixture({ width: 390, render: () => botChat(true) })

export const botHomeChatSmallFolded = defineFixture({ width: 320, render: () => botChat(false) })

export const botHomeChatSmallOpen = defineFixture({ width: 320, render: () => botChat(true) })

// Nothing waits on you, so the folded header shows the failed state icon instead of the robot.
const failedOnly = () => botChat(false, [failed], 'ORCA-21 stopped with a typecheck failure.')

export const failedOnlyFolded = defineFixture({ width: 720, render: failedOnly })

export const failedOnlyNarrowFolded = defineFixture({ width: 390, render: failedOnly })

export const failedOnlySmallFolded = defineFixture({ width: 320, render: failedOnly })

export const longListMidScroll = defineFixture({
  width: 720,
  render: () => botChat(true, longRows),
  interact: scrollMidway
})

export const longListNarrowMidScroll = defineFixture({
  width: 390,
  render: () => botChat(true, longRows),
  interact: scrollMidway
})

export const composerDefault390 = defineFixture({
  width: 390,
  setup: forgetSavedPosition,
  render: () => composerChat(true)
})

export const composerOverSend390 = defineFixture({
  width: 390,
  setup: savePositionOverSend,
  render: () => composerChat(true)
})

export const composerDefault320 = defineFixture({
  width: 320,
  setup: forgetSavedPosition,
  render: () => composerChat(true)
})

export const composerOverSend320 = defineFixture({
  width: 320,
  setup: savePositionOverSend,
  render: () => composerChat(false)
})

// Ended work next to live work: a failure this Orca acknowledges (Clear), a failure run from another
// computer and a finished subagent (Dismiss, hidden here only). Live rows never offer either.
const DISMISSED_STORAGE_KEY = 'orca.nativeChat.workerDock.dismissed'
const endedRows = [
  worker(1, 'ORCA-18', 'Fix streaming journal amplification', 'running', 12),
  failed,
  worker(5, 'ORCA-22', 'Trim the startup font preload', 'unexpected', 20, {
    changedAt: minutes(5),
    reason: 'The worker exited before it reported',
    settlement: 'settled:ctx_bot_5',
    ownerActionsAvailable: false
  })
]
const settledAgents: AgentSessionBackgroundTask[] = [
  {
    id: 'agent-review',
    kind: 'agent',
    description: 'Review dock read model',
    state: 'done',
    startedAt: minutes(7)
  }
]

// Each fixture gets its own ids: the shots share one page, and a dismissal is kept per row.
function EndedWorkChat({ scope }: { scope: string }) {
  const [list, setList] = useState(() =>
    endedRows.map((row) => ({ ...row, id: `${row.id}:${scope}` }))
  )
  const drop = (keep: (row: WorkerDockRowView) => boolean) => setList((rows) => rows.filter(keep))
  return (
    <div
      className="native-chat-appearance flex flex-col gap-2 bg-chat-canvas p-3"
      style={nativeChatAppearanceStyle({})}
    >
      <p className="text-xs text-muted-foreground">Perf Issue · Home Chat</p>
      <p className="text-sm text-chat-foreground">
        Two workers and a subagent ended; one worker is still running.
      </p>
      <div className="rounded-xl border border-chat-composer-border bg-chat-composer-surface p-1.5 shadow-xs">
        {dock(true, list, {
          sessionId: `${SOURCE}:${scope}`,
          settledTasks: settledAgents,
          // Stands in for the host acknowledging the failure.
          onClearAll: () => drop((row) => !workerDockClearable(row)),
          onWorkerAction: (row, action) => {
            if (action === 'clear') {
              drop((other) => other.id !== row.id)
            }
          }
        })}
      </div>
    </div>
  )
}

function forgetDismissed() {
  localStorage.removeItem(DISMISSED_STORAGE_KEY)
}

export const endedWorkOpen = defineFixture({
  width: 720,
  setup: forgetDismissed,
  render: () => <EndedWorkChat scope="endedWorkOpen" />
})

export const endedWorkDismissed = defineFixture({
  width: 720,
  setup: forgetDismissed,
  render: () => <EndedWorkChat scope="endedWorkDismissed" />,
  interact: async (frame) => {
    const button = [
      ...frame.querySelectorAll<HTMLButtonElement>('[data-worker-dock-header] button')
    ].find(
      (candidate) => candidate.textContent === 'Dismiss' || candidate.textContent === 'Dispensar'
    )
    if (!button) {
      throw new Error('Dismiss not found')
    }
    button.click()
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
})

export const endedWorkNarrowOpen = defineFixture({
  width: 390,
  setup: forgetDismissed,
  render: () => <EndedWorkChat scope="endedWorkNarrowOpen" />
})

// The finished subagent sits below the fold; scroll to it to show its Dismiss.
export const endedWorkOpenBottom = defineFixture({
  width: 720,
  setup: forgetDismissed,
  render: () => <EndedWorkChat scope="endedWorkOpenBottom" />,
  interact: async (frame) => {
    const viewport = frame.querySelector<HTMLElement>(
      '[data-native-chat-background-tasks] [role="region"]'
    )
    if (!viewport) {
      throw new Error('Worker roster viewport not found')
    }
    viewport.scrollTop = viewport.scrollHeight
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
})

// The same views in Portuguese, whose longer labels must not overlap the names either.
const inPortuguese =
  (then?: (frame: HTMLElement) => void | Promise<void>) =>
  async (frame: HTMLElement): Promise<void> => {
    await i18n.changeLanguage(await loadRendererUiLanguage('pt'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await then?.(frame)
  }

export const endedWorkOpenPt = defineFixture({
  ...endedWorkOpen,
  interact: inPortuguese()
})
export const endedWorkNarrowOpenPt = defineFixture({
  ...endedWorkNarrowOpen,
  interact: inPortuguese()
})
export const endedWorkOpenBottomPt = defineFixture({
  ...endedWorkOpenBottom,
  interact: inPortuguese(endedWorkOpenBottom.interact)
})
export const endedWorkDismissedPt = defineFixture({
  ...endedWorkDismissed,
  interact: inPortuguese(endedWorkDismissed.interact)
})
