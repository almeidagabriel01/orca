import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const DiagnosticsProcessTreeParams = z.object({
  sessionId: requiredString('Missing session id')
})
