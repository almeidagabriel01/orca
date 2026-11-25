// Fixtures' stand-in for a host whose accounts carry nicknames, for the account-name screens.
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../shared/agent-accounts/managed-account-types'

const stamp = { createdAt: 0, updatedAt: 0, lastAuthenticatedAt: 0 }

/** The computer's own login ("ProOps") is the default; the saved account is called "Beyond". */
export const namedClaudeAccounts: ClaudeRateLimitAccountsState = {
  accounts: [
    {
      id: 'claude-gabriel',
      email: 'gabriel.almeida@example.com',
      displayName: 'Beyond',
      authMethod: 'subscription-oauth',
      ...stamp
    }
  ],
  activeAccountId: null,
  systemDefaultEmail: 'gestao@example.com',
  systemDefaultDisplayName: 'ProOps'
}

/** The computer's own login ("Pessoal") is the default; the saved account is called "Ops". */
export const namedCodexAccounts: CodexRateLimitAccountsState = {
  accounts: [
    {
      id: 'codex-ops',
      email: 'ops@example.com',
      displayName: 'Ops',
      managedHomeRuntime: 'host',
      ...stamp
    }
  ],
  activeAccountId: null,
  systemDefault: {
    hasAuth: true,
    authKind: 'oauth',
    email: 'dev@example.com',
    providerAccountId: null,
    workspaceLabel: null
  },
  systemDefaultDisplayName: 'Pessoal'
}
