import { z } from 'zod';

/**
 * Regex for standard academic identifiers
 */
export const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i;
export const ARXIV_REGEX = /^(?:arxiv:)?\d{4}\.\d{4,5}(?:v\d+)?$/i;
export const CITEKEY_REGEX = /^[a-zA-Z0-9_:-]+$/;

/**
 * Schema for looking up academic citations by DOI, arXiv ID, or title
 */
export const citationLookupSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Please enter a DOI, arXiv ID, or title')
    .max(500, 'Query is too long'),
});

export type CitationLookupInput = z.infer<typeof citationLookupSchema>;

/**
 * Validates whether an input query is a structured academic identifier (DOI or arXiv)
 */
export function validateAcademicIdentifier(query: string): {
  isIdentifier: boolean;
  type?: 'doi' | 'arxiv';
  normalized?: string;
} {
  const trimmed = query.trim();
  if (DOI_REGEX.test(trimmed)) {
    return { isIdentifier: true, type: 'doi', normalized: trimmed };
  }
  if (ARXIV_REGEX.test(trimmed)) {
    const normalized = trimmed.toLowerCase().startsWith('arxiv:')
      ? trimmed
      : `arxiv:${trimmed}`;
    return { isIdentifier: true, type: 'arxiv', normalized };
  }
  return { isIdentifier: false };
}

/**
 * Schema for citation sidebar & picker search and filtering
 */
export const citationFilterSchema = z.object({
  search: z.string().trim().default(''),
  tab: z.enum(['document', 'library']).default('document'),
  collectionId: z.string().optional(),
  source: z.enum(['all', 'library', 'bib', 'cited']).default('all'),
  style: z
    .enum(['latex-cite', 'latex-citep', 'latex-citet', 'markdown-bracket', 'markdown-inline'])
    .default('latex-cite'),
});

export type CitationFilterValues = z.infer<typeof citationFilterSchema>;

/**
 * Schema for manually entering or editing a BibTeX reference
 */
export const manualBibEntrySchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, 'Citation key must be at least 2 characters')
    .max(64, 'Citation key cannot exceed 64 characters')
    .regex(
      CITEKEY_REGEX,
      'Citation key may only contain letters, numbers, hyphens, colons, and underscores',
    ),
  type: z
    .enum([
      'article',
      'book',
      'inproceedings',
      'phdthesis',
      'mastersthesis',
      'techreport',
      'misc',
      'unpublished',
    ])
    .default('article'),
  title: z.string().trim().min(1, 'Title is required'),
  authors: z.string().trim().optional(),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Year must be a 4-digit number')
    .optional()
    .or(z.literal('')),
  journal: z.string().trim().optional(),
  booktitle: z.string().trim().optional(),
  doi: z
    .string()
    .trim()
    .regex(DOI_REGEX, 'Invalid DOI format (e.g. 10.1145/1234567.1234568)')
    .optional()
    .or(z.literal('')),
  url: z.string().trim().url('Invalid URL format').optional().or(z.literal('')),
  abstract: z.string().trim().optional(),
});

export type ManualBibEntryInput = z.infer<typeof manualBibEntrySchema>;

/**
 * Schema for inserting a citation command into the active manuscript
 */
export const citationInsertSchema = z.object({
  citeKey: z
    .string()
    .trim()
    .min(1, 'Citation key is required')
    .regex(CITEKEY_REGEX, 'Invalid citation key syntax'),
  style: z
    .enum(['latex-cite', 'latex-citep', 'latex-citet', 'markdown-bracket', 'markdown-inline'])
    .default('latex-cite'),
  snippet: z.string().min(1, 'Citation snippet is required'),
});

export type CitationInsertInput = z.infer<typeof citationInsertSchema>;
