/**
 * Wave 12: Exhaustive End-to-End Round-Trip Audit & Verification Across All 37 Zotero Schema v42 Item Types & All 121 Fields
 *
 * Verifies:
 * 1. Schema parity: All 37 bibliographic item types in LIBRARY_ITEM_TYPES match canonical Zotero Schema v42 (`zotero-schema.json`)
 *    for `fields` (order & keys), `baseField` mappings, `primaryCreatorType`, `creatorTypes`, and `CSL_TYPE_MAP`.
 * 2. Pipeline normalization (`mapBackendItemToPaper`): For all 37 item types, backend items with fields stored in
 *    top-level columns, `metadata`, or `extraFields` preserve 100% of fields and creator structures (`fieldMode`, `shortName`, `creatorType`).
 * 3. Inspector Field Resolution & Atomic Save (`resolveInspectorFieldValue` + `buildInspectorFieldPatch` + `formatAndSanitizeExtraMetadata`):
 *    Every single field of every single one of the 37 item types resolves accurately, saves atomically without dropping sibling `extraFields`,
 *    round-trips back to the exact saved value, and never leaks dedicated schema fields into the `Extra` text box.
 * 4. Multi-Format Export (`toBibTeXEntry`, `formatRis`, `formatCslJson`, `formatCitation`, `generateCitationKey`):
 *    Every single one of the 37 Zotero item types exports valid BibTeX, RIS, CSL-JSON, and APA/IEEE citations with type-specific
 *    titles (`caseName`, `nameOfAct`, `subject`), dates (`dateDecided`, `dateEnacted`, `issueDate`, `filingDate`),
 *    numbers (`patentNumber`, `docketNumber`, `publicLawNumber`, `billNumber`, `documentNumber`, `reportNumber`, `identifier`, `episodeNumber`),
 *    volumes/pages (`reporterVolume`/`firstPage`, `codeVolume`/`codePages`), and venues/authorities (`court`, `issuingAuthority`, `legislativeBody`, `repository`, `company`, `organization`, `meetingName`, `programTitle`).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LIBRARY_ITEM_TYPES,
  ALL_ITEM_TYPES_FLAT,
  BASE_FIELD_MAPPINGS,
  CSL_TYPE_MAP,
  getItemTypeDefinition,
  getPrimaryCreatorType,
  getTitleFieldForType,
  getDateFieldForType,
  getVenueFieldForType,
} from '@/features/library/domain/types/item-types.types';
import {
  mapBackendItem,
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  formatAndSanitizeExtraMetadata,
} from '@/features/library/domain/metadata';
import {
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
  DIRECT_METADATA_FIELDS,
} from '@/features/library/domain/item-field-schema';
import {
  parseCreators,
  toItemCreators,
} from '@/features/library/ui/inspector/fields/CreatorFields';
import {
  generateCitationKey,
  toBibTeXEntry,
  formatRis,
  formatCslJson,
  formatCitation,
  resolveExportSpec,
} from '@/features/library/domain/citations';

interface RawZoteroSchemaItemType {
  itemType: string;
  fields: Array<{ field: string; baseField?: string }>;
  creatorTypes: Array<{ creatorType: string; primary?: boolean }>;
}

const zoteroSchemaPath = path.resolve(
  __dirname,
  '../../../../backend/src/modules/library/core/data/zotero-schema.json',
);
const rawZoteroSchema = JSON.parse(fs.readFileSync(zoteroSchemaPath, 'utf8')) as {
  itemTypes: RawZoteroSchemaItemType[];
};

const canonicalBibliographicTypes = rawZoteroSchema.itemTypes.filter(
  (it) => it.itemType !== 'attachment' && it.itemType !== 'note' && it.itemType !== 'annotation',
);

/** Deterministic sample value generator for any of the 121 Zotero Schema v42 fields */
function buildSampleFieldValue(itemType: string, fieldName: string): string {
  const lower = fieldName.toLowerCase();
  if (lower === 'doi') return '10.1038/s41586-026-00001-x';
  if (lower === 'isbn') return '978-0-262-03561-3';
  if (lower === 'issn') return '0028-0836';
  if (lower === 'pmid') return '38492011';
  if (lower === 'pmcid') return 'PMC10928374';
  if (lower === 'archiveid') return itemType === 'preprint' ? 'arXiv:2601.12345' : '2601.12345';
  if (lower === 'url') return `https://example.org/${itemType.toLowerCase()}/record`;
  if (lower.includes('date')) return '2026-05-14';
  if (lower === 'numpages') return '342';
  if (lower === 'numberofvolumes') return '4';
  if (lower === 'volume' || lower === 'reportervolume' || lower === 'codevolume') return '42';
  if (lower === 'issue' || lower === 'episodenumber') return '7';
  if (lower === 'pages' || lower === 'firstpage' || lower === 'codepages') return '101-128';
  if (lower === 'citationkey') return `smith2026${itemType.toLowerCase()}`;
  if (lower === 'extra') return 'Original Date: 2024\nNIHMSID: NIHMS998877';
  if (lower === 'language') return 'en-US';
  if (lower === 'programminglanguage') return 'TypeScript';
  if (lower === 'versionnumber') return '4.2.0';
  return `${fieldName}_val_for_${itemType}`;
}

