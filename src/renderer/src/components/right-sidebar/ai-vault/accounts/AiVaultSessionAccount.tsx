import type React from 'react'
import { UserRound } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { SessionReceiptSection } from '../session-list/AiVaultSessionReceiptSection'

export function SessionAccountSection({
  accountLabel
}: {
  accountLabel: string | null
}): React.JSX.Element | null {
  const t = useTranslate()
  // An account Orca cannot name is left out rather than shown as Unknown.
  if (!accountLabel) {
    return null
  }
  return (
    <SessionReceiptSection
      icon={<UserRound className="size-3" />}
      label={t('aiVault.sessionAccount', 'Account')}
    >
      <div className="select-text text-[12px] font-medium leading-4 text-foreground [overflow-wrap:anywhere]">
        {accountLabel}
      </div>
    </SessionReceiptSection>
  )
}
