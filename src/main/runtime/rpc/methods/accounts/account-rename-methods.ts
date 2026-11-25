import {
  MergeAccountNamesParams,
  RenameAccountParams,
  SetAccountNameParams
} from '../../../../../shared/rpc-contract/accounts/accounts-params'
import type { AccountNames } from '../../../../../shared/agent-accounts/account-names'
import {
  mergeStoredAccountNames,
  setStoredAccountName,
  type AccountNamesStore
} from '../../../../agent-accounts/stored-account-names'
import { defineMethod, type RpcContext } from '../../core'

function namesStore({ runtime }: RpcContext): AccountNamesStore {
  const store = runtime.requireStore()
  if (!store.updateSettings) {
    throw new Error('This host cannot save account names.')
  }
  return {
    getSettings: () => store.getSettings(),
    updateSettings: (patch, options) => store.updateSettings?.(patch, options)
  }
}

// Separate methods so hosts older than account names answer method_not_found, not a wrong write.
export const ACCOUNT_RENAME_METHODS = [
  defineMethod({
    name: 'accounts.renameClaude',
    permission: 'accounts-admin',
    params: RenameAccountParams,
    handler: async (params, { runtime }) =>
      runtime.renameManagedAccount('claude', params.accountId, params.displayName)
  }),
  defineMethod({
    name: 'accounts.renameCodex',
    permission: 'accounts-admin',
    params: RenameAccountParams,
    handler: async (params, { runtime }) =>
      runtime.renameManagedAccount('codex', params.accountId, params.displayName)
  }),
  // Any provider whose login has an email (Antigravity and others without saved-account names).
  defineMethod({
    name: 'accounts.setName',
    permission: 'accounts-admin',
    params: SetAccountNameParams,
    handler: async (params, ctx): Promise<{ accountNames: AccountNames }> => {
      const store = namesStore(ctx)
      const identity = { email: params.email, organization: params.organization }
      if (setStoredAccountName(store, params.provider, identity, params.name)) {
        ctx.runtime.notifyAccountNamesChanged()
      }
      return { accountNames: store.getSettings().accountNames ?? {} }
    }
  }),
  // Names are global: clients carry each host's names to the others, newest entry winning.
  defineMethod({
    name: 'accounts.getNames',
    permission: 'workspace',
    params: null,
    handler: async (_, { runtime }): Promise<{ accountNames: AccountNames }> => ({
      accountNames: runtime.requireStore().getSettings().accountNames ?? {}
    })
  }),
  defineMethod({
    name: 'accounts.mergeNames',
    permission: 'accounts-admin',
    params: MergeAccountNamesParams,
    handler: async (params, ctx): Promise<{ accountNames: AccountNames }> => {
      const store = namesStore(ctx)
      if (mergeStoredAccountNames(store, params.names)) {
        ctx.runtime.notifyAccountNamesChanged()
      }
      return { accountNames: store.getSettings().accountNames ?? {} }
    }
  })
]
