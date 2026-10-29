import type { Item } from './types/library.types';
import { isValidValue } from './metadata-sanitizers';
import {
  ALLOWED_ITEM_EXTRA_LINE_KEYS,
  SYSTEM_INTERNAL_METADATA_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  DEDICATED_FIELDS_BY_TYPE_MAP,
  EMPTY_DEDICATED_FIELDS_SET,
  EXTRA_KEY_ALIASES,
  getMatchingExtraKeyNorms,
  collectUnmappedFieldsSet,
  isDedicatedFieldForType,
} from './metadata-extra.constants';

export function isSystemInternalExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return true;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return SYSTEM_INTERNAL_METADATA_KEYS.has(normalized);
}

export function isAllowedItemExtraKey(rawKey: string): boolean {
  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.startsWith('_')) return false;
  const normalized = trimmed.toLowerCase().replace(/[\s_-]+/g, '');
  return !INTERNAL_AND_DEDICATED_METADATA_KEYS.has(normalized);
}

/**
 * Formats the extra metadata field for inspector display.
 */
export function formatExtraDisplay(item: Item): string {
  const sanitized = formatAndSanitizeExtraMetadata(
    item.extra,
    item.extraFields as Record<string, unknown> | undefined,
    item,
  );
  if (sanitized) {
    return sanitized.replace(/\r?\n+/g, ', ');
  }
  return '—';
}

/**
 * Formats and cleans extra metadata text for the Inspector's Extra tab.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  const lines: string[] = [];
  const seenNormalizedLines = new Set<string>();

  const effectiveExtraFields =
    additionalExtraFields ||
    (associatedPaperItem?.extraFields as Record<string, unknown> | undefined);

  const resolvedItemType =
    (typeof associatedPaperItem?.itemType === 'string' &&
      associatedPaperItem.itemType) ||
    (typeof effectiveExtraFields?.itemType === 'string' &&
      effectiveExtraFields.itemType) ||
    undefined;

  const dedicatedFieldsForType: ReadonlySet<string> =
    (resolvedItemType && DEDICATED_FIELDS_BY_TYPE_MAP.get(resolvedItemType)) ||
    EMPTY_DEDICATED_FIELDS_SET;
  const unmappedFields = collectUnmappedFieldsSet(
    associatedPaperItem,
    additionalExtraFields,
  );

  const isDedicatedFieldOnCurrentType = (rawKey: string): boolean => {
    return isDedicatedFieldForType(
      rawKey,
      dedicatedFieldsForType,
      unmappedFields,
    );
  };

  const canRenderExtraFieldKey = (
    rawKey: string,
    fromExplicitExtraText: boolean,
  ): boolean => {
    const trimmedKey = rawKey.trim();
    if (!trimmedKey) return false;
    const normKey = trimmedKey.toLowerCase().replace(/[\s_-]+/g, '');
    if (unmappedFields.has(normKey)) {
      return true;
    }
    if (isSystemInternalExtraKey(trimmedKey)) return false;
    if (isDedicatedFieldOnCurrentType(trimmedKey)) {
      return false;
    }
    if (ALLOWED_ITEM_EXTRA_LINE_KEYS.has(normKey)) {
      return true;
    }
    if (resolvedItemType && fromExplicitExtraText) {
      return true;
    }
    return isAllowedItemExtraKey(trimmedKey);
  };

  const pushUniqueLine = (rawLine: string, fromExplicitExtraText = true) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const key = kvMatch[1]!.trim();
      const val = kvMatch[2]!.trim();
      if (
        !canRenderExtraFieldKey(key, fromExplicitExtraText) ||
        (!isValidValue(val) && val !== '0') ||
        val === '[object Object]'
      ) {
        return;
      }
    }
    const norm = trimmed
      .toLowerCase()
      .replace(/\s*:\s*/g, ': ')
      .replace(/\s+/g, ' ');
    if (!seenNormalizedLines.has(norm)) {
      seenNormalizedLines.add(norm);
      lines.push(trimmed);
    }
  };

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const parsedObj = parsed as Record<string, unknown>;
          if (
            typeof parsedObj._rawExtra === 'string' &&
            parsedObj._rawExtra.trim()
          ) {
            for (const l of parsedObj._rawExtra.split(/\r?\n/)) {
              pushUniqueLine(l, true);
            }
          }
          for (const [k, v] of Object.entries(parsedObj)) {
            if (k === '_rawExtra' || !canRenderExtraFieldKey(k, false)) {
              continue;
            }
            if (
              (typeof v === 'string' || typeof v === 'number') &&
              (isValidValue(v) || v === 0 || v === '0')
            ) {
              pushUniqueLine(`${k}: ${String(v).trim()}`, false);
            }
          }
        }
      } catch {
        for (const l of trimmed.split(/\r?\n/)) {
          pushUniqueLine(l, true);
        }
      }
    } else {
      for (const l of trimmed.split(/\r?\n/)) {
        pushUniqueLine(l, true);
      }
    }
  }

  if (effectiveExtraFields && typeof effectiveExtraFields === 'object') {
    for (const [k, v] of Object.entries(effectiveExtraFields)) {
      if (!canRenderExtraFieldKey(k, false)) {
        continue;
      }
      if (
        (typeof v === 'string' || typeof v === 'number') &&
        (isValidValue(v) || v === 0 || v === '0')
      ) {
        pushUniqueLine(`${k}: ${String(v).trim()}`, false);
      }
    }
  }

  return lines.join('\n').trim();
}

