/**
 * Global React Query Cache Timing Presets (milliseconds).
 *
 * Provides standardized `staleTime`, `gcTime`, and `refetchInterval` presets
 * so feature hooks avoid scattering arbitrary magic numbers.
 */
const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export const QUERY_TIMINGS = {
  /** Always refetch on mount/focus (live status, presence) */
  REALTIME: 0,
  /** Short-lived transactional data (30 seconds) */
  SHORT: 30 * SECOND,
  /** Standard workspace lists & entities (1 minute) */
  DEFAULT_STALE: 60 * SECOND,
  /** Moderate-churn metadata & project summaries (2 minutes) */
  MEDIUM: 2 * MINUTE,
  /** Low-churn catalog, labels, settings (5 minutes) */
  LONG: 5 * MINUTE,
  /** Default garbage-collection window (10 minutes) */
  DEFAULT_GC: 10 * MINUTE,
  /** Nearly static reference data (30 minutes) */
  STATIC: 30 * MINUTE,
} as const;
