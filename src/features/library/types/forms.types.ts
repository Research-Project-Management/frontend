import { z } from 'zod';
import { retractionNatureSchema } from './retraction.types';

// ── Collection Form ──────────────────────────────────────────────────────────
export const collectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  color: z.string().optional().default(''),
  parent: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

// ── Add Link / Identifier Form ───────────────────────────────────────────────
const isValidIdentifierOrUrl = (val: string): boolean => {
  const trimmed = val.trim();
  if (!trimmed) return false;

  // 1. Web URL
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  } catch {
    // not a standard web URL
  }

  // 2. DOI: 10.xxxx/...
  if (/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+\b/i.test(trimmed) || /^10\.\d{4,9}\//i.test(trimmed)) {
    return true;
  }

  // 3. arXiv ID: digits.digits (e.g. 1706.03762) or legacy format (e.g. math.GT/0309136)
  if (/^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/i.test(trimmed)) {
    return true;
  }

  // 4. PMID: digits (1-9 digits) or pmid:digits
  if (/^(?:pmid:\s*)?\d{1,9}$/i.test(trimmed)) {
    return true;
  }

  // 5. ISBN: 10 or 13 digits with optional hyphens or prefix
  const cleanDigits = trimmed.replace(/[-\s]/g, '');
  if (/^(?:isbn:?\s*)?(97[89]\d{10}|\d{9}[\dX])$/i.test(trimmed)) {
    return true;
  }
  if ((cleanDigits.length === 10 || cleanDigits.length === 13) && /^\d+X?$/i.test(cleanDigits)) {
    return true;
  }

  return false;
};

export const addLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Identifier or URL is required')
    .refine(
      isValidIdentifierOrUrl,
      'Please enter a valid DOI, arXiv ID, PMID, ISBN, or Web URL',
    ),
  title: z.string().optional(),
});

export type AddLinkFormValues = z.infer<typeof addLinkSchema>;

// ── Flag Retraction Form ─────────────────────────────────────────────────────
export const flagRetractionSchema = z.object({
  nature: retractionNatureSchema,
  reason: z.string().min(1, 'Reason is required'),
  noticeUrl: z.string().url('Valid URL required'),
  date: z.string().optional(),
});

export type FlagRetractionFormValues = z.infer<typeof flagRetractionSchema>;

// ── Authorship Confirmation Form ─────────────────────────────────────────────
export const authorshipSchema = z.object({
  confirmed: z.boolean(),
});

export type AuthorshipFormValues = z.infer<typeof authorshipSchema>;
