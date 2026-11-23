import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

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
  z.object({ action: z.literal('slots'), slots: z.number().int().min(1).max(9) })
])
export type HeavyQueueAction = z.infer<typeof DiagnosticsHeavyQueueActionParams>

/** Clients that show chats ask for them; older hosts ignore it and send terminals only. */
export const DiagnosticsMemoryParams = z.object({ withChats: z.boolean().optional() })
