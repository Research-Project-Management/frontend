/**
 * Pure Domain Policy: System Views & "My Publications" Authorship / Open Access License Guard
 */

import { isItemRetracted } from './retraction';
import type { LibraryScope } from './types/core.types';

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

/**
 * Filters a list of library items according to System View rules:
 * - `'trash'`: returns only trashed items (`isTrashed` / `deletedAt`).
 * - All non-trash views (`'all'`, `'my-publications'`, `'unfiled'`, `'retracted'`, `'starred'`, `'duplicates'`):
 *   strictly exclude trashed items so deleted items never leak!
 * - `'my-publications'` / `'publications'`: strictly returns `[]` if `scope.type === 'project'`
 *   (My Publications is personal-only) and requires `isItemInMyPublications(item)`.
 * - `'unfiled'`: items with zero collections (`collectionIds.length === 0 && collections.length === 0`).
 * - `'retracted'`: items flagged as retracted (`isItemRetracted(item)`).
 */
export function filterItemsBySystemView<T extends Record<string, unknown>>(
  items: readonly T[],
  view: LibrarySystemViewId,
  scope: LibraryScope | { type: 'user' | 'project'; id?: string } = { type: 'user', id: 'user' },
): T[] {
  if (view === 'trash') {
    return items.filter((item) => isItemTrashed(item));
  }

  // Non-trash views never include trashed items
  const activeItems = items.filter((item) => !isItemTrashed(item));

  switch (view) {
    case 'all':
      return activeItems;

    case 'my-publications':
    case 'publications':
      // My Publications is strictly scoped to Personal Library ('user'), never Project Libraries
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
