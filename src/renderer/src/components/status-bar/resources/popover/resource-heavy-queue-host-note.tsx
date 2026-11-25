import React, { createContext, useContext } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import { heavyJobBlockersText } from './resource-heavy-job-move'
import { useHeavyJobRouteNote } from './resource-heavy-job-route'

/** Queue hostname -> the card label, so moved rows name hosts the way the cards do. */
export const HostLabelByHostnameContext = createContext<ReadonlyMap<string, string>>(new Map())

/** Where a job went, came from, or why the "Run on" preference left it here; wraps, never hover-only. */
export function QueueRowHostNote({
  hostId,
  hostLabel,
  job
}: {
  hostId: string
  hostLabel: string
  job: HeavyCommandJob
}): React.JSX.Element | null {
  const t = useTranslate()
  const route = useHeavyJobRouteNote(hostId, job)
  const labels = useContext(HostLabelByHostnameContext)
  const text =
    job.status === 'moved'
      ? t('resourceManager.heavyQueue.movedTo', '→ running on {{value0}}', {
          value0:
            (job.movedTo?.hostname && labels.get(job.movedTo.hostname)) ??
            job.movedTo?.peer ??
            t('resourceManager.heavyQueue.otherHost', 'another host')
        })
      : job.movedFrom
        ? t('resourceManager.heavyQueue.movedFrom', 'from {{value0}}', {
            value0: labels.get(job.movedFrom) ?? job.movedFrom
          })
        : route && job.status === 'waiting'
          ? t(
              'resourceManager.heavyQueue.routeStays',
              'Stays on {{value0}}; {{value1}} can’t run it: {{value2}}',
              {
                value0: hostLabel,
                value1: route.targetLabel,
                value2: heavyJobBlockersText(route.blockers, t)
              }
            )
          : null
  if (!text) {
    return null
  }
  return (
    <p data-queue-host-note className="pl-[1.125rem] text-2xs break-words text-muted-foreground">
      {text}
    </p>
  )
}
