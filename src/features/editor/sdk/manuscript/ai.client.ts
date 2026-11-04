/**
 * ai.client.ts
 *
 * AI Assistant & LaTeX Error Repair Sub-API (Part of manuscriptService SDK).
 * Connects frontend editor and logs to authoritative backend CLSI AI endpoints:
 * - POST /api/v1/manuscripts/clsi/ai/transform
 * - POST /api/v1/manuscripts/clsi/ai/fix-error
 * - POST /api/v1/manuscripts/clsi/ai/generate-table
 */

import { apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import {
  applyFallbackTransform,
  type AiActionParams,
  type AiActionResult,
  type AcademicAiActionParams,
  type AcademicAiActionResult,
} from '@/features/editor/domain/ai/ai-assistant';
import {
  fixLatexError,
  type AiErrorFixParams,
  type AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';

export type {
  AiActionParams,
  AiActionResult,
  AcademicAiActionParams,
  AcademicAiActionResult,
  AiErrorFixParams,
  AiErrorFixResult,
};

export class AiClient {
  /**
   * Execute an AI action on selected text via the backend CLSI AI endpoint.
   */
  public static async executeAction(params: AiActionParams): Promise<AiActionResult> {
    const { action, selectedText } = params;
    const trimmed = selectedText.trim();

    if (!trimmed) {
      return {
        success: false,
        originalText: selectedText,
        suggestedText: selectedText,
        explanation: 'No text selected.',
        action,
        diffSummary: {
          charsOriginal: 0,
          charsSuggested: 0,
          wordsOriginal: 0,
          wordsSuggested: 0,
        },
      };
    }

    try {
      const res = await apiPost<AiActionResult>(
        `${MANUSCRIPTS_API_BASE}/clsi/ai/transform`,
        params,
        { silent: true },
      );
      if (res && typeof res.suggestedText === 'string') {
        return res;
      }
    } catch {
      // Fallback if backend endpoint is unreachable
    }

    const suggestedText = applyFallbackTransform(selectedText, action);
    const wordsOriginal = trimmed.split(/\s+/).filter(Boolean).length;
    const wordsSuggested = suggestedText.trim().split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      originalText: selectedText,
      suggestedText,
      explanation: `Applied ${action} transformation.`,
      action,
      diffSummary: {
        charsOriginal: trimmed.length,
        charsSuggested: suggestedText.trim().length,
        wordsOriginal,
        wordsSuggested,
      },
    };
  }
}

export { AiClient as AcademicAiService };

/**
 * Request AI fix suggestion for a given compilation error via backend CLSI AI endpoint.
 */
export async function suggestLatexFix(params: AiErrorFixParams): Promise<AiErrorFixResult> {
  try {
    const res = await apiPost<AiErrorFixResult>(
      `${MANUSCRIPTS_API_BASE}/clsi/ai/fix-error`,
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
export async function generateLatexTable(prompt: string): Promise<string> {
  const res = await apiPost<{ table?: string; content?: string } | null>(
    `${MANUSCRIPTS_API_BASE}/clsi/ai/generate-table`,
    { prompt },
  );
  const rawText = res?.table || res?.content || '';
  return rawText.replace(/```latex\n?|```tsv\n?|```\n?/g, '').trim();
}

export const ai = {
  executeAction: AiClient.executeAction,
  executeAcademicAction: AiClient.executeAction,
  suggestLatexFix,
  generateLatexTable,
  AiClient,
  AcademicAiService: AiClient,
};
