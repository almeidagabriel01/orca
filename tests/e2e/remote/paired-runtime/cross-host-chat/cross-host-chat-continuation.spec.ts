// Real client + isolated `orca serve` paired as "vps": History host buttons, sidebar routing and
// "Continue on <host>" both ways. Harness steps are hard expects; the cross-host behaviour is soft so
// one run reports every scenario and leaves a screenshot per step (ORCA_E2E_SHOT_DIR).
import { rmSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, test, type Locator, type Page } from '@stablyai/playwright-test'
import type { GlobalSettings } from '../../../../../src/shared/settings/global-settings-types'
import { getLocalExecutionHostLabel } from '../../../../../src/shared/execution-host/execution-host'
import { cleanupE2EDaemons } from '../../../desktop/electron-fixtures/electron-process-shutdown'
import { cliServeProfile, startCliServe, type CliServe } from '../client-hosts/orca-serve-cli-host'
import {
  launchPairedElectronClient,
  type PairedElectronClient
} from '../client-hosts/paired-electron-client'
import {
  createCrossHostFixture,
  killProcessesUsing,
  patchProfileSettings,
  MAC_BRANCH,
  readStubLaunches,
  screenshotStep,
  scrubHostOrcaEnv,
  shotDir,
  stubPath,
  VPS_BRANCH,
  writeClaudeTranscript,
  writeSessionPathMap,
  type CrossHostFixture,
  type SeededSession
} from './cross-host-chat-fixture'

scrubHostOrcaEnv()

const VPS_HOST = 'vps'
// The client's own host; "Local Mac" on macOS, "Local Linux" on the Linux runner.
const LOCAL_HOST = getLocalExecutionHostLabel(process.platform)
const VPS_SESSION: SeededSession = {
  sessionId: randomUUID(),
  prompt: 'VPS-RECORDED: fix the develop build pipeline',
  reply: 'Fixed the develop pipeline on the vps.'
}
const MAC_SESSION: SeededSession = {
  sessionId: randomUUID(),
  prompt: 'MAC-RECORDED: polish the mobile login screen',
  reply: 'Polished the login screen on the Mac.'
}

const CLAUDE_CHAT_SETTINGS = {
  defaultTuiAgent: 'claude',
  agentDefaultSurface: 'chat',
  nativeChatProviders: { claude: true }
} satisfies Partial<GlobalSettings>

type Workspaces = { macWorktreeId: string; vpsWorktreeId: string; vpsEnvironmentId: string }

test.describe.configure({ mode: 'serial' })
// A missing control fails its scenario in seconds instead of eating the whole budget.
test.use({ actionTimeout: 15_000 })

