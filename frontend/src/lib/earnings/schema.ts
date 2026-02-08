import { z } from 'zod';

export const EarningsBriefSchema = z.object({
  overview: z
    .object({
      text: z.string().min(1),
      evidence: z.string().min(1),
    })
    .nullable(),

  positives: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        evidence: z.string().min(1),
      })
    )
    .max(5),

  concerns: z
    .array(
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        evidence: z.string().min(1),
      })
    )
    .max(5),

  guidance: z
    .object({
      text: z.string().min(1),
      evidence: z.string().min(1),
    })
    .nullable(),

  notableNumbers: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        evidence: z.string().min(1),
      })
    )
    .max(10),

  meta: z.object({
    generatedAt: z.string().min(1),
    model: z.string().min(1),
    provider: z.string().min(1),
    inputChars: z.number().int().nonnegative(),
    notes: z.array(z.string()),
  }),
});
