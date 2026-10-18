import { describe, it, expect } from 'vitest';
import {
  formatAndSanitizeExtraMetadata,
  formatExtraDisplay,
  isAllowedZoteroExtraKey,
} from '@/features/library/domain/metadata';
import {
  generateCitationKey,
  toBibTeXEntry,
  formatRis,
  formatCslJson,
} from '@/features/library/domain/citations';
import { buildFallbackCitation } from '@/features/library/core/coordinator/batch-action.coordinator';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Zotero Wave 8: Citation, Export & Metadata Format Grounding & Accuracy Remediation', () => {
  // ===========================================================================
  // Case Study 1: Zero Internal Metadata Leakage in Zotero `Extra` Field
  // ===========================================================================
  describe('Case Study 1: Zero Internal Metadata Leakage in Zotero Extra Field', () => {
    it('strips internal system/audit keys and dedicated first-class Inspector fields while preserving genuine Zotero 7 Extra lines', () => {
      const pollutedExtraFields: Record<string, unknown> = {
        // Internal audit / duplicate / retraction state that used to leak into the Extra box
        dismissedDuplicateIds: ['dup-991', 'dup-992'],
        mergedCitationKeys: ['vaswani2017old'],
        isRetracted: false,
        retractionDate: '2024-01-15',
        retractionReasons: ['Data integrity concern'],
        retractionNoticeDoi: '10.1000/retract.1',
        provenance: { sourceProvider: 'crossref', confidence: 0.99 },
        sourceProvider: 'crossref',
        extractionStatus: 'COMPLETED',
        _version: 4,
        deletedAt: null,
        // First-class Inspector fields that already have dedicated inputs
        title: 'Attention Is All You Need',
        publicationTitle: 'Advances in Neural Information Processing Systems',
        volume: '30',
        issue: '1',
        pages: '5998-6008',
        doi: '10.5555/3295222.3295349',
        isbn: '978-1-5108-6096-4',
        issn: '1049-5258',
        url: 'https://papers.nips.cc/paper/7181-attention-is-all-you-need',
        year: 2017,
        itemType: 'conferencePaper',
        // Genuine Zotero 7 Extra fields that MUST be preserved
        PMID: '28601938',
        PMCID: 'PMC5551234',
        'Original Date': '1925',
        'tex.ids': 'vaswani2017old, vaswani2017nips',
        NIHMSID: 'NIHMS12345',
        OCLC: '1029384756',
      };

      const rawExtra =
        'PMID: 28601938\ndismissedDuplicateIds: ["dup-991"]\ntitle: Duplicate Title\nReviewed by Clinical Panel A';

      const sanitized = formatAndSanitizeExtraMetadata(rawExtra, pollutedExtraFields);

      // Genuine Zotero Extra key-values and free-text notes are preserved without duplication
      expect(sanitized).toContain('PMID: 28601938');
      expect(sanitized.match(/PMID:\s*28601938/g)?.length).toBe(1);
      expect(sanitized).toContain('PMCID: PMC5551234');
      expect(sanitized).toContain('Original Date: 1925');
      expect(sanitized).toContain('tex.ids: vaswani2017old, vaswani2017nips');
      expect(sanitized).toContain('NIHMSID: NIHMS12345');
      expect(sanitized).toContain('OCLC: 1029384756');
      expect(sanitized).toContain('Reviewed by Clinical Panel A');

      // Zero leakage of internal system keys or dedicated first-class Inspector fields
      expect(sanitized).not.toContain('dismissedDuplicateIds');
      expect(sanitized).not.toContain('mergedCitationKeys');
      expect(sanitized).not.toContain('isRetracted');
      expect(sanitized).not.toContain('retractionReasons');
      expect(sanitized).not.toContain('provenance');
      expect(sanitized).not.toContain('extractionStatus');
      expect(sanitized).not.toContain('_version');
      expect(sanitized).not.toContain('title:');
      expect(sanitized).not.toContain('publicationTitle');
      expect(sanitized).not.toContain('volume:');
      expect(sanitized).not.toContain('pages:');
      expect(sanitized).not.toContain('doi:');

      // Verify formatExtraDisplay also renders clean inline summary without internal keys
      const itemWithPollutedExtra: Item = {
        id: 'item-extra-1',
        title: 'Attention Is All You Need',
        itemType: 'conferencePaper',
        authors: ['Vaswani, Ashish'],
        tags: [],
        collections: [],
        notes: [],
        attachments: [],
        extra: JSON.stringify(pollutedExtraFields),
        extraFields: pollutedExtraFields,
      };

      const display = formatExtraDisplay(itemWithPollutedExtra);
      expect(display).toContain('PMID: 28601938');
      expect(display).toContain('PMCID: PMC5551234');
      expect(display).not.toContain('dismissedDuplicateIds');
      expect(display).not.toContain('publicationTitle');
      expect(isAllowedZoteroExtraKey('PMID')).toBe(true);
      expect(isAllowedZoteroExtraKey('tex.ids')).toBe(true);
      expect(isAllowedZoteroExtraKey('dismissedDuplicateIds')).toBe(false);
      expect(isAllowedZoteroExtraKey('volume')).toBe(false);
    });
  });

  // ===========================================================================
  // Case Study 2: Strict BibTeX / BibLaTeX Standard Compliance in `toBibTeXEntry`
  // ===========================================================================
  describe('Case Study 2: Strict BibTeX / BibLaTeX Standard Compliance in toBibTeXEntry', () => {
    it('formats double-dash page ranges (5998--6008), issn, pmid, eprint/archiveprefix, @phdthesis school, @techreport institution, and @incollection editor/booktitle', () => {
      // 1. Journal article with single-dash page range, ISSN, PMID, DOI, and arXiv eprint
      const journalBib = toBibTeXEntry({
        title: 'Attention Is All You Need',
        itemType: 'journalArticle',
        authors: ['Vaswani, Ashish', 'Shazeer, Noam'],
        year: 2017,
        publicationTitle: 'Advances in Neural Information Processing Systems',
        volume: '30',
        issue: '4',
        pages: '5998-6008',
        doi: 'https://doi.org/10.5555/3295222.3295349',
        arxivId: 'arXiv:1706.03762',
        issn: '1049-5258',
        pmid: 'PMID: 28601938',
        url: 'https://arxiv.org/abs/1706.03762',
        accessedAt: '2026-03-15T10:20:30.000Z',
      });

      expect(journalBib).toContain('@article{vaswani2017attention,');
      expect(journalBib).toContain('  pages = {5998--6008},');
      expect(journalBib).toContain('  doi = {10.5555/3295222.3295349},');
      expect(journalBib).toContain('  eprint = {1706.03762},');
      expect(journalBib).toContain('  archiveprefix = {arXiv},');
      expect(journalBib).toContain('  issn = {1049-5258},');
      expect(journalBib).toContain('  pmid = {28601938},');
      expect(journalBib).toContain('  urldate = {2026-03-15}');

      // 2. PhD Thesis (@phdthesis with school)
      const thesisBib = toBibTeXEntry({
        title: 'Architectural Styles and the Design of Network-based Software Architectures',
        itemType: 'thesis',
        authors: ['Fielding, Roy Thomas'],
        year: 2000,
        university: 'University of California, Irvine',
      });
      expect(thesisBib).toContain('@phdthesis{fielding2000architectural,');
      expect(thesisBib).toContain('  school = {University of California, Irvine}');

      // 3. Technical Report (@techreport with institution)
      const reportBib = toBibTeXEntry({
        title: 'PageRank Citation Ranking: Bringing Order to the Web',
        itemType: 'report',
        authors: ['Page, Lawrence', 'Brin, Sergey'],
        year: 1999,
        institution: 'Stanford InfoLab',
      });
      expect(reportBib).toContain('@techreport{page1999pagerank,');
      expect(reportBib).toContain('  institution = {Stanford InfoLab}');

      // 4. Book Section (@incollection with booktitle and editor)
      const chapterBib = toBibTeXEntry({
        title: 'Convolutional Networks for Images, Speech, and Time-Series',
        itemType: 'bookSection',
        creators: [
          { firstName: 'Yann', lastName: 'LeCun', creatorType: 'author' },
          { firstName: 'Michael A.', lastName: 'Arbib', creatorType: 'editor' },
        ],
        year: 1995,
        bookTitle: 'The Handbook of Brain Theory and Neural Networks',
        publisher: 'MIT Press',
        pages: '255–258', // en-dash normalized to --
        isbn: '978-0-262-51102-5',
      });
      expect(chapterBib).toContain('@incollection{lecun1995convolutional,');
      expect(chapterBib).toContain('  author = {Yann LeCun},');
      expect(chapterBib).toContain('  editor = {Michael A. Arbib},');
      expect(chapterBib).toContain('  booktitle = {The Handbook of Brain Theory and Neural Networks},');
      expect(chapterBib).toContain('  pages = {255--258},');
      expect(chapterBib).toContain('  isbn = {978-0-262-51102-5}');
    });
  });

  // ===========================================================================
  // Case Study 3: Strict RefMan RIS Standard Compliance in `formatRis`
  // ===========================================================================
  describe('Case Study 3: Strict RefMan RIS Standard Compliance in formatRis', () => {
    it('exports complete RefMan RIS tags including TY, TI, AU, PY, T2, VL, IS, SP/EP split, PB, CY, DO, SN (ISBN/ISSN), AN (PMID), AB, UR, and ER', () => {
      const ris = formatRis({
        title: 'Deep Residual Learning for Image Recognition',
        itemType: 'journalArticle',
        authors: ['He, Kaiming', 'Zhang, Xiangyu'],
        year: 2016,
        publicationTitle: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        volume: '38',
        issue: '7',
        pages: '770-778',
        publisher: 'IEEE Computer Society',
        place: 'Las Vegas, NV',
        doi: '10.1109/CVPR.2016.90',
        issn: '0162-8828',
        pmid: '27891234',
        abstract: 'Deeper neural networks are more difficult to train. We present a residual learning framework.',
        url: 'https://ieeexplore.ieee.org/document/7780459',
      });

      const lines = ris.split('\n');
      expect(lines[0]).toBe('TY  - JOUR');
      expect(lines).toContain('TI  - Deep Residual Learning for Image Recognition');
      expect(lines).toContain('AU  - He, Kaiming');
      expect(lines).toContain('AU  - Zhang, Xiangyu');
      expect(lines).toContain('PY  - 2016');
      expect(lines).toContain('T2  - IEEE Transactions on Pattern Analysis and Machine Intelligence');
      expect(lines).toContain('VL  - 38');
      expect(lines).toContain('IS  - 7');
      expect(lines).toContain('SP  - 770');
      expect(lines).toContain('EP  - 778');
      expect(lines).toContain('PB  - IEEE Computer Society');
      expect(lines).toContain('CY  - Las Vegas, NV');
      expect(lines).toContain('DO  - 10.1109/CVPR.2016.90');
      expect(lines).toContain('SN  - 0162-8828');
      expect(lines).toContain('AN  - 27891234');
      expect(lines).toContain(
        'AB  - Deeper neural networks are more difficult to train. We present a residual learning framework.',
      );
      expect(lines).toContain('UR  - https://ieeexplore.ieee.org/document/7780459');
      expect(lines[lines.length - 1]).toBe('ER  - ');
    });
  });

  // ===========================================================================
  // Case Study 4: CSL-JSON 1.0.2 Standard Compliance & IEEE/APA `buildFallbackCitation` Fidelity
  // ===========================================================================
  describe('Case Study 4: CSL-JSON 1.0.2 Standard Compliance & IEEE/APA buildFallbackCitation Fidelity', () => {
    it('maps CSL-JSON 1.0.2 fields (issued.date-parts, container-title, volume, issue, page, ISSN, PMID, institutional literal) and formats IEEE/APA citations with volume/issue/pages', () => {
      const sampleItem: Item = {
        id: 'item-csl-1',
        title: 'Global Surveillance of Antimicrobial Resistance',
        itemType: 'journalArticle',
        authors: ['World Health Organization', 'Laxminarayan, Ramanan'],
        year: 2024,
        publicationTitle: 'The Lancet Infectious Diseases',
        volume: '24',
        issue: '3',
        pages: '210-225',
        publisher: 'Elsevier',
        place: 'London',
        doi: '10.1016/S1473-3099(24)00001-X',
        issn: '1473-3099',
        pmid: '38112233',
        tags: [],
        collections: [],
        notes: [],
        attachments: [],
      };

      const csl = formatCslJson(sampleItem);
      expect(csl.type).toBe('article-journal');
      expect(csl.title).toBe('Global Surveillance of Antimicrobial Resistance');
      expect(csl.issued).toEqual({ 'date-parts': [[2024]] });
      expect(csl['container-title']).toBe('The Lancet Infectious Diseases');
      expect(csl.volume).toBe('24');
      expect(csl.issue).toBe('3');
      expect(csl.page).toBe('210-225');
      expect(csl.DOI).toBe('10.1016/S1473-3099(24)00001-X');
      expect(csl.ISSN).toBe('1473-3099');
      expect(csl.PMID).toBe('38112233');
      expect(csl.author).toEqual([
        { literal: 'World Health Organization' },
        { family: 'Laxminarayan', given: 'Ramanan' },
      ]);

      // IEEE fallback citation includes vol., no., pp., year, and doi:
      const ieee = buildFallbackCitation(sampleItem, 'ieee');
      expect(ieee).toBe(
        'World Health Organization, R. Laxminarayan, "Global Surveillance of Antimicrobial Resistance," The Lancet Infectious Diseases, vol. 24, no. 3, pp. 210-225, 2024. doi: 10.1016/S1473-3099(24)00001-X.',
      );

      // APA fallback citation includes volume(issue), pages, and https://doi.org/
      const apa = buildFallbackCitation(sampleItem, 'apa');
      expect(apa).toBe(
        'World Health Organization, Laxminarayan, R. (2024). Global Surveillance of Antimicrobial Resistance. The Lancet Infectious Diseases, 24(3), 210-225. https://doi.org/10.1016/S1473-3099(24)00001-X',
      );
    });
  });

  // ===========================================================================
  // Case Study 5: Deterministic BetterBibTeX Citation Key Generation & Diacritic Transliteration
  // ===========================================================================
  describe('Case Study 5: Deterministic BetterBibTeX Citation Key Generation & Diacritic Transliteration', () => {
    it('transliterates Vietnamese, Polish, Scandinavian, and German diacritics, skips leading stop-words, and disambiguates collisions with a/b/c suffixes', () => {
      // 1. Vietnamese author (`Đặng, Văn Ngữ`) + stop-words (`The`, `On`, `Of`)
      const vnKey = generateCitationKey({
        title: 'The Role of Mosquito Vectors in Tropical Epidemiology',
        authors: ['Đặng, Văn Ngữ'],
        year: 1965,
      });
      expect(vnKey).toBe('dang1965role');

      // 2. Polish (`Łukasiewicz`) & German (`Müller-Böck`)
      const plKey = generateCitationKey({
        title: 'A System of Modal Logic',
        authors: ['Łukasiewicz, Jan'],
        year: 1953,
      });
      expect(plKey).toBe('lukasiewicz1953system');

      const deKey = generateCitationKey({
        title: 'Über die Quantenmechanik der Stoßvorgänge',
        authors: ['Müller-Böck, Friedrich'],
        year: 1926,
      });
      expect(deKey).toBe('mullerbock1926uber');

      // 3. Collision disambiguation (base -> a -> b)
      const used = new Set<string>(['dang1965role', 'dang1965rolea']);
      const disambiguated = generateCitationKey(
        {
          title: 'The Role of Parasites in Clinical Fever',
          authors: ['Đặng, Văn Ngữ'],
          year: 1965,
        },
        used,
      );
      expect(disambiguated).toBe('dang1965roleb');
    });
  });
});

