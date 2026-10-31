import { buildInspectorFieldPatch } from '@/features/library/domain/item-field-schema';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  mapBackendItem,
  hydrateIdentifiersFromRelationalArray,
  projectContainerAndVenueTitles,
} from '@/features/library/domain/metadata-mapper';
import {
  buildExtraMetadataPatch,
  formatAndSanitizeExtraMetadata,
} from '@/features/library/domain/metadata-extra';
import {
  resolveDuplicateMergeFieldOverrides,
  buildMergedItemPayload,
} from '@/features/library/domain/diff';

import { CreatorFields } from '@/features/library/ui/inspector/fields/CreatorFields';
import { TypeConversionModal } from '@/features/library/ui/modals/TypeConversionModal';
import type { Item, SchemaItemTypeDefinition } from '@/features/library/domain/types/library.types';

vi.mock('@/features/library/sdk/queries/saved-searches-relations.queries', () => ({
  useItemTypeConversion: () => ({
    convertAsync: vi.fn(),
    isConverting: false,
  }),
  useItemTypeConversionPreviewQuery: () => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/library/sdk/queries/catalog.queries', () => ({
  useLibraryCacheSynchronizer: () => ({
    invalidateItemById: vi.fn(),
  }),
}));

vi.mock('@/shared/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

describe('System Design Loop 2 — Frontend-Backend Symmetry (SD3-01, SD3-02, SD3-03, SD3-05, SD3-07, SD3-08, SD3-11)', () => {
  describe('SD3-01: Relational identifiers array hydration in mapBackendItem', () => {
    it('hydrates doi, arxivId, pmid, pmcid, isbn, issn from relational identifiers array when not already set', () => {
      const raw = {
        id: 'item-rel-1',
        title: 'Relational Identifiers Paper',
        itemType: 'journalArticle',
        identifiers: [
          { type: 'DOI', value: '10.1038/s41586-026-00001-x' },
          { identifierType: 'arXiv', value: '2601.12345' },
          { type: 'pmid', value: '39123456' },
          { type: 'PMCID', value: 'PMC11223344' },
          { type: 'isbn', value: '978-3-16-148410-0' },
          { type: 'ISSN', value: '0028-0836' },
        ],
      };

      const item = mapBackendItem(raw);
      expect(item.doi).toBe('10.1038/s41586-026-00001-x');
      expect((item as Record<string, unknown>).arxivId).toBe('2601.12345');
      expect((item as Record<string, unknown>).pmid).toBe('39123456');
      expect((item as Record<string, unknown>).pmcid).toBe('PMC11223344');
      expect(item.isbn).toBe('978-3-16-148410-0');
      expect(item.issn).toBe('0028-0836');
      expect((item.extraFields as Record<string, unknown>).doi).toBe('10.1038/s41586-026-00001-x');
      expect((item.extraFields as Record<string, unknown>).arxivId).toBe('2601.12345');
      expect((item.extraFields as Record<string, unknown>).pmid).toBe('39123456');
      expect((item.extraFields as Record<string, unknown>).pmcid).toBe('PMC11223344');
      expect((item.extraFields as Record<string, unknown>).isbn).toBe('978-3-16-148410-0');
      expect((item.extraFields as Record<string, unknown>).issn).toBe('0028-0836');
    });

    it('respects explicit tombstones (null / "") and does not overwrite them from relational identifiers', () => {
      const raw = {
        id: 'item-rel-tombstone',
        title: 'Tombstoned Identifiers Paper',
        itemType: 'journalArticle',
        doi: '',
        extraFields: {
          pmid: null,
          PMCID: null,
        },
        identifiers: [
          { type: 'doi', value: '10.1000/stale-doi' },
          { type: 'pmid', value: '99999999' },
          { type: 'pmcid', value: 'PMC9999999' },
          { type: 'arxivid', value: '2602.54321' },
        ],
      };

      const item = mapBackendItem(raw);
      expect(item.doi).toBe('');
      expect((item as Record<string, unknown>).pmid).toBeUndefined();
      expect((item as Record<string, unknown>).pmcid).toBeUndefined();
      expect((item as Record<string, unknown>).arxivId).toBe('2602.54321');
    });

    it('hydrateIdentifiersFromRelationalArray directly populates rec and ef', () => {
      const rec: Record<string, unknown> = {
        identifiers: [{ type: 'archiveid', value: '2512.00001' }],
      };
      const ef: Record<string, unknown> = {};
      hydrateIdentifiersFromRelationalArray(rec, ef);
      expect(rec.arxivId).toBe('2512.00001');
      expect(ef.arxivId).toBe('2512.00001');
    });
  });

  describe('SD3-02: Bidirectional Base Field Coupling in GeneralFields & metadata-mapper', () => {
    it('projects programTitle for tvBroadcast/radioBroadcast and seriesTitle for podcast/audioRecording from publicationTitle', () => {
      const tvItem = mapBackendItem({
        id: 'tv-1',
        title: 'Episode 1',
        itemType: 'tvBroadcast',
        publicationTitle: 'NOVA Science',
      });
      expect((tvItem as Record<string, unknown>).programTitle).toBe('NOVA Science');
      expect((tvItem.extraFields as Record<string, unknown>).programTitle).toBe('NOVA Science');

      const podcastItem = mapBackendItem({
        id: 'pod-1',
        title: 'Deep Dive on Systems',
        itemType: 'podcast',
        publicationTitle: 'Distributed Engineering Podcast',
      });
      expect((podcastItem as Record<string, unknown>).seriesTitle).toBe(
        'Distributed Engineering Podcast',
      );
      expect((podcastItem.extraFields as Record<string, unknown>).seriesTitle).toBe(
        'Distributed Engineering Podcast',
      );

      const audioItem = mapBackendItem({
        id: 'audio-1',
        title: 'Symphony No. 9',
        itemType: 'audioRecording',
        publicationTitle: 'Berlin Philharmonic Masterworks',
      });
      expect((audioItem as Record<string, unknown>).seriesTitle).toBe(
        'Berlin Philharmonic Masterworks',
      );

      // Reverse projection: seriesTitle -> publicationTitle
      const podReverse = mapBackendItem({
        id: 'pod-2',
        title: 'Episode 42',
        itemType: 'podcast',
        extraFields: { seriesTitle: 'Lexicon Show' },
      });
      expect(podReverse.publicationTitle).toBe('Lexicon Show');

      // Tombstoned target field should not be overwritten
      const mappedTomb: Record<string, unknown> = {
        itemType: 'tvBroadcast',
        publicationTitle: 'NOVA',
      };
      const recTomb: Record<string, unknown> = {
        itemType: 'tvBroadcast',
        publicationTitle: 'NOVA',
        programTitle: null,
      };
      const efTomb: Record<string, unknown> = { programTitle: null };
      projectContainerAndVenueTitles(mappedTomb, recTomb, efTomb);
      expect(mappedTomb.programTitle).toBeUndefined();
    });

    it('buildInspectorFieldPatch couples title, publicationTitle, place, date, numPages, and authority on edit and clear', () => {
      // 1. Title coupling: caseName (case), nameOfAct (statute), subject (email)
      const caseTitlePatch = buildInspectorFieldPatch(
        { id: 'c1', itemType: 'case' },
        'caseName',
        'Roe v. Wade',
      );
      expect(caseTitlePatch.title).toBe('Roe v. Wade');
      expect(caseTitlePatch.caseName).toBe('Roe v. Wade');
      expect((caseTitlePatch.extraFields as Record<string, unknown>).caseName).toBe('Roe v. Wade');

      const statuteClearPatch = buildInspectorFieldPatch(
        { id: 's1', itemType: 'statute', title: 'Old Act', extraFields: { nameOfAct: 'Old Act' } },
        'nameOfAct',
        '',
      );
      expect(statuteClearPatch.title).toBe('');
      expect(statuteClearPatch.nameOfAct).toBe('');
      expect((statuteClearPatch.extraFields as Record<string, unknown>).nameOfAct).toBeNull();

      const emailTitlePatch = buildInspectorFieldPatch(
        { id: 'e1', itemType: 'email' },
        'subject',
        'Project Milestone Update',
      );
      expect(emailTitlePatch.title).toBe('Project Milestone Update');
      expect(emailTitlePatch.subject).toBe('Project Milestone Update');

      // 2. publicationTitle coupling: reporter, code, blogTitle, forumTitle, dictionaryTitle, encyclopediaTitle, programTitle
      const blogPatch = buildInspectorFieldPatch(
        { id: 'b1', itemType: 'blogPost' },
        'blogTitle',
        'Engineering Blog',
      );
      expect(blogPatch.publicationTitle).toBe('Engineering Blog');
      expect(blogPatch.blogTitle).toBe('Engineering Blog');

      const tvClearPatch = buildInspectorFieldPatch(
        { id: 'tv1', itemType: 'tvBroadcast', publicationTitle: 'Show', extraFields: { programTitle: 'Show' } },
        'programTitle',
        '',
      );
      expect(tvClearPatch.publicationTitle).toBe('');
      expect(tvClearPatch.programTitle).toBe('');
      expect((tvClearPatch.extraFields as Record<string, unknown>).programTitle).toBeNull();
      expect((tvClearPatch.extraFields as Record<string, unknown>).publicationTitle).toBeNull();

      // 3. place coupling: eventPlace (conferencePaper, presentation, artwork, letter) and country (patent)
      const confPlacePatch = buildInspectorFieldPatch(
        { id: 'cp1', itemType: 'conferencePaper' },
        'eventPlace',
        'Vancouver, Canada',
      );
      expect(confPlacePatch.place).toBe('Vancouver, Canada');
      expect(confPlacePatch.eventPlace).toBe('Vancouver, Canada');
      expect((confPlacePatch.extraFields as Record<string, unknown>).place).toBe('Vancouver, Canada');
      expect((confPlacePatch.extraFields as Record<string, unknown>).eventPlace).toBe('Vancouver, Canada');

      const patentCountryPatch = buildInspectorFieldPatch(
        { id: 'pat1', itemType: 'patent' },
        'country',
        'United States',
      );
      expect(patentCountryPatch.place).toBe('United States');
      expect(patentCountryPatch.country).toBe('United States');

      // 4. date coupling: dateDecided, dateEnacted, issueDate, filingDate
      const caseDatePatch = buildInspectorFieldPatch(
        { id: 'c1', itemType: 'case' },
        'dateDecided',
        '2024-05-15',
      );
      expect(caseDatePatch.date).toBe('2024-05-15');
      expect(caseDatePatch.publicationDate).toBe('2024-05-15');
      expect(caseDatePatch.dateDecided).toBe('2024-05-15');
      expect(caseDatePatch.year).toBe(2024);

      const patentFilingClear = buildInspectorFieldPatch(
        { id: 'pat1', itemType: 'patent', year: 2023 },
        'filingDate',
        '',
      );
      expect(patentFilingClear.date).toBe('');
      expect(patentFilingClear.publicationDate).toBe('');
      expect(patentFilingClear.filingDate).toBe('');
      expect(patentFilingClear.year).toBeNull();

      // 5. numPages <-> numberOfPages and authority <-> issuingAuthority
      const pagesPatch = buildInspectorFieldPatch(
        { id: 'bk1', itemType: 'book' },
        'numPages',
        '420',
      );
      expect(pagesPatch.numPages).toBe('420');
      expect(pagesPatch.numberOfPages).toBe('420');

      const authPatch = buildInspectorFieldPatch(
        { id: 'pat2', itemType: 'patent' },
        'authority',
        'USPTO',
      );
      expect(authPatch.authority).toBe('USPTO');
      expect(authPatch.issuingAuthority).toBe('USPTO');
    });
  });

  describe('SD3-03: CreatorFields secondary-role-only items do not copy editors into authors', () => {
    it('emits authors: [] and editors: ["Jane Editor"] when all creators have secondary roles', () => {
      const onUpdateItem = vi.fn();
      const item: Item = mapBackendItem({
        id: 'book-ed-1',
        title: 'Edited Volume',
        itemType: 'book',
        authors: ['Alice Primary'],
        creators: [
          { firstName: 'Alice', lastName: 'Primary', creatorType: 'author' },
        ],
      });
      const typeDef: SchemaItemTypeDefinition = {
        itemType: 'book',
        label: 'Book',
        primaryCreatorType: 'author',
        creatorTypes: [
          { creatorType: 'author', label: 'Author', primary: true },
          { creatorType: 'editor', label: 'Editor', primary: false },
          { creatorType: 'translator', label: 'Translator', primary: false },
        ],
        fields: [],
      };

      render(
        React.createElement(CreatorFields, {
          item,
          typeDefinition: typeDef,
          canEdit: true,
          onUpdateItem,
        }),
      );

      // Change the creator's role from Author to Editor via the role button or input edit
      const input = screen.getByDisplayValue('Alice Primary');
      fireEvent.change(input, { target: { value: 'Jane Editor' } });
      fireEvent.blur(input);

      expect(onUpdateItem).toHaveBeenCalledTimes(1);

      // Now simulate an item where the user switches the sole creator role to editor
      onUpdateItem.mockClear();
      const itemWithAuthorAndEditor: Item = mapBackendItem({
        id: 'book-ed-2',
        title: 'Edited Volume 2',
        itemType: 'book',
        authors: ['Alice Primary'],
        creators: [
          { firstName: 'Alice', lastName: 'Primary', creatorType: 'author' },
          { firstName: 'Jane', lastName: 'Editor', creatorType: 'editor' },
        ],
      });

      const { unmount } = render(
        React.createElement(CreatorFields, {
          item: itemWithAuthorAndEditor,
          typeDefinition: typeDef,
          canEdit: true,
          onUpdateItem,
        }),
      );

      // Remove the first creator (Alice Primary - author), leaving only Jane Editor (editor)
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      fireEvent.click(removeButtons[0]!);

      expect(onUpdateItem).toHaveBeenCalledTimes(1);
      const patch = onUpdateItem.mock.calls[0]![0] as Partial<Item>;
      expect(patch.authors).toEqual([]);
      expect(patch.editors).toEqual(['Jane Editor']);
      expect(patch.creators).toHaveLength(1);
      expect(patch.creators?.[0]?.creatorType).toBe('editor');
      unmount();
    });
  });

  describe('SD3-05 & SD3-07: Duplicate Merge Year Clearing & Top-Level Override Symmetry', () => {
    const masterItem = mapBackendItem({
      id: 'master-1',
      title: 'Master Paper',
      itemType: 'conferencePaper',
      year: 2023,
      date: '2023-06-01',
    });
    const candidateItem = mapBackendItem({
      id: 'cand-1',
      title: 'Master Paper',
      itemType: 'conferencePaper',
      year: 2024,
      date: '2024-06-01',
      isbn: '978-1-4503-0000-0',
      issn: '1234-5678',
      pmid: '11223344',
      pmcid: 'PMC5566778',
      arxivId: '2406.09999',
      proceedingsTitle: 'Proc. ICML 2024',
      series: 'PMLR Vol 235',
      place: 'Vienna, Austria',
    });

    it('SD3-05: emits out.year = null (never "") and nextExtraFields.year = null when year is cleared', () => {
      const resolvedNull = resolveDuplicateMergeFieldOverrides(
        [masterItem, candidateItem],
        'master-1',
        { year: null },
      );
      expect(resolvedNull.year).toBeNull();
      expect((resolvedNull.extraFields as Record<string, unknown>).year).toBeNull();

      const resolvedEmptyStr = resolveDuplicateMergeFieldOverrides(
        [masterItem, candidateItem],
        'master-1',
        { year: '' },
      );
      expect(resolvedEmptyStr.year).toBeNull();
      expect((resolvedEmptyStr.extraFields as Record<string, unknown>).year).toBeNull();

      const resolvedCustomEmpty = resolveDuplicateMergeFieldOverrides(
        [masterItem, candidateItem],
        'master-1',
        {},
        { customFieldTexts: { year: '' } },
      );
      expect(resolvedCustomEmpty.year).toBeNull();
      expect((resolvedCustomEmpty.extraFields as Record<string, unknown>).year).toBeNull();
    });

    it('SD3-07: emits every resolved field override at top-level out[fieldKey] in addition to nextExtraFields[fieldKey]', () => {
      const payload = buildMergedItemPayload(
        [masterItem, candidateItem],
        'master-1',
        {
          bookTitle: 'Advances in ML',
          edition: '2nd',
          university: 'TU Wien',
          institution: 'ELLIS',
        },
      );
      const rf = payload.resolvedFields;
      const ef = rf.extraFields as Record<string, unknown>;

      for (const key of [
        'isbn',
        'issn',
        'pmid',
        'pmcid',
        'arxivId',
        'proceedingsTitle',
        'bookTitle',
        'series',
        'edition',
        'place',
        'university',
        'institution',
      ]) {
        expect(rf[key]).toBeDefined();
        expect(rf[key]).not.toBe('');
        expect(ef[key]).toEqual(rf[key]);
      }
    });
  });

  describe('SD3-08: Editable & Deletable __unmapped_<sourceType>_<field> Keys in Extra', () => {
    it('tombstones __unmapped_<sourceType>_<field> when the user deletes its line from Extra', () => {
      const convertedItem = mapBackendItem({
        id: 'conv-1',
        title: 'Converted Paper',
        itemType: 'book',
        extra: 'Proceedings Title: NeurIPS 2025\nCustom Note: Keep me',
        extraFields: {
          __unmapped_conferencePaper_proceedingsTitle: 'NeurIPS 2025',
        },
        metadata: {
          __unmapped_conferencePaper_proceedingsTitle: 'NeurIPS 2025',
        },
      });

      const displayed = formatAndSanitizeExtraMetadata(
        convertedItem.extra,
        convertedItem.extraFields as Record<string, unknown>,
        convertedItem,
      );
      expect(displayed).toContain('Proceedings Title: NeurIPS 2025');

      // User deletes the Proceedings Title line
      const patchDeleted = buildExtraMetadataPatch(convertedItem, 'Custom Note: Keep me');
      expect(
        (patchDeleted.extraFields as Record<string, unknown>)
          .__unmapped_conferencePaper_proceedingsTitle,
      ).toBeNull();
      expect(
        (patchDeleted.metadata as Record<string, unknown>)
          .__unmapped_conferencePaper_proceedingsTitle,
      ).toBeNull();
    });

    it('updates __unmapped_<sourceType>_<field> when the user edits its value in Extra', () => {
      const convertedItem = mapBackendItem({
        id: 'conv-2',
        title: 'Converted Paper 2',
        itemType: 'book',
        extra: 'Proceedings Title: NeurIPS 2025',
        extraFields: {
          __unmapped_conferencePaper_proceedingsTitle: 'NeurIPS 2025',
        },
      });

      const patchEdited = buildExtraMetadataPatch(
        convertedItem,
        'Proceedings Title: ICML 2026',
      );
      expect(
        (patchEdited.extraFields as Record<string, unknown>)
          .__unmapped_conferencePaper_proceedingsTitle,
      ).toBe('ICML 2026');
    });
  });

  describe('SD3-11: Dynamic Unmapped Field Copy in TypeConversionModal', () => {
    it('reflects retainUnmapped checkbox state in header and per-row badges', () => {
      const mockItem = {
        id: 'item-conv-ui',
        title: 'Test Conversion Item',
        itemType: 'conferencePaper',
        version: 1,
      };
      const initialPreview = {
        sourceType: 'conferencePaper',
        targetType: 'book',
        preservedFields: ['title', 'date'],
        remappedFields: [],
        droppedFields: [
          {
            field: 'proceedingsTitle',
            label: 'Proceedings Title',
            value: 'NeurIPS 2025',
          },
        ],
        preservedCreators: [],
        remappedCreators: [],
      };

      render(
        React.createElement(TypeConversionModal, {
          open: true,
          onOpenChange: vi.fn(),
          item: mockItem,
          targetType: 'book',
          initialPreview,
        }),
      );

      // Default retainUnmapped is true
      expect(
        screen.getByText('Unmapped Fields — Moved to Extra'),
      ).toBeTruthy();
      expect(screen.getByText('→ Extra')).toBeTruthy();

      // Uncheck the checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(
        screen.getByText('Unmapped Fields — Will Be Discarded'),
      ).toBeTruthy();
      expect(screen.getByText('→ Discard')).toBeTruthy();
    });
  });
});
