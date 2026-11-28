/**
 * Regex for standard academic identifiers
 */
const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i;
const ARXIV_REGEX = /^(?:arxiv:)?\d{4}\.\d{4,5}(?:v\d+)?$/i;

/**
 * Validates whether an input query is a structured academic identifier (DOI or arXiv)
 */
export function validateIdentifier(query: string): {
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

