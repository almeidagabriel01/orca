import { useRef, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import {
  getAccountDisplayName,
  MANAGED_ACCOUNT_DISPLAY_NAME_MAX_LENGTH
} from '../../../../../shared/agent-accounts/managed-account-display-names'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import type { AccountsPaneSectionModel, RenameAccountTarget } from './accounts-pane-types'
import { accountNameToSave, renamingAccountKey } from './account-rename-runner'

// Names never touch the sign-in, so signed-out and busy accounts stay renameable.
export function AccountRenameButton({
  disabled,
  pending,
  onRename,
  t = translate
}: {
  disabled?: boolean
  pending: boolean
  onRename: () => void
  t?: Translate
}): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={(event) => {
        event.stopPropagation()
        onRename()
      }}
      disabled={disabled || pending}
      aria-label={t('accounts.rename.action', 'Rename')}
      title={t('accounts.rename.action', 'Rename')}
      className="h-6 px-2 text-muted-foreground hover:text-foreground"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Pencil className="size-3" />}
    </Button>
  )
}

/** Enter or blur saves, Escape cancels; `onDone(null)` means nothing to save. */
export function AccountNameInput({
  saved,
  placeholder,
  onDone,
  t = translate
}: {
  saved: string | null | undefined
  placeholder?: string
  onDone: (name: string | null) => void
  t?: Translate
}): React.JSX.Element {
  const [draft, setDraft] = useState(saved ?? '')
  // Enter or Escape unmounts the input, and that blur must not save a second time.
  const finished = useRef(false)
  const finish = (save: boolean): void => {
    if (finished.current) {
      return
    }
    finished.current = true
    onDone(save ? accountNameToSave(draft, saved) : null)
  }
  return (
    // The name's slot; -my-1 absorbs the compact input's extra height so the card does not grow.
    <div className="-my-1 w-40 max-w-full min-w-0 font-medium">
      <Input
        density="compact"
        autoFocus
        value={draft}
        maxLength={MANAGED_ACCOUNT_DISPLAY_NAME_MAX_LENGTH}
        placeholder={placeholder}
        aria-label={t('accounts.rename.label', 'Display name')}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          event.stopPropagation()
          // An IME's Enter commits a candidate; it must not save a half-typed name.
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            finish(true)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            finish(false)
          }
        }}
      />
    </div>
  )
}

/** The row's selectable area; a div while its name is edited, since an input cannot live in a button. */
export function AccountSelectArea({
  editing,
  onSelect,
  disabled,
  children
}: {
  editing: boolean
  onSelect: () => void
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const className = 'flex min-w-0 flex-1 flex-col gap-0.5 text-left disabled:cursor-default'
  return editing ? (
    <div className={className}>{children}</div>
  ) : (
    <button type="button" onClick={onSelect} disabled={disabled} className={className}>
      {children}
    </button>
  )
}

/** The Claude/Codex name editor; blank clears the name back to the email's local part. */
export function renderAccountNameInput(
  model: AccountsPaneSectionModel,
  target: RenameAccountTarget,
  account: { displayName?: string | null; email?: string | null },
  t: Translate = translate
): React.JSX.Element {
  return (
    <AccountNameInput
      t={t}
      saved={account.displayName}
      placeholder={getAccountDisplayName({ email: account.email })}
      onDone={(name) => {
        model.setEditingNameKey(null)
        if (name !== null) {
          void model.renameAccount(target, name)
        }
      }}
    />
  )
}

export function isEditingAccountName(
  model: AccountsPaneSectionModel,
  target: RenameAccountTarget
): boolean {
  return model.editingNameKey === renamingAccountKey(target)
}
