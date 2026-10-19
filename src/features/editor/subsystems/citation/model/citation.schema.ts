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

