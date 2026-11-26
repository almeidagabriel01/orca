import { z } from 'zod'

export const MarkContinuedToParams = z
  .object({
    /** The source chat, on the host this call reaches. */
    sessionId: z.string().min(1),
    /** Where the conversation went: the destination Orca's installation id (absent when the client
     *  could not read it), its name, and the chat and workspace there. */
    installationId: z.string().min(1).max(512).optional(),
    hostLabel: z.string().min(1).max(512),
    continuedSessionId: z.string().min(1).max(512).optional(),
    worktreeId: z.string().min(1).max(512).optional()
  })
  .strict()
