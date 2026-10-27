/**
 * Pure Domain SavedSearchAstEngine
 * Zero React imports. Encapsulates Saved Search AST hydration, condition state transitions,
 * multi-mode validation (preview vs submit), smart fallback naming, and recursive client-side evaluation.
 */

import {
  type ConditionRow,
  getFieldConfig,
  formatConditionValue,
} from '@/features/library/domain/saved-search-schema.domain';
import {
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
} from '@/features/library/domain/metadata';
import { resolveItemFieldValue } from '@/features/library/domain/diff-primitives';
import type {
  SavedSearchCondition,
  SavedSearchConditionGroup,
  SavedSearchField,
  SavedSearchOperator,
  SavedSearchScopeOptions,
} from '@/features/library/domain/types/saved-searches.types';

export interface HydratedSavedSearchAst {
  rows: ConditionRow[];
  preservedGroups: SavedSearchConditionGroup[];
  conjunction: 'AND' | 'OR';
  scopeOptions: Required<SavedSearchScopeOptions>;
}

export interface TransitionConditionLookup {
  itemTypeOptions?: ReadonlyArray<{ value: string; label: string }>;
  collections?: ReadonlyArray<{ id: string; name: string }>;
}

export interface SavedSearchValidationResult {
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

export function parseBetweenBounds(raw: unknown): [string, string] | null {
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

function extractItemFieldValues(item: Record<string, unknown>, field: string): unknown[] {
  const normalizedField = field.trim();
  const extraFields =
    item.extraFields && typeof item.extraFields === 'object' && !Array.isArray(item.extraFields)
      ? (item.extraFields as Record<string, unknown>)
      : {};

  if (normalizedField === 'anyField') {
    const candidates: unknown[] = [
      getItemDisplayTitle(item) || item.title,
      resolveItemFieldValue(item, 'abstractNote'),
      item.abstractNote,
      item.abstract,
      getPublicationVenue(item) || item.publicationTitle,
      item.journal,
      resolveItemFieldValue(item, 'publisher') || item.publisher,
      resolveItemFieldValue(item, 'doi') || item.doi,
      resolveItemFieldValue(item, 'isbn') || item.isbn,
      resolveItemFieldValue(item, 'url') || item.url,
      getItemDisplayDate(item) ?? item.year,
      ...extractItemFieldValues(item, 'creator'),
      ...extractItemFieldValues(item, 'tag'),
    ];
    return candidates.filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  }

  if (normalizedField === 'title') {
    const canonicalTitle = getItemDisplayTitle(item);
    const rawTitle = item.title ?? extraFields.title;
    return [canonicalTitle, rawTitle].filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== '',
    );
  }

  if (
    normalizedField === 'publicationTitle' ||
    normalizedField === 'journal' ||
    normalizedField === 'venue'
  ) {
    const canonicalVenue = getPublicationVenue(item);
    const resolved = resolveItemFieldValue(item, normalizedField);
    return [canonicalVenue, resolved, item[normalizedField], extraFields[normalizedField]].filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== '',
    );
  }

