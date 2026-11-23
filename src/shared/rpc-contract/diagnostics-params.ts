import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const DiagnosticsProcessTreeParams = z.object({
  sessionId: requiredString('Missing session id')
})

/** Clients that show chats ask for them; older hosts ignore it and send terminals only. */
export const DiagnosticsMemoryParams = z.object({ withChats: z.boolean().optional() })
