import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import type { SessionProcessTree } from '../../../../../../shared/diagnostics/process-stats-types'
import { hasErrorCode } from '../../host-connections/runtime-host-resources'
import { RESOURCE_POLL_MS } from '../use-resource-memory-snapshot'
import { MetricPair, ROW_TRAILING_GUTTER_CLS } from './resource-usage-metrics'
import {
  buildProcessForest,
  formatElapsed,
  groupSiblings,
  processLabel,
  relativeCwd,
  type ProcessNode
} from './resource-session-processes'

const FIRST_INDENT_PX = 44
// A narrow popover indents less and drops cwd and age, so the command keeps some width.
const TREE_ROW_INDENT_CLS =
  '[--proc-indent:20px] [--proc-step:8px] @sm/proctree:[--proc-indent:44px] @sm/proctree:[--proc-step:12px]'
const WIDE_ONLY_CLS = 'hidden @sm/proctree:block'

type TreeState =
  | { status: 'loading' | 'gone' | 'update-required' | 'failed' }
  | { status: 'ready'; tree: SessionProcessTree }

function readProcessTree(
  sessionId: string,
  environmentId: string | undefined
): Promise<SessionProcessTree | null> {
  return environmentId
    ? callRuntimeRpc<SessionProcessTree | null>(
        { kind: 'environment', environmentId },
        'diagnostics.processTree',
        { sessionId },
        { timeoutMs: 5_000 }
      )
    : window.api.memory.getProcessTree(sessionId, { resourceManagerView: true })
}

/** Re-read on the panel's own interval, only while this session is expanded. */
function useSessionProcessTree(sessionId: string, environmentId: string | undefined): TreeState {
  const [state, setState] = useState<TreeState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    let inFlight = false
    const poll = (): void => {
      if (inFlight) {
        return
      }
      inFlight = true
      void readProcessTree(sessionId, environmentId)
        .then(
          (tree) => !cancelled && setState(tree ? { status: 'ready', tree } : { status: 'gone' }),
          (error: unknown) =>
            !cancelled &&
            setState((prev) =>
              hasErrorCode(error, 'method_not_found')
                ? { status: 'update-required' }
                : prev.status === 'ready'
                  ? prev
                  : { status: 'failed' }
            )
        )
        .finally(() => {
          inFlight = false
        })
    }
    poll()
    const stop = installWindowVisibilityInterval({ run: poll, intervalMs: RESOURCE_POLL_MS })
    return () => {
      cancelled = true
      stop()
    }
  }, [sessionId, environmentId])
  return state
}

