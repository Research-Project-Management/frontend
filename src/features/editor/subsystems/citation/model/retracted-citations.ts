import type { BibEntry } from './bib-parser';
import { getRetractionInfo } from '@/features/library/domain/retraction';

export interface RetractedItemInfo {
  title?: string;
  reason?: string;
  nature?: string;
  noticeUrl?: string;
}

/** Natures that Zotero does not warn about; only real retractions are flagged. */
const NON_RETRACTION_NATURES = new Set(['expression_of_concern', 'correction']);

function normalizeDoi(doi?: string | null): string {
  return (doi ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

type RetractedLibraryItem = {
  title?: string | null;
  doi?: string | null;
  citationKey?: string | null;
};

/**
 * Builds the `citation key -> retraction info` map consumed by the LaTeX linter.
 *
 * A project's .bib keys are authored independently from library citation keys,
 * so entries are matched by DOI (the same identifier Zotero uses). A library
 * item's own citation key is also registered so `\cite{thatKey}` is caught even
 * when the key is not in the project's bibliography yet.
 */
export function buildRetractedCitationMap(
  bibEntries: BibEntry[] | undefined,
  retractedItemsInput: unknown,
): Map<string, RetractedItemInfo> {
  const map = new Map<string, RetractedItemInfo>();
  const rawObj =
    retractedItemsInput && typeof retractedItemsInput === 'object' && !Array.isArray(retractedItemsInput)
      ? (retractedItemsInput as { items?: unknown[]; data?: unknown })
      : null;
  const nestedData =
    rawObj?.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data)
      ? (rawObj.data as { items?: unknown[] })
      : null;
  const retractedItems: unknown[] = Array.isArray(retractedItemsInput)
    ? retractedItemsInput
    : Array.isArray(rawObj?.items)
      ? rawObj.items
      : Array.isArray(rawObj?.data)
        ? rawObj.data
        : Array.isArray(nestedData?.items)
          ? nestedData.items
          : [];

  if (retractedItems.length === 0) return map;

  const byDoi = new Map<string, RetractedItemInfo>();

  for (const raw of retractedItems) {
    const item = raw as RetractedLibraryItem;
    const info = getRetractionInfo(raw);
    if (info.nature && NON_RETRACTION_NATURES.has(info.nature)) continue;

    const entryInfo: RetractedItemInfo = {
      title: item.title ?? undefined,
      reason: info.reason,
      nature: info.nature,
      noticeUrl: info.noticeUrl,
    };

    const doi = normalizeDoi(item.doi);
    if (doi) byDoi.set(doi, entryInfo);
    if (item.citationKey) map.set(item.citationKey, entryInfo);
  }

  for (const entry of bibEntries ?? []) {
    const doi = normalizeDoi(entry.doi);
    const hit = doi ? byDoi.get(doi) : undefined;
    if (hit) map.set(entry.key, hit);
  }

  return map;
}
