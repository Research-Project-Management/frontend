import { z } from 'zod';
import { itemSchema } from './items.types';

export const savedSearchFieldSchema = z.string();

export const savedSearchOperatorSchema = z.enum([
  'is',
  'isNot',
  'contains',
  'doesNotContain',
  'beginsWith',
  'endsWith',
  'isGreaterThan',
  'isLessThan',
  'isBetween',
  'isInTheLast',
  'isPresent',
  'isAbsent',
  'greater_than',
  'less_than',
  'equals',
  'not_equals',
  'between',
]);

export const savedSearchScopeOptionsSchema = z.object({
  searchSubcollections: z.boolean().optional().default(true),
  showOnlyTopLevel: z.boolean().optional().default(false),
  includeParentsAndChildren: z.boolean().optional().default(true),
});

export type SavedSearchScopeOptions = z.infer<typeof savedSearchScopeOptionsSchema>;

export const savedSearchConditionSchema = z.object({
  field: savedSearchFieldSchema,
  operator: savedSearchOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
    z.record(z.string(), z.unknown()),
  ]).optional(),
});

export type SavedSearchCondition = z.infer<typeof savedSearchConditionSchema>;

export interface SavedSearchConditionGroup {
  conjunction: 'AND' | 'OR';
  conditions: (SavedSearchCondition | SavedSearchConditionGroup)[];
  scopeOptions?: SavedSearchScopeOptions;
}

export const savedSearchConditionGroupSchema: z.ZodType<SavedSearchConditionGroup> = z.lazy(() =>
  z.object({
    conjunction: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(
      z.union([savedSearchConditionSchema, savedSearchConditionGroupSchema]),
    ),
    scopeOptions: savedSearchScopeOptionsSchema.optional(),
  }),
);

export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  conditions: savedSearchConditionGroupSchema,
  scopeOptions: savedSearchScopeOptionsSchema.optional(),
  conjunction: z.enum(['AND', 'OR']).default('AND'),
  sortBy: z.enum(['dateAdded', 'year', 'title', 'creator']).optional().default('dateAdded'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  isPinned: z.boolean().optional().default(false),
  cachedCount: z.number().nullable().optional().default(0),
  lastEvaluatedAt: z.string().datetime().nullable().optional(),
  scopeId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  userId: z.string(),
  creator: z
    .object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createSavedSearchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  conditions: savedSearchConditionGroupSchema,
  scopeOptions: savedSearchScopeOptionsSchema.optional(),
  conjunction: z.enum(['AND', 'OR']).optional().default('AND'),
  sortBy: z.enum(['dateAdded', 'year', 'title', 'creator']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPinned: z.boolean().optional(),
  targetScope: z.string().optional(),
  scope: z.string().optional(),
});

export const updateSavedSearchSchema = createSavedSearchSchema.partial();

export const savedSearchResultsResponseSchema = z.object({
  savedSearch: savedSearchSchema,
  items: z.array(itemSchema),
  meta: z.object({
    totalCount: z.number(),
    cursor: z.string().optional(),
    hasNextPage: z.boolean(),
  }),
});

export const savedSearchPreviewResponseSchema = z.object({
  count: z.number(),
  sampleItems: z.array(itemSchema),
});

export type SavedSearchField = z.infer<typeof savedSearchFieldSchema>;
export type SavedSearchOperator = z.infer<typeof savedSearchOperatorSchema>;

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type SavedSearchResultsResponse = z.infer<
  typeof savedSearchResultsResponseSchema
>;
export type SavedSearchPreviewResponse = z.infer<
  typeof savedSearchPreviewResponseSchema
>;

function isConditionGroup(
  node: SavedSearchCondition | SavedSearchConditionGroup,
): node is SavedSearchConditionGroup {
  return 'conditions' in node && Array.isArray(node.conditions);
}

function extractNormalizedFieldValues(
  item: Record<string, unknown>,
  normalizedField: string,
): unknown[] {
  if (normalizedField === 'hasFile') {
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
  if (normalizedField === 'tag' || normalizedField === 'tags') {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const out: string[] = [];
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      const name =
        typeof t === 'string'
          ? t
          : t && typeof t === 'object' && 'name' in t
            ? String((t as { name: unknown }).name)
            : '';
      if (name) out.push(name);
    }
    return out;
  }
  if (normalizedField === 'authors' || normalizedField === 'creator' || normalizedField === 'creators') {
    const creators = Array.isArray(item.creators) ? item.creators : [];
    const authors = Array.isArray(item.authors) ? item.authors : [];
    const extracted: string[] = [];
    const processEntry = (c: unknown) => {
      if (typeof c === 'string') {
        extracted.push(c);
      } else if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        const full = [obj.firstName, obj.lastName, obj.fullName, obj.name]
          .filter((v) => typeof v === 'string' && v.trim())
          .join(' ');
        if (full) extracted.push(full);
      }
    };
    for (let i = 0; i < creators.length; i++) processEntry(creators[i]);
    for (let i = 0; i < authors.length; i++) processEntry(authors[i]);
    return extracted;
  }
  const raw = item[normalizedField];
  if (Array.isArray(raw)) return raw;
  if (raw === undefined || raw === null) return [];
  return [raw];
}

