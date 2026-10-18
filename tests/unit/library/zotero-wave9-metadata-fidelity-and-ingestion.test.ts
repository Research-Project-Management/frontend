import { describe, expect, it } from 'vitest';
import type { Item } from '@/features/library/domain/types/library.types';
import {
  DIRECT_METADATA_FIELDS,
  FIELD_FALLBACK_CHAINS,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
  parseCreators,
  toItemCreators,
  areCreatorsEqual,
} from '@/features/library/ui/inspector/InfoSection';
import {
  formatAndSanitizeExtraMetadata,
  isAllowedZoteroExtraKey,
} from '@/features/library/domain/metadata';

function makeBaseItem(overrides: Partial<Item> & Record<string, unknown> = {}): Item {
  return {
    id: 'item-wave9-1',
    title: 'Wave 9 Test Item',
    authors: ['Vaswani, Ashish'],
    year: 2024,
    itemType: 'journalArticle',
    createdAt: '2025-03-10T00:00:00.000Z',
    updatedAt: '2025-03-10T00:00:00.000Z',
    ...overrides,
  } as Item;
}

describe('Zotero Wave 9 — Frontend Metadata Fidelity, Inspector Field Completeness & Author/Extra Hygiene', () => {
  describe('1. InfoSection Dynamic Field Resolution & Atomic Patch Persistence across Zotero Item Types', () => {
    it('expands DIRECT_METADATA_FIELDS to cover all Zotero Schema v42 specialized fields', () => {
      const requiredFields = [
        'chapter',
        'chapterNumber',
        'versionNumber',
        'version',
        'system',
        'company',
        'distributor',
        'studio',
        'network',
        'label',
        'audioRecordingFormat',
        'videoRecordingFormat',
        'runningTime',
        'episodeNumber',
        'sessionTitle',
        'programTitle',
        'forumTitle',
        'postType',
        'dictionaryTitle',
        'encyclopediaTitle',
        'artworkMedium',
        'artworkSize',
        'scale',
        'mapType',
        'interviewMedium',
        'presentationType',
        'meetingName',
        'caseName',
        'court',
        'docketNumber',
        'dateDecided',
        'legalStatus',
        'applicationNumber',
        'references',
        'history',
        'legislativeBody',
        'session',
        'billNumber',
        'code',
        'codeNumber',
        'codeVolume',
        'codePages',
        'publicLawNumber',
        'dateEnacted',
        'statuteNumber',
        'committee',
        'documentNumber',
        'filingDate',
        'country',
      ];
      for (const field of requiredFields) {
        expect(DIRECT_METADATA_FIELDS.has(field), `Expected DIRECT_METADATA_FIELDS to contain ${field}`).toBe(true);
      }
      expect(FIELD_FALLBACK_CHAINS.shorttitle).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.section).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.versionnumber).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.system).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.numberofvolumes).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.partnumber).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.parttitle).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.meetingname).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.thesistype).toBeDefined();
      expect(FIELD_FALLBACK_CHAINS.reporttype).toBeDefined();
    });

    it('resolves and saves thesis fields (university, thesisType, numPages) with extraFields synchronization', () => {
      const thesisItem = makeBaseItem({
        itemType: 'thesis',
        extraFields: {
          university: 'Massachusetts Institute of Technology',
          thesisType: 'Ph.D. Thesis',
          numPages: 184,
        },
      });

      expect(resolveInspectorFieldValue(thesisItem, 'university')).toBe(
        'Massachusetts Institute of Technology',
      );
      expect(resolveInspectorFieldValue(thesisItem, 'thesisType')).toBe('Ph.D. Thesis');
      expect(resolveInspectorFieldValue(thesisItem, 'numPages')).toBe('184');

      const uniPatch = buildInspectorFieldPatch(thesisItem, 'university', 'Stanford University');
      expect(uniPatch.university).toBe('Stanford University');
      expect(uniPatch.publisher).toBe('Stanford University');
      expect((uniPatch.extraFields as Record<string, unknown>)?.university).toBe(
        'Stanford University',
      );

      const typePatch = buildInspectorFieldPatch(thesisItem, 'thesisType', "Master's Thesis");
      expect(typePatch.thesisType).toBe("Master's Thesis");
      expect(typePatch.genre).toBe("Master's Thesis");
      expect(typePatch.type).toBe("Master's Thesis");
      expect((typePatch.extraFields as Record<string, unknown>)?.thesisType).toBe(
        "Master's Thesis",
      );
    });

    it('resolves and saves report fields (reportNumber, reportType, institution) with extraFields synchronization', () => {
      const reportItem = makeBaseItem({
        itemType: 'report',
        extraFields: {
          reportNumber: 'NIST SP 800-63B',
          reportType: 'Technical Special Publication',
          institution: 'National Institute of Standards and Technology',
        },
      });

      expect(resolveInspectorFieldValue(reportItem, 'reportNumber')).toBe('NIST SP 800-63B');
      expect(resolveInspectorFieldValue(reportItem, 'reportType')).toBe(
        'Technical Special Publication',
      );
      expect(resolveInspectorFieldValue(reportItem, 'institution')).toBe(
        'National Institute of Standards and Technology',
      );

      const numPatch = buildInspectorFieldPatch(reportItem, 'reportNumber', 'NIST SP 800-207');
      expect(numPatch.reportNumber).toBe('NIST SP 800-207');
      expect(numPatch.number).toBe('NIST SP 800-207');
      expect((numPatch.extraFields as Record<string, unknown>)?.reportNumber).toBe(
        'NIST SP 800-207',
      );
    });

    it('resolves and saves conferencePaper, bookSection, patent, and computerProgram fields cleanly', () => {
      const confItem = makeBaseItem({
        itemType: 'conferencePaper',
        extraFields: {
          proceedingsTitle: 'Advances in Neural Information Processing Systems 30',
          conferenceName: 'NeurIPS 2017',
          eventPlace: 'Long Beach, CA, USA',
        },
      });
      expect(resolveInspectorFieldValue(confItem, 'proceedingsTitle')).toBe(
        'Advances in Neural Information Processing Systems 30',
      );
      expect(resolveInspectorFieldValue(confItem, 'conferenceName')).toBe('NeurIPS 2017');
      expect(resolveInspectorFieldValue(confItem, 'eventPlace')).toBe('Long Beach, CA, USA');

      const bookSectionItem = makeBaseItem({
        itemType: 'bookSection',
        extraFields: {
          bookTitle: 'Deep Learning',
          partNumber: 'Part II',
          partTitle: 'Modern Practical Deep Networks',
          numberOfVolumes: '2',
        },
      });
      expect(resolveInspectorFieldValue(bookSectionItem, 'bookTitle')).toBe('Deep Learning');
      expect(resolveInspectorFieldValue(bookSectionItem, 'partNumber')).toBe('Part II');
      expect(resolveInspectorFieldValue(bookSectionItem, 'partTitle')).toBe(
        'Modern Practical Deep Networks',
      );
      expect(resolveInspectorFieldValue(bookSectionItem, 'numberOfVolumes')).toBe('2');

      const patentItem = makeBaseItem({
        itemType: 'patent',
        extraFields: {
          patentNumber: 'US10853717B2',
          applicationNumber: 'US15/821,452',
          filingDate: '2017-11-22',
          issueDate: '2020-12-01',
          assignee: 'Google LLC',
          issuingAuthority: 'United States Patent and Trademark Office',
          country: 'United States',
        },
      });
      expect(resolveInspectorFieldValue(patentItem, 'patentNumber')).toBe('US10853717B2');
      expect(resolveInspectorFieldValue(patentItem, 'applicationNumber')).toBe('US15/821,452');
      expect(resolveInspectorFieldValue(patentItem, 'filingDate')).toBe('2017-11-22');
      expect(resolveInspectorFieldValue(patentItem, 'issueDate')).toBe('2020-12-01');
      expect(resolveInspectorFieldValue(patentItem, 'assignee')).toBe('Google LLC');
      expect(resolveInspectorFieldValue(patentItem, 'issuingAuthority')).toBe(
        'United States Patent and Trademark Office',
      );
      expect(resolveInspectorFieldValue(patentItem, 'country')).toBe('United States');

      const softwareItem = makeBaseItem({
        itemType: 'computerProgram',
        extraFields: {
          versionNumber: '2.4.1',
          system: 'Linux, macOS, Windows',
          company: 'PyTorch Foundation',
          programmingLanguage: 'Python / C++',
        },
      });
      expect(resolveInspectorFieldValue(softwareItem, 'versionNumber')).toBe('2.4.1');
      expect(resolveInspectorFieldValue(softwareItem, 'system')).toBe('Linux, macOS, Windows');
      expect(resolveInspectorFieldValue(softwareItem, 'company')).toBe('PyTorch Foundation');
      expect(resolveInspectorFieldValue(softwareItem, 'programmingLanguage')).toBe('Python / C++');

      const sysPatch = buildInspectorFieldPatch(softwareItem, 'system', 'CUDA 12.4 / Linux');
      expect(sysPatch.system).toBe('CUDA 12.4 / Linux');
      expect((sysPatch.extraFields as Record<string, unknown>)?.system).toBe('CUDA 12.4 / Linux');
    });

    it('preserves versioned arXiv IDs (e.g. 2305.18290v2) on preprint and journalArticle items', () => {
      const preprintItem = makeBaseItem({
        itemType: 'preprint',
        arxivId: '2305.18290v2',
        repository: 'arXiv',
      });
      expect(resolveInspectorFieldValue(preprintItem, 'archiveID')).toBe('arXiv:2305.18290v2');
      expect(resolveInspectorFieldValue(preprintItem, 'arxivId')).toBe('arXiv:2305.18290v2');

      const articleWithArxivUrl = makeBaseItem({
        itemType: 'journalArticle',
        url: 'https://arxiv.org/abs/1706.03762v7',
      });
      expect(resolveInspectorFieldValue(articleWithArxivUrl, 'arxivId')).toBe('1706.03762v7');

      const arxivPatch = buildInspectorFieldPatch(preprintItem, 'archiveID', 'arXiv:2401.00001v3');
      expect(arxivPatch.arxivId).toBe('2401.00001v3');
      expect(arxivPatch.archiveID).toBe('arXiv:2401.00001v3');
      expect((arxivPatch.extraFields as Record<string, unknown>)?.arxivId).toBe('2401.00001v3');
    });
  });

  describe('2. Access Date / AccessedAt ISO Formatting Fidelity', () => {
    it('formats ISO timestamps (2025-03-10T00:00:00.000Z) as YYYY-MM-DD without timezone shifts', () => {
      const itemWithAccessedAt = makeBaseItem({
        accessedAt: '2025-03-10T00:00:00.000Z',
      });
      expect(resolveInspectorFieldValue(itemWithAccessedAt, 'accessDate')).toBe('2025-03-10');
      expect(resolveInspectorFieldValue(itemWithAccessedAt, 'accessedAt')).toBe('2025-03-10');

      const itemWithExtraAccessDate = makeBaseItem({
        extraFields: {
          accessDate: '2026-01-15T14:30:00.000Z',
        },
      });
      expect(resolveInspectorFieldValue(itemWithExtraAccessDate, 'accessDate')).toBe('2026-01-15');
    });
  });

  describe('3. CreatorFields Institutional Single-Field Mode (fieldMode: 1), Acronym & Secondary Roles', () => {
    it('preserves fieldMode: 1 and shortName without splitting institutional names containing "and" or "&"', () => {
      const item = makeBaseItem({
        creators: [
          {
            creatorType: 'author',
            fieldMode: 1,
            name: 'World Health Organization and UNICEF Joint Monitoring Programme',
            shortName: 'WHO/UNICEF',
          },
          {
            creatorType: 'author',
            fieldMode: 1,
            name: 'National Academy of Sciences, Engineering, and Medicine',
            shortName: 'NASEM',
          },
          {
            creatorType: 'editor',
            fieldMode: 0,
            firstName: 'Yann',
            lastName: 'LeCun',
            name: 'LeCun, Yann',
          },
          {
            creatorType: 'translator',
            fieldMode: 0,
            firstName: 'Clara',
            lastName: 'Moreau',
            name: 'Moreau, Clara',
          },
          {
            creatorType: 'seriesEditor',
            fieldMode: 0,
            firstName: 'michael i.',
            lastName: 'Jordan',
            name: 'Jordan, Michael I.',
          },
        ],
      });

      const parsed = parseCreators(item);
      expect(parsed).toHaveLength(5);

      expect(parsed[0]).toEqual({
        creatorType: 'author',
        name: 'World Health Organization and UNICEF Joint Monitoring Programme',
        fieldMode: 1,
        firstName: undefined,
        lastName: 'World Health Organization and UNICEF Joint Monitoring Programme',
        shortName: 'WHO/UNICEF',
      });

      expect(parsed[1]).toEqual({
        creatorType: 'author',
        name: 'National Academy of Sciences, Engineering, and Medicine',
        fieldMode: 1,
        firstName: undefined,
        lastName: 'National Academy of Sciences, Engineering, and Medicine',
        shortName: 'NASEM',
      });

      expect(parsed[2]?.creatorType).toBe('editor');
      expect(parsed[3]?.creatorType).toBe('translator');
      expect(parsed[4]?.creatorType).toBe('seriesEditor');

      // Round-trip back to Item CreatorCredit array
      const credits = toItemCreators(parsed);
      expect(credits[0]).toMatchObject({
        orderIndex: 0,
        creatorType: 'author',
        fieldMode: 1,
        name: 'World Health Organization and UNICEF Joint Monitoring Programme',
        firstName: undefined,
        lastName: 'World Health Organization and UNICEF Joint Monitoring Programme',
        shortName: 'WHO/UNICEF',
      });
      expect(credits[1]).toMatchObject({
        orderIndex: 1,
        creatorType: 'author',
        fieldMode: 1,
        name: 'National Academy of Sciences, Engineering, and Medicine',
        firstName: undefined,
        lastName: 'National Academy of Sciences, Engineering, and Medicine',
        shortName: 'NASEM',
      });
      expect(credits[2]?.creatorType).toBe('editor');
      expect(credits[3]?.creatorType).toBe('translator');
      expect(credits[4]?.creatorType).toBe('seriesEditor');

      // Semantic equality check detects fieldMode, role, and shortName differences
      expect(areCreatorsEqual(parsed, [...parsed])).toBe(true);
      expect(
        areCreatorsEqual(parsed, [
          { ...parsed[0]!, shortName: 'WHO' },
          ...parsed.slice(1),
        ]),
      ).toBe(false);
      expect(
        areCreatorsEqual(parsed, [
          { ...parsed[0]!, fieldMode: 0 },
          ...parsed.slice(1),
        ]),
      ).toBe(false);
    });
  });

  describe('4. Zotero Extra Sanitization & Internal Ingestion Telemetry Stripping', () => {
    it('strips all internal ingestion and verification telemetry lines while preserving genuine Zotero Extra entries', () => {
      const rawExtra = [
        'PMID: 34265844',
        'PMCID: PMC8284567',
        'Original Date: 1950-10-01',
        'tex.ids: vaswani2017attention',
        'IngestionStatus: VERIFIED',
        'VerificationScore: 0.95',
        'IsVerified: true',
        'FieldProvenance: [object Object]',
        'MatchedSignals: doi,title,authors',
        'MissingFields: volume,pages',
        'IsSelfSufficient: true',
        'EngineUsed: LOCAL_IN_PROCESS',
        'QualityScore: 0.92',
        'MergedFromIds: item-old-1,item-old-2',
        'PrimaryCategory: cs.CL',
        'CustomArchivalNote: Verified against Bodleian Library folio MS.24',
      ].join('\n');

      const extraFields: Record<string, unknown> = {
        ingestionStatus: 'VERIFIED',
        verificationScore: 0.95,
        isVerified: true,
        fieldProvenance: { title: 'crossref', doi: 'crossref' },
        matchedSignals: ['doi', 'title'],
        missingFields: [],
        isSelfSufficient: true,
        engineUsed: 'LOCAL_IN_PROCESS',
        qualityScore: 0.92,
        mergedFromIds: ['item-old-1'],
        primaryCategory: 'cs.CL',
        NIHMSID: 'NIHMS154321',
      };

      const sanitized = formatAndSanitizeExtraMetadata(rawExtra, extraFields);
      expect(sanitized).toContain('PMID: 34265844');
      expect(sanitized).toContain('PMCID: PMC8284567');
      expect(sanitized).toContain('Original Date: 1950-10-01');
      expect(sanitized).toContain('tex.ids: vaswani2017attention');
      expect(sanitized).toContain('CustomArchivalNote: Verified against Bodleian Library folio MS.24');
      expect(sanitized).toContain('NIHMSID: NIHMS154321');

      expect(sanitized).not.toContain('IngestionStatus');
      expect(sanitized).not.toContain('ingestionStatus');
      expect(sanitized).not.toContain('VerificationScore');
      expect(sanitized).not.toContain('IsVerified');
      expect(sanitized).not.toContain('FieldProvenance');
      expect(sanitized).not.toContain('[object Object]');
      expect(sanitized).not.toContain('MatchedSignals');
      expect(sanitized).not.toContain('MissingFields');
      expect(sanitized).not.toContain('IsSelfSufficient');
      expect(sanitized).not.toContain('EngineUsed');
      expect(sanitized).not.toContain('QualityScore');
      expect(sanitized).not.toContain('MergedFromIds');
      expect(sanitized).not.toContain('PrimaryCategory');

      expect(isAllowedZoteroExtraKey('IngestionStatus')).toBe(false);
      expect(isAllowedZoteroExtraKey('verification_score')).toBe(false);
      expect(isAllowedZoteroExtraKey('fieldProvenance')).toBe(false);
      expect(isAllowedZoteroExtraKey('engineUsed')).toBe(false);
      expect(isAllowedZoteroExtraKey('PMID')).toBe(true);
      expect(isAllowedZoteroExtraKey('Original Date')).toBe(true);
    });
  });
});

