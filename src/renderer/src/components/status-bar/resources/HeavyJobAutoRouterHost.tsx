import { Suspense } from 'react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { useAppStore } from '@/store'
import { hasRunHostPreference } from '../../../../../shared/execution-host/project-run-host-preference'

const HeavyJobAutoRouter = lazyWithRetry(() =>
  import('./HeavyJobAutoRouter').then((module) => ({ default: module.HeavyJobAutoRouter }))
)

/** Loads and runs the heavy-job router only while a "Run on" preference is saved. */
export function HeavyJobAutoRouterHost(): React.JSX.Element | null {
  const enabled = useAppStore((s) => hasRunHostPreference(s.settings))
  return enabled ? (
    <Suspense fallback={null}>
      <HeavyJobAutoRouter />
    </Suspense>
  ) : null
}