/**
 * Pre-compiles a single `SavedSearchCondition` into a zero-parse predicate closure
 * (Partial Evaluation Pattern: pre-computes normalizedField, targetStr, targetNum, and range bounds once).
 */
export function compileSavedSearchCondition(
  condition: SavedSearchCondition,
): (item: Record<string, unknown>) => boolean {
  const normalizedField = condition.field.trim();
  const op = condition.operator;
  const target = condition.value;

  if (op === 'isPresent') {
    return (item) => {
      const values = extractNormalizedFieldValues(item, normalizedField);
      return values.some((v) => v !== null && v !== undefined && String(v).trim() !== '');
    };
  }
  if (op === 'isAbsent') {
    return (item) => {
      const values = extractNormalizedFieldValues(item, normalizedField);
      return (
        values.length === 0 ||
        values.every((v) => v === null || v === undefined || String(v).trim() === '')
      );
    };
  }

  const targetStr =
    target !== undefined && target !== null ? String(target).trim().toLowerCase() : '';
  const targetNum = typeof target === 'number' ? target : Number(target);

  switch (op) {
    case 'is':
    case 'equals':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some(
          (v) => String(v).trim().toLowerCase() === targetStr,
        );
    case 'isNot':
    case 'not_equals':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).every(
          (v) => String(v).trim().toLowerCase() !== targetStr,
        );
    case 'contains':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) =>
          String(v).toLowerCase().includes(targetStr),
        );
    case 'doesNotContain':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).every(
          (v) => !String(v).toLowerCase().includes(targetStr),
        );
    case 'beginsWith':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) =>
          String(v).trim().toLowerCase().startsWith(targetStr),
        );
    case 'endsWith':
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) =>
          String(v).trim().toLowerCase().endsWith(targetStr),
        );
    case 'isGreaterThan':
    case 'greater_than':
      if (Number.isNaN(targetNum)) return () => false;
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num > targetNum;
        });
    case 'isLessThan':
    case 'less_than':
      if (Number.isNaN(targetNum)) return () => false;
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num < targetNum;
        });
    case 'isBetween':
    case 'between': {
      let min = NaN;
      let max = NaN;
      if (Array.isArray(target) && target.length >= 2) {
        min = Number(target[0]);
        max = Number(target[1]);
      } else if (target && typeof target === 'object') {
        const range = target as Record<string, unknown>;
        min = Number(range.min ?? range.from ?? range.start);
        max = Number(range.max ?? range.to ?? range.end);
      }
      if (Number.isNaN(min) || Number.isNaN(max)) return () => false;
      return (item) =>
        extractNormalizedFieldValues(item, normalizedField).some((v) => {
          const num = typeof v === 'number' ? v : Number(v);
          return !Number.isNaN(num) && num >= min && num <= max;
        });
    }
    default:
      return () => false;
  }
}

/**
 * Pre-compiles an entire `SavedSearchConditionGroup` AST into a fast predicate function.
 */
export function compileSavedSearch(
  group: SavedSearchConditionGroup,
): (item: Record<string, unknown>) => boolean {
  if (!group.conditions || group.conditions.length === 0) {
    return () => true;
  }
  const compiledChildren = group.conditions.map((node) =>
    isConditionGroup(node) ? compileSavedSearch(node) : compileSavedSearchCondition(node),
  );
  if (group.conjunction === 'OR') {
    return (item) => {
      for (let i = 0; i < compiledChildren.length; i++) {
        if (compiledChildren[i](item)) return true;
      }
      return false;
    };
  }
  return (item) => {
    for (let i = 0; i < compiledChildren.length; i++) {
      if (!compiledChildren[i](item)) return false;
    }
    return true;
  };
}

export function evaluateSavedSearchCondition(
  item: Record<string, unknown>,
  condition: SavedSearchCondition,
): boolean {
  return compileSavedSearchCondition(condition)(item);
}

export function evaluateSavedSearch(
  item: Record<string, unknown>,
  group: SavedSearchConditionGroup,
): boolean {
  return compileSavedSearch(group)(item);
}

export function filterItemsBySavedSearch<T extends Record<string, unknown>>(
  items: T[],
  group: SavedSearchConditionGroup,
): T[] {
  if (!items || items.length === 0) return [];
  if (!group.conditions || group.conditions.length === 0) return [...items];
  const predicate = compileSavedSearch(group);
  return items.filter(predicate);
}

