import { useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useTranslate } from '@/i18n/use-translate'
import { structuredAgentLabel } from '@/lib/agent-session/launch/structured-agent-session-launch-label'
import { cn } from '@/lib/class-names'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import type { AgentSessionAgentSwitchMark } from '../../../../../../shared/agent-session/conversation-context/agent-session-agent-switch'
import { NativeChatCopyButton } from '../actions/NativeChatCopyButton'

/** The rule where a chat moved to another agent or account; opens to what the new one was handed. */
export function NativeChatAgentSwitchRow({
  mark
}: {
  mark: AgentSessionAgentSwitchMark
}): React.JSX.Element {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const toAgent = structuredAgentLabel(mark.toAgent)
  const fromAgent = structuredAgentLabel(mark.fromAgent)
  const label =
    mark.kind === 'account'
      ? mark.toAccountLabel
        ? t(
            'components.native-chat.agentSwitch.accountSwitched',
            'Account switched to {{account}}',
            {
              account: mark.toAccountLabel
            }
          )
        : t('components.native-chat.agentSwitch.accountSwitchedUnnamed', 'Account switched')
      : mark.toAccountLabel
        ? t(
            'components.native-chat.agentSwitch.continuedWith',
            'Continued with {{agent}} · {{account}}',
            {
              agent: toAgent,
              account: mark.toAccountLabel
            }
          )
        : t('components.native-chat.agentSwitch.continuedWithAgent', 'Continued with {{agent}}', {
            agent: toAgent
          })
  const from = mark.fromAccountLabel ? `${fromAgent} · ${mark.fromAccountLabel}` : fromAgent
  return (
    <div className="py-2 text-xs text-chat-foreground-faint">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((shown) => !shown)}
          className="inline-flex min-w-0 max-w-[80%] items-center gap-1.5 rounded-full border border-border bg-foreground/5 px-2.5 py-1 text-xs hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 shrink-0 transition-transform motion-reduce:transition-none',
              open ? 'rotate-90' : 'rtl:rotate-180'
            )}
          />
          <AgentIcon
            agent={isTuiAgent(mark.toAgent) ? mark.toAgent : null}
            size={14}
            className="shrink-0"
          />
          <span className="min-w-0 truncate text-chat-foreground">{label}</span>
        </button>
        <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
      </div>
      <div
        id={bodyId}
        hidden={!open}
        className="mx-auto mt-2 max-w-[80%] space-y-3 rounded-md border border-border bg-muted/20 p-3"
      >
        <p className="text-chat-foreground">
          {t('components.native-chat.agentSwitch.from', 'From {{from}}', { from })}
        </p>
        {mark.handoff?.excerpt ? (
          <div className="space-y-1">
            <div>
              {t(
                'components.native-chat.agentSwitch.handedContext',
                'Context passed to the new agent'
              )}
            </div>
            <pre
              tabIndex={0}
              aria-label={t(
                'components.native-chat.agentSwitch.handedContext',
                'Context passed to the new agent'
              )}
              className="scrollbar-sleek max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-chat-code-surface p-2 font-mono text-chat-code text-chat-foreground"
            >
              {mark.handoff.excerpt}
            </pre>
          </div>
        ) : null}
        {mark.handoff?.transcriptPath ? (
          <div className="space-y-1">
            <div>{t('components.native-chat.agentSwitch.savedTranscript', 'Saved transcript')}</div>
            <div className="flex items-center gap-1">
              <code className="min-w-0 flex-1 truncate font-mono text-chat-code text-chat-foreground">
                {mark.handoff.transcriptPath}
              </code>
              <NativeChatCopyButton
                text={mark.handoff.transcriptPath}
                label={t('components.native-chat.agentSwitch.copyPath', 'Copy path')}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
