import { describe, it, expect } from 'vitest';
import {
  toBibTeXEntry,
  formatRis,
  formatCslJson,
  formatCitation,
  generateCitationKey,
  resolveExportSpec,
} from '@/features/library/domain/citations';
import {
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  mapBackendItemToPaper,
} from '@/features/library/domain/metadata';
import {
  resolveItemFieldValue,
  inspectItemDifferences,
} from '@/features/library/domain/diff';
import {
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
} from '@/features/library/ui/inspector/InfoSection';
import {
  getPrimaryCreatorType,
  getTitleFieldForType,
  getDateFieldForType,
  getVenueFieldForType,
  LIBRARY_ITEM_TYPES,
} from '@/features/library/domain/types/item-types.types';
import type { Item } from '@/features/library/domain/types/library.types';

describe('Wave 12: Multi-Type Scholarly, Legal & Technical Datasets & Base Field Mappings', () => {
  describe('1. Patent Dataset (patent)', () => {
    const patentItem = {
      id: 'patent-us-101',
      itemType: 'patent',
      title: 'Attention-Based Neural Hardware Accelerator',
      creators: [
        { firstName: 'Norman', lastName: 'Jouppi', creatorType: 'inventor' },
        { firstName: 'Cliff', lastName: 'Young', creatorType: 'inventor' },
        { firstName: 'Jane', lastName: 'Smith', creatorType: 'attorneyAgent' },
      ],
      patentNumber: 'US10891519B2',
      issuingAuthority: 'United States Patent and Trademark Office',
      country: 'United States',
      filingDate: '2018-05-14',
      issueDate: '2021-01-12',
      url: 'https://patents.google.com/patent/US10891519B2/en',
    };

    it('resolves primary creator role, venue, date, and citation key for patent', () => {
      expect(getPrimaryCreatorType('patent')).toBe('inventor');
      expect(getDateFieldForType('patent')).toBe('issueDate');
      expect(getVenueFieldForType('patent')).toBe('issuingAuthority');
      expect(getPublicationVenue(patentItem)).toBe('United States Patent and Trademark Office');
      expect(getItemDisplayDate(patentItem)).toBe(2021);
      expect(generateCitationKey(patentItem)).toBe('jouppi2021attentionbased');
    });

    it('exports patent to BibTeX, RIS, CSL-JSON, and APA/IEEE citations with inventor creators and patentNumber', () => {
      const bib = toBibTeXEntry(patentItem);
      expect(bib).toContain('@misc{jouppi2021attentionbased,');
      expect(bib).toContain('author = {Norman Jouppi and Cliff Young},');
      expect(bib).toContain('year = {2021},');
      expect(bib).toContain('publisher = {United States Patent and Trademark Office},');
      expect(bib).toContain('address = {United States},');
      expect(bib).toContain('number = {US10891519B2},');

      const ris = formatRis(patentItem);
      expect(ris).toContain('TY  - PAT');
      expect(ris).toContain('TI  - Attention-Based Neural Hardware Accelerator');
      expect(ris).toContain('AU  - Jouppi, Norman');
      expect(ris).toContain('AU  - Young, Cliff');
      expect(ris).toContain('PY  - 2021');
      expect(ris).toContain('IS  - US10891519B2');
      expect(ris).toContain('PB  - United States Patent and Trademark Office');
      expect(ris).toContain('CY  - United States');

      const csl = formatCslJson(patentItem);
      expect(csl.type).toBe('patent');
      expect(csl.number).toBe('US10891519B2');
      expect(csl.authority).toBe('United States Patent and Trademark Office');
      expect(csl.publisher).toBe('United States Patent and Trademark Office');
      expect(csl['publisher-place']).toBe('United States');
      expect(csl.issued).toEqual({ 'date-parts': [[2021, 1, 12]] });
      expect((csl.author as Array<Record<string, unknown>>).slice(0, 2)).toEqual([
        { family: 'Jouppi', given: 'Norman' },
        { family: 'Young', given: 'Cliff' },
      ]);

      const apa = formatCitation(patentItem as unknown as Partial<Item>, 'apa');
      expect(apa).toContain('Jouppi, N., Young, C.');
      expect(apa).toContain('(2021).');
      expect(apa).toContain('United States Patent and Trademark Office (US10891519B2).');
    });
  });

  describe('2. Software / Computer Program Dataset (computerProgram)', () => {
    const softwareItem = {
      id: 'sw-pytorch-2',
      itemType: 'computerProgram',
      title: 'PyTorch: An Imperative Style, High-Performance Deep Learning Library',
      creators: [
        { firstName: 'Adam', lastName: 'Paszke', creatorType: 'programmer' },
        { firstName: 'Sam', lastName: 'Gross', creatorType: 'programmer' },
      ],
      versionNumber: '2.4.0',
      company: 'Linux Foundation / Meta AI',
      programmingLanguage: 'Python / C++',
      date: '2024-07-24',
      url: 'https://pytorch.org',
    };

    it('resolves programmer creators, versionNumber, company, and programmingLanguage', () => {
      expect(getPrimaryCreatorType('computerProgram')).toBe('programmer');
      expect(getPublicationVenue(softwareItem)).toBe('Linux Foundation / Meta AI');
      expect(getItemDisplayDate(softwareItem)).toBe(2024);

      const bib = toBibTeXEntry(softwareItem);
      expect(bib).toContain('@misc{paszke2024pytorch,');
      expect(bib).toContain('author = {Adam Paszke and Sam Gross},');
      expect(bib).toContain('publisher = {Linux Foundation / Meta AI},');
      expect(bib).toContain('version = {2.4.0},');

      const ris = formatRis(softwareItem);
      expect(ris).toContain('TY  - COMP');
      expect(ris).toContain('AU  - Paszke, Adam');
      expect(ris).toContain('ET  - 2.4.0');
      expect(ris).toContain('PB  - Linux Foundation / Meta AI');

      const csl = formatCslJson(softwareItem);
      expect(csl.type).toBe('software');
      expect(csl.version).toBe('2.4.0');
      expect(csl.publisher).toBe('Linux Foundation / Meta AI');
      expect(csl.author).toEqual([
        { family: 'Paszke', given: 'Adam' },
        { family: 'Gross', given: 'Sam' },
      ]);
    });
  });

  describe('3. Research Dataset (dataset)', () => {
    const datasetItem = {
      id: 'ds-imagenet',
      itemType: 'dataset',
      title: 'ImageNet Large Scale Visual Recognition Challenge Dataset',
      creators: [
        { firstName: 'Olga', lastName: 'Russakovsky', creatorType: 'author' },
        { firstName: 'Jia', lastName: 'Deng', creatorType: 'author' },
      ],
      repository: 'Zenodo',
      versionNumber: 'v1.2',
      identifier: 'ZENODO-2015-9981',
      date: '2015-09-01',
      doi: '10.5281/zenodo.9981',
    };

    it('exports dataset with repository -> publisher/archive, versionNumber -> version, identifier -> number', () => {
      expect(getPublicationVenue(datasetItem)).toBe('Zenodo');
      const bib = toBibTeXEntry(datasetItem);
      expect(bib).toContain('@misc{russakovsky2015imagenet,');
      expect(bib).toContain('publisher = {Zenodo},');
      expect(bib).toContain('version = {v1.2},');
      expect(bib).toContain('number = {ZENODO-2015-9981},');
      expect(bib).toContain('doi = {10.5281/zenodo.9981}');

      const ris = formatRis(datasetItem);
      expect(ris).toContain('TY  - DATA');
      expect(ris).toContain('ET  - v1.2');
      expect(ris).toContain('IS  - ZENODO-2015-9981');
      expect(ris).toContain('PB  - Zenodo');

      const csl = formatCslJson(datasetItem);
      expect(csl.type).toBe('dataset');
      expect(csl.publisher).toBe('Zenodo');
      expect(csl.archive).toBe('Zenodo');
      expect(csl.version).toBe('v1.2');
      expect(csl.number).toBe('ZENODO-2015-9981');
    });
  });

  describe('4. Legal Case Dataset (case)', () => {
    const legalCaseRaw = {
      id: 'case-google-oracle',
      itemType: 'case',
      caseName: 'Google LLC v. Oracle America, Inc.',
      court: 'Supreme Court of the United States',
      docketNumber: '18-956',
      dateDecided: '2021-04-05',
      volume: '593',
      pages: '1',
      creators: [
        { firstName: 'Stephen', lastName: 'Breyer', creatorType: 'author' },
        { firstName: 'Thomas', lastName: 'Goldstein', creatorType: 'counsel' },
      ],
    };

    it('maps caseName -> title, court -> venue/authority, dateDecided -> year/issued, docketNumber -> number', () => {
      expect(getTitleFieldForType('case')).toBe('caseName');
      expect(getDateFieldForType('case')).toBe('dateDecided');
      expect(getVenueFieldForType('case')).toBe('court');
      expect(LIBRARY_ITEM_TYPES.case.creatorTypes.map((c) => c.creatorType)).toContain('counsel');

      expect(getItemDisplayTitle(legalCaseRaw)).toBe('Google LLC v. Oracle America, Inc.');
      expect(getPublicationVenue(legalCaseRaw)).toBe('Supreme Court of the United States');
      expect(getItemDisplayDate(legalCaseRaw)).toBe(2021);

      const mapped = mapBackendItemToPaper(legalCaseRaw);
      expect(mapped.title).toBe('Google LLC v. Oracle America, Inc.');
      expect(mapped.publicationTitle).toBe('Supreme Court of the United States');
      expect(mapped.publisher).toBe('Supreme Court of the United States');
      expect(mapped.year).toBe(2021);
      expect(mapped.authors).toEqual(['Stephen Breyer', 'Thomas Goldstein']);

      const bib = toBibTeXEntry(legalCaseRaw);
      expect(bib).toContain('@misc{breyer2021google,');
      expect(bib).toContain('title = {Google LLC v. Oracle America, Inc.},');
      expect(bib).toContain('publisher = {Supreme Court of the United States},');
      expect(bib).toContain('number = {18-956}');
      expect(bib).toContain('year = {2021},');

      const ris = formatRis(legalCaseRaw);
      expect(ris).toContain('TY  - CASE');
      expect(ris).toContain('TI  - Google LLC v. Oracle America, Inc.');
      expect(ris).toContain('PB  - Supreme Court of the United States');
      expect(ris).toContain('IS  - 18-956');
      expect(ris).toContain('PY  - 2021');

      const csl = formatCslJson(legalCaseRaw);
      expect(csl.type).toBe('legal_case');
      expect(csl.title).toBe('Google LLC v. Oracle America, Inc.');
      expect(csl.authority).toBe('Supreme Court of the United States');
      expect(csl.number).toBe('18-956');
      expect(csl.issued).toEqual({ 'date-parts': [[2021, 4, 5]] });
    });
  });

  describe('5. Statute Dataset (statute)', () => {
    const statuteRaw = {
      id: 'statute-ai-act',
      itemType: 'statute',
      nameOfAct: 'Regulation (EU) 2024/1689 Artificial Intelligence Act',
      publicLawNumber: 'EU-2024/1689',
      dateEnacted: '2024-06-13',
      code: 'Official Journal of the European Union',
      creators: [
        { name: 'European Parliament', fieldMode: 1, creatorType: 'author' },
      ],
    };

    it('maps nameOfAct -> title, publicLawNumber -> number, dateEnacted -> year/issued', () => {
      expect(getTitleFieldForType('statute')).toBe('nameOfAct');
      expect(getDateFieldForType('statute')).toBe('dateEnacted');
      expect(getItemDisplayTitle(statuteRaw)).toBe(
        'Regulation (EU) 2024/1689 Artificial Intelligence Act',
      );
      expect(getItemDisplayDate(statuteRaw)).toBe(2024);

      const mapped = mapBackendItemToPaper(statuteRaw);
      expect(mapped.title).toBe('Regulation (EU) 2024/1689 Artificial Intelligence Act');
      expect(mapped.year).toBe(2024);

      const bib = toBibTeXEntry(statuteRaw);
      expect(bib).toContain('title = {Regulation (EU) 2024/1689 Artificial Intelligence Act},');
      expect(bib).toContain('author = {{European Parliament}},');
      expect(bib).toContain('number = {EU-2024/1689}');
      expect(bib).toContain('year = {2024},');

      const ris = formatRis(statuteRaw);
      expect(ris).toContain('TY  - STAT');
      expect(ris).toContain('TI  - Regulation (EU) 2024/1689 Artificial Intelligence Act');
      expect(ris).toContain('IS  - EU-2024/1689');
      expect(ris).toContain('PY  - 2024');

      const csl = formatCslJson(statuteRaw);
      expect(csl.type).toBe('legislation');
      expect(csl.title).toBe('Regulation (EU) 2024/1689 Artificial Intelligence Act');
      expect(csl.number).toBe('EU-2024/1689');
      expect(csl.issued).toEqual({ 'date-parts': [[2024, 6, 13]] });
    });
  });

  describe('6. Presentation Dataset (presentation)', () => {
    const presentationItem = {
      id: 'pres-keynote',
      itemType: 'presentation',
      title: 'Scaling Laws for Foundation Models in Science',
      creators: [
        { firstName: 'Fei-Fei', lastName: 'Li', creatorType: 'presenter' },
      ],
      meetingName: 'NeurIPS 2025 Annual Conference',
      presentationType: 'Keynote Lecture',
      place: 'Vancouver, Canada',
      date: '2025-12-10',
    };

    it('maps presenter -> author, meetingName -> booktitle/T2/event-title, presentationType -> type/genre', () => {
      expect(getPrimaryCreatorType('presentation')).toBe('presenter');
      expect(getVenueFieldForType('presentation')).toBe('meetingName');
      expect(getPublicationVenue(presentationItem)).toBe('NeurIPS 2025 Annual Conference');

      const bib = toBibTeXEntry(presentationItem);
      expect(bib).toContain('@inproceedings{li2025scaling,');
      expect(bib).toContain('author = {Fei-Fei Li},');
      expect(bib).toContain('booktitle = {NeurIPS 2025 Annual Conference},');
      expect(bib).toContain('type = {Keynote Lecture},');
      expect(bib).toContain('address = {Vancouver, Canada}');

      const ris = formatRis(presentationItem);
      expect(ris).toContain('TY  - CONF');
      expect(ris).toContain('AU  - Li, Fei-Fei');
      expect(ris).toContain('T2  - NeurIPS 2025 Annual Conference');

      const csl = formatCslJson(presentationItem);
      expect(csl.type).toBe('speech');
      expect(csl['event-title']).toBe('NeurIPS 2025 Annual Conference');
      expect(csl.genre).toBe('Keynote Lecture');
      expect(csl.author).toEqual([{ family: 'Li', given: 'Fei-Fei' }]);
    });
  });

  describe('7. Book Section, Conference Paper, Thesis & Report Datasets', () => {
    it('exports bookSection, conferencePaper, thesis (Masters vs PhD), and report with full fidelity', () => {
      const bookSection = {
        id: 'bs-1',
        itemType: 'bookSection',
        title: 'Backpropagation Revisited',
        bookTitle: 'Deep Learning Foundations',
        creators: [
          { firstName: 'Geoffrey', lastName: 'Hinton', creatorType: 'author' },
          { firstName: 'Yoshua', lastName: 'Bengio', creatorType: 'editor' },
        ],
        publisher: 'MIT Press',
        pages: '45-88',
        year: 2023,
      };
      const bsBib = toBibTeXEntry(bookSection);
      expect(bsBib).toContain('@incollection{hinton2023backpropagation,');
      expect(bsBib).toContain('booktitle = {Deep Learning Foundations},');
      expect(bsBib).toContain('editor = {Yoshua Bengio},');
      expect(bsBib).toContain('pages = {45--88}');

      const mastersThesis = {
        id: 'th-1',
        itemType: 'thesis',
        title: 'Efficient Graph Transformers',
        university: 'ETH Zurich',
        thesisType: "Master's Thesis",
        creators: [{ firstName: 'Lukas', lastName: 'Meier', creatorType: 'author' }],
        year: 2024,
      };
      expect(resolveExportSpec(mastersThesis).bibtexType).toBe('mastersthesis');
      const thBib = toBibTeXEntry(mastersThesis);
      expect(thBib).toContain('@mastersthesis{meier2024efficient,');
      expect(thBib).toContain('school = {ETH Zurich},');
      expect(thBib).toContain("type = {Master's Thesis}");

      const techReport = {
        id: 'rep-1',
        itemType: 'report',
        title: 'GPT-4 Technical Report',
        institution: 'OpenAI',
        reportNumber: 'TR-2023-03',
        reportType: 'Technical Report',
        creators: [{ name: 'OpenAI', fieldMode: 1, creatorType: 'author' }],
        year: 2023,
      };
      const repBib = toBibTeXEntry(techReport);
      expect(repBib).toContain('@techreport{openai2023gpt4,');
      expect(repBib).toContain('institution = {OpenAI},');
      expect(repBib).toContain('number = {TR-2023-03}');
    });
  });

  describe('8. Inspector & Duplicate Diff Resolution Across Mapped Fields', () => {
    it('resolves and patches mapped fields in InfoSection and diff engine', () => {
      const caseItem = {
        id: 'c-1',
        itemType: 'case',
        title: '',
        extraFields: {
          caseName: 'Alice Corp. v. CLS Bank International',
          court: 'Supreme Court of the United States',
          docketNumber: '13-298',
          dateDecided: '2014-06-19',
        },
      } as unknown as Item;

      expect(resolveInspectorFieldValue(caseItem, 'caseName')).toBe(
        'Alice Corp. v. CLS Bank International',
      );
      expect(resolveInspectorFieldValue(caseItem, 'court')).toBe(
        'Supreme Court of the United States',
      );
      expect(resolveInspectorFieldValue(caseItem, 'docketNumber')).toBe('13-298');
      expect(resolveInspectorFieldValue(caseItem, 'dateDecided')).toBe('2014-06-19');

      // Diff engine resolves title, publicationTitle, publisher, year, issue from mapped case fields
      const rawCaseRec = caseItem as unknown as Record<string, unknown>;
      expect(resolveItemFieldValue(rawCaseRec, 'title')).toBe(
        'Alice Corp. v. CLS Bank International',
      );
      expect(resolveItemFieldValue(rawCaseRec, 'publicationTitle')).toBe(
        'Supreme Court of the United States',
      );
      expect(resolveItemFieldValue(rawCaseRec, 'publisher')).toBe(
        'Supreme Court of the United States',
      );
      expect(resolveItemFieldValue(rawCaseRec, 'year')).toBe(2014);
      expect(resolveItemFieldValue(rawCaseRec, 'issue')).toBe('13-298');

      const patchDate = buildInspectorFieldPatch(caseItem, 'dateDecided', '2014-06-19');
      expect(patchDate.dateDecided).toBe('2014-06-19');
      expect(patchDate.year).toBe(2014);
      expect((patchDate.extraFields as Record<string, unknown>).dateDecided).toBe('2014-06-19');

      const patchCourt = buildInspectorFieldPatch(caseItem, 'court', 'U.S. Supreme Court');
      expect(patchCourt.court).toBe('U.S. Supreme Court');
      expect(patchCourt.publisher).toBe('U.S. Supreme Court');
      expect((patchCourt.extraFields as Record<string, unknown>).court).toBe('U.S. Supreme Court');

      const candidateCase = {
        id: 'c-2',
        itemType: 'case',
        title: 'Alice Corp. v. CLS Bank International',
        court: 'Supreme Court of the United States',
        docketNumber: '13-298',
        dateDecided: '2014-06-19',
      } as unknown as Item;

      const diffResult = inspectItemDifferences([caseItem, candidateCase], 'c-1');
      const titleDiff = diffResult.fields.find((f) => f.key === 'title');
      expect(titleDiff?.status).toBe('IDENTICAL');
      expect(titleDiff?.hasConflict).toBe(false);
    });
  });
});