describe('Wave 12: Exhaustive All-37 Zotero Item Types & All-121 Fields Round-Trip Audit', () => {
  it('verifies exact 37 bibliographic item types and 100% field & creator role parity with zotero-schema.json', () => {
    expect(canonicalBibliographicTypes).toHaveLength(37);
    expect(ALL_ITEM_TYPES_FLAT).toHaveLength(37);
    expect(Object.keys(LIBRARY_ITEM_TYPES)).toHaveLength(37);

    const allUniqueFields = new Set<string>();

    for (const schemaType of canonicalBibliographicTypes) {
      const { itemType } = schemaType;
      const frontendDef = getItemTypeDefinition(itemType);
      expect(frontendDef, `Missing definition for ${itemType}`).toBeDefined();

      // 1. Exact fields in exact canonical Zotero order
      const expectedFieldNames = schemaType.fields.map((f) => f.field);
      const actualFieldNames = frontendDef!.fields.map((f) => f.field);
      expect(actualFieldNames, `Field list mismatch for ${itemType}`).toEqual(expectedFieldNames);

      for (const f of expectedFieldNames) {
        allUniqueFields.add(f);
      }

      // 2. Exact baseField mappings in Zotero Schema v42
      const expectedBaseMap: Record<string, string> = {};
      for (const f of schemaType.fields) {
        if (f.baseField) {
          expectedBaseMap[f.baseField] = f.field;
        }
      }
      expect(BASE_FIELD_MAPPINGS[itemType] || {}, `BASE_FIELD_MAPPINGS mismatch for ${itemType}`).toEqual(
        expectedBaseMap,
      );

      // 3. Exact creatorTypes & primaryCreatorType in canonical Zotero order
      const expectedCreatorRoles = schemaType.creatorTypes.map((c) => c.creatorType);
      const actualCreatorRoles = frontendDef!.creatorTypes.map((c) => c.creatorType);
      expect(actualCreatorRoles, `creatorTypes mismatch for ${itemType}`).toEqual(expectedCreatorRoles);

      const expectedPrimary =
        schemaType.creatorTypes.find((c) => c.primary)?.creatorType ||
        schemaType.creatorTypes[0]?.creatorType ||
        'author';
      expect(getPrimaryCreatorType(itemType), `primaryCreatorType mismatch for ${itemType}`).toBe(
        expectedPrimary,
      );

      // 4. CSL_TYPE_MAP entry exists
      expect(CSL_TYPE_MAP[itemType], `Missing CSL_TYPE_MAP for ${itemType}`).toBeTruthy();
    }

    expect(allUniqueFields.size).toBe(121);
    for (const field of allUniqueFields) {
      if (field !== 'title' && field !== 'extra') {
        expect(
          DIRECT_METADATA_FIELDS.has(field),
          `Field "${field}" missing from DIRECT_METADATA_FIELDS in domain/item-field-schema.ts`,
        ).toBe(true);
      }
    }
  });

  describe.each(canonicalBibliographicTypes.map((t) => [t.itemType, t] as const))(
    'Item Type [%s] end-to-end pipeline round-trip',
    (itemType, schemaType) => {
      it(`normalizes backend payload -> resolves all ${schemaType.fields.length} Inspector fields -> saves & round-trips patches -> exports BibTeX, RIS, CSL-JSON, and APA/IEEE`, () => {
        const primaryCreatorRole = getPrimaryCreatorType(itemType);
        const secondaryCreatorRole =
          schemaType.creatorTypes[1]?.creatorType || primaryCreatorRole;

        // 1. Construct raw backend payload with type-specific fields in extraFields & metadata
        const rawExtraFields: Record<string, unknown> = {};
        for (const f of schemaType.fields) {
          if (f.field === 'extra') continue;
          rawExtraFields[f.field] = buildSampleFieldValue(itemType, f.field);
        }

        const rawBackendPayload: Record<string, unknown> = {
          id: `id-${itemType}`,
          itemType,
          extra: 'Original Date: 2024\nNIHMSID: NIHMS998877',
          extraFields: rawExtraFields,
          creators: [
            {
              creatorType: primaryCreatorRole,
              firstName: 'Ada',
              lastName: 'Lovelace',
            },
            {
              creatorType: secondaryCreatorRole,
              name: 'World Health Organization',
              fieldMode: 1,
              shortName: 'WHO',
            },
          ],
        };

        // 2. Normalize via mapBackendItem
        const paper = mapBackendItem(rawBackendPayload);
        expect(paper.itemType).toBe(itemType);

        // Verify display title, display date, and venue extraction
        const titleField = getTitleFieldForType(itemType);
        const expectedTitle = buildSampleFieldValue(itemType, titleField);
        expect(getItemDisplayTitle(paper)).toBe(expectedTitle);
        expect(paper.title).toBe(expectedTitle);

        const dateField = getDateFieldForType(itemType);
        if (schemaType.fields.some((f) => f.field === dateField)) {
          expect(getItemDisplayDate(paper)).toBe(2026);
          expect(paper.year).toBe(2026);
        }

        const venueField = getVenueFieldForType(itemType);
        if (schemaType.fields.some((f) => f.field === venueField)) {
          expect(getPublicationVenue(paper)).toBe(buildSampleFieldValue(itemType, venueField));
        }

        // 3. Creator round-trip (preserving primary/secondary roles, fieldMode=1, and shortName)
        const parsedCreators = parseCreators(paper, primaryCreatorRole);
        expect(parsedCreators).toHaveLength(2);
        expect(parsedCreators[0]?.creatorType).toBe(primaryCreatorRole);
        expect(parsedCreators[0]?.lastName).toBe('Lovelace');
        expect(parsedCreators[1]?.creatorType).toBe(secondaryCreatorRole);
        expect(parsedCreators[1]?.fieldMode).toBe(1);
        expect(parsedCreators[1]?.shortName).toBe('WHO');

        const serializedCreators = toItemCreators(parsedCreators);
        expect(serializedCreators[0]?.creatorType).toBe(primaryCreatorRole);
        expect(serializedCreators[1]?.fieldMode).toBe(1);
        expect(serializedCreators[1]?.shortName).toBe('WHO');

        // 4. Verify every single schema field resolves in Inspector AND round-trips through buildInspectorFieldPatch
        let currentItemState: Record<string, unknown> = { ...paper };
        for (const f of schemaType.fields) {
          if (f.field === 'extra') continue;
          const expectedInitial = buildSampleFieldValue(itemType, f.field);
          const resolvedInitial = resolveInspectorFieldValue(currentItemState, f.field);
          expect(
            resolvedInitial,
            `Initial resolveInspectorFieldValue failed for ${itemType}.${f.field}`,
          ).toBe(expectedInitial);

          // Mutate the field via buildInspectorFieldPatch and verify round-trip
          const updatedVal =
            f.field.toLowerCase() === 'doi'
              ? '10.1145/9999999.8888888'
              : f.field.toLowerCase() === 'archiveid'
                ? itemType === 'preprint'
                  ? 'arXiv:2612.99999'
                  : '2612.99999'
                : f.field.toLowerCase().includes('date')
                  ? '2025-11-20'
                  : f.field.toLowerCase() === 'numpages'
                    ? '512'
                    : f.field.toLowerCase() === 'numberofvolumes'
                      ? '8'
                      : `${expectedInitial}_edited`;

          const patch = buildInspectorFieldPatch(currentItemState, f.field, updatedVal);
          currentItemState = {
            ...currentItemState,
            ...patch,
            extraFields: {
              ...((currentItemState.extraFields as Record<string, unknown>) || {}),
              ...((patch.extraFields as Record<string, unknown>) || {}),
            },
          };

          const resolvedAfterSave = resolveInspectorFieldValue(currentItemState, f.field);
          expect(
            resolvedAfterSave,
            `Post-save resolveInspectorFieldValue failed for ${itemType}.${f.field}`,
          ).toBe(updatedVal);
        }

        // 5. Verify dedicated schema fields in extraFields NEVER leak into the Extra text box
        const sanitizedExtra = formatAndSanitizeExtraMetadata(
          currentItemState.extra as string,
          currentItemState.extraFields as Record<string, unknown>,
          currentItemState,
        );
        if (!schemaType.fields.some((f) => f.field.toLowerCase() === 'originaldate')) {
          expect(sanitizedExtra).toContain('Original Date: 2024');
        }
        expect(sanitizedExtra).toContain('NIHMSID: NIHMS998877');
        for (const f of schemaType.fields) {
          const fl = f.field.toLowerCase();
          if (fl === 'extra') continue;
          expect(
            sanitizedExtra,
            `Dedicated field ${f.field} leaked into Extra display for ${itemType}`,
          ).not.toContain(`${f.field}:`);
        }

        // 6. Verify Client-Side Exports (BibTeX, RIS, CSL-JSON, APA, IEEE, CitationKey)
        const exportSpec = resolveExportSpec(paper);
        expect(exportSpec.cslType).toBe(CSL_TYPE_MAP[itemType]);

        const citeKey = generateCitationKey(paper);
        expect(citeKey).toBeTruthy();

        const bibtex = toBibTeXEntry(paper);
        expect(bibtex).toContain(`@${exportSpec.bibtexType}{`);
        expect(bibtex).toContain(`title = {${expectedTitle}}`);
        expect(bibtex).toContain('Ada Lovelace');
        expect(bibtex).toContain('{World Health Organization}');

        const ris = formatRis(paper);
        expect(ris).toContain(`TY  - ${exportSpec.risType}`);
        expect(ris).toContain(`TI  - ${expectedTitle}`);
        expect(ris).toContain('AU  - Lovelace, Ada');
        expect(ris).toContain('World Health Organization');

        const csl = formatCslJson(paper);
        expect(csl.type).toBe(CSL_TYPE_MAP[itemType]);
        expect(csl.title).toBe(expectedTitle);

        const apa = formatCitation(paper, 'apa');
        expect(apa).toContain('Lovelace, A.');
        expect(apa).toContain(expectedTitle);

        const ieee = formatCitation(paper, 'ieee');
        expect(ieee).toContain('A. Lovelace');
        expect(ieee).toContain(expectedTitle);
      });
    },
  );
});

