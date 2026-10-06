/**
 * Single source of truth for reading retraction state off a library item.
 *
 * The API/schema has carried several spellings over time
 * (`isRetracted`, `retractionStatus === 'retracted'`, `is_retracted`);
 * every UI surface must go through these helpers instead of re-deriving it.
 */

export interface RetractionInfo {
  nature?: string;
  reason?: string;
  noticeUrl?: string;
  date?: string;
}

type RetractableLike = {
  isRetracted?: boolean | null;
  retractionStatus?: string | null;
  is_retracted?: boolean | null;
  retractionNature?: string | null;
  retractionDetails?: unknown;
  retractionReason?: string | null;
  retractionDate?: string | null;
  noticeUrl?: string | null;
  doi?: string | null;
};

export function isItemRetracted(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const i = item as RetractableLike;
  return Boolean(
    i.isRetracted || i.retractionStatus === 'retracted' || i.is_retracted,
  );
}

/** Normalised retraction details (reason, notice link, date) for display. */
export function getRetractionInfo(item: unknown): RetractionInfo {
  if (!item || typeof item !== 'object') return {};
  const i = item as RetractableLike;
  const d =
    i.retractionDetails && typeof i.retractionDetails === 'object'
      ? (i.retractionDetails as Record<string, unknown>)
      : {};

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

  return {
    nature: str(d.nature) ?? str(i.retractionNature),
    reason: str(d.reason) ?? str(i.retractionReason),
    noticeUrl:
      str(d.noticeUrl) ??
      str(i.noticeUrl) ??
      (i.doi ? `https://doi.org/${i.doi}` : undefined),
    date: str(d.date) ?? str(i.retractionDate),
  };
}
