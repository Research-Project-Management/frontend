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
  formattedReason?: string;
  title: string;
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

export function formatRetractionReason(raw?: string, nature?: string): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    if (nature === 'expression_of_concern') {
      return 'An expression of concern has been published regarding the integrity of this article.';
    }
    if (nature === 'correction') {
      return 'A publisher correction notice has been issued for this publication.';
    }
    return 'This publication has been flagged as retracted or unreliable by academic integrity audits.';
  }
  let text = raw.replace(/\r?\n+/g, ' ').trim();
  // Fix possessive apostrophe typos commonly seen in raw feeds (e.g. "authors inability" -> "authors' inability")
  text = text.replace(/\bauthors\s+inability\b/gi, "authors' inability");
  text = text.replace(/\bauthor\s+inability\b/gi, "author's inability");
  // Capitalize first character
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  // Ensure proper sentence punctuation
  if (text.length > 5 && !/[.!?]$/.test(text)) {
    text += '.';
  }
  return text;
}

/**
 * Splits formatted retraction text into structured prefix (e.g. "Retracted on June 5, 2020:")
 * and body reason text for clear typographical hierarchy.
 */
export function parseRetractionReasonParts(text?: string): { prefix?: string; body: string } {
  if (!text || typeof text !== 'string') return { body: '' };
  const m = text.match(/^(Retracted(?:\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})?)(?:\s*[:—–-]\s*(.*)|\s+(due\s+to\s+.*))$/i);
  if (m) {
    const prefix = m[1].trim() + ':';
    const rest = (m[2] || m[3] || '').trim();
    const body = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
    return { prefix, body };
  }
  return { body: text };
}

export function getRetractionTitle(nature?: string): string {
  if (nature === 'expression_of_concern') {
    return 'Expression of Concern';
  }
  if (nature === 'correction') {
    return 'Publisher Correction Notice';
  }
  return 'This item has been retracted';
}

/** Normalised retraction details (reason, notice link, date) for display. */
export function getRetractionInfo(item: unknown): RetractionInfo {
  if (!item || typeof item !== 'object') {
    return { title: 'This item has been retracted' };
  }
  const i = item as RetractableLike;
  const d =
    i.retractionDetails && typeof i.retractionDetails === 'object'
      ? (i.retractionDetails as Record<string, unknown>)
      : {};

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

  const nature = str(d.nature) ?? str(i.retractionNature);
  const rawReason = str(d.reason) ?? str(i.retractionReason);
  const noticeUrl =
    str(d.noticeUrl) ??
    str(i.noticeUrl) ??
    (i.doi ? `https://doi.org/${i.doi}` : undefined);
  const date = str(d.date) ?? str(i.retractionDate);

  return {
    nature,
    reason: rawReason,
    formattedReason: formatRetractionReason(rawReason, nature),
    title: getRetractionTitle(nature),
    noticeUrl,
    date,
  };
}
