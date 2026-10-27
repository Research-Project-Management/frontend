'use client';

import type { Item } from '@/features/library/domain/types/library.types';
import { ALL_SCHEMA_PROMOTE_KEYS } from '@/features/library/domain/metadata';
import { CANONICAL_FIELD_ALIASES } from '@/features/library/domain/item-field-schema';

export function cloneSnapshotValue<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((item) =>
      item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item,
    ) as unknown as T;
  }
  if (val && typeof itemIsObject(val)) {
    return { ...(val as Record<string, unknown>) } as unknown as T;
  }
  return val;
}

function itemIsObject(val: unknown): boolean {
  return Boolean(val) && typeof val === 'object';
}

const TRANSIENT_PATCH_KEYS = new Set<string>(['version', 'silent', 'expectedVersion']);

const MULTI_KEY_SIBLING_FALLBACKS: Record<string, readonly string[]> = {
  abstract: ['abstractNote', 'abstract'],
  abstractNote: ['abstractNote', 'abstract'],
  date: ['publicationDate', 'date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  publicationDate: ['publicationDate', 'date', 'issueDate', 'dateDecided', 'dateEnacted', 'filingDate'],
  issueDate: ['issueDate', 'publicationDate', 'date'],
  dateDecided: ['dateDecided', 'publicationDate', 'date'],
  dateEnacted: ['dateEnacted', 'publicationDate', 'date'],
  filingDate: ['filingDate', 'date', 'publicationDate'],
  journal: ['publicationTitle', 'journal'],
  publicationTitle: ['publicationTitle', 'journal'],
  journalAbbr: ['journalAbbreviation', 'journalAbbr'],
  journalAbbreviation: ['journalAbbreviation', 'journalAbbr'],
  accessedAt: ['accessDate', 'accessedAt'],
  accessDate: ['accessDate', 'accessedAt'],
  rights: ['license', 'rights'],
  license: ['license', 'rights'],
  numPages: ['numberOfPages', 'numPages'],
  numberOfPages: ['numberOfPages', 'numPages'],
  archiveID: ['arxivId', 'archiveID', 'archiveId'],
  archiveId: ['arxivId', 'archiveID', 'archiveId'],
  arxivId: ['arxivId', 'archiveID', 'archiveId'],
};

function resolvePreviousScalarValue(
  itemRecord: Record<string, unknown>,
  key: string,
): unknown {
  if (itemRecord[key] !== undefined) {
    return itemRecord[key];
  }
  const currentEf =
    itemRecord.extraFields &&
    typeof itemRecord.extraFields === 'object' &&
    !Array.isArray(itemRecord.extraFields)
      ? (itemRecord.extraFields as Record<string, unknown>)
      : undefined;

  const siblingCandidates =
    MULTI_KEY_SIBLING_FALLBACKS[key] ?? CANONICAL_FIELD_ALIASES[key];
  if (siblingCandidates) {
    for (const sibling of siblingCandidates) {
      if (itemRecord[sibling] !== undefined) {
        return itemRecord[sibling];
      }
      if (currentEf && currentEf[sibling] !== undefined) {
        return currentEf[sibling];
      }
    }
  }
  if (currentEf && currentEf[key] !== undefined) {
    return currentEf[key];
  }
  return undefined;
}

/**
 * Snapshots the previous values of every key in `forwardPatch` from `currentItem`,
 * including nested keys inside `forwardPatch.extraFields` and `forwardPatch.metadata`.
 * - If a key was not in `currentItem.extraFields`, its inverse in `extraFields` is `null` so undo deletes it.
 * - If a key in `forwardPatch` was set to `null` or mutated, its inverse restores `currentItem[key]` / `currentItem.extraFields[key]`,
 *   falling back to canonical sibling fields (`abstract` <-> `abstractNote`, `date`/`issueDate` <-> `publicationDate`, `journal` <-> `publicationTitle`).
 */
export function buildInverseMetadataPatch(
  currentItem: Item,
  forwardPatch: Partial<Item>,
): Partial<Item> {
  const itemRecord = currentItem as Record<string, unknown>;
  const patchRecord = forwardPatch as Record<string, unknown>;
  const inverse: Record<string, unknown> = {};

  for (const key of Object.keys(patchRecord)) {
    if (TRANSIENT_PATCH_KEYS.has(key)) continue;

    if (key === 'extraFields') {
      const forwardEf = patchRecord.extraFields;
      if (forwardEf && typeof forwardEf === 'object' && !Array.isArray(forwardEf)) {
        const currentEf =
          itemRecord.extraFields &&
          typeof itemRecord.extraFields === 'object' &&
          !Array.isArray(itemRecord.extraFields)
            ? (itemRecord.extraFields as Record<string, unknown>)
            : {};
        const inverseEf: Record<string, unknown> = { ...currentEf };
        for (const efKey of Object.keys(forwardEf as Record<string, unknown>)) {
          if (efKey in currentEf && currentEf[efKey] !== undefined) {
            inverseEf[efKey] = cloneSnapshotValue(currentEf[efKey]);
          } else {
            inverseEf[efKey] = null;
          }
        }
        inverse.extraFields = inverseEf;
      }
      continue;
    }

    if (key === 'metadata') {
      const forwardMeta = patchRecord.metadata;
      if (forwardMeta && typeof forwardMeta === 'object' && !Array.isArray(forwardMeta)) {
        const currentMeta =
          itemRecord.metadata &&
          typeof itemRecord.metadata === 'object' &&
          !Array.isArray(itemRecord.metadata)
            ? (itemRecord.metadata as Record<string, unknown>)
            : {};
        const inverseMeta: Record<string, unknown> = { ...currentMeta };
        for (const metaKey of Object.keys(forwardMeta as Record<string, unknown>)) {
          if (metaKey in currentMeta && currentMeta[metaKey] !== undefined) {
            inverseMeta[metaKey] = cloneSnapshotValue(currentMeta[metaKey]);
          } else {
            inverseMeta[metaKey] = null;
          }
        }
        inverse.metadata = inverseMeta;
      }
      continue;
    }

    const prevVal = resolvePreviousScalarValue(itemRecord, key);
    if (prevVal === undefined) {
      inverse[key] = null;
    } else {
      inverse[key] = cloneSnapshotValue(prevVal);
    }
  }

  return inverse as Partial<Item>;
}

const BASE_PRE_CONVERSION_SCALAR_KEYS = [
  'title',
  'isbn',
  'issn',
  'doi',
  'pmid',
  'pmcid',
  'arxivId',
  'volume',
  'issue',
  'pages',
  'numberOfPages',
  'edition',
  'series',
  'seriesTitle',
  'seriesNumber',
  'place',
  'abstract',
  'abstractNote',
  'url',
  'openAccessPdfUrl',
  'language',
  'rights',
  'license',
  'archive',
  'archiveLocation',
  'callNumber',
  'shortTitle',
  'year',
  'publicationDate',
  'date',
  'accessDate',
  'journalAbbreviation',
  'citationKey',
  'itemType',
  'extra',
  'publicationTitle',
  'venue',
  'publisher',
] as const;

export const PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS: readonly string[] = Array.from(
  new Set<string>([
    ...BASE_PRE_CONVERSION_SCALAR_KEYS,
    ...ALL_SCHEMA_PROMOTE_KEYS,
  ]),
);

export function buildPreConversionSnapshot(sourceItem: Partial<Item>): Partial<Item> {
  const srcRecord = sourceItem as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  if (typeof sourceItem.id === 'string' && sourceItem.id) {
    snap.id = sourceItem.id;
  }
  const allKeysToSnapshot = new Set<string>([
    ...PRE_CONVERSION_BIBLIOGRAPHIC_SCALAR_KEYS,
    ...ALL_SCHEMA_PROMOTE_KEYS,
  ]);
  for (const key of allKeysToSnapshot) {
    if (srcRecord[key] !== undefined) {
      snap[key] = cloneSnapshotValue(srcRecord[key]);
    }
  }
  snap.extra = typeof sourceItem.extra === 'string' ? sourceItem.extra : '';
  if (sourceItem.extraFields && typeof sourceItem.extraFields === 'object') {
    snap.extraFields = { ...(sourceItem.extraFields as Record<string, unknown>) };
  }
  if (Array.isArray(sourceItem.creators)) {
    snap.creators = sourceItem.creators.map((c) => ({ ...c }));
  }
  if (Array.isArray(sourceItem.contributors)) {
    snap.contributors = sourceItem.contributors.map((c) => ({ ...c }));
  }
  if (Array.isArray(sourceItem.authors)) {
    snap.authors = [...sourceItem.authors];
  }
  return snap as Partial<Item>;
}
