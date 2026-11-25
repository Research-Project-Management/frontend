/**
 * ai.client.ts
 *
 * Client-side LaTeX error remediation and AI authoring helpers.
 */

import {
  fixLatexError,
  type AiErrorFixParams,
  type AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';

export type { AiErrorFixParams, AiErrorFixResult };

/**
 * Suggest a fix for a LaTeX compilation error using client-side heuristics.
 */
export async function suggestLatexFix(
  params: AiErrorFixParams,
): Promise<AiErrorFixResult> {
  return fixLatexError(params);
}

/**
 * AI table generation (moved out of CLSI; routed to the AI module when enabled).
 */
export async function generateLatexTable(
  _prompt: string,
  _options?: { spaceId?: string; pageId?: string },
): Promise<string> {
  throw new Error('AI table generation is handled by the AI assistant module.');
}

/**
 * AI equation generation (moved out of CLSI; routed to the AI module when enabled).
 */
export async function generateLatexEquation(
  _prompt: string,
  _options?: { spaceId?: string; pageId?: string },
): Promise<string> {
  throw new Error('AI equation generation is handled by the AI assistant module.');
}

export const ai = {
  suggestLatexFix,
  generateLatexTable,
  generateLatexEquation,
};
