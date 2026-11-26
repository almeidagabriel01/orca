import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'

/** Stop all, for a provider that can only stop everything at once: in the open panel's header. */
export function WorkerDockStopAll({
  stopAll
}: {
  stopAll?: { pending: boolean; onStop: () => void }
}) {
  const t = useTranslate()
  return stopAll ? (
    <Button
      variant="ghost"
      size="xs"
      aria-disabled={stopAll.pending}
      onClick={() => {
        if (!stopAll.pending) {
          stopAll.onStop()
        }
      }}
    >
      {stopAll.pending
        ? t('components.native-chat.workerDock.stopping', 'Stopping…')
        : t('components.native-chat.workerDock.stopAll', 'Stop all')}
    </Button>
  ) : null
}

/** The panel's bulk action, drawn only when it applies: Dismiss once two or more ended rows can be
 *  hidden or acknowledged. */
export function WorkerDockCardFooter({
  clearable,
  clearing,
  onClearAll
}: {
  clearable: number
  clearing: boolean
  onClearAll: () => void
}) {
  const t = useTranslate()
  if (clearable < 2) {
    return null
  }
  return (
    <div
      data-worker-dock-footer=""
      className="mt-1 flex items-center justify-end gap-1 border-t border-border px-1 pt-1"
    >
      <Button
        variant="ghost"
        size="xs"
        aria-disabled={clearing}
        onClick={() => {
          if (!clearing) {
            onClearAll()
          }
        }}
      >
        {t('components.native-chat.workerDock.dismiss', 'Dismiss')}
      </Button>
    </div>
  )
}
