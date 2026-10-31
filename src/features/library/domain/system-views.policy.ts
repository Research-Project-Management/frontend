/**
 * Pure Domain Policy: System Views, Retraction State & "My Publications" Authorship / Open Access License Guard
 */

import type { LibraryScope } from './types/core.types';

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
  text = text.replace(/\bauthors\s+inability\b/gi, "authors' inability");
  text = text.replace(/\bauthor\s+inability\b/gi, "author's inability");
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
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

// ── System Views & Open Access License Policy ───────────────────────────────

export type LibrarySystemViewId =
  | 'all'
  | 'my-publications'
  | 'publications'
  | 'unfiled'
  | 'duplicates'
  | 'trash'
  | 'retracted'
  | 'starred';

export interface OpenAccessLicenseBadge {
  code: string;
  label: string;
  isOpenAccess: boolean;
  url?: string;
}

const KNOWN_LICENSES: Record<string, { label: string; isOpenAccess: boolean; url: string }> = {
  'cc-by-4.0': {
    label: 'CC BY 4.0',
    isOpenAccess: true,
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'cc-by': {
    label: 'CC BY 4.0',
    isOpenAccess: true,
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'cc-by-sa-4.0': {
    label: 'CC BY-SA 4.0',
    isOpenAccess: true,
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'cc-by-nc-4.0': {
    label: 'CC BY-NC 4.0',
    isOpenAccess: true,
    url: 'https://creativecommons.org/licenses/by-nc/4.0/',
  },
  'cc-by-nc-nd-4.0': {
    label: 'CC BY-NC-ND 4.0',
    isOpenAccess: true,
    url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  },
  'cc0-1.0': {
    label: 'CC0 1.0 Public Domain',
    isOpenAccess: true,
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'cc0': {
    label: 'CC0 1.0 Public Domain',
    isOpenAccess: true,
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'mit': {
    label: 'MIT License',
    isOpenAccess: true,
    url: 'https://opensource.org/licenses/MIT',
  },
  'apache-2.0': {
    label: 'Apache 2.0',
    isOpenAccess: true,
    url: 'https://www.apache.org/licenses/LICENSE-2.0',
  },
  'arxiv-nonexclusive-distrib-1.0': {
    label: 'arXiv Non-Exclusive Distribution',
    isOpenAccess: true,
    url: 'https://arxiv.org/licenses/nonexclusive-distrib/1.0/',
  },
};

export function resolveOpenAccessLicenseBadge(
  item: Record<string, unknown>,
): OpenAccessLicenseBadge | null {
  const extra =
    item.extraFields && typeof item.extraFields === 'object'
      ? (item.extraFields as Record<string, unknown>)
      : {};
  const meta =
    item.metadata && typeof item.metadata === 'object'
      ? (item.metadata as Record<string, unknown>)
      : {};

  const rawLicense =
    item.license ??
    item.rights ??
    extra.license ??
    extra.rights ??
    meta.license ??
    meta.rights;

  if (typeof rawLicense !== 'string' || !rawLicense.trim()) {
    return null;
  }

  const normalized = rawLicense.trim().toLowerCase().replace(/\s+/g, '-');
  const known = KNOWN_LICENSES[normalized];
  if (known) {
    return {
      code: rawLicense.trim().toUpperCase(),
      label: known.label,
      isOpenAccess: known.isOpenAccess,
      url: known.url,
    };
  }

  const isCcOrOa =
    normalized.startsWith('cc-') ||
    normalized.includes('creative-commons') ||
    normalized.includes('open-access');

  return {
    code: rawLicense.trim(),
    label: rawLicense.trim(),
    isOpenAccess: isCcOrOa,
  };
}

export function isItemTrashed(item: Record<string, unknown>): boolean {
  return Boolean(
    item.isTrashed === true ||
      item.trashed === true ||
      (typeof item.deletedAt === 'string' && item.deletedAt.trim().length > 0),
  );
}

export function isItemInMyPublications(item: Record<string, unknown>): boolean {
  const extra =
    item.extraFields && typeof item.extraFields === 'object'
      ? (item.extraFields as Record<string, unknown>)
      : {};
  const meta =
    item.metadata && typeof item.metadata === 'object'
      ? (item.metadata as Record<string, unknown>)
      : {};
  return Boolean(
    item.isMyPublication === true ||
      item.isInMyPublications === true ||
      item.inPublications === true ||
      extra.isMyPublication === true ||
      extra.isInMyPublications === true ||
      extra.inPublications === true ||
      meta.isMyPublication === true ||
      meta.isInMyPublications === true ||
      meta.inPublications === true,
  );
}

export function isItemUnfiled(item: Record<string, unknown>): boolean {
  const colIds = Array.isArray(item.collectionIds) ? item.collectionIds : [];
  const cols = Array.isArray(item.collections) ? item.collections : [];
  const singleColId =
    typeof item.collectionId === 'string' && item.collectionId.trim()
      ? item.collectionId.trim()
      : null;
  return colIds.length === 0 && cols.length === 0 && !singleColId;
}

export function filterItemsBySystemView<T extends Record<string, unknown>>(
  items: readonly T[],
  view: LibrarySystemViewId,
  scope: LibraryScope | { type: 'user' | 'project'; id?: string } = { type: 'user', id: 'user' },
): T[] {
  if (view === 'trash') {
    return items.filter((item) => isItemTrashed(item));
  }

  const activeItems = items.filter((item) => !isItemTrashed(item));

  switch (view) {
    case 'all':
      return activeItems;

    case 'my-publications':
    case 'publications':
      if (scope.type !== 'user') {
        return [];
      }
      return activeItems.filter((item) => isItemInMyPublications(item));

    case 'unfiled':
      return activeItems.filter((item) => isItemUnfiled(item));

    case 'retracted':
      return activeItems.filter((item) => isItemRetracted(item));

    case 'starred':
      return activeItems.filter((item) => Boolean(item.isStarred));

    case 'duplicates': {
      const doiCounts = new Map<string, number>();
      const titleYearCounts = new Map<string, number>();

      for (const item of activeItems) {
        const doi = typeof item.doi === 'string' && item.doi.trim() ? item.doi.trim().toLowerCase() : '';
        if (doi) {
          doiCounts.set(doi, (doiCounts.get(doi) || 0) + 1);
        }
        const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
        const year = item.year ? String(item.year) : '';
        if (title) {
          const key = `${title}|${year}`;
          titleYearCounts.set(key, (titleYearCounts.get(key) || 0) + 1);
        }
      }

      return activeItems.filter((item) => {
        const doi = typeof item.doi === 'string' && item.doi.trim() ? item.doi.trim().toLowerCase() : '';
        if (doi && (doiCounts.get(doi) || 0) > 1) return true;
        const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
        const year = item.year ? String(item.year) : '';
        if (title && (titleYearCounts.get(`${title}|${year}`) || 0) > 1) return true;
        return false;
      });
    }

    default:
      return activeItems;
  }
}