test('History and chat continue across Local and vps hosts', async () => {
  const testInfo = test.info()
  // Two Orca apps, two hosts and four scenarios with real launches outgrow the default budget.
  test.setTimeout(15 * 60_000)
  const shots = shotDir(testInfo.outputDir)
  let step = 0
  const shot = (page: Page, name: string) => screenshotStep(page, shots, ++step, name)

  const fixture: CrossHostFixture = createCrossHostFixture()
  const serverProfile = cliServeProfile(fixture.root)
  let serve: CliServe | null = null
  let client: PairedElectronClient | null = null
  try {
    const serverHome = path.join(serverProfile.userDataDir, 'home')
    // The vps's own transcript: the session it recorded in its develop checkout.
    writeClaudeTranscript({
      home: serverHome,
      cwd: fixture.vpsCheckout,
      branch: VPS_BRANCH,
      session: VPS_SESSION
    })
    // The vps, like the local host, opens Claude as a chat rather than a terminal.
    patchProfileSettings(serverProfile.userDataDir, CLAUDE_CHAT_SETTINGS)
    serve = await startCliServe(serverProfile, { PATH: stubPath(fixture.vpsStub) })
    const pairing = serve.readiness.pairing
    const pairingUrl =
      pairing && typeof pairing === 'object' && 'url' in pairing && typeof pairing.url === 'string'
        ? pairing.url
        : null
    expect(pairingUrl, 'isolated orca serve offers a pairing link').not.toBeNull()

    client = await launchPairedElectronClient({ pairingUrl: pairingUrl! }, testInfo, VPS_HOST, {
      extraEnv: { PATH: stubPath(fixture.macStub) }
    })
    const page = client.page
    const clientHome = path.join(client.userDataDir, 'home')
    writeClaudeTranscript({
      home: clientHome,
      cwd: fixture.macCheckout,
      branch: MAC_BRANCH,
      session: MAC_SESSION
    })
    // The synced copy the Mac holds of the vps session, placed by the client's path map.
    writeClaudeTranscript({
      home: clientHome,
      cwd: fixture.vpsCheckout,
      branch: VPS_BRANCH,
      session: VPS_SESSION
    })
    writeSessionPathMap(client.userDataDir, fixture.macCheckout, fixture.vpsCheckout)

    const workspaces = await addProjectOnBothHosts(page, client.environmentId, fixture)
    testInfo.annotations.push({ type: 'vps-environment-id', description: client.environmentId })
    // One scenario's failure is recorded and the next still runs from a known workspace.
    const scenario = async (name: string, body: () => Promise<void>): Promise<void> => {
      await test.step(name, body).catch(async (error: unknown) => {
        await shot(page, `${name.slice(0, 1).toLowerCase()}-failed`).catch(() => undefined)
        expect.soft(String(error).split('\n').slice(0, 6).join('\n'), name).toBe('passed')
        for (let i = 0; i < 3; i += 1) {
          await page.keyboard.press('Escape').catch(() => undefined)
        }
      })
    }
    await enableClaudeChat(page)
    await activateWorkspace(page, workspaces.macWorktreeId)
    await shot(page, 'setup-sidebar-local-active')

    // ── A. Mac → vps: open a vps-recorded session from History ──────────────────────────────
    await scenario('A: open a vps-recorded session from History', async () => {
      await openNewClaudeChat(page)
      await shot(page, 'a-local-chat')
      const dialog = await openHistoryModal(page)
      const card = await expandSession(dialog, VPS_SESSION.prompt)
      await expectHistoryRowsApart(page)
      await shot(page, 'a-history-vps-card-expanded')
      const continueVps = hostButton(card, VPS_HOST)
      const continueLocal = hostButton(card, LOCAL_HOST)
      await expect.soft(continueVps, `card offers ${VPS_HOST}`).toBeVisible()
      await expect.soft(continueLocal, `card offers ${LOCAL_HOST}`).toBeVisible()
      await expect
        .soft(
          continueVps.getByRole('img', { name: `Recorded on ${VPS_HOST}` }),
          'vps is marked as recording host'
        )
        .toBeVisible()
      await continueVps.first().click()
      await expect
        .soft(sidebarRow(page, workspaces.vpsWorktreeId), 'vps workspace becomes active')
        .toHaveAttribute('aria-current', 'page', { timeout: 30_000 })
      await expect
        .soft(sidebarRow(page, workspaces.vpsWorktreeId), 'sidebar names the vps workspace')
        .toContainText(new RegExp(`${VPS_BRANCH}.*${VPS_HOST}`))
      await expect.soft(page.getByText(VPS_SESSION.reply).first()).toBeVisible({ timeout: 30_000 })
      await shot(page, 'a-vps-chat-opened')
    })

    // ── B. Mac → vps: continue a local chat on the vps ──────────────────────────────────────
    await scenario('B: continue a local chat on the vps', async () => {
      await activateWorkspace(page, workspaces.macWorktreeId)
      await openSessionFromHistory(page, MAC_SESSION.prompt)
      await expect.soft(page.getByText(MAC_SESSION.reply).first()).toBeVisible({ timeout: 30_000 })
      await shot(page, 'b-local-chat-resumed')
      const vpsBefore = (await workspacesWithHostChats(page, workspaces)).vps
      await continueFromFooter(page, VPS_HOST, (name) => shot(page, `b-${name}`))
      await expect
        .poll(async () => (await workspacesWithHostChats(page, workspaces)).vps, {
          message: 'a new chat opens under a vps workspace',
          timeout: 30_000
        })
        .toBeGreaterThan(vpsBefore)
        .catch((error) => expect.soft(error).toBeUndefined())
      const destination = await vpsWorktreeOnBranch(page, workspaces, MAC_BRANCH)
      if (destination) {
        await expect
          .soft(sidebarRow(page, destination), 'focus moves to the new vps chat')
          .toHaveAttribute('aria-current', 'page', { timeout: 15_000 })
        await expect
          .soft(sidebarRow(page, destination), 'the continued chat keeps the source name')
          .toContainText('MAC-RECORDED', { timeout: 15_000 })
      }
      await shot(page, 'b-vps-chat-continued')
      await activateWorkspace(page, workspaces.macWorktreeId)
      await expect
        .soft(page.getByText(`Continued on ${VPS_HOST}`).first(), 'source chat says where it went')
        .toBeVisible({ timeout: 15_000 })
      await expect
        .soft(page.getByRole('button', { name: new RegExp(`Open on ${VPS_HOST}`) }).first())
        .toBeVisible()
      await expandFoldedChats(page, workspaces.macWorktreeId)
      await expect
        .soft(continuedChip(page, workspaces.macWorktreeId, VPS_HOST), 'chip on the source row')
        .toBeVisible({ timeout: 15_000 })
      await shot(page, 'b-local-source-continued-on-vps')
      expect
        .soft(
          (await workspacesWithHostChats(page, workspaces)).vps,
          'one continued chat, no duplicate'
        )
        .toBe(vpsBefore + 1)
    })

    // ── C. vps → Mac: continue the vps chat locally ─────────────────────────────────────────
    await scenario('C: continue a vps chat on the local host', async () => {
      // The source is B's continuation: a live chat on the vps. (A's vps session opens as a terminal.)
      const sourceWorktreeId = await vpsWorktreeOnBranch(page, workspaces, MAC_BRANCH)
      expect(sourceWorktreeId, 'B left a chat on a vps workspace').not.toBeNull()
      await activateWorkspace(page, sourceWorktreeId!)
      await expect(composerOf(page), 'the vps chat is live').toBeVisible({ timeout: 30_000 })
      await shot(page, 'c-vps-chat-handoff-draft')
      // The hand-off leaves its prompt as a draft; sending it is what starts the vps conversation.
      await composerOf(page).click()
      await page.keyboard.press('Enter')
      await expect(page.getByText('Stub reply.').first(), 'the vps chat answered').toBeVisible({
        timeout: 60_000
      })
      await shot(page, 'c-vps-chat')
      const before = (await workspacesWithHostChats(page, workspaces)).local
      await continueFromFooter(page, LOCAL_HOST, (name) => shot(page, `c-${name}`))
      await expect
        .poll(async () => (await workspacesWithHostChats(page, workspaces)).local, {
          message: 'a new chat opens under a local workspace',
          timeout: 30_000
        })
        .toBeGreaterThan(before)
        .catch((error) => expect.soft(error).toBeUndefined())
      await shot(page, 'c-local-chat-continued')
      expect
        .soft(
          (await workspacesWithHostChats(page, workspaces)).local,
          'one continued chat, no duplicate'
        )
        .toBe(before + 1)
      await activateWorkspace(page, sourceWorktreeId!)
      await expect
        .soft(page.getByText(`Continued on ${LOCAL_HOST}`).first(), 'vps source says where it went')
        .toBeVisible({ timeout: 15_000 })
      await expandFoldedChats(page, sourceWorktreeId!)
      await expect
        .soft(continuedChip(page, sourceWorktreeId!, LOCAL_HOST), 'chip on the vps source row')
        .toBeVisible({ timeout: 15_000 })
      await shot(page, 'c-vps-source-continued-on-local')
    })

    // ── D. Narrow window: the controls stay reachable ───────────────────────────────────────
    await scenario('D: narrow window keeps History buttons and sidebar visible', async () => {
      await client!.app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0]
        win?.setMinimumSize(400, 400)
        win?.setContentSize(900, 760)
      })
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(900)
      await activateWorkspace(page, workspaces.macWorktreeId)
      await shot(page, 'd-narrow-sidebar')
      // The continued source chat has no composer; /resume needs a live one.
      await openNewClaudeChat(page)
      const dialog = await openHistoryModal(page)
      const card = await expandSession(dialog, VPS_SESSION.prompt)
      await expectHistoryRowsApart(page)
      await shot(page, 'd-narrow-history-card')
      for (const host of [VPS_HOST, LOCAL_HOST]) {
        const button = hostButton(card, host).first()
        await expect.soft(button, `narrow card shows ${host}`).toBeVisible()
        await expect.soft(button, `${host} button is inside the dialog`).toBeInViewport()
      }
      await page.keyboard.press('Escape')
    })

    // No real Claude ever ran: every chat launch went to the per-host stubs.
    testInfo.annotations.push({
      type: 'stub-launches',
      description: `local=${readStubLaunches(fixture.macStub).length} vps=${readStubLaunches(fixture.vpsStub).length}`
    })
  } finally {
    await client?.dispose().catch(() => undefined)
    await serve?.stop().catch(() => undefined)
    // Stopping serve leaves its terminal daemon running; it would outlive the run.
    await cleanupE2EDaemons(serverProfile.userDataDir).catch(() => undefined)
    killProcessesUsing(fixture.root)
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

async function addProjectOnBothHosts(
  page: Page,
  vpsEnvironmentId: string,
  fixture: CrossHostFixture
): Promise<Workspaces> {
  const ids = await page.evaluate(
    async ({ macPath, vpsPath, environmentId }) => {
      const store = window.__store!
      const local = await store
        .getState()
        .addRepoPath(macPath, 'git', { runtimeEnvironmentId: null })
      const vps = await store
        .getState()
        .addRepoPath(vpsPath, 'git', { runtimeEnvironmentId: environmentId })
      if (!local || !vps) {
        throw new Error(`Project add failed: local=${Boolean(local)} vps=${Boolean(vps)}`)
      }
      await store.getState().fetchAllWorktrees()
      return { localRepoId: local.id, vpsRepoId: vps.id }
    },
    { macPath: fixture.macCheckout, vpsPath: fixture.vpsCheckout, environmentId: vpsEnvironmentId }
  )
  const found = await page.waitForFunction(
    ({ localRepoId, vpsRepoId }) => {
      const state = window.__store!.getState()
      const mac = state.worktreesByRepo[localRepoId]?.[0]
      const vps = state.worktreesByRepo[vpsRepoId]?.[0]
      return mac && vps ? { mac: mac.id, vps: vps.id } : null
    },
    ids,
    { timeout: 60_000, polling: 250 }
  )
  const { mac, vps }: { mac: string; vps: string } = await found.jsonValue()
  // Both copies must be one project, or no host-to-host action can exist.
  await expect
    .poll(
      () =>
        page.evaluate(({ localRepoId, vpsRepoId }) => {
          const repos = window.__store!.getState().repos
          const key = (id: string) =>
            repos.find((repo) => repo.id === id)?.gitRemoteIdentity?.canonicalKey ?? null
          return key(localRepoId) !== null && key(localRepoId) === key(vpsRepoId)
        }, ids),
      { message: 'both checkouts resolve to one project identity', timeout: 30_000 }
    )
    .toBe(true)
  return { macWorktreeId: mac, vpsWorktreeId: vps, vpsEnvironmentId }
}

async function enableClaudeChat(page: Page): Promise<void> {
  await page.evaluate(async (settings) => {
    await window.__store!.getState().updateSettings(settings)
  }, CLAUDE_CHAT_SETTINGS)
}

function sidebarRow(page: Page, worktreeId: string): Locator {
  return page.locator(`[data-worktree-sidebar] [data-worktree-id="${worktreeId}"]`).first()
}

/** An expanded History card pushes the next card down instead of being drawn under it. */
async function expectHistoryRowsApart(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const rows = [...document.querySelectorAll('.ai-vault-session-row')]
            .map((row) => row.getBoundingClientRect())
            .sort((a, b) => a.top - b.top)
          return rows.every((row, i) => i === 0 || row.top >= rows[i - 1].bottom - 1)
        }),
      { message: 'History cards do not overlap', timeout: 5_000 }
    )
    .toBe(true)
    .catch((error) => expect.soft(error).toBeUndefined())
}

