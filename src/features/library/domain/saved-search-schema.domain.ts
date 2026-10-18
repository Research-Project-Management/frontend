/**
 * Pure Saved Search Schema & Field Definitions
 * Single Source of Truth for Saved Search field configurations, operators,
 * duration parsing, and condition value formatting.
 */

import {
  FIELD_LABELS,
  humanizeFieldName,
  type SavedSearchField,
  type SavedSearchOperator,
} from '@/features/library/domain/types/library.types';

export interface SavedSearchOperatorConfig {
  value: SavedSearchOperator;
  label: string;
}

export interface SavedSearchFieldConfig {
  value: SavedSearchField;
  label: string;
  type: 'text' | 'date' | 'boolean' | 'enum' | 'number';
  operators: SavedSearchOperatorConfig[];
  placeholder: string;
  defaultValue?: string;
}

export type FieldConfig = SavedSearchFieldConfig;

export interface ConditionRow {
  id: string;
  field: SavedSearchField;
  operator: SavedSearchOperator;
  value: string;
}

export const READ_STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'read', label: 'Read' },
  { value: 'skimming', label: 'Skimming' },
];

export const RATING_OPTIONS = [
  { value: '1', label: '★☆☆☆☆ (1 Star)' },
  { value: '2', label: '★★☆☆☆ (2 Stars)' },
  { value: '3', label: '★★★☆☆ (3 Stars)' },
  { value: '4', label: '★★★★☆ (4 Stars)' },
  { value: '5', label: '★★★★★ (5 Stars)' },
];

export const HAS_ATTACHMENT_OPTIONS = [
  { value: 'true', label: 'Has Attachments' },
  { value: 'false', label: 'No Attachments' },
];

export const PRIMARY_SAVED_SEARCH_FIELD_ITEMS: {
  value: SavedSearchField;
  label: string;
}[] = [
  { value: 'title', label: 'Title' },
  { value: 'creator', label: 'Author / Creator' },
  { value: 'year', label: 'Year' },
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'dateModified', label: 'Date Modified' },
  { value: 'anyField', label: 'Any Field' },
  { value: 'itemType', label: 'Item Type' },
  { value: 'collection', label: 'Collection' },
  { value: 'tag', label: 'Tag' },
  { value: 'noteContent', label: 'Note' },
  { value: 'attachmentContent', label: 'Attachment Content' },
  { value: 'attachmentFilename', label: 'Attachment File Name' },
  { value: 'doi', label: 'DOI' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'url', label: 'URL' },
  { value: 'readStatus', label: 'Read Status' },
  { value: 'rating', label: 'Rating' },
];

export const PRIMARY_FIELD_SET = new Set(
  PRIMARY_SAVED_SEARCH_FIELD_ITEMS.map((f) => f.value),
);

