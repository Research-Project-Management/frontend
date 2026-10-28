import { describe, it, expect } from 'vitest';
import { generateCitationKey } from '@/features/library/domain/citations';
import {
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
  mapBackendItem,
} from '@/features/library/domain/metadata';
import {
  resolveItemFieldValue,
  inspectItemDifferences,
} from '@/features/library/domain/diff';
import {
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
} from '@/features/library/domain/item-field-schema';
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

    it('resolves inspector fields and builds patch for patent', () => {
      const val = resolveInspectorFieldValue(patentItem as any, 'patentNumber');
      expect(val).toBe('US10891519B2');
      const patch = buildInspectorFieldPatch('patent', 'patentNumber', 'US10891519B3', patentItem as any);
      expect(patch).toMatchObject({ patentNumber: 'US10891519B3' });
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
      expect(generateCitationKey(softwareItem)).toBe('paszke2024pytorch');
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

    it('resolves dataset repository, versionNumber, identifier and citationKey', () => {
      expect(getPublicationVenue(datasetItem)).toBe('Zenodo');
      expect(getItemDisplayDate(datasetItem)).toBe(2015);
      expect(generateCitationKey(datasetItem)).toBe('russakovsky2015imagenet');
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
      expect(getItemDisplayTitle(legalCaseRaw)).toBe('Google LLC v. Oracle America, Inc.');
      expect(getPublicationVenue(legalCaseRaw)).toBe('Supreme Court of the United States');
      expect(getItemDisplayDate(legalCaseRaw)).toBe(2021);
      expect(generateCitationKey(legalCaseRaw)).toBe('breyer2021google');
    });
  });

  describe('5. Statute / Legislation Dataset (statute)', () => {
    const statuteRaw = {
      id: 'statute-ai-act',
      itemType: 'statute',
      nameOfAct: 'Artificial Intelligence Act',
      code: 'Official Journal of the European Union',
      publicLawNumber: 'Regulation (EU) 2024/1689',
      dateEnacted: '2024-06-13',
    };

    it('maps nameOfAct -> title, dateEnacted -> year/issued, publicLawNumber -> number', () => {
      expect(getTitleFieldForType('statute')).toBe('nameOfAct');
      expect(getDateFieldForType('statute')).toBe('dateEnacted');
      expect(getItemDisplayTitle(statuteRaw)).toBe('Artificial Intelligence Act');
      expect(getItemDisplayDate(statuteRaw)).toBe(2024);
      expect(generateCitationKey(statuteRaw)).toBe('anon2024artificial');
    });
  });

  describe('6. Presentation / Talk Dataset (presentation)', () => {
    const presentationItem = {
      id: 'pres-keynote-2024',
      itemType: 'presentation',
      title: 'State of AI 2024 Keynote Address',
      creators: [{ firstName: 'Demis', lastName: 'Hassabis', creatorType: 'presenter' }],
      presentationType: 'Keynote Speech',
      meetingName: 'Nobel Symposium on AI and Science',
      place: 'Stockholm, Sweden',
      date: '2024-10-15',
    };

    it('resolves presenter creators, meetingName -> venue, presentationType -> genre', () => {
      expect(getPrimaryCreatorType('presentation')).toBe('presenter');
      expect(getVenueFieldForType('presentation')).toBe('meetingName');
      expect(getPublicationVenue(presentationItem)).toBe('Nobel Symposium on AI and Science');
      expect(generateCitationKey(presentationItem)).toBe('hassabis2024state');
    });
  });

  describe('7. Side-by-Side Diff Resolution Across Dynamic Types', () => {
    it('compares type-specific field differences accurately between two candidate items', () => {
      const primary: Partial<Item> = {
        id: 'p1',
        itemType: 'patent',
        title: 'Neural Engine',
        patentNumber: 'US12345',
      };
      const donor: Partial<Item> = {
        id: 'd1',
        itemType: 'patent',
        title: 'Neural Engine Accelerator',
        patentNumber: 'US12345-B2',
      };

      const inspection = inspectItemDifferences([primary as Item, donor as Item], 'p1');
      expect(inspection.fields.length).toBeGreaterThan(0);
      const titleDiff = inspection.fields.find((f) => f.key === 'title');
      expect(titleDiff).toBeDefined();
      expect(titleDiff?.hasConflict).toBe(true);
    });
  });
});
