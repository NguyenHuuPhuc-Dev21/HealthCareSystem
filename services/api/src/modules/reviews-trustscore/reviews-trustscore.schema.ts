/** Request validation for reviews-trustscore (strict whitelist). */
import { z } from 'zod';

export const submitReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional(),
    /** Quick feedback chips, e.g. "Đúng giờ" (column reviews.tags, migration 0009). */
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  })
  .strict();

export type SubmitReviewBody = z.infer<typeof submitReviewSchema>;
