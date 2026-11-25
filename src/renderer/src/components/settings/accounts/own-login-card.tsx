import type { Translate } from '@/i18n/use-translate'
import type { AccountsPaneSectionModel, RenameAccountTarget } from './accounts-pane-types'
import {
  AccountRenameButton,
  AccountSelectArea,
  isEditingAccountName,
  renderAccountNameInput
} from './account-name-field'
import { renamingAccountKey } from './account-rename-runner'
import { OwnLoginRowTitle } from './own-login-row-title'

/** The host login's card: name (or its editor), badges and detail line, with the pencil inside. */
export function OwnLoginCard({
  model,
  target,
  account,
  name,
  active,
  cardClassName,
  disabled,
  canRename,
  onSelect,
  badges,
  detail,
  t
}: {
  model: AccountsPaneSectionModel
  target: RenameAccountTarget
  account: { displayName?: string | null; email?: string | null }
  name: string | undefined
  active: boolean
  cardClassName: string
  disabled: boolean
  canRename: boolean
  onSelect: () => void
  badges?: React.ReactNode
  detail: React.ReactNode
  t: Translate
}): React.JSX.Element {
  const editing = isEditingAccountName(model, target)
  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${cardClassName}`}
    >
      <AccountSelectArea editing={editing} onSelect={onSelect} disabled={disabled}>
        <OwnLoginRowTitle
          name={name}
          active={active}
          t={t}
          nameSlot={editing ? renderAccountNameInput(model, target, account, t) : undefined}
        >
          {badges}
        </OwnLoginRowTitle>
        {detail}
      </AccountSelectArea>
      {canRename ? (
        <AccountRenameButton
          t={t}
          pending={model.renamingAccountKeys.has(renamingAccountKey(target))}
          onRename={() => model.setEditingNameKey(renamingAccountKey(target))}
        />
      ) : null}
    </div>
  )
}
