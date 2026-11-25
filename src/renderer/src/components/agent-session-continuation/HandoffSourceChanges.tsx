import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogError } from '@/components/ui/dialog-parts'
import { Input } from '@/components/ui/input'
import { useTranslate } from '@/i18n/use-translate'

const KEY = 'components.agentSessionContinuation.sourceChanges'

export type HandoffSourceChangesState =
  | { kind: 'checking' }
  | { kind: 'clean'; branch: string }
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'dirty'
      uncommitted: number
      unpushed: number
      branch: string
      hasUpstream: boolean
    }

/** What the other environment would miss: the source workspace's unsaved and unpushed work. */
export function HandoffSourceChanges({
  state,
  message,
  onMessageChange,
  onCommitAndPush,
  running,
  error,
  hostLabel
}: {
  state: HandoffSourceChangesState
  message: string
  onMessageChange: (value: string) => void
  onCommitAndPush: () => void
  running: boolean
  error: string | null
  hostLabel: string
}): React.JSX.Element {
  const t = useTranslate()
  const inputId = useId()
  if (state.kind === 'checking') {
    return (
      <p className="text-xs text-muted-foreground">
        {t(`${KEY}.checking`, 'Checking changes in {{host}}…', {
          host: hostLabel
        })}
      </p>
    )
  }
  if (state.kind === 'clean') {
    return (
      <p className="text-xs text-muted-foreground">
        {t(`${KEY}.clean`, 'Everything on {{branch}} is pushed.', {
          branch: state.branch
        })}
      </p>
    )
  }
  if (state.kind === 'unavailable') {
    return <p className="text-xs break-words text-status-warning-text">{state.reason}</p>
  }
  const { uncommitted, unpushed, branch } = state
  const files = t(`${KEY}.uncommittedFiles`, '{{count}} uncommitted files', {
    count: uncommitted,
    defaultValue_one: '{{count}} uncommitted file'
  })
  const commits = t(`${KEY}.unpushedCommits`, '{{count}} commits not pushed', {
    count: unpushed,
    defaultValue_one: '{{count}} commit not pushed'
  })
  const changes =
    uncommitted > 0 && unpushed > 0
      ? t(`${KEY}.and`, '{{first}} and {{second}}', {
          first: files,
          second: commits
        })
      : uncommitted > 0
        ? files
        : commits
  const sentence = `${t(`${KEY}.summary`, '{{host}} has {{changes}} on {{branch}}.', {
    host: hostLabel,
    changes,
    branch
  })} ${t(`${KEY}.onlyPushed`, 'The other environment only sees what is pushed.')}`
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-xs break-words text-status-warning-text">{sentence}</p>
      {uncommitted > 0 ? (
        <div className="grid gap-1.5">
          <label htmlFor={inputId} className="text-[13px] font-medium">
            {t(`${KEY}.messageLabel`, 'Commit message')}
          </label>
          <Input
            id={inputId}
            value={message}
            disabled={running}
            onChange={(event) => onMessageChange(event.target.value)}
          />
        </div>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={running || (uncommitted > 0 && message.trim() === '')}
          onClick={onCommitAndPush}
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {uncommitted > 0 ? t(`${KEY}.commitAndPush`, 'Commit & push') : t(`${KEY}.push`, 'Push')}
        </Button>
      </div>
      {error ? <DialogError>{error}</DialogError> : null}
    </div>
  )
}

/** Why Start waits: the other host only sees what is pushed. */
export function HandoffStartReason({ host }: { host: string }): React.JSX.Element {
  const t = useTranslate()
  return (
    <p className="text-xs text-muted-foreground">
      {t(
        'components.agentSessionContinuation.environment.startBlocked',
        '{{action}} first to start on {{host}}.',
        {
          action: t(
            'components.agentSessionContinuation.sourceChanges.commitAndPush',
            'Commit & push'
          ),
          host
        }
      )}
    </p>
  )
}
