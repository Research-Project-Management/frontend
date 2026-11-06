/**
 * Pure Domain Policy: System Views, Retraction State & "My Publications" Authorship / Open Access License Guard
 */

import type { Item } from './types/core.types';

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

interface RetractionInfo {
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

function getRetractionTitle(nature?: string): string {
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

export function isItemStarred(item: Record<string, unknown>): boolean {
  return Boolean(item.isStarred || item.starred);
}

function isItemUnread(item: Record<string, unknown>): boolean {
  const status = typeof item.readStatus === 'string' ? item.readStatus.trim().toLowerCase() : '';
  if (status) return status === 'unread';
  return !item.isRead;
}

function doesItemHavePdf(item: Record<string, unknown>): boolean {
  if (item.hasFile === true || item.hasPdf === true) return true;
  if (typeof item.fileUrl === 'string' && item.fileUrl.trim().length > 0) return true;
  if (typeof item.openAccessPdfUrl === 'string' && item.openAccessPdfUrl.trim().length > 0) return true;
  if (Array.isArray(item.attachments)) {
    return item.attachments.some((att) => {
      if (!att || typeof att !== 'object') return false;
      const a = att as Record<string, unknown>;
      return (
        a.attachmentType === 'primary_pdf' ||
        a.mimeType === 'application/pdf' ||
        (typeof a.filename === 'string' && a.filename.toLowerCase().endsWith('.pdf'))
      );
    });
  }
  return false;
}

function isItemBroken(item: Record<string, unknown>): boolean {
  if (Array.isArray(item.qualityIssues) && item.qualityIssues.length > 0) return true;
  if (typeof item.qualityScore === 'number' && item.qualityScore < 50) return true;
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  return !title || title === 'Untitled' || title === 'Untitled Item';
}

/**
 * Canonical predicate determining whether an item matches a given system view (`all`, `starred`,
 * `favorites`, `trash`, `unfiled`, `my-publications`, `publications`, `retracted`, `recent`,
 * `unread`, `has_pdf`, `broken`).
 */
export function doesItemMatchSystemView(
  item: Record<string, unknown>,
  view: string,
): boolean {
  const normalizedView = view.trim().toLowerCase();
  if (normalizedView === 'trash') {
    return isItemTrashed(item);
  }
  if (isItemTrashed(item)) {
    return false;
  }

  switch (normalizedView) {
    case 'all':
    case 'recent':
      return true;
    case 'starred':
    case 'favorites':
      return isItemStarred(item);
    case 'unfiled':
      return isItemUnfiled(item);
    case 'my-publications':
    case 'publications':
      return isItemInMyPublications(item);
    case 'retracted':
      return isItemRetracted(item);
    case 'unread':
      return isItemUnread(item);
    case 'has_pdf':
    case 'has-pdf':
      return doesItemHavePdf(item);
    case 'broken':
      return isItemBroken(item);
    default:
      return true;
  }
}

export function isTrashQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey[2] === 'trash' || queryKey[3] === 'trash') return true;
  const params = queryKey[3];
  if (params && typeof params === 'object' && (params as { view?: unknown }).view === 'trash') {
    return true;
  }
  return false;
}

function extractNormalizedItemTags(item: Item): string[] {
  if (!Array.isArray(item.tags)) return [];
  return item.tags
    .map((t) => {
      if (typeof t === 'string') return t.trim().toLowerCase();
      if (t && typeof t === 'object' && 'name' in t && typeof (t as { name?: unknown }).name === 'string') {
        return ((t as { name: string }).name || '').trim().toLowerCase();
      }
      return '';
    })
    .filter(Boolean);
}

