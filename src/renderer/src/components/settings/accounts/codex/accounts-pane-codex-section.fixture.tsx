import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { AccountsPaneSectionModel } from '../accounts-pane-types'
import { renderCodexAccountsSection } from './accounts-pane-codex-section'

const BASE = {
  accountRuntime: { runtime: 'host', label: 'This device' },
  accountRuntimeSentenceLabel: 'this device',
  accountRuntimeUnavailable: false,
  activeCodexAccountId: null,
  codexAction: 'idle',
  codexConfigSync: null,
  codexConfigSyncWarning: null,
  isRemoteAccountScope: false,
  remoteAccountScopeNotice: null,
  runCodexAccountAction: async () => {},
  accountOwner: { kind: 'local' },
  systemCodexActive: true,
  systemCodexIdentity: undefined,
  visibleCodexAccounts: [],
  wslCapabilitiesLoading: false,
  codexCliMissing: false,
  refreshCodexDetection: async () => []
}

function section(model: object): () => React.JSX.Element {
  return () => (
    <div className="bg-background p-5">
      {renderCodexAccountsSection(
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the Codex section reads only these fields when it lists no managed accounts.
        { ...BASE, ...model } as unknown as AccountsPaneSectionModel
      )}
    </div>
  )
}

/** CLI on this host and signed in. */
export const signedIn = defineFixture({
  width: 760,
  render: section({
    activeCodexAuthWarning: null,
    systemCodexMissingSignIn: false,
    systemCodexNeedsSignIn: false,
    systemCodexIdentity: { email: 'dev@example.com', authKind: 'chatgpt' }
  })
})

/** CLI on this host, no login: the one case that is an error. */
export const installedNoSignIn = defineFixture({
  width: 760,
  render: section({
    activeCodexAuthWarning: 'missing-sign-in',
    systemCodexMissingSignIn: true,
    systemCodexNeedsSignIn: true
  })
})

/** No Codex CLI on this host: neutral, not a sign-in error. */
export const notInstalled = defineFixture({
  width: 760,
  render: section({
    activeCodexAuthWarning: null,
    systemCodexMissingSignIn: false,
    systemCodexNeedsSignIn: false,
    codexCliMissing: true
  })
})