/**
 * Strips or updates in-place any `Key: Value` line or `{:Key: Value}` block in `extraText`
 * matching `canonicalKey` (including its `EXTRA_KEY_ALIASES` such as `DOI`, `PMID`, `PMCID`,
 * `arXiv`, `Original Date`, `Citation Key`). Returns `undefined` if `extraText` did not
 * contain a matching entry so callers only patch `item.extra` when necessary.
 */
export function stripOrUpdateExtraKeyLine(
  extraText: string | null | undefined,
  canonicalKey: string,
  newValue: string,
): string | undefined {
  if (typeof extraText !== 'string' || !extraText.trim()) return undefined;
  const matchingNorms = getMatchingExtraKeyNorms(canonicalKey);
  if (matchingNorms.size === 0) return undefined;

  const cleanNewVal = newValue.trim();
  let mutated = false;
  const nextLines: string[] = [];

  for (const rawLine of extraText.split(/\r?\n/)) {
    let workingLine = rawLine;
    if (workingLine.includes('{:')) {
      workingLine = workingLine.replace(
        /\{:([^:}]+):\s*([^}]+)\}/g,
        (fullMatch, rawKey: string, rawVal: string) => {
          const norm = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
          if (!matchingNorms.has(norm)) return fullMatch;
          if (!cleanNewVal) {
            mutated = true;
            return '';
          }
          if (rawVal.trim() !== cleanNewVal) {
            mutated = true;
          }
          return `{:${rawKey.trim()}: ${cleanNewVal}}`;
        },
      );
    }

    const trimmed = workingLine.trim();
    if (!trimmed) {
      if (rawLine.trim()) mutated = true;
      continue;
    }

    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const lineKey = kvMatch[1]!.trim();
      const lineVal = kvMatch[2]!.trim();
      const lineNorm = lineKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (matchingNorms.has(lineNorm)) {
        if (!cleanNewVal) {
          mutated = true;
          continue;
        }
        if (lineVal !== cleanNewVal) {
          mutated = true;
        }
        nextLines.push(`${lineKey}: ${cleanNewVal}`);
        continue;
      }
    }

    nextLines.push(workingLine);
  }

  return mutated ? nextLines.join('\n').trim() : undefined;
}

export function extractNormalizedExtraLines(
  text?: string | null,
): Map<string, { rawKey: string; value: string }> {
  const map = new Map<string, { rawKey: string; value: string }>();
  if (typeof text !== 'string' || !text.trim()) return map;
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const kvMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9._\s-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (kvMatch) {
      const rawKey = kvMatch[1]!.trim();
      const value = kvMatch[2]!.trim();
      const norm = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
      if (norm && !isSystemInternalExtraKey(rawKey)) {
        map.set(norm, { rawKey, value });
      }
    }
  }
  return map;
}

