import { z } from 'zod';

/**
 * Global Environment Schema & Validator
 * Enforces Matt Pocock's fail-fast pattern for configuration.
 */
const envSchema = z.object({
  // Client Environment (Accessible in browser & server, prefixed with NEXT_PUBLIC_)
  NEXT_PUBLIC_API_URL: z
    .string()
    .refine(
      (v) => !v || v === '' || v.startsWith('/') || /^https?:\/\//i.test(v),
      {
        message: 'NEXT_PUBLIC_API_URL must be a valid URL, relative path, or empty',
      },
    )
    .default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Flux'),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Server Environment (Node.js runtime only)
  INTERNAL_API_URL: z.string().url().optional(),
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
    console.error(
      '❌ Invalid environment variables detected:\n',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables. Check server console.');
  }

  return parsed.data;
};

export const env = parseEnv();
export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;
export type Env = z.infer<typeof envSchema>;
