import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const DiagnosticsHeavyQueueCountsParams = z.object({})

export const DiagnosticsProcessTreeParams = z.object({
  sessionId: requiredString('Missing session id')
})

const HeavyQueuePid = z.number().int().positive()

/** One control of a host's vps-heavy queue; the host's own script validates the job. */
export const DiagnosticsHeavyQueueActionParams = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    pid: HeavyQueuePid,
    to: z.enum(['up', 'down', 'top', 'bottom'])
  }),
  z.object({ action: z.literal('run-now'), pid: HeavyQueuePid, extra: z.boolean() }),
  z.object({ action: z.literal('cancel'), pid: HeavyQueuePid }),
  z.object({ action: z.literal('stop'), pid: HeavyQueuePid }),
  z.object({ action: z.literal('slots'), slots: z.number().int().min(1).max(9) }),
  z.object({
    action: z.literal('move-host'),
    pid: HeavyQueuePid,
    // The host checks it against its own peers file.
    peer: z.string().min(1).max(256),
    cwd: z
      .string()
      .max(4096)
      .refine((cwd) => cwd.startsWith('/') && !cwd.includes('\0'), 'cwd must be absolute')
  })
])
export type HeavyQueueAction = z.infer<typeof DiagnosticsHeavyQueueActionParams>

export const DiagnosticsHeavyJobMoveSourceParams = z.object({ pid: HeavyQueuePid })

const BoundedArg = z
  .string()
  .max(8192)
  .refine((arg) => !arg.includes('\0'))

/** What another host asks of this one before moving a job here; nothing in it is trusted. */
export const DiagnosticsHeavyJobTargetParams = z.object({
  remoteUrl: z.string().min(1).max(1024),
  // git check-ref-format runs on it too; this only rejects option-like and oversized names.
  branch: z
    .string()
    .min(1)
    .max(255)
    .refine((branch) => !branch.startsWith('-') && !branch.includes('@{')),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  relativeDir: z
    .string()
    .max(4096)
    .refine(
      (dir) =>
        !dir.startsWith('/') &&
        !dir.includes('\\') &&
        !dir.includes('\0') &&
        dir.split('/').every((part) => part !== '..'),
      'relativeDir must stay inside the checkout'
    ),
  argv: z.array(BoundedArg).min(1).max(256),
  prepare: z.boolean()
})

/** Clients that show chats ask for them; older hosts ignore it and send terminals only. */
export const DiagnosticsMemoryParams = z.object({ withChats: z.boolean().optional() })