export const ALL_SCHEMA_FIELD_ITEMS: {
  value: SavedSearchField;
  label: string;
}[] = Object.entries(FIELD_LABELS)
  .filter(
    ([key]) =>
      !PRIMARY_FIELD_SET.has(key as SavedSearchField) &&
      key !== 'citationCount' &&
      key !== 'referenceCount',
  )
  .map(([key, label]) => ({
    value: key as SavedSearchField,
    label,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function getFieldConfig(field: SavedSearchField | string): SavedSearchFieldConfig {
  const f = field as SavedSearchField;

  if (f === 'anyField') {
    return {
      value: 'anyField',
      label: 'Any Field',
      type: 'text',
      operators: [
        { value: 'contains', label: 'contains' },
        { value: 'doesNotContain', label: 'does not contain' },
        { value: 'is', label: 'is (exact)' },
        { value: 'isNot', label: 'is not' },
      ],
      placeholder: 'Search across all fields, authors, notes, tags...',
    };
  }

  if (
    f === 'dateAdded' ||
    f === 'dateModified' ||
    f === 'date' ||
    f === 'publicationDate' ||
    f === 'accessDate' ||
    f === 'accessedAt' ||
    f === 'filingDate' ||
    f === 'issueDate' ||
    f === 'dateDecided' ||
    f === 'dateEnacted'
  ) {
    const label =
      f === 'dateAdded'
        ? 'Date Added'
        : f === 'dateModified'
          ? 'Date Modified'
          : FIELD_LABELS[f] || humanizeFieldName(f);

    return {
      value: f,
      label,
      type: 'date',
      operators: [
        { value: 'isInTheLast', label: 'is in the last' },
        { value: 'isGreaterThan', label: 'is after (>)' },
        { value: 'isLessThan', label: 'is before (<)' },
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
        { value: 'isBetween', label: 'is between' },
        { value: 'isPresent', label: 'is set' },
        { value: 'isAbsent', label: 'is not set' },
      ],
      placeholder: 'YYYY-MM-DD',
      defaultValue: '30 days',
    };
  }

  if (f === 'year' || f === 'numberOfVolumes' || f === 'numPages') {
    const label = FIELD_LABELS[f] || humanizeFieldName(f);
    return {
      value: f,
      label,
      type: 'number',
      operators: [
        { value: 'is', label: 'equals (=)' },
        { value: 'isGreaterThan', label: 'is greater than (>)' },
        { value: 'isLessThan', label: 'is less than (<)' },
        { value: 'isNot', label: 'is not equal to (≠)' },
        { value: 'isBetween', label: 'is between' },
        { value: 'isPresent', label: 'has value' },
        { value: 'isAbsent', label: 'is empty' },
      ],
      placeholder: 'Enter number...',
    };
  }

  if (f === 'itemType') {
    return {
      value: 'itemType',
      label: 'Item Type',
      type: 'enum',
      operators: [
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
        { value: 'isPresent', label: 'is not empty' },
        { value: 'isAbsent', label: 'is empty' },
      ],
      placeholder: 'Select item type...',
      defaultValue: 'journalArticle',
    };
  }

  if (f === 'collection') {
    return {
      value: 'collection',
      label: 'Collection',
      type: 'enum',
      operators: [
        { value: 'is', label: 'is in collection' },
        { value: 'isNot', label: 'is not in collection' },
        { value: 'isPresent', label: 'is in any collection' },
        { value: 'isAbsent', label: 'is unfiled (no collection)' },
      ],
      placeholder: 'Select collection...',
    };
  }

  if (f === 'tag') {
    return {
      value: 'tag',
      label: 'Tag',
      type: 'text',
      operators: [
        { value: 'contains', label: 'contains' },
        { value: 'is', label: 'is exact tag' },
        { value: 'doesNotContain', label: 'does not contain' },
        { value: 'isPresent', label: 'has tags' },
        { value: 'isAbsent', label: 'no tags' },
      ],
      placeholder: 'Enter tag name...',
    };
  }

  if (f === 'hasAttachment') {
    return {
      value: 'hasAttachment',
      label: 'Has Attachment',
      type: 'boolean',
      operators: [{ value: 'is', label: 'is' }],
      placeholder: 'Select attachment status...',
      defaultValue: 'true',
    };
  }

  if (f === 'readStatus') {
    return {
      value: 'readStatus',
      label: 'Read Status',
      type: 'enum',
      operators: [
        { value: 'is', label: 'is' },
        { value: 'isNot', label: 'is not' },
      ],
      placeholder: 'Select reading status...',
      defaultValue: 'unread',
    };
  }

  if (f === 'rating') {
    return {
      value: 'rating',
      label: 'Rating',
      type: 'number',
      operators: [
        { value: 'is', label: 'equals (=)' },
        { value: 'isGreaterThan', label: 'is greater than (>)' },
        { value: 'isLessThan', label: 'is less than (<)' },
        { value: 'isNot', label: 'is not equal to (≠)' },
        { value: 'isPresent', label: 'is rated' },
        { value: 'isAbsent', label: 'is unrated' },
      ],
      placeholder: 'Select rating...',
      defaultValue: '3',
    };
  }

  const label = FIELD_LABELS[f] || humanizeFieldName(f) || f;
  return {
    value: f,
    label,
    type: 'text',
    operators: [
      { value: 'contains', label: 'contains' },
      { value: 'doesNotContain', label: 'does not contain' },
      { value: 'is', label: 'is (exact)' },
      { value: 'isNot', label: 'is not' },
      { value: 'beginsWith', label: 'begins with' },
      { value: 'endsWith', label: 'ends with' },
      { value: 'isPresent', label: 'is not empty' },
      { value: 'isAbsent', label: 'is empty' },
    ],
    placeholder: `Enter ${label.toLowerCase()}...`,
  };
}

export function parseDurationParts(val: string): { count: string; unit: string } {
  if (!val || typeof val !== 'string') return { count: '30', unit: 'days' };
  const match = val.trim().match(/^(\d+)\s*([a-zA-Z]+)?$/);
  if (match) {
    const count = match[1] || '30';
    let unit = (match[2] || 'days').toLowerCase();
    if (unit.startsWith('d')) unit = 'days';
    else if (unit.startsWith('w')) unit = 'weeks';
    else if (unit.startsWith('m')) unit = 'months';
    else if (unit.startsWith('y')) unit = 'years';
    else unit = 'days';
    return { count, unit };
  }
  return { count: '30', unit: 'days' };
}

export function formatConditionValue(
  field: SavedSearchField | string,
  val: unknown,
): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;
  const trimmed = String(val).trim();
  if (field === 'year' || field === 'rating') {
    const num = Number(trimmed);
    return !isNaN(num) && trimmed !== '' ? num : trimmed;
  }
  if (field === 'hasAttachment') {
    return trimmed === 'true';
  }
  return trimmed;
}
