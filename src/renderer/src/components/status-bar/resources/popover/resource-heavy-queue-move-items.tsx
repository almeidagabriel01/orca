import React, { createContext, useContext, useEffect, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import {
  checkHeavyJobMove,
  heavyJobBlockersText,
  type HeavyJobMoveCheckResult,
  type HeavyJobMovePlan,
  type HeavyMoveHost
} from './resource-heavy-job-move'
import { QueueMenuItem } from './resource-heavy-queue-row-menu-item'

/** The check the menu runs on open; fixtures swap it for a canned answer. */
export const HeavyJobMoveCheckContext = createContext(checkHeavyJobMove)

export type HeavyJobMoveRequest = (target: HeavyMoveHost, plan: HeavyJobMovePlan) => void

/** "Run on <host>" per other host; mounted only while the menu is open, so it checks once per opening. */
export function RunOnHostItems({
  source,
  targets,
  job,
  onMove
}: {
  source: HeavyMoveHost
  targets: readonly HeavyMoveHost[]
  job: HeavyCommandJob
  onMove: HeavyJobMoveRequest
}): React.JSX.Element {
  const t = useTranslate()
  const check = useContext(HeavyJobMoveCheckContext)
  // Why frozen: the queue re-polls while the menu is open; the check answers for the job as opened.
  const [opened] = useState(() => ({ source, targets, job }))
  const [results, setResults] = useState<Record<string, HeavyJobMoveCheckResult>>({})
  useEffect(() => {
    let live = true
    for (const target of opened.targets) {
      void check(opened.source, target, opened.job).then((result) => {
        if (live) {
          setResults((prev) => ({ ...prev, [target.id]: result }))
        }
      })
    }
    return () => {
      live = false
    }
  }, [check, opened])
  return (
    <>
      {opened.targets.map((target) => {
        const result = results[target.id]
        const reason = !result
          ? t('resourceManager.heavyQueue.moveChecking', 'Checking that host…')
          : result.ok
            ? null
            : heavyJobBlockersText(result.blockers, t)
        return (
          <QueueMenuItem
            key={target.id}
            icon={ArrowRightLeft}
            label={t('resourceManager.heavyQueue.runOn', 'Run on {{value0}}', {
              value0: target.label
            })}
            reason={reason}
            onSelect={() => result?.ok && onMove(target, result.plan)}
          />
        )
      })}
    </>
  )
}