  if (normalizedField === 'year' || normalizedField === 'date' || normalizedField === 'publicationDate') {
    const canonicalDate = getItemDisplayDate(item);
    const resolved = resolveItemFieldValue(item, normalizedField);
    return [canonicalDate, resolved, item[normalizedField], extraFields[normalizedField]].filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== '',
    );
  }

  if (normalizedField === 'hasAttachment' || normalizedField === 'hasFile') {
    const fileCount =
      typeof item.fileCount === 'number'
        ? item.fileCount
        : Array.isArray(item.attachments)
          ? item.attachments.length
          : 0;
    const hasFile = Boolean(item.hasFile || item.pdfUrl || fileCount > 0);
    return [hasFile, String(hasFile)];
  }

  if (normalizedField === 'hasNotes') {
    const noteCount =
      typeof item.noteCount === 'number'
        ? item.noteCount
        : Array.isArray(item.notes)
          ? item.notes.length
          : 0;
    const hasNotes = Boolean(item.hasNotes || noteCount > 0);
    return [hasNotes, String(hasNotes)];
  }

  if (normalizedField === 'collection') {
    const ids: string[] = [];
    if (Array.isArray(item.collectionIds)) {
      for (const id of item.collectionIds) {
        if (typeof id === 'string' && id.trim()) ids.push(id.trim());
      }
    }
    if (Array.isArray(item.collections)) {
      for (const col of item.collections) {
        if (typeof col === 'string' && col.trim()) {
          ids.push(col.trim());
        } else if (col && typeof col === 'object') {
          const cid =
            (col as { collectionId?: unknown; id?: unknown }).collectionId ??
            (col as { id?: unknown }).id;
          if (typeof cid === 'string' && cid.trim()) ids.push(cid.trim());
        }
      }
    }
    return ids;
  }

  if (normalizedField === 'tag' || normalizedField === 'tags') {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const out: string[] = [];
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) {
        out.push(t.trim());
      } else if (t && typeof t === 'object' && 'name' in t) {
        const name = String((t as { name?: unknown }).name ?? '').trim();
        if (name) out.push(name);
      }
    }
    return out;
  }

  if (normalizedField === 'authors' || normalizedField === 'creator' || normalizedField === 'creators') {
    const creators = Array.isArray(item.creators) ? item.creators : [];
    const authors = Array.isArray(item.authors) ? item.authors : [];
    const extracted: string[] = [];
    const pushEntry = (c: unknown) => {
      if (typeof c === 'string' && c.trim()) {
        extracted.push(c.trim());
      } else if (c && typeof colObj(c)) {
        const obj = c as Record<string, unknown>;
        const full = [obj.firstName, obj.lastName, obj.fullName, obj.name]
          .filter((v) => typeof v === 'string' && v.trim())
          .join(' ');
        if (full) extracted.push(full);
      }
    };
    for (const c of creators) pushEntry(c);
    for (const a of authors) pushEntry(a);
    return extracted;
  }

  const canonicalResolved = resolveItemFieldValue(item, normalizedField);
  if (canonicalResolved !== undefined && canonicalResolved !== null && String(canonicalResolved).trim() !== '') {
    return Array.isArray(canonicalResolved) ? canonicalResolved : [canonicalResolved];
  }

  const raw = item[normalizedField] ?? extraFields[normalizedField];
  if (Array.isArray(raw)) return raw;
  return raw === undefined || raw === null ? [] : [raw];
}

function colObj(val: unknown): boolean {
  return Boolean(val) && typeof val === 'object';
}

