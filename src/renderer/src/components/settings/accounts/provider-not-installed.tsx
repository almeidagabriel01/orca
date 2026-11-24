import { ExternalLink, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { openAppHttpLinkFromAnchor } from '@/lib/browser/navigation/app-http-link-open'
import { useDetectedAgents } from '@/lib/agent-session/launch/inventory/useDetectedAgents'
import { agentCliInstalled } from '../../../lib/provider-accounts/provider-cli-presence'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import { Button } from '../../ui/button'
import { SettingsGroup } from '../section-layout/SettingsGroup'

export type AgentCliPresence = {
  /** True/false from the host's inventory; null while it loads. */
  installed: (agent: TuiAgent) => boolean | null
  refresh: () => Promise<unknown>
}

/** The shown host's agent inventory, the same one Settings > Agents lists. */
export function useAgentCliPresence(
  owner: RuntimeClientTarget,
  runtime: 'host' | 'wsl' = 'host'
): AgentCliPresence {
  const environmentId = owner.kind === 'environment' ? owner.environmentId : null
  const detection = useDetectedAgents(
    environmentId ? { kind: 'runtime', environmentId } : { kind: 'local' },
    'all'
  )
  return {
    // ponytail: the host inventory cannot speak for a WSL distro, so WSL keeps each section as is.
    installed: (agent) =>
      runtime === 'wsl'
        ? true
        : agentCliInstalled(detection.detectedIds, detection.detectionFailed, agent),
    refresh: detection.refresh
  }
}

/** Neutral, collapsed body for a host without this CLI: absence is not a sign-in error. */
export function ProviderNotInstalledNotice({
  agent,
  hostLabel,
  onCheckAgain
}: {
  agent: TuiAgent
  hostLabel: string | null
  onCheckAgain: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const entry = getAgentCatalog().find((candidate) => candidate.id === agent)
  const name = entry?.label ?? agent
  const host = hostLabel ?? t('accounts.cliNotInstalled.thisHost', 'this host')
  return (
    <div className="my-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-border/70 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm text-foreground/90">
          {t('accounts.cliNotInstalled.title', '{{name}} is not installed on {{host}}.', {
            name,
            host
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            'accounts.cliNotInstalled.hint',
            'Install the {{name}} CLI there to sign in and add accounts.',
            { name }
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="xs" onClick={onCheckAgain}>
          <RefreshCw className="size-3" />
          {t('accounts.cliNotInstalled.checkAgain', 'Check again')}
        </Button>
        {entry?.homepageUrl ? (
          <Button variant="outline" size="xs" asChild>
            <a
              href={entry.homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openAppHttpLinkFromAnchor}
            >
              {t('accounts.cliNotInstalled.howTo', 'How to install')}
              <ExternalLink className="size-3" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** A provider section collapsed to its title and the not-installed notice. */
export function ProviderNotInstalledSection({
  id,
  title,
  agent,
  hostLabel,
  onCheckAgain
}: {
  id?: string
  title: ReactNode
  agent: TuiAgent
  hostLabel: string | null
  onCheckAgain: () => void
}): React.JSX.Element {
  return (
    <div id={id} className="scroll-mt-6">
      <SettingsGroup title={title}>
        <ProviderNotInstalledNotice
          agent={agent}
          hostLabel={hostLabel}
          onCheckAgain={onCheckAgain}
        />
      </SettingsGroup>
    </div>
  )
}