const PARSED_EXTRA_STRING_CACHE = new Map<string, Readonly<Record<string, string>>>();
const PARSED_EXTRA_OBJECT_CACHE = new WeakMap<object, Readonly<Record<string, string>>>();
const MAX_EXTRA_CACHE_SIZE = 5000;

/**
 * Parses item "Extra" field extended syntax (both `Key: Value` lines and `{:Key: Value}` blocks)
 * into a dictionary supporting both exact, lowercase, and canonical field lookups.
 */
export function parseItemExtraField(extra?: unknown): Record<string, string> {
  if (!extra) return {};

  if (typeof extra === 'string') {
    const trimmed = extra.trim();
    if (!trimmed) return {};
    const cached = PARSED_EXTRA_STRING_CACHE.get(trimmed);
    if (cached) {
      PARSED_EXTRA_STRING_CACHE.delete(trimmed);
      PARSED_EXTRA_STRING_CACHE.set(trimmed, cached);
      return cached;
    }
  } else if (typeof extra === 'object' && !Array.isArray(extra)) {
    const cached = PARSED_EXTRA_OBJECT_CACHE.get(extra);
    if (cached) return cached;
  }

  const result: Record<string, string> = {};
  const setKey = (rawKey: string, rawVal: string) => {
    const k = rawKey.trim();
    const v = rawVal.trim();
    if (!k || !isValidValue(v)) return;
    result[k] = v;
    const lower = k.toLowerCase();
    result[lower] = v;
    const collapsed = lower.replace(/[\s_-]+/g, '');
    result[collapsed] = v;
    const aliases = EXTRA_KEY_ALIASES[collapsed];
    if (aliases) {
      for (const alias of aliases) {
        if (!result[alias]) result[alias] = v;
        if (!result[alias.toLowerCase()]) result[alias.toLowerCase()] = v;
      }
    }
  };

  if (typeof extra === 'object' && !Array.isArray(extra)) {
    for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
      if (v !== null && v !== undefined && isValidValue(v)) {
        setKey(k, String(v));
      }
    }
    const frozen = Object.freeze(result);
    PARSED_EXTRA_OBJECT_CACHE.set(extra, frozen);
    return frozen;
  }

  if (typeof extra !== 'string') return result;
  const trimmed = extra.trim();
  if (!trimmed) return result;

  const cacheAndReturn = (res: Record<string, string>): Readonly<Record<string, string>> => {
    const frozen = Object.freeze(res);
    if (PARSED_EXTRA_STRING_CACHE.size >= MAX_EXTRA_CACHE_SIZE) {
      const oldest = PARSED_EXTRA_STRING_CACHE.keys().next().value;
      if (oldest !== undefined) {
        PARSED_EXTRA_STRING_CACHE.delete(oldest);
      }
    }
    PARSED_EXTRA_STRING_CACHE.set(trimmed, frozen);
    return frozen;
  };

  if (trimmed.startsWith('{') && !trimmed.startsWith('{:')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (v !== null && v !== undefined && isValidValue(v)) {
            setKey(k, String(v));
          }
        }
        return cacheAndReturn(result);
      }
    } catch {
      // Fall through to line-by-line Extra field parsing
    }
  }

  const inlineRegex = /\{:([^:}]+):\s*([^}]+)\}/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(trimmed)) !== null) {
    setKey(inlineMatch[1], inlineMatch[2]);
  }

  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const cleanLine = line.replace(/\{:[^:}]+:[^}]+\}/g, '').trim();
    if (!cleanLine) continue;
    const match = cleanLine.match(
      /^([A-Za-z][A-Za-z0-9\s_-]{0,40}?)\s*:\s*(.+)$/,
    );
    if (match) {
      setKey(match[1], match[2]);
    }
  }

  return cacheAndReturn(result);
}
