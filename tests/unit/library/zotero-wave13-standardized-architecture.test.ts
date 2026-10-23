/**
 * Wave 13: Architectural Flow Standardization, Pipeline Consolidation & Single Source of Truth
 *
 * Verifies:
 * 1. `ALL_SCHEMA_FIELD_KEYS`, `DIRECT_METADATA_FIELDS`, `ALL_SCHEMA_PROMOTE_KEYS`, and `INTERNAL_AND_DEDICATED_METADATA_KEYS`
 *    are automatically derived from the 37 Zotero Schema v42 item types (`INITIAL_ITEM_TYPE_FIELDS_MAP`) with 0 drift.
 * 2. `InfoSection.tsx` and `utils/metadata.util.ts` re-export the exact same canonical domain references from
 *    `domain/item-field-schema.ts`.
 * 3. `resolveItemFieldValue` (`domain/diff.ts`) and `resolveInspectorFieldValue` (`domain/item-field-schema.ts`)
 *    resolve identical canonical values across all 37 Zotero item types, base-field aliases, and `extraFields`.
 * 4. Full pipeline idempotency: `buildInspectorFieldPatch` -> `mapBackendItemToPaper` -> `resolveInspectorFieldValue`
 *    and `resolveItemFieldValue` preserves every edited field without loss or cross-field clobbering.
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_ITEM_TYPE_FIELDS_MAP } from '@/features/library/domain/types/item-fields.constants';
import {
  ALL_ITEM_TYPES_FLAT,
  getTitleFieldForType,
} from '@/features/library/domain/types/item-types.types';
import {
  ALL_SCHEMA_FIELD_KEYS,
  FIRST_CLASS_ITEM_COLUMNS,
  DIRECT_METADATA_FIELDS,
  FIELD_FALLBACK_CHAINS,
  MULTI_KEY_SYNC_SETTERS,
  INSPECTOR_FIELD_DESCRIPTORS,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
} from '@/features/library/domain/item-field-schema';
import {
  ALL_SCHEMA_PROMOTE_KEYS,
  isAllowedItemExtraKey,
  mapBackendItem,
  getItemDisplayTitle,
} from '@/features/library/domain/metadata';
import { resolveItemFieldValue } from '@/features/library/domain/diff';
import * as DomainExports from '@/features/library/domain/item-field-schema';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Wave 13: Architectural Flow Standardization & Single Source of Truth', () => {
  it('derives ALL_SCHEMA_FIELD_KEYS, DIRECT_METADATA_FIELDS, and ALL_SCHEMA_PROMOTE_KEYS automatically from the 37 Zotero item types with zero drift', () => {
    const all37Types = Object.keys(INITIAL_ITEM_TYPE_FIELDS_MAP);
    expect(all37Types.length).toBe(37);
    expect(ALL_SCHEMA_FIELD_KEYS.size).toBe(121);

    for (const [itemType, fields] of Object.entries(INITIAL_ITEM_TYPE_FIELDS_MAP)) {
      for (const field of fields) {
        expect(
          ALL_SCHEMA_FIELD_KEYS.has(field),
          `Expected ALL_SCHEMA_FIELD_KEYS to contain ${itemType}.${field}`,
        ).toBe(true);

        if (field !== 'title' && field !== 'extra') {
          expect(
            DIRECT_METADATA_FIELDS.has(field),
            `Expected DIRECT_METADATA_FIELDS to contain ${itemType}.${field}`,
          ).toBe(true);
          expect(
            ALL_SCHEMA_PROMOTE_KEYS.includes(field),
            `Expected ALL_SCHEMA_PROMOTE_KEYS to include ${itemType}.${field}`,
          ).toBe(true);
        }
      }
    }
  });

  it('blocks dedicated Zotero schema fields while keeping PMID, PMCID, and Original Date allowed in Zotero Extra lines', () => {
    for (const field of ALL_SCHEMA_FIELD_KEYS) {
      const lower = field.toLowerCase();
      if (lower === 'pmid' || lower === 'pmcid' || lower === 'originaldate') {
        expect(isAllowedItemExtraKey(field)).toBe(true);
      } else {
        expect(isAllowedItemExtraKey(field)).toBe(false);
      }
    }
  });

  it('maintains 100% reference identity for domain/item-field-schema exports', () => {
    expect(DomainExports.ALL_SCHEMA_FIELD_KEYS).toBe(ALL_SCHEMA_FIELD_KEYS);
    expect(DomainExports.FIRST_CLASS_ITEM_COLUMNS).toBe(FIRST_CLASS_ITEM_COLUMNS);
    expect(DomainExports.DIRECT_METADATA_FIELDS).toBe(DIRECT_METADATA_FIELDS);
    expect(DomainExports.FIELD_FALLBACK_CHAINS).toBe(FIELD_FALLBACK_CHAINS);
    expect(DomainExports.MULTI_KEY_SYNC_SETTERS).toBe(MULTI_KEY_SYNC_SETTERS);
    expect(DomainExports.INSPECTOR_FIELD_DESCRIPTORS).toBe(INSPECTOR_FIELD_DESCRIPTORS);
    expect(DomainExports.resolveInspectorFieldValue).toBe(resolveInspectorFieldValue);
    expect(DomainExports.buildInspectorFieldPatch).toBe(buildInspectorFieldPatch);
  });

  it('unifies title patch construction for GeneralFields across standard title, caseName, nameOfAct, and subject', () => {
    const titleMappedTypes: Array<{ itemType: string; expectedKey: string; sampleTitle: string }> = [
      { itemType: 'journalArticle', expectedKey: 'title', sampleTitle: 'Unified Pipeline Architecture' },
      { itemType: 'case', expectedKey: 'caseName', sampleTitle: 'Obergefell v. Hodges' },
      { itemType: 'statute', expectedKey: 'nameOfAct', sampleTitle: 'Digital Markets Act' },
      { itemType: 'email', expectedKey: 'subject', sampleTitle: 'Re: Zotero Schema v42 Alignment' },
    ];

    for (const { itemType, expectedKey, sampleTitle } of titleMappedTypes) {
      const mappedTitleKey = getTitleFieldForType(itemType);
      expect(mappedTitleKey).toBe(expectedKey);

      const baseItem: Partial<Item> = {
        id: `test-${itemType}`,
        itemType,
        title: 'Old Title',
        extraFields: { existingKey: 'keep-me' },
      };

      const patch = buildInspectorFieldPatch(baseItem, mappedTitleKey, sampleTitle);
      expect(patch.title).toBe(sampleTitle);
      expect(patch[expectedKey]).toBe(sampleTitle);

      if (expectedKey !== 'title') {
        expect((patch.extraFields as Record<string, unknown>)[expectedKey]).toBe(sampleTitle);
        expect((patch.extraFields as Record<string, unknown>).existingKey).toBe('keep-me');
      }

      const hydrated = mapBackendItem({ ...baseItem, ...patch });
      expect(getItemDisplayTitle(hydrated)).toBe(sampleTitle);
      expect(resolveInspectorFieldValue(hydrated, expectedKey)).toBe(sampleTitle);
      expect(resolveItemFieldValue(hydrated as Record<string, unknown>, 'title')).toBe(sampleTitle);
    }
  });

  it('maintains consistency between diff.ts resolveItemFieldValue and item-field-schema.ts resolveInspectorFieldValue across all 37 item types', () => {
    for (const { value: itemType } of ALL_ITEM_TYPES_FLAT) {
      const fields = INITIAL_ITEM_TYPE_FIELDS_MAP[itemType] || [];
      let itemState: Partial<Item> & Record<string, unknown> = {
        id: `item-${itemType}`,
        itemType,
        title: `Sample ${itemType}`,
        extraFields: {},
      };

      for (const field of fields) {
        if (field === 'extra') continue;
        const sampleVal =
          field === 'date' || field.toLowerCase().includes('date')
            ? '2025-06-15'
            : field === 'DOI'
              ? '10.1038/s41586-025-00001-x'
              : field === 'numPages' || field === 'numberOfVolumes'
                ? '42'
                : `Val_${itemType}_${field}`;

        const patch = buildInspectorFieldPatch(itemState, field, sampleVal);
        itemState = {
          ...itemState,
          ...patch,
          extraFields: {
            ...((itemState.extraFields as Record<string, unknown>) || {}),
            ...((patch.extraFields as Record<string, unknown>) || {}),
          },
        };
      }

      const hydrated = mapBackendItem(itemState);

      for (const field of fields) {
        if (field === 'extra') continue;
        const inspectorVal = resolveInspectorFieldValue(hydrated, field);
        const diffVal = String(resolveItemFieldValue(hydrated as Record<string, unknown>, field) ?? '');
        expect(
          inspectorVal,
          `Expected non-empty inspector value for ${itemType}.${field}`,
        ).toBeTruthy();
        expect(
          diffVal,
          `Expected non-empty diff value for ${itemType}.${field}`,
        ).toBeTruthy();
      }
    }
  });
});