/** The chip is icon + host; its accessible name carries the whole sentence. */
function continuedChip(page: Page, worktreeId: string, host: string): Locator {
  return sidebarRow(page, worktreeId)
    .getByRole('button', { name: `Continued on ${host}` })
    .first()
}

/** A row with several chats folds them into "+N"; per-chat marks show once it is expanded. */
async function expandFoldedChats(page: Page, worktreeId: string): Promise<void> {
  const folded = sidebarRow(page, worktreeId).locator(
    '.compact-agent-summary-button[aria-expanded="false"]'
  )
  if (await folded.count()) {
    await folded.first().click()
  }
}

async function activateWorkspace(page: Page, worktreeId: string): Promise<void> {
  const row = sidebarRow(page, worktreeId)
  await expect(row, `sidebar lists ${worktreeId}`).toBeVisible({ timeout: 30_000 })
  await row.click()
  await expect(row).toHaveAttribute('aria-current', 'page', { timeout: 15_000 })
}

async function openNewClaudeChat(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New tab' }).first().click()
  await page
    .getByRole('menuitem', { name: /^Claude(?:\s|$)/i })
    .first()
    .click()
  await expect(composerOf(page)).toBeVisible({
    timeout: 30_000
  })
}

/** `/resume` in the active chat: the History modal. */
async function openHistoryModal(page: Page): Promise<Locator> {
  const composer = composerOf(page)
  await composer.click()
  await page.keyboard.type('/resume')
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog, 'History modal opens').toBeVisible({ timeout: 15_000 })
  return dialog
}

