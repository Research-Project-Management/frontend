/**
 * Shared browser storage error helpers (OPFS / IndexedDB / localStorage).
 */

/**
 * Returns true when a storage write failure was caused by exceeding browser quota.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const domErr = err as { name?: string; code?: number; message?: string };
  return (
    domErr.name === 'QuotaExceededError' ||
    domErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    domErr.code === 22 ||
    domErr.code === 1014 ||
    Boolean(domErr.message && domErr.message.toLowerCase().includes('quota'))
  );
}
