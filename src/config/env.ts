import { z } from 'zod';
import { logger } from '@/shared/lib/logger';

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
    .default('http://127.0.0.1:18300'),
  NEXT_PUBLIC_REALTIME_URL: z
    .string()
    .trim()
    .refine(
      (v) => !v || v === '' || v.startsWith('/') || /^https?:\/\//i.test(v),
      {
        message: 'NEXT_PUBLIC_REALTIME_URL must be a valid URL, relative path, or empty',
      },
    )
    .default('http://127.0.0.1:3014'),
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
  INTERNAL_REALTIME_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const resolveRawApiUrl = (): string => {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

  // On the server (Node.js SSR / Route Handlers), prefer INTERNAL_API_URL, then NEXT_PUBLIC_API_URL
  if (typeof window === 'undefined') {
    const internal = (process.env.INTERNAL_API_URL ?? '').trim().replace(/\/$/, '');
    return internal || configured || 'http://127.0.0.1:18300';
  }

  // In the browser:
  // 1. If NEXT_PUBLIC_API_URL is empty or relative, use '' so requests go through same-origin Next.js rewrites
  if (!configured || configured === '/') {
    return '';
  }

  // 2. Prevent Mixed Content errors & dynamic DNS blocks: if page is loaded over HTTPS
  //    and configured URL is insecure HTTP or uses *.sslip.io, force relative same-origin proxy ('')
  if (
    (window.location.protocol === 'https:' && /^http:\/\//i.test(configured)) ||
    /\.sslip\.io(\b|:|\/|$)/i.test(configured)
  ) {
    return '';
  }

  // 3. In production browser (not localhost), if configured points to localhost/127.0.0.1, force relative ('')
  const isLocalBrowser =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalBrowser && /^https?:\/\/(localhost|127\.0\.0\.1)(\b|:|\/|$)/i.test(configured)) {
    return '';
  }

  return configured;
};

const resolveRawRealtimeUrl = (): string => {
  const rawConfigured = process.env.NEXT_PUBLIC_REALTIME_URL;
  const configured = (rawConfigured ?? '').trim().replace(/\/$/, '');

  // On the server (Node.js SSR / Route Handlers), prefer INTERNAL_REALTIME_URL, then NEXT_PUBLIC_REALTIME_URL
  if (typeof window === 'undefined') {
    const internal = (process.env.INTERNAL_REALTIME_URL ?? '').trim().replace(/\/$/, '');
    return internal || configured || 'http://127.0.0.1:3014';
  }

  const isLocalBrowser =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // If NEXT_PUBLIC_REALTIME_URL was not explicitly set:
  // default to standalone local Realtime service (:3014) on localhost, or same-origin ('') in prod.
  if (rawConfigured === undefined) {
    return isLocalBrowser && window.location.protocol === 'http:'
      ? 'http://127.0.0.1:3014'
      : '';
  }

  // 1. If NEXT_PUBLIC_REALTIME_URL is empty or relative, route through same-origin /socket.io rewrite
  if (!configured || configured === '/') {
    return '';
  }

  // 2. Prevent Mixed Content errors & dynamic DNS blocks on HTTPS / sslip.io
  if (
    (window.location.protocol === 'https:' && /^http:\/\//i.test(configured)) ||
    /\.sslip\.io(\b|:|\/|$)/i.test(configured)
  ) {
    return '';
  }

  // 3. In production browser (not localhost), avoid connecting to localhost/127.0.0.1
  if (!isLocalBrowser && /^https?:\/\/(localhost|127\.0\.0\.1)(\b|:|\/|$)/i.test(configured)) {
    return '';
  }

  return configured;
};

const parseEnv = () => {
  const resolvedApiUrl = resolveRawApiUrl();
  const resolvedRealtimeUrl = resolveRawRealtimeUrl();
  const rawEnv = {
    NEXT_PUBLIC_API_URL: resolvedApiUrl,
    NEXT_PUBLIC_REALTIME_URL: resolvedRealtimeUrl,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Flux',
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS || 'false',
    INTERNAL_API_URL: process.env.INTERNAL_API_URL,
    INTERNAL_REALTIME_URL: process.env.INTERNAL_REALTIME_URL,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    logger.warn(
      '⚠️ Warning: Environment validation reported issues, applying safe fallback defaults',
      { fieldErrors: parsed.error.flatten().fieldErrors },
    );
    return {
      NEXT_PUBLIC_API_URL: resolvedApiUrl,
      NEXT_PUBLIC_REALTIME_URL: resolvedRealtimeUrl,
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Flux',
      NEXT_PUBLIC_ENABLE_ANALYTICS: false,
      INTERNAL_API_URL: undefined,
      INTERNAL_REALTIME_URL: undefined,
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    };
  }

  return parsed.data;
};

export const env = parseEnv();
export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;
export const REALTIME_BASE_URL = env.NEXT_PUBLIC_REALTIME_URL;
export const IS_DEV = env.NODE_ENV === 'development';
export const IS_PROD = env.NODE_ENV === 'production';
export const IS_TEST = env.NODE_ENV === 'test';

/**
 * Library microservice host overrides (getters preserve runtime test overrides
 * while keeping literal `process.env.NEXT_PUBLIC_*` for Next.js static inlining).
 */
export const LIBRARY_SERVICE_ENV = {
  get catalog() { return process.env.NEXT_PUBLIC_LIBRARY_CATALOG_URL; },
  get extraction() { return process.env.NEXT_PUBLIC_LIBRARY_EXTRACTION_URL; },
  get ingestion() { return process.env.NEXT_PUBLIC_LIBRARY_INGESTION_URL; },
  get citation() { return process.env.NEXT_PUBLIC_LIBRARY_CITATION_URL; },
  get search() { return process.env.NEXT_PUBLIC_LIBRARY_SEARCH_URL; },
  get sync() { return process.env.NEXT_PUBLIC_LIBRARY_SYNC_URL; },
  get reader() { return process.env.NEXT_PUBLIC_LIBRARY_READER_URL; },
  get defaultHost() { return process.env.NEXT_PUBLIC_LIBRARY_SERVICES_URL; },
  get apiFallback() { return process.env.NEXT_PUBLIC_API_URL; },
};

/**
 * Pages / Manuscript microservice base URL.
 */
export const PAGES_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_PAGES_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPTS_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPT_SERVICE_URL ||
  '/api/v1/pages';

/**
 * External LaTeX documentation URLs.
 */
export const LATEX_DOCS_URLS = {
  DOCUMENTATION_HOME:
    process.env.NEXT_PUBLIC_LATEX_DOCS_URL || 'https://latexref.xyz/dev/latex2e.html',
  LATEX_INTRO_GUIDE:
    process.env.NEXT_PUBLIC_LATEX_GUIDE_URL || 'https://en.wikibooks.org/wiki/LaTeX',
} as const;

export type Env = z.infer<typeof envSchema>;