async function expandSession(dialog: Locator, prompt: string): Promise<Locator> {
  const card = dialog.locator('.group\\/session-row', { hasText: prompt }).first()
  await expect(card, `History lists "${prompt}"`).toBeVisible({ timeout: 60_000 })
  await card.getByTestId('ai-vault-session-toggle-details').click()
  return card
}

function hostButton(card: Locator, host: string): Locator {
  // The recording host's button also carries a "Recorded on <host>" dot in its accessible name.
  return card.getByRole('button', { name: new RegExp(`^Continue on ${host}(\\s|$)`) })
}

async function openSessionFromHistory(page: Page, prompt: string): Promise<void> {
  await openNewClaudeChat(page)
  const dialog = await openHistoryModal(page)
  const card = await expandSession(dialog, prompt)
  await card
    .locator('[data-host-action="resume"], [data-testid="ai-vault-session-resume"]')
    .first()
    .click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** The composer footer's host menu, then the hand-off dialog's confirm when one opens. */
async function continueFromFooter(
  page: Page,
  host: string,
  shot: (name: string) => Promise<unknown>
): Promise<void> {
  await page.getByRole('button', { name: 'Continue on another host' }).last().click()
  const item = page.getByRole('menuitem', { name: new RegExp(`Continue on ${host}`) }).first()
  await expect(item, `footer offers Continue on ${host}`).toBeVisible()
  await shot('footer-host-menu')
  await item.click()
  const dialog = page.getByRole('dialog', { name: new RegExp(`Continue on ${host}`) })
  await expect(dialog, 'hand-off dialog opens').toBeVisible({ timeout: 10_000 })
  await shot('handoff-dialog')
  // Another branch on the destination: the dialog creates that host's workspace first.
  const create = dialog.getByRole('button', { name: new RegExp(`^Create workspace on ${host}`) })
  if (await create.isVisible()) {
    await create.click()
    await shot('handoff-workspace-created')
  }
  const start = dialog.getByRole('button', { name: 'Start session' })
  await expect(start, 'Start session enables').toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
}

/** Chat tabs summed over each host's workspaces (a new workspace's default terminal is not a chat). */
async function workspacesWithHostChats(
  page: Page,
  workspaces: Workspaces
): Promise<{ local: number; vps: number }> {
  return page.evaluate(({ vpsEnvironmentId }) => {
    const state = window.__store!.getState()
    const runtimeHost = `runtime:${encodeURIComponent(vpsEnvironmentId)}`
    const hostOfRepo = new Map(
      state.repos.map((repo) => [repo.id, repo.executionHostId ?? 'local'] as const)
    )
    const counts = { local: 0, vps: 0 }
    for (const [repoId, worktrees] of Object.entries(state.worktreesByRepo)) {
      const bucket = hostOfRepo.get(repoId) === runtimeHost ? 'vps' : 'local'
      for (const worktree of worktrees ?? []) {
        counts[bucket] += (state.unifiedTabsByWorktree[worktree.id] ?? []).filter(
          (tab) => tab.contentType === 'agent-session'
        ).length
      }
    }
    return counts
  }, workspaces)
}

/** The chat composer: a rich-text textbox named after its placeholder. */
function composerOf(page: Page): Locator {
  return page
    .getByRole('textbox', { name: /^Ask anything/ })
    .locator('visible=true')
    .first()
}

/** The vps workspace of the project on `branch`, e.g. the one a hand-off created. */
async function vpsWorktreeOnBranch(
  page: Page,
  workspaces: Workspaces,
  branch: string
): Promise<string | null> {
  return page.evaluate(
    ({ vpsEnvironmentId, branch }) => {
      const state = window.__store!.getState()
      const runtimeHost = `runtime:${encodeURIComponent(vpsEnvironmentId)}`
      for (const repo of state.repos) {
        if (repo.executionHostId !== runtimeHost) {
          continue
        }
        const match = (state.worktreesByRepo[repo.id] ?? []).find((worktree) =>
          worktree.branch.endsWith(branch)
        )
        if (match) {
          return match.id
        }
      }
      return null
    },
    { vpsEnvironmentId: workspaces.vpsEnvironmentId, branch }
  )
}