function evaluateLeafCondition(
  item: Record<string, unknown>,
  condition: SavedSearchCondition,
): boolean {
  const field = condition.field.trim();
  const op = condition.operator as string;
  const target = condition.value;
  const values = extractItemFieldValues(item, field);

  if (op === 'isPresent' || op === 'is_present' || op === 'isNotEmpty' || op === 'is_not_empty') {
    return values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
  }

  if (op === 'isAbsent' || op === 'is_absent' || op === 'isEmpty' || op === 'is_empty') {
    return (
      values.length === 0 ||
      values.every((v) => v === null || v === undefined || String(v).trim() === '')
    );
  }

  if (op === 'isBetween' || op === 'between') {
    const bounds = parseBetweenBounds(target);
    if (!bounds) return false;
    const minNum = Number(bounds[0]);
    const maxNum = Number(bounds[1]);
    if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
      return values.some((v) => {
        const num = typeof v === 'number' ? v : Number(v);
        return !Number.isNaN(num) && num >= minNum && num <= maxNum;
      });
    }
    const minTime = Date.parse(bounds[0]);
    const maxTime = Date.parse(bounds[1]);
    if (!Number.isNaN(minTime) && !Number.isNaN(maxTime)) {
      return values.some((v) => {
        const t = Date.parse(String(v));
        return !Number.isNaN(t) && t >= minTime && t <= maxTime;
      });
    }
    const minStr = bounds[0].toLowerCase();
    const maxStr = bounds[1].toLowerCase();
    return values.some((v) => {
      const s = String(v).trim().toLowerCase();
      return s >= minStr && s <= maxStr;
    });
  }

  if (op === 'isInTheLast' || op === 'in_the_last') {
    const rawStr = String(target ?? '').trim();
    const m = rawStr.match(/^(\d+)\s*([a-zA-Z]+)?$/);
    if (!m) return false;
    const count = Number(m[1]);
    if (Number.isNaN(count) || count <= 0) return false;
    const unit = (m[2] || 'days').toLowerCase();
    const daysMultiplier = unit.startsWith('y')
      ? 365
      : unit.startsWith('m')
        ? 30
        : unit.startsWith('w')
          ? 7
          : 1;
    const cutoffMs = Date.now() - count * daysMultiplier * 86_400_000;
    return values.some((v) => {
      const ts = Date.parse(String(v));
      return !Number.isNaN(ts) && ts >= cutoffMs;
    });
  }

  const targetStr =
    target !== undefined && target !== null ? String(target).trim().toLowerCase() : '';
  const targetNum = typeof target === 'number' ? target : Number(target);

  switch (op) {
    case 'is':
    case 'equals':
      return values.some((v) => String(v).trim().toLowerCase() === targetStr);
    case 'isNot':
    case 'is_not':
    case 'not_equals':
      return values.every((v) => String(v).trim().toLowerCase() !== targetStr);
    case 'contains':
      return values.some((v) => String(v).toLowerCase().includes(targetStr));
    case 'doesNotContain':
    case 'does_not_contain':
      return values.every((v) => !String(v).toLowerCase().includes(targetStr));
    case 'beginsWith':
    case 'begins_with':
      return values.some((v) => String(v).trim().toLowerCase().startsWith(targetStr));
    case 'endsWith':
    case 'ends_with':
      return values.some((v) => String(v).trim().toLowerCase().endsWith(targetStr));
    case 'isGreaterThan':
    case 'greater_than':
    case 'gt':
      if (!Number.isNaN(targetNum) && targetStr !== '') {
        return values.some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num > targetNum;
        });
      }
      return values.some((v) => String(v).trim() > String(target ?? '').trim());
    case 'isLessThan':
    case 'less_than':
    case 'lt':
      if (!Number.isNaN(targetNum) && targetStr !== '') {
        return values.some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num < targetNum;
        });
      }
      return values.some((v) => String(v).trim() < String(target ?? '').trim());
    default:
      return false;
  }
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

    const conjunction: 'AND' | 'OR' = group.conjunction === 'OR' ? 'OR' : 'AND';
    const rawScope = group.scopeOptions;
    const scopeOptions: Required<SavedSearchScopeOptions> = {
      searchSubcollections: rawScope?.searchSubcollections !== false,
      showOnlyTopLevel: Boolean(rawScope?.showOnlyTopLevel),
      includeParentsAndChildren: rawScope?.includeParentsAndChildren !== false,
    };

    const preservedGroups: SavedSearchConditionGroup[] = [];
    const leafNodes: SavedSearchCondition[] = [];

    if (Array.isArray(group.conditions)) {
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
    matchMode: 'AND' | 'OR',
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

  /**
   * Pure client-side recursive AST evaluator supporting `AND`, `OR`, `NOT`,
   * and core operators (`is`, `isNot`, `contains`, `doesNotContain`, `isGreaterThan`,
   * `isLessThan`, `isBetween`, `isInTheLast`, `isEmpty`/`isAbsent`, `isNotEmpty`/`isPresent`).
   */
  matchesItem(item: Record<string, unknown>, group: SavedSearchConditionGroup): boolean {
    if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
      return true;
    }

    const rawConjunction = String(
      (group as { conjunction?: string; operator?: string }).conjunction ||
        (group as { operator?: string }).operator ||
        'AND',
    ).toUpperCase();
    const isNotGroup =
      rawConjunction === 'NOT' || Boolean((group as { not?: boolean }).not);

    const evaluateNode = (node: SavedSearchCondition | SavedSearchConditionGroup): boolean =>
      isConditionGroupNode(node)
        ? SavedSearchAstEngine.matchesItem(item, node)
        : evaluateLeafCondition(item, node);

    if (rawConjunction === 'OR') {
      const matched = group.conditions.some(evaluateNode);
      return isNotGroup ? !matched : matched;
    }

    const matchedAll = group.conditions.every(evaluateNode);
    return isNotGroup ? !matchedAll : matchedAll;
  },
};