export function ProcessTreeToggle({
  expanded,
  onToggle,
  className = ''
}: {
  expanded: boolean
  onToggle: () => void
  className?: string
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      aria-expanded={expanded}
      aria-label={
        expanded
          ? t('resourceManager.sessionProcesses.hide', 'Hide processes')
          : t('resourceManager.sessionProcesses.show', 'Show processes')
      }
      className={`shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground ${className}`}
    >
      {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
    </button>
  )
}

function CopyCommand({ command }: { command: string }): React.JSX.Element {
  const t = useTranslate()
  return (
    <button
      type="button"
      onClick={() => void window.api.ui.writeClipboardText(command)}
      aria-label={t('resourceManager.sessionProcesses.copy', 'Copy command')}
      className="shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground can-hover:opacity-0 group-hover/procrow:opacity-100 focus-visible:opacity-100"
    >
      <Copy className="size-3" />
    </button>
  )
}

function TreeRow({
  depth,
  toggle,
  children
}: {
  depth: number
  toggle: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={`group/procrow flex items-center gap-1.5 py-1 pr-3 ${TREE_ROW_INDENT_CLS}`}
      style={{ paddingLeft: `calc(var(--proc-indent) + ${depth} * var(--proc-step))` }}
    >
      {toggle ?? <span className="w-4 shrink-0" aria-hidden />}
      {children}
    </div>
  )
}

function ProcessRow({
  node,
  depth,
  base,
  collectedAt,
  toggle,
  showSubtree
}: {
  node: ProcessNode
  depth: number
  base: string | null
  collectedAt: number
  toggle: React.ReactNode
  showSubtree: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const { process } = node
  const label =
    processLabel(process, base) ??
    t('resourceManager.sessionProcesses.pid', 'PID {{value0}}', { value0: process.pid })
  const cwd = relativeCwd(process.cwd, base)
  return (
    <TreeRow depth={depth} toggle={toggle}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 cursor-default truncate font-mono text-[10px] text-muted-foreground">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4} className="max-w-96 break-all">
          <span className="font-mono">{process.command ?? label}</span>
          {process.cwd ? <div className="opacity-70">{process.cwd}</div> : null}
        </TooltipContent>
      </Tooltip>
      {cwd && cwd !== '.' ? (
        <span
          className={`max-w-28 shrink truncate text-[10px] text-muted-foreground/60 ${WIDE_ONLY_CLS}`}
        >
          {cwd}
        </span>
      ) : null}
      {process.startedAt !== null ? (
        <span
          className={`shrink-0 tabular-nums text-[10px] text-muted-foreground/60 ${WIDE_ONLY_CLS}`}
        >
          {formatElapsed(collectedAt - process.startedAt)}
        </span>
      ) : null}
      {process.command ? <CopyCommand command={process.command} /> : null}
      <MetricPair
        cpu={showSubtree ? node.cpu : process.cpu}
        memory={showSubtree ? node.memory : process.memory}
        size="small"
      />
      <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
    </TreeRow>
  )
}

/** A session's processes as a tree; siblings running the same command fold into one row. */
export function SessionProcessTreeView({
  sessionId,
  environmentId,
  workspacePath
}: {
  /** A terminal's session id, or a chat's agent session id. */
  sessionId: string
  /** The paired server that runs it; absent for this machine. */
  environmentId?: string
  workspacePath: string | null
}): React.JSX.Element {
  const t = useTranslate()
  const state = useSessionProcessTree(sessionId, environmentId)
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set())
  const [closedPids, setClosedPids] = useState<ReadonlySet<number>>(new Set())
  if (state.status !== 'ready') {
    const notice = {
      loading: t('resourceManager.sessionProcesses.loading', 'Reading processes…'),
      gone: t('resourceManager.sessionProcesses.gone', 'No running processes.'),
      'update-required': t(
        'resourceManager.sessionProcesses.updateRequired',
        'Update Orca on this host to see its processes.'
      ),
      failed: t('resourceManager.sessionProcesses.failed', "Couldn't read the processes.")
    }[state.status]
    return (
      <div
        className="py-1 pr-3 text-[10px] text-muted-foreground/70"
        style={{ paddingLeft: FIRST_INDENT_PX }}
      >
        {notice}
      </div>
    )
  }
  const { tree } = state
  const base =
    workspacePath ?? tree.processes.find((process) => process.pid === tree.rootPid)?.cwd ?? null
  const flip = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
    const next = new Set(set)
    if (!next.delete(value)) {
      next.add(value)
    }
    return next
  }
  const rows: React.JSX.Element[] = []
  const pushNode = (node: ProcessNode, depth: number): void => {
    const { pid } = node.process
    const closed = closedPids.has(pid)
    rows.push(
      <ProcessRow
        key={pid}
        node={node}
        depth={depth}
        base={base}
        collectedAt={tree.collectedAt}
        showSubtree={closed}
        toggle={
          node.children.length > 0 ? (
            <ProcessTreeToggle
              expanded={!closed}
              onToggle={() => setClosedPids((prev) => flip(prev, pid))}
            />
          ) : null
        }
      />
    )
    if (!closed) {
      pushNodes(node.children, depth + 1, String(pid))
    }
  }
  const pushNodes = (nodes: ProcessNode[], depth: number, parentKey: string): void => {
    for (const group of groupSiblings(nodes, base)) {
      if (group.nodes.length === 1) {
        pushNode(group.nodes[0], depth)
        continue
      }
      const key = `${parentKey}/${group.key}`
      const open = openGroups.has(key)
      rows.push(
        <TreeRow
          key={key}
          depth={depth}
          toggle={
            <ProcessTreeToggle
              expanded={open}
              onToggle={() => setOpenGroups((prev) => flip(prev, key))}
            />
          }
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
            {group.label}
          </span>
          <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/60">
            {t('resourceManager.sessionProcesses.count', '×{{value0}}', {
              value0: group.nodes.length
            })}
          </span>
          <MetricPair cpu={group.cpu} memory={group.memory} size="small" />
          <span className={ROW_TRAILING_GUTTER_CLS} aria-hidden />
        </TreeRow>
      )
      if (open) {
        group.nodes.forEach((node) => pushNode(node, depth + 1))
      }
    }
  }
  pushNodes(buildProcessForest(tree.processes), 0, '')
  return (
    <div role="group" className="@container/proctree">
      {rows}
    </div>
  )
}
