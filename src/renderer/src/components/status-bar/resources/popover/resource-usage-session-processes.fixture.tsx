import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type {
  ChatAgentMemory,
  SessionProcess,
  SessionProcessTree
} from '../../../../../../shared/diagnostics/process-stats-types'
import type { UnifiedSessionRow } from '../workspace-attribution/resource-usage-merge-types'
import { ChatRows } from './resource-usage-chat-row'
import { SessionRow } from './resource-usage-session-rows'

const MIB = 1024 ** 2
const WORKSPACE = '/Users/dev/projects/shop-app'
const NOW = Date.UTC(2026, 10, 23, 15, 0, 0)

const proc = (
  pid: number,
  ppid: number,
  command: string,
  cpu: number,
  memoryMib: number,
  ageMinutes: number,
  cwd: string = WORKSPACE
): SessionProcess => ({
  pid,
  ppid,
  cpu,
  memory: memoryMib * MIB,
  command,
  cwd,
  startedAt: NOW - ageMinutes * 60_000
})

const TERMINAL_PROCESSES: SessionProcess[] = [
  proc(4100, 1, '/bin/zsh -l', 0, 6, 182),
  proc(
    4120,
    4100,
    `node ${WORKSPACE}/node_modules/.pnpm/vitest@3.2.4/node_modules/vitest/vitest.mjs run --watch`,
    3.1,
    210,
    41
  ),
  ...[1, 2, 3, 4].map((n) =>
    proc(
      4130 + n,
      4120,
      `node ${WORKSPACE}/node_modules/.pnpm/vitest@3.2.4/node_modules/tinypool/dist/entry/process.js --pool-id ${n}`,
      11 + n * 3,
      160 + n * 12,
      41
    )
  ),
  proc(
    4150,
    4100,
    `node ${WORKSPACE}/node_modules/.bin/vite --port 5173`,
    1.4,
    320,
    95,
    `${WORKSPACE}/apps/web`
  ),
  proc(
    4160,
    4150,
    `${WORKSPACE}/node_modules/@esbuild/darwin-arm64/bin/esbuild --service=0.25.0 --ping`,
    0.2,
    38,
    95,
    `${WORKSPACE}/apps/web`
  )
]

const CHAT_ID = 'chat-worker-login'
const CHAT_PROCESSES: SessionProcess[] = [
  proc(
    5200,
    1,
    'claude --output-format stream-json --input-format stream-json --verbose',
    6.5,
    410,
    23
  ),
  ...[1, 2, 3].map((n) =>
    proc(5210 + n, 5200, 'npx -y @modelcontextprotocol/server-github', 0.1, 70, 23)
  ),
  proc(5220, 5200, `/bin/bash -c pnpm test src/auth/login.test.ts --maxWorkers=2`, 0.4, 12, 1),
  proc(
    5221,
    5220,
    `node ${WORKSPACE}/node_modules/.bin/vitest run src/auth/login.test.ts --maxWorkers=2`,
    48.2,
    380,
    1
  )
]

const tree = (sessionId: string, processes: SessionProcess[]): SessionProcessTree => ({
  sessionId,
  rootPid: processes[0].pid,
  collectedAt: NOW,
  processes
})

function stubProcessTrees(): void {
  window.api.memory.getProcessTree = async (sessionId: string) =>
    sessionId === CHAT_ID
      ? tree(sessionId, CHAT_PROCESSES)
      : sessionId === 'pty-shop-1'
        ? tree(sessionId, TERMINAL_PROCESSES)
        : null
}

const session: UnifiedSessionRow = {
  sessionId: 'pty-shop-1',
  paneKey: 'tab-1:leaf-1',
  pid: 4100,
  label: 'Terminal 1',
  bound: true,
  agentOwnership: 'absent',
  tabId: 'tab-1',
  cpu: 59.7,
  memory: 1_430 * MIB,
  hasLocalSamples: true
}

const chat: ChatAgentMemory = {
  agentSessionId: CHAT_ID,
  agent: 'claude',
  name: 'Fix the login redirect',
  cpu: 55.4,
  memory: 1_012 * MIB
}

/** Clicks the row's own toggle, waits for the tree, then opens the first ×N group. */
async function expand(frame: HTMLElement, openGroup: boolean): Promise<void> {
  frame.querySelector<HTMLButtonElement>('button[aria-label="Show processes"]')?.click()
  for (let i = 0; i < 40 && !frame.querySelector('[role="group"]'); i++) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  if (openGroup) {
    frame
      .querySelector('[role="group"]')
      ?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
      ?.click()
  }
  await new Promise((resolve) => setTimeout(resolve, 50))
}

const Panel = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="rounded-md border border-border bg-popover py-1">{children}</div>
)

const terminal = (): React.JSX.Element => (
  <Panel>
    <SessionRow
      session={session}
      worktreeId="shop-app"
      workspacePath={WORKSPACE}
      onNavigate={() => {}}
      onKill={() => {}}
    />
  </Panel>
)

const chatRows = (): React.JSX.Element => (
  <Panel>
    <ChatRows
      chats={[chat]}
      worktreeId="shop-app"
      workspacePath={WORKSPACE}
      onOpenChat={() => {}}
    />
  </Panel>
)

// The popover is 26rem wide; the frame adds 16px padding on each side.
export const terminalExpanded = defineFixture({
  width: 448,
  setup: stubProcessTrees,
  render: terminal,
  interact: (frame) => expand(frame, true)
})

export const terminalExpandedNarrow = defineFixture({
  ...terminalExpanded,
  width: 320
})

export const chatCollapsed = defineFixture({
  width: 448,
  setup: stubProcessTrees,
  render: chatRows
})

export const chatExpanded = defineFixture({
  width: 448,
  setup: stubProcessTrees,
  render: chatRows,
  interact: (frame) => expand(frame, false)
})

export const chatExpandedNarrow = defineFixture({
  ...chatExpanded,
  width: 320
})