export function doesItemMatchQueryFilter(
  item: Item,
  params: Record<string, unknown> | undefined,
): boolean {
  if (!params || typeof params !== 'object') return true;
  const view = typeof params.view === 'string' ? params.view : undefined;
  const rec = item as Record<string, unknown>;

  if (view) {
    if (!doesItemMatchSystemView(rec, view)) return false;
    if (view === 'trash') return true;
  } else if (isItemTrashed(rec)) {
    return false;
  }
  if (Boolean(params.starred) && !isItemStarred(rec)) return false;
  if (Boolean(params.unfiled) && !isItemUnfiled(rec)) return false;

  const collectionId = typeof params.collectionId === 'string' ? params.collectionId : undefined;
  if (collectionId) {
    const colIds = Array.isArray(item.collectionIds) ? item.collectionIds : [];
    const singleColId = (item as { collectionId?: string }).collectionId;
    const expandedIds = Array.isArray(params.collectionIds) ? (params.collectionIds as string[]) : null;
    if (expandedIds && expandedIds.length > 0) {
      if (!colIds.some((c) => expandedIds.includes(c)) && (!singleColId || !expandedIds.includes(singleColId))) return false;
    } else if (params.includeSubcollections === false) {
      if (!colIds.includes(collectionId) && singleColId !== collectionId) return false;
    } else if (colIds.length === 0 && !singleColId) {
      return false;
    }
  }

  if (typeof params.tag === 'string' && params.tag.trim()) {
    const requiredTags = params.tag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (requiredTags.length > 0 && Array.isArray(item.tags)) {
      const itemTagSet = new Set(extractNormalizedItemTags(item));
      if (!requiredTags.every((req) => itemTagSet.has(req))) return false;
    }
  }

  if (typeof params.itemType === 'string' && params.itemType.trim()) {
    const targetType = params.itemType.trim();
    const currentType = (item.itemType || (rec.type as string | undefined) || '').trim();
    if (currentType && currentType !== targetType) return false;
  }

  if (typeof params.readStatus === 'string' && params.readStatus.trim()) {
    const targetStatus = params.readStatus.trim().toLowerCase();
    const mappedTarget = targetStatus === 'read' ? 'completed' : targetStatus;
    const currentStatus = (item.readStatus || (item.isRead ? 'completed' : 'unread')).toLowerCase();
    if (currentStatus !== mappedTarget) return false;
  }

  return true;
}

export const MEMBERSHIP_MUTATION_KEYS = new Set([
  'isStarred',
  'deletedAt',
  'status',
  'readStatus',
  'isRead',
  'collectionId',
  'collectionIds',
  'isMyPublication',
  'isInMyPublications',
  'isRetracted',
  'retractionStatus',
  'itemType',
]);

export function doesPatchAffectMembership(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  for (const key of Object.keys(patch)) {
    if (MEMBERSHIP_MUTATION_KEYS.has(key)) return true;
  }
  return false;
}

export function isMetadataOnlyPatch(patch?: Record<string, unknown> | null): boolean {
  if (!patch || typeof patch !== 'object') return false;
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return !keys.some((k) => MEMBERSHIP_MUTATION_KEYS.has(k) || k === 'tags');
}

const MEMBERSHIP_STATE_EXTRACTORS: ReadonlyArray<(it: Record<string, unknown>) => unknown> = [
  isItemStarred,
  isItemTrashed,
  isItemInMyPublications,
  isItemRetracted,
  (it) => (it as { status?: string }).status ?? null,
  (it) => (it as { readStatus?: string }).readStatus ?? null,
  (it) => (it as { itemType?: string }).itemType ?? null,
  (it) => (it as { collectionId?: string }).collectionId ?? null,
];

export function hasMembershipFieldsChanged(
  oldItem: Item | null,
  updatedItem: Item,
  membershipPatch?: Record<string, unknown>,
): boolean {
  if (membershipPatch && !doesPatchAffectMembership(membershipPatch)) {
    return false;
  }
  const nextRec = updatedItem as Record<string, unknown>;
  const nextCols = Array.isArray(updatedItem.collectionIds) ? updatedItem.collectionIds : [];
  if (!oldItem) {
    return (
      nextCols.length > 0 ||
      Boolean((updatedItem as { collectionId?: string }).collectionId) ||
      isItemStarred(nextRec) ||
      isItemTrashed(nextRec) ||
      isItemInMyPublications(nextRec) ||
      isItemRetracted(nextRec)
    );
  }
  const oldRec = oldItem as Record<string, unknown>;
  if (MEMBERSHIP_STATE_EXTRACTORS.some((fn) => fn(oldRec) !== fn(nextRec))) {
    return true;
  }
  const oldCols = Array.isArray(oldItem.collectionIds) ? oldItem.collectionIds : [];
  if (oldCols.length !== nextCols.length) return true;
  const oldSet = new Set(oldCols);
  if (nextCols.some((c) => !oldSet.has(c))) return true;

  const oldTags = extractNormalizedItemTags(oldItem);
  const nextTags = extractNormalizedItemTags(updatedItem);
  if (oldTags.length !== nextTags.length) return true;
  const oldTagSet = new Set(oldTags);
  return nextTags.some((t) => !oldTagSet.has(t));
}
