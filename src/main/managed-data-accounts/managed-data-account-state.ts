import { z } from 'zod'
import { lazyZodSchema } from '../../shared/schema/lazy-zod-schema'

export const stateSchema = lazyZodSchema(() =>
  z.object({
    accounts: z
      .array(
        z.object({
          id: z.uuid(),
          label: z.string().min(1).max(120),
          integrations: z.array(z.string()).max(64),
          createdAt: z.number()
        })
      )
      .max(64),
    activeAccountId: z.uuid().nullable()
  })
)
