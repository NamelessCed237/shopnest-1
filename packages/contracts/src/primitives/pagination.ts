import { z } from 'zod'

/**
 * doc/02 §2.3 — pagination par CURSEUR, jamais par offset.
 * `OFFSET 100000` force PostgreSQL à parcourir puis jeter 100 000 lignes ;
 * le curseur reste en O(log n) quelle que soit la profondeur.
 */
export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
})
export type CursorQuery = z.infer<typeof CursorQuerySchema>

export interface CursorPage<T> {
  items: T[]
  nextCursor?: string
  /** Optionnel : un COUNT exact est coûteux sur une grande table. */
  total?: number
}

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().optional(),
    total: z.number().int().optional(),
  })

export const SortOrderSchema = z.enum(['asc', 'desc'])
export type SortOrder = z.infer<typeof SortOrderSchema>
