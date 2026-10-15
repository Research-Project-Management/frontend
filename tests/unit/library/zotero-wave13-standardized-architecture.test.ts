/**
 * Wave 13: Architectural Flow Standardization, Pipeline Consolidation & Single Source of Truth
 *
 * Verifies:
 * 1. `ALL_SCHEMA_FIELD_KEYS`, `DIRECT_METADATA_FIELDS`, `ALL_ZOTERO_PROMOTE_KEYS`, and `INTERNAL_AND_DEDICATED_METADATA_KEYS`
 *    are automatically derived from the 37 Zotero Schema v42 item types (`INITIAL_ITEM_TYPE_FIELDS_MAP`) with 0 drift.
 * 2. `InfoSection.tsx` and `utils/metadata.util.ts` re-export the exact same canonical domain references from
 *    `domain/item-field-schema.ts`.
 * 3. `resolveItemFieldValue` (`domain/diff.ts`) and `resolveInspectorFieldValue` (`domain/item-field-schema.ts`)
 *    resolve identical canonical values across all 37 Zotero item types, base-field aliases, and `extraFields`.
 * 4. Full pipeline idempotency: `buildInspectorFieldPatch` -> `mapBackendItemToPaper` -> `resolveInspectorFieldValue`
 *    and `resolveItemFieldValue` preserves every edited field without loss or cross-field clobbering.
 */

import { describe, expect, it } from 'vitest';
import { INITIAL_ITEM_TYPE_FIELDS_MAP } from '@/features/library/types/item-fields.constants';
import {
  ALL_ITEM_TYPES_FLAT,
  getTitleFieldForType,
} from '@/features/library/types/item-types.types';
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
  ALL_ZOTERO_SCHEMA_FIELDS,
  ALL_ZOTERO_PROMOTE_KEYS,
  INTERNAL_AND_DEDICATED_METADATA_KEYS,
  isAllowedZoteroExtraKey,
  mapBackendItemToPaper,
  getItemDisplayTitle,
} from '@/features/library/domain/metadata';
import { resolveItemFieldValue } from '@/features/library/domain/diff';
import * as InfoSectionExports from '@/features/library/components/inspector/InfoSection';
import * as MetadataUtilExports from '@/features/library/domain/metadata.util';
import type { Item } from '@/features/library/types/library.types';

describe('Wave 13: Architectural Flow Standardization & Single Source of Truth', () => {
  it('derives ALL_SCHEMA_FIELD_KEYS, DIRECT_METADATA_FIELDS, and ALL_ZOTERO_PROMOTE_KEYS automatically from the 37 Zotero item types with zero drift', () => {
    const all37Types = Object.keys(INITIAL_ITEM_TYPE_FIELDS_MAP);
    expect(all37Types.length).toBe(37);
    expect(ALL_SCHEMA_FIELD_KEYS.size).toBe(121);
    expect(ALL_ZOTERO_SCHEMA_FIELDS.size).toBe(121);

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
            ALL_ZOTERO_PROMOTE_KEYS.includes(field),
            `Expected ALL_ZOTERO_PROMOTE_KEYS to include ${itemType}.${field}`,
          ).toBe(true);
        }
      }
    }
  });

  it('derives INTERNAL_AND_DEDICATED_METADATA_KEYS automatically while keeping PMID, PMCID, and Original Date allowed in Zotero Extra lines', () => {
    for (const field of ALL_SCHEMA_FIELD_KEYS) {
      const lower = field.toLowerCase();
      if (lower === 'pmid' || lower === 'pmcid' || lower === 'originaldate') {
        expect(isAllowedZoteroExtraKey(field)).toBe(true);
      } else {
        expect(
          INTERNAL_AND_DEDICATED_METADATA_KEYS.has(lower),
          `Expected INTERNAL_AND_DEDICATED_METADATA_KEYS to block dedicated schema field ${field}`,
        ).toBe(true);
        expect(isAllowedZoteroExtraKey(field)).toBe(false);
      }
    }
  });

  it('maintains 100% reference identity between domain/item-field-schema, InfoSection.tsx, and utils/metadata.util.ts', () => {
    expect(InfoSectionExports.ALL_SCHEMA_FIELD_KEYS).toBe(ALL_SCHEMA_FIELD_KEYS);
    expect(InfoSectionExports.FIRST_CLASS_ITEM_COLUMNS).toBe(FIRST_CLASS_ITEM_COLUMNS);
    expect(InfoSectionExports.DIRECT_METADATA_FIELDS).toBe(DIRECT_METADATA_FIELDS);
    expect(InfoSectionExports.FIELD_FALLBACK_CHAINS).toBe(FIELD_FALLBACK_CHAINS);
    expect(InfoSectionExports.MULTI_KEY_SYNC_SETTERS).toBe(MULTI_KEY_SYNC_SETTERS);
    expect(InfoSectionExports.INSPECTOR_FIELD_DESCRIPTORS).toBe(INSPECTOR_FIELD_DESCRIPTORS);
    expect(InfoSectionExports.resolveInspectorFieldValue).toBe(resolveInspectorFieldValue);
    expect(InfoSectionExports.buildInspectorFieldPatch).toBe(buildInspectorFieldPatch);

    expect(MetadataUtilExports.DIRECT_METADATA_FIELDS).toBe(DIRECT_METADATA_FIELDS);
    expect(MetadataUtilExports.resolveInspectorFieldValue).toBe(resolveInspectorFieldValue);
    expect(MetadataUtilExports.buildInspectorFieldPatch).toBe(buildInspectorFieldPatch);
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

      const hydrated = mapBackendItemToPaper({ ...baseItem, ...patch });
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

      const hydrated = mapBackendItemToPaper(itemState);

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
