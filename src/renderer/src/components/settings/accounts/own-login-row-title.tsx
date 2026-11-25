import type { Translate } from '@/i18n/use-translate'
import { Badge } from '../../ui/badge'

const ROW_BADGE_CLASS =
  'h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none text-foreground/80'

/** The host's own login row: its name (never "System default"), a Default badge, and Active. */
export function OwnLoginRowTitle({
  name,
  active,
  t,
  children
}: {
  name: string | undefined
  active: boolean
  t: Translate
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-medium">
        {name ?? t('accounts.ownLogin', "This computer's login")}
      </span>
      <Badge variant="outline" className={ROW_BADGE_CLASS}>
        {t('accounts.defaultBadge', 'default')}
      </Badge>
      {active ? (
        <Badge variant="outline" className={ROW_BADGE_CLASS}>
          {t('auto.components.settings.AccountsPane.e74831fb6b', 'Active')}
        </Badge>
      ) : null}
      {children}
    </div>
  )
}
