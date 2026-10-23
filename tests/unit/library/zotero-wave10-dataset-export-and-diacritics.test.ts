import { describe, expect, it } from 'vitest';
import { stripLatexMarkup } from '@/features/library/domain/metadata';
import {
  parseCreatorName,
  splitAuthorString,
  isInstitutionName,
} from '@/features/library/domain/creators';
import { toAsciiKeyPart, generateCitationKey } from '@/features/library/domain/citations';
import { foldDiacritics } from '@/features/library/domain/academic-text';

describe('Zotero Wave 10 — Frontend Dataset Export & Creator/Diacritic Fidelity', () => {
  describe('1. LaTeX Diacritics & Accent Decoding (stripLatexMarkup)', () => {
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
  });

  describe('2. Transliteration & ASCII Key Projection (toAsciiKeyPart)', () => {
    it('transliterates diacritics into clean ASCII for bibtex keys without losing phonetic root', () => {
      expect(toAsciiKeyPart('Łukasiewicz')).toBe('lukasiewicz');
      expect(toAsciiKeyPart('Schrödinger')).toBe('schrodinger');
      expect(toAsciiKeyPart('Žižek')).toBe('zizek');
      expect(toAsciiKeyPart('đorđević')).toBe('dordevic');
      expect(toAsciiKeyPart('Nguyễn')).toBe('nguyen');
      expect(toAsciiKeyPart('François')).toBe('francois');
    });

    it('generates clean ASCII citation keys for papers with diacritics', () => {
      const key = generateCitationKey({
        title: 'Thuyết Tương Đối và Lượng Tử',
        authors: ['Nguyễn, Văn A'],
        year: 2024,
      });
      expect(key).toBe('nguyen2024thuyet');
    });
  });

  describe('3. Multipart Particle Surname & Creator Parsing', () => {
    it('preserves multipart particle surnames in both inverted and forward order', () => {
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

    it('correctly detects institutional and corporate authors', () => {
      expect(isInstitutionName('World Health Organization')).toBe(true);
      expect(isInstitutionName('OpenAI Alignment Team')).toBe(true);
      expect(isInstitutionName('Stanford University')).toBe(true);
      expect(isInstitutionName('Yoshua Bengio')).toBe(false);
    });
  });
});
