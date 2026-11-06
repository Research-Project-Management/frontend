import type { SavedSearchCondition, SavedSearchConditionGroup, SavedSearchField, SavedSearchOperator, SavedSearchScopeOptions } from '@/features/library/domain/types/ingestion.types';
import { FIELD_LABELS, humanizeFieldName } from '@/features/library/domain/types/core.types';

/**
 * Pure Domain SavedSearchAstEngine
 * Zero React imports. Encapsulates Saved Search AST hydration, condition state transitions,
 * multi-mode validation (preview vs submit), and smart fallback naming.
 * All Saved Search query execution and live previews are evaluated authoritatively by Backend.
 */

function parseBetweenBounds(raw: unknown): [string, string] | null {
  if (Array.isArray(raw)) {
    if (raw.length < 2) return null;
    const a = String(raw[0] ?? '').trim();
    const b = String(raw[1] ?? '').trim();
    return a && b ? [a, b] : null;
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const a = String(rec.min ?? rec.from ?? rec.start ?? '').trim();
    const b = String(rec.max ?? rec.to ?? rec.end ?? '').trim();
    return a && b ? [a, b] : null;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.includes('..')
    ? trimmed.split('..')
    : trimmed.includes(',')
      ? trimmed.split(',')
      : trimmed.split(/\s+to\s+|\s*;\s*/i);
  if (parts.length < 2) return null;
  const start = (parts[0] ?? '').trim();
  const end = (parts[1] ?? '').trim();
  return start && end ? [start, end] : null;
}

interface HydratedSavedSearchAst {
  rows: ConditionRow[];
  preservedGroups: SavedSearchConditionGroup[];
  conjunction: 'AND' | 'OR';
  scopeOptions: Required<SavedSearchScopeOptions>;
}

interface TransitionConditionLookup {
  itemTypeOptions?: ReadonlyArray<{ value: string; label: string }>;
  collections?: ReadonlyArray<{ id: string; name: string }>;
}

interface SavedSearchValidationResult {
  valid: boolean;
  errors: string[];
  payload: SavedSearchConditionGroup;
  hasActiveConditions: boolean;
}

const DEFAULT_SCOPE_OPTIONS: Required<SavedSearchScopeOptions> = {
  searchSubcollections: true,
  showOnlyTopLevel: false,
  includeParentsAndChildren: true,
};

function isNoValueOperator(op: string): boolean {
  return (
    op === 'isPresent' ||
    op === 'is_present' ||
    op === 'isAbsent' ||
    op === 'is_absent' ||
    op === 'isEmpty' ||
    op === 'is_empty' ||
    op === 'isNotEmpty' ||
    op === 'is_not_empty'
  );
}

function isConditionGroupNode(node: unknown): node is SavedSearchConditionGroup {
  return (
    Boolean(node) &&
    typeof node === 'object' &&
    'conditions' in (node as Record<string, unknown>) &&
    Array.isArray((node as SavedSearchConditionGroup).conditions)
  );
}

function serializeConditionValueToRowString(val: unknown): string {
  if (val === undefined || val === null) return '';
  if (Array.isArray(val)) {
    return val.map((v) => String(v ?? '').trim()).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    const rec = val as Record<string, unknown>;
    const start = rec.min ?? rec.from ?? rec.start;
    const end = rec.max ?? rec.to ?? rec.end;
    if (start !== undefined || end !== undefined) {
      return `${start ?? ''}, ${end ?? ''}`.trim();
    }
    return '';
  }
  return String(val);
}

function formatRowConditionPayloadValue(row: ConditionRow): SavedSearchCondition['value'] {
  if (isNoValueOperator(row.operator)) return '';
  if (row.operator === 'isBetween' || row.operator === 'between') {
    const bounds = parseBetweenBounds(row.value);
    if (bounds) {
      const config = getFieldConfig(row.field);
      if (config.type === 'number' || row.field === 'year' || row.field === 'rating') {
        const n1 = Number(bounds[0]);
        const n2 = Number(bounds[1]);
        if (!Number.isNaN(n1) && !Number.isNaN(n2)) return [n1, n2];
      }
      return [bounds[0], bounds[1]];
    }
  }
  return formatConditionValue(row.field, row.value);
}

function createDefaultConditionRow(suffix?: string | number): ConditionRow {
  const idSuffix =
    suffix !== undefined
      ? String(suffix)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return { id: `row-${idSuffix}`, field: 'title', operator: 'contains', value: '' };
}

export const SavedSearchAstEngine = {
  /**
   * Hydrates a persisted `SavedSearchConditionGroup` into editable leaf `ConditionRow[]`
   * and preserved nested `SavedSearchConditionGroup[]`.
   */
  hydrate(group?: SavedSearchConditionGroup | null): HydratedSavedSearchAst {
    if (!group || typeof group !== 'object') {
      return {
        rows: [createDefaultConditionRow(1)],
        preservedGroups: [],
        conjunction: 'AND',
        scopeOptions: { ...DEFAULT_SCOPE_OPTIONS },
      };
    }

    const rawConj = String(
      (group as { conjunction?: string; matchMode?: string }).conjunction ||
        (group as { matchMode?: string }).matchMode ||
        'AND',
    ).toUpperCase();
    const isRootNot =
      rawConj === 'NOT' || Boolean((group as { not?: boolean }).not);
    const conjunction: 'AND' | 'OR' =
      rawConj === 'OR' || rawConj === 'ANY' ? 'OR' : 'AND';
    const rawScope = group.scopeOptions;
    const scopeOptions: Required<SavedSearchScopeOptions> = {
      searchSubcollections: rawScope?.searchSubcollections !== false,
      showOnlyTopLevel: Boolean(rawScope?.showOnlyTopLevel),
      includeParentsAndChildren: rawScope?.includeParentsAndChildren !== false,
    };

    const preservedGroups: SavedSearchConditionGroup[] = [];
    const leafNodes: SavedSearchCondition[] = [];

    if (isRootNot && Array.isArray(group.conditions) && group.conditions.length > 0) {
      preservedGroups.push({
        conjunction: 'NOT',
        conditions: group.conditions,
      });
    } else if (Array.isArray(group.conditions)) {
      for (const node of group.conditions) {
        if (isConditionGroupNode(node)) {
          preservedGroups.push(node);
        } else if (node && typeof node === 'object') {
          leafNodes.push(node as SavedSearchCondition);
        }
      }
    }

    const rows: ConditionRow[] =
      leafNodes.length > 0
        ? leafNodes.map((c, idx) => ({
            id: `row-${idx}-${Date.now()}`,
            field: (c.field || 'title') as SavedSearchField,
            operator: (c.operator || 'contains') as SavedSearchOperator,
            value: serializeConditionValueToRowString(c.value),
          }))
        : [createDefaultConditionRow()];

    return { rows, preservedGroups, conjunction, scopeOptions };
  },

  /**
   * Pure state transition for a single `ConditionRow` when field, operator, or value changes.
   * Encapsulates default operator/value resets for enum, boolean, `isBetween`, `isInTheLast`, and empty operators.
   */
  transitionCondition(
    row: ConditionRow,
    patch: Partial<ConditionRow>,
    lookup?: TransitionConditionLookup,
  ): ConditionRow {
    if (patch.field !== undefined && patch.field !== row.field) {
      const newField = patch.field;
      const config = getFieldConfig(newField);
      const defaultOp = patch.operator ?? (config.operators[0]?.value || 'contains');
      let defaultValue = patch.value ?? '';

      if (patch.value === undefined) {
        if (isNoValueOperator(defaultOp)) {
          defaultValue = '';
        } else if (newField === 'itemType') {
          defaultValue = lookup?.itemTypeOptions?.[0]?.value || 'journalArticle';
        } else if (newField === 'collection') {
          defaultValue = lookup?.collections?.[0]?.id || '';
        } else if (newField === 'readStatus') {
          defaultValue = 'unread';
        } else if (newField === 'rating') {
          defaultValue = '3';
        } else if (newField === 'hasAttachment') {
          defaultValue = 'true';
        } else if (defaultOp === 'isInTheLast') {
          defaultValue = '30 days';
        } else if (config.defaultValue) {
          defaultValue = config.defaultValue;
        }
      }

      return { ...row, ...patch, field: newField, operator: defaultOp, value: defaultValue };
    }

    if (patch.operator !== undefined && patch.operator !== row.operator) {
      const newOperator = patch.operator;
      let nextVal = patch.value !== undefined ? patch.value : row.value;

      if (patch.value === undefined) {
        if (isNoValueOperator(newOperator)) {
          nextVal = '';
        } else if (newOperator === 'isInTheLast' && (!nextVal || !nextVal.includes(' '))) {
          nextVal = '30 days';
        }
      }

      return { ...row, ...patch, operator: newOperator, value: nextVal };
    }

    return { ...row, ...patch };
  },

  /**
   * Validates `ConditionRow[]` and builds the normalized `SavedSearchConditionGroup` AST payload.
   */
  validate(
    rows: ConditionRow[],
    matchMode: 'AND' | 'OR' | 'NOT',
    preservedGroups: SavedSearchConditionGroup[] = [],
    mode: 'preview' | 'submit' = 'submit',
    scopeOptions?: SavedSearchScopeOptions,
  ): SavedSearchValidationResult {
    const errors: string[] = [];
    const validLeafConditions: SavedSearchCondition[] = [];

    for (const row of rows) {
      const op = row.operator;
      const trimmedVal = row.value.trim();

      if (isNoValueOperator(op)) {
        validLeafConditions.push({ field: row.field, operator: op, value: '' });
        continue;
      }

      if (!trimmedVal) {
        if (mode === 'submit') {
          errors.push('Please enter or select a search value for every condition.');
        }
        continue;
      }

      if (op === 'isBetween' || op === 'between') {
        const bounds = parseBetweenBounds(trimmedVal);
        if (!bounds) {
          errors.push(`Please enter two range bounds separated by a comma for "${row.field}".`);
          continue;
        }
        const config = getFieldConfig(row.field);
        const isNumeric =
          config.type === 'number' ||
          row.field === 'year' ||
          row.field === 'rating' ||
          (!Number.isNaN(Number(bounds[0])) && !Number.isNaN(Number(bounds[1])));
        if (isNumeric) {
          const startNum = Number(bounds[0]);
          const endNum = Number(bounds[1]);
          if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
            errors.push(`Range bounds for "${row.field}" must be valid numbers.`);
            continue;
          }
          if (startNum > endNum) {
            errors.push(`Range start (${startNum}) must be less than or equal to end (${endNum}).`);
            continue;
          }
          if (row.field === 'year' && (startNum < 0 || startNum > 9999 || endNum < 0 || endNum > 9999)) {
            errors.push('Please enter a valid 4-digit year (e.g. 2024).');
            continue;
          }
        }
      } else if (op === 'isInTheLast' || op === 'in_the_last') {
        const m = trimmedVal.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
        const durationNum = m ? Number(m[1]) : NaN;
        if (Number.isNaN(durationNum) || durationNum <= 0) {
          errors.push('Duration for "is in the last" must be a positive number.');
          continue;
        }
      } else if (row.field === 'year') {
        const parsedYear = Number(trimmedVal);
        if (!Number.isInteger(parsedYear) || parsedYear < 0 || parsedYear > 9999) {
          errors.push('Please enter a valid 4-digit year (e.g. 2024).');
          continue;
        }
      } else {
        const config = getFieldConfig(row.field);
        if (config.type === 'number' && Number.isNaN(Number(trimmedVal))) {
          errors.push(`Please enter a valid number for ${config.label || row.field}.`);
          continue;
        }
      }

      validLeafConditions.push({
        field: row.field,
        operator: op,
        value: formatRowConditionPayloadValue(row),
      });
    }

    const payload: SavedSearchConditionGroup = {
      conjunction: matchMode,
      conditions: [...validLeafConditions, ...preservedGroups],
      ...(scopeOptions ? { scopeOptions } : {}),
    };
    const hasActiveConditions = payload.conditions.length > 0;

    return {
      valid: errors.length === 0 && (mode === 'preview' || hasActiveConditions),
      errors,
      payload,
      hasActiveConditions,
    };
  },

  /**
   * Generates a human-friendly fallback name for a Saved Search when the user leaves the name blank.
   */
  synthesizeAutoName(
    rows: ConditionRow[],
    lookup?: { collections?: ReadonlyArray<{ id: string; name: string }> },
  ): string {
    const firstCond = rows[0];
    if (!firstCond) return 'Untitled Search';
    const config = getFieldConfig(firstCond.field);
    const fieldLabel = config.label || firstCond.field;
    const op = firstCond.operator as string;
    if (op === 'isPresent' || op === 'is_present' || op === 'isNotEmpty') {
      return `Has ${fieldLabel}`;
    }
    if (op === 'isAbsent' || op === 'is_absent' || op === 'isEmpty') {
      return `No ${fieldLabel}`;
    }
    const trimmed = firstCond.value.trim();
    if (trimmed) {
      if (firstCond.field === 'collection') {
        const found = lookup?.collections?.find((c) => c.id === firstCond.value);
        return found ? `Collection: ${found.name}` : 'Collection search';
      }
      return `${fieldLabel}: ${trimmed}`;
    }
    return `Search (${new Date().toLocaleDateString()})`;
  },
};

/**
 * Pure Saved Search Schema & Field Definitions
 * Single Source of Truth for Saved Search field configurations, operators,
 * duration parsing, and condition value formatting.
 */


interface SavedSearchOperatorConfig {
  value: SavedSearchOperator;
  label: string;
}

interface SavedSearchFieldConfig {
  value: SavedSearchField;
  label: string;
  type: 'text' | 'date' | 'boolean' | 'enum' | 'number';
  operators: SavedSearchOperatorConfig[];
  placeholder: string;
  defaultValue?: string;
}

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

const PRIMARY_FIELD_SET = new Set(
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
