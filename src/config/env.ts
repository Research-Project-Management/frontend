import { z } from 'zod';

/**
 * Global Environment Schema & Validator
 * Enforces resilient configuration with fail-safe fallbacks for CI/CD and Vercel.
 */
const envSchema = z.object({
  // Client Environment (Accessible in browser & server, prefixed with NEXT_PUBLIC_)
  NEXT_PUBLIC_API_URL: z
    .string()
    .trim()
    .refine(
      (v) => !v || v === '' || v.startsWith('/') || /^https?:\/\//i.test(v),
      {
        message: 'NEXT_PUBLIC_API_URL must be a valid URL, relative path, or empty',
      },
    )
    .default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Flux'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .preprocess((val) => String(val ?? 'false').toLowerCase().trim(), z.string())
    .transform((v) => v === 'true' || v === '1'),

  // Server Environment (Node.js runtime only)
  INTERNAL_API_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const parseEnv = () => {
  const rawEnv = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Flux',
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS || 'false',
    INTERNAL_API_URL: process.env.INTERNAL_API_URL,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.warn(
      '⚠️ Warning: Environment validation reported issues, applying safe fallback defaults:\n',
      parsed.error.flatten().fieldErrors,
    );
    return {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Flux',
      NEXT_PUBLIC_ENABLE_ANALYTICS: false,
      INTERNAL_API_URL: undefined,
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    };
  }

  return parsed.data;
};

export const env = parseEnv();
export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;
export type Env = z.infer<typeof envSchema>;

