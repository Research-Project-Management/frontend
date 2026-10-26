/**
 * Single source of truth for reading retraction state off a library item.
 */


export function safeHttpUrl(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export interface RetractionInfo {
  nature?: string;
  reason?: string;
  reasons?: string[];
  formattedReason?: string;
  title: string;
  noticeUrl?: string;
  noticeDoi?: string;
  date?: string;
}

type RetractableLike = {
  isRetracted?: boolean | null;
  retractionStatus?: string | null;
  retractionNature?: string | null;
  retractionDetails?: unknown;
  retraction?: unknown;
  metadata?: unknown;
  retractionReason?: string | null;
  retractionReasons?: string[] | null;
  retractionDate?: string | null;
  retractionNoticeDoi?: string | null;
  noticeUrl?: string | null;
  doi?: string | null;
};

export function isItemRetracted(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const i = item as RetractableLike;
  const meta =
    i.metadata && typeof i.metadata === 'object'
      ? (i.metadata as Record<string, unknown>)
      : null;
  const retObj =
    i.retraction && typeof i.retraction === 'object'
      ? (i.retraction as Record<string, unknown>)
      : null;
  const rawObj = item as Record<string, unknown>;
  return Boolean(
    i.isRetracted ||
      rawObj.is_retracted === true ||
      i.retractionStatus === 'retracted' ||
      meta?.isRetracted === true ||
      meta?.is_retracted === true ||
      meta?.retractionStatus === 'retracted' ||
      retObj?.isRetracted === true,
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

/** Normalised retraction details (reason, reasons, notice link, noticeDoi, date) for display. */
export function getRetractionInfo(item: unknown): RetractionInfo {
  if (!item || typeof item !== 'object') {
    return { title: 'This item has been retracted' };
  }
  const i = item as RetractableLike;
  const d =
    i.retractionDetails && typeof i.retractionDetails === 'object'
      ? (i.retractionDetails as Record<string, unknown>)
      : {};
  const r =
    i.retraction && typeof i.retraction === 'object'
      ? (i.retraction as Record<string, unknown>)
      : {};
  const m =
    i.metadata && typeof i.metadata === 'object'
      ? (i.metadata as Record<string, unknown>)
      : {};

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const strArr = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const list = v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    return list.length > 0 ? list : undefined;
  };

  const nature =
    str(d.nature) ??
    str(r.nature) ??
    str(m.retractionNature) ??
    str(i.retractionNature);

  const reasons =
    strArr(d.reasons) ??
    strArr(d.retractionReasons) ??
    strArr(r.reasons) ??
    strArr(r.retractionReasons) ??
    strArr(m.retractionReasons) ??
    strArr(i.retractionReasons);

  const rawReason =
    str(d.reason) ??
    str(r.reason) ??
    str(m.retractionReason) ??
    str(i.retractionReason) ??
    (reasons && reasons.length > 0 ? reasons.join('; ') : undefined);

  const noticeDoi =
    str(d.noticeDoi) ??
    str(d.retractionNoticeDoi) ??
    str(r.noticeDoi) ??
    str(r.retractionNoticeDoi) ??
    str(m.retractionNoticeDoi) ??
    str(i.retractionNoticeDoi);

  const rawNoticeUrl =
    str(d.noticeUrl) ??
    str(r.noticeUrl) ??
    str(m.noticeUrl) ??
    str(i.noticeUrl) ??
    (noticeDoi ? `https://doi.org/${noticeDoi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : undefined) ??
    (i.doi ? `https://doi.org/${i.doi}` : undefined);
  const noticeUrl = safeHttpUrl(rawNoticeUrl);

  const date =
    str(d.date) ??
    str(d.retractionDate) ??
    str(r.date) ??
    str(r.retractionDate) ??
    str(m.retractionDate) ??
    str(i.retractionDate);

  return {
    nature,
    reason: rawReason,
    reasons,
    formattedReason: formatRetractionReason(rawReason, nature),
    title: getRetractionTitle(nature),
    noticeUrl,
    noticeDoi,
    date,
  };
}

