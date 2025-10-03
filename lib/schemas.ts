import { z } from 'zod';

// Environment variables schema
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  YNAB_ACCESS_TOKEN: z.string().optional(),
  YNAB_BUDGET_ID: z.string().optional(),
  YNAB_ACCOUNT_ID: z.string().optional(),
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : [])),
});

export type Env = z.infer<typeof envSchema>;

// Transaction schema
export const transactionSchema = z.object({
  date: z.string().min(1),
  payee_name: z.string().nullable(),
  category_name: z.string().nullable().optional(),
  memo: z.string().nullable(),
  amount: z.number(),
});

// Config schema
export const configSchema = z.object({
  accessToken: z.string().min(1),
  budgetId: z.string().nullable(),
  accountId: z.string().nullable(),
});

// Upload query parameters schema
export const uploadQuerySchema = z.object({
  dryRun: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  budgetId: z.string().optional(),
  accountId: z.string().optional(),
});

// Helper to validate and throw on error
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
}
