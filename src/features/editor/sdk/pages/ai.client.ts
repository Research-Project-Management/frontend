/**
 * ai.client.ts
 *
 * AI Error Repair & Table Generation Sub-API (Part of pagesService SDK).
 * Connects frontend logs and authoring wizards to authoritative backend CLSI AI endpoints:
 * - POST /api/v1/pages/clsi/ai/fix-error
 * - POST /api/v1/pages/clsi/ai/generate-table
 */

import { apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import {
  fixLatexError,
  type AiErrorFixParams,
  type AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';

export type {
  AiErrorFixParams,
  AiErrorFixResult,
};

/**
 * Request AI fix suggestion for a given compilation error via backend CLSI AI endpoint.
 */
export async function suggestLatexFix(params: AiErrorFixParams): Promise<AiErrorFixResult> {
  try {
    const res = await apiPost<AiErrorFixResult>(
      `${PAGES_API_BASE}/clsi/ai/fix-error`,
      params,
      { silent: true },
    );
    if (res && typeof res.explanation === 'string') {
      return res;
    }
  } catch {
    // Fall back to lightweight client-side error descriptor if backend is unreachable
  }

  return fixLatexError(params);
}

/**
 * Generate a clean LaTeX tabular or TSV table from an AI prompt via backend CLSI AI endpoint.
 */
export async function generateLatexTable(
  prompt: string,
  options?: { spaceId?: string; pageId?: string },
): Promise<string> {
  const res = await apiPost<{ table?: string; content?: string } | null>(
    `${PAGES_API_BASE}/clsi/ai/generate-table`,
    {
      prompt,
      ...(options?.spaceId ? { spaceId: options.spaceId } : {}),
      ...(options?.pageId ? { pageId: options.pageId } : {}),
    },
  );
  const rawText = res?.table || res?.content || '';
  return rawText.replace(/```latex\n?|```tsv\n?|```\n?/g, '').trim();
}

export const ai = {
  suggestLatexFix,
  generateLatexTable,
};
