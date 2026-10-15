import { describe, expect, it } from 'vitest';
import {
  toBibTeXEntry,
  formatRis,
  formatCslJson,
} from '@/features/library/domain/citations';
import { stripLatexMarkup } from '@/features/library/domain/metadata';
import {
  parseCreatorName,
  splitAuthorString,
} from '@/features/library/domain/creators';

describe('Zotero Wave 10 — Frontend Dataset Export & Creator/Diacritic Fidelity', () => {
  describe('1. BibTeX Export Fidelity (toBibTeXEntry)', () => {
    it('distinguishes @mastersthesis from @phdthesis and preserves thesisType and school', () => {
      const mastersBib = toBibTeXEntry({
        title: 'Efficient Distributed Consensus in BFT Networks',
        authors: ['Chen, Wei'],
        year: 2024,
        itemType: 'thesis',
        thesisType: "Master's Thesis",
        university: 'ETH Zürich',
        citationKey: 'chen2024efficient',
      });
      expect(mastersBib).toContain('@mastersthesis{chen2024efficient,');
      expect(mastersBib).toContain('school = {ETH Zürich}');
      expect(mastersBib).toContain("type = {Master's Thesis}");

      const phdBib = toBibTeXEntry({
        title: 'Foundations of Mechanistic Interpretability',
        authors: ['Olah, Christopher'],
        year: 2025,
        itemType: 'thesis',
        thesisType: 'Ph.D. Dissertation',
        university: 'Stanford University',
        citationKey: 'olah2025foundations',
      });
      expect(phdBib).toContain('@phdthesis{olah2025foundations,');
      expect(phdBib).toContain('school = {Stanford University}');
      expect(phdBib).toContain('type = {Ph.D. Dissertation}');
    });

    it('wraps institutional authors (fieldMode: 1) in inner braces and preserves reportNumber, reportType, series, edition, pmcid, urldate', () => {
      const reportBib = toBibTeXEntry({
        title: 'Global Tuberculosis Report 2024',
        itemType: 'report',
        year: 2024,
        creators: [
          {
            creatorType: 'author',
            fieldMode: 1,
            name: 'World Health Organization',
          },
          {
            creatorType: 'author',
            fieldMode: 0,
            firstName: 'Tedros Adhanom',
            lastName: 'Ghebreyesus',
          },
        ],
        institution: 'World Health Organization',
        reportNumber: 'WHO/HTM/TB/2024.1',
        reportType: 'Annual Epidemiological Surveillance Report',
        series: 'WHO Global Health Surveillance Series',
        edition: '29th',
        pmcid: 'PMC9876543',
        url: 'https://www.who.int/teams/global-tuberculosis-programme/tb-reports',
        accessedAt: '2025-03-10T00:00:00.000Z',
        citationKey: 'who2024global',
      });

      expect(reportBib).toContain('@techreport{who2024global,');
      expect(reportBib).toContain(
        'author = {{World Health Organization} and Tedros Adhanom Ghebreyesus}',
      );
      expect(reportBib).toContain('institution = {World Health Organization}');
      expect(reportBib).toContain('type = {Annual Epidemiological Surveillance Report}');
      expect(reportBib).toContain('series = {WHO Global Health Surveillance Series}');
      expect(reportBib).toContain('edition = {29th}');
      expect(reportBib).toContain('number = {WHO/HTM/TB/2024.1}');
      expect(reportBib).toContain('pmcid = {PMC9876543}');
      expect(reportBib).toContain('urldate = {2025-03-10}');
    });
  });

  describe('2. RIS Export Fidelity (formatRis)', () => {
    it('preserves ED (editors), TA (translators), non-inverted institutional AU, C2 (PMCID), ST (shortTitle), J2 (journalAbbr), ET (edition), T3 (series), Y2 (accessedAt), and KW (tags)', () => {
      const ris = formatRis({
        title: 'Deep Learning: Foundations and Concepts',
        shortTitle: 'Deep Learning',
        itemType: 'book',
        year: 2024,
        creators: [
          {
            creatorType: 'author',
            fieldMode: 1,
            name: 'Microsoft Research AI4Science',
          },
          {
            creatorType: 'author',
            fieldMode: 0,
            firstName: 'Christopher M.',
            lastName: 'Bishop',
          },
          {
            creatorType: 'editor',
            fieldMode: 0,
            firstName: 'Bernhard',
            lastName: 'Schölkopf',
          },
          {
            creatorType: 'translator',
            fieldMode: 0,
            firstName: 'Jean-Pierre',
            lastName: 'Dupont',
          },
        ],
        publisher: 'Springer Nature',
        place: 'Cham, Switzerland',
        series: 'Information Science and Statistics',
        edition: '2nd',
        journalAbbr: 'Inf. Sci. Stat.',
        isbn: '978-3-031-45467-7',
        pmid: '38123456',
        pmcid: 'PMC10987654',
        accessedAt: '2025-03-10T00:00:00.000Z',
        tags: ['Deep Learning', 'Neural Networks', 'Foundations'],
      });

      expect(ris).toContain('TY  - BOOK');
      expect(ris).toContain('TI  - Deep Learning: Foundations and Concepts');
      expect(ris).toContain('ST  - Deep Learning');
      expect(ris).toContain('AU  - Microsoft Research AI4Science');
      expect(ris).toContain('AU  - Bishop, Christopher M.');
      expect(ris).toContain('ED  - Schölkopf, Bernhard');
      expect(ris).toContain('TA  - Dupont, Jean-Pierre');
      expect(ris).toContain('J2  - Inf. Sci. Stat.');
      expect(ris).toContain('T3  - Information Science and Statistics');
      expect(ris).toContain('ET  - 2nd');
      expect(ris).toContain('AN  - 38123456');
      expect(ris).toContain('C2  - PMC10987654');
      expect(ris).toContain('Y2  - 2025-03-10');
      expect(ris).toContain('KW  - Deep Learning');
      expect(ris).toContain('KW  - Neural Networks');
      expect(ris).toContain('KW  - Foundations');
      expect(ris).toContain('ER  - ');
    });
  });

  describe('3. CSL-JSON Export Fidelity (formatCslJson)', () => {
    it('preserves all creator roles (author, editor, translator, collection-editor), institutional literal, full ISO date-parts, and specialized CSL fields', () => {
      const csl = formatCslJson({
        title: 'Scaling Laws for Neural Language Models: A Comprehensive Review',
        shortTitle: 'Scaling Laws Review',
        itemType: 'conferencePaper',
        publicationDate: '2024-05-18',
        accessedAt: '2025-03-10T08:15:00.000Z',
        creators: [
          {
            creatorType: 'author',
            fieldMode: 1,
            name: 'OpenAI Alignment Team',
          },
          {
            creatorType: 'author',
            fieldMode: 0,
            firstName: 'Jared',
            lastName: 'Kaplan',
          },
          {
            creatorType: 'editor',
            fieldMode: 0,
            firstName: 'Yoshua',
            lastName: 'Bengio',
          },
          {
            creatorType: 'translator',
            fieldMode: 0,
            firstName: 'Hélène',
            lastName: 'Laurent',
          },
          {
            creatorType: 'seriesEditor',
            fieldMode: 0,
            firstName: 'Michael I.',
            lastName: 'Jordan',
          },
        ],
        proceedingsTitle: 'Proceedings of the 41st International Conference on Machine Learning',
        journalAbbr: 'ICML',
        series: 'Proceedings of Machine Learning Research',
        seriesNumber: '235',
        edition: '1st',
        numPages: 42,
        reportNumber: 'ICML-2024-108',
        genre: 'Keynote Paper',
        conferenceName: 'ICML 2024',
        publisher: 'PMLR',
        eventPlace: 'Vienna, Austria',
        archive: 'arXiv',
        archiveLocation: 'cs.LG',
        callNumber: 'QA76.87',
        language: 'en-US',
        abstract: 'We study empirical scaling laws for language model performance on cross-entropy loss.',
        doi: '10.48550/arXiv.2001.08361',
        pmid: '34265844',
        pmcid: 'PMC8284567',
      });

      expect(csl.type).toBe('paper-conference');
      expect(csl.title).toBe('Scaling Laws for Neural Language Models: A Comprehensive Review');
      expect(csl['title-short']).toBe('Scaling Laws Review');
      expect(csl['container-title']).toBe(
        'Proceedings of the 41st International Conference on Machine Learning',
      );
      expect(csl['container-title-short']).toBe('ICML');
      expect(csl['collection-title']).toBe('Proceedings of Machine Learning Research');
      expect(csl['collection-number']).toBe('235');
      expect(csl.edition).toBe('1st');
      expect(csl['number-of-pages']).toBe('42');
      expect(csl.number).toBe('ICML-2024-108');
      expect(csl.genre).toBe('Keynote Paper');
      expect(csl['event-title']).toBe('ICML 2024');
      expect(csl.archive).toBe('arXiv');
      expect(csl.archive_location).toBe('cs.LG');
      expect(csl['call-number']).toBe('QA76.87');
      expect(csl.language).toBe('en-US');
      expect(csl.abstract).toBe(
        'We study empirical scaling laws for language model performance on cross-entropy loss.',
      );
      expect(csl.PMID).toBe('34265844');
      expect(csl.PMCID).toBe('PMC8284567');

      expect(csl.issued).toEqual({ 'date-parts': [[2024, 5, 18]] });
      expect(csl.accessed).toEqual({ 'date-parts': [[2025, 3, 10]] });

      expect(csl.author).toEqual([
        { literal: 'OpenAI Alignment Team' },
        { family: 'Kaplan', given: 'Jared' },
      ]);
      expect(csl.editor).toEqual([{ family: 'Bengio', given: 'Yoshua' }]);
      expect(csl.translator).toEqual([{ family: 'Laurent', given: 'Hélène' }]);
      expect(csl['collection-editor']).toEqual([
        { family: 'Jordan', given: 'Michael I.' },
      ]);
    });
  });

  describe('4. LaTeX Diacritics & Multipart Particle Surname Parsing', () => {
    it('decodes dotless \\i and \\j inside LaTeX accent macros and braced commands cleanly', () => {
      expect(stripLatexMarkup("Mart{\\'\\i}nez")).toBe('Martínez');
      expect(stripLatexMarkup("Mart\\'{\\i}nez")).toBe('Martínez');
      expect(stripLatexMarkup('Na{\\"\\i}ve Bayes')).toBe('Naïve Bayes');
      expect(stripLatexMarkup('Erd{\\H{o}}s')).toBe('Erdős');
      expect(stripLatexMarkup('{\\L}ukasiewicz')).toBe('Łukasiewicz');
      expect(stripLatexMarkup('Schr{\\"o}dinger')).toBe('Schrödinger');
      expect(stripLatexMarkup('{\\v{Z}}i{\\v{z}}ek')).toBe('Žižek');
      expect(stripLatexMarkup('{\\dj}or{\\dj}evi{\\\'c}')).toBe('đorđević');
    });

    it('preserves multipart particle surnames in both inverted ("de la Fuente, Juan Carlos") and forward order', () => {
      const splitInverted = splitAuthorString('de la Fuente, Juan Carlos');
      expect(splitInverted).toEqual(['de la Fuente, Juan Carlos']);

      const parsedInverted = parseCreatorName(splitInverted[0]!);
      expect(parsedInverted).toEqual({
        firstName: 'Juan Carlos',
        lastName: 'de la Fuente',
        fullName: 'Juan Carlos de la Fuente',
        isInstitution: false,
      });

      const parsedForward = parseCreatorName('Johannes Diderik van der Waals');
      expect(parsedForward).toEqual({
        firstName: 'Johannes Diderik',
        lastName: 'van der Waals',
        fullName: 'Johannes Diderik van der Waals',
        isInstitution: false,
      });

      const parsedGerman = parseCreatorName('Karl Theodor zu Guttenberg');
      expect(parsedGerman).toEqual({
        firstName: 'Karl Theodor',
        lastName: 'zu Guttenberg',
        fullName: 'Karl Theodor zu Guttenberg',
        isInstitution: false,
      });
    });
  });
});
