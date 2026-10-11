/**
 * ai.api.ts
 *
 * AI Academic Assistant & LaTeX Error Repair Sub-API (Part of manuscriptService SDK).
 * Connects frontend editor and logs to /api/ai/chat/sync endpoint, backed by
 * domain-level macro masking and robust offline heuristics.
 */

import { API_BASE_URL } from '@/config/env';
import { getAuthToken } from '@/shared/lib/api';
import {
  type AcademicAiActionParams,
  type AcademicAiActionResult,
  maskLatexEntities,
  getAcademicSystemPrompt,
  applyHeuristicTransformation,
} from '@/features/editor/domain/latex/ai-academic-assistant';
import {
  type AiErrorFixParams,
  type AiErrorFixResult,
  heuristicLatexErrorFix,
} from '@/features/editor/domain/latex/ai-error-assist';

export class AcademicAiService {
  /**
   * Execute an academic AI action on selected text.
   */
  public static async executeAction(params: AcademicAiActionParams): Promise<AcademicAiActionResult> {
    const { action, selectedText, customPrompt } = params;
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

    // 1. Mask LaTeX entities (equations, citations, labels)
    const { maskedText, unmask } = maskLatexEntities(trimmed);

    let suggestedResult = '';
    let explanation = '';

    try {
      const token = getAuthToken();
      const systemPrompt = getAcademicSystemPrompt(action, customPrompt);

      const promptText = `Text to edit:\n"""\n${maskedText}\n"""`;
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: promptText,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText },
          ],
          model: 'fast',
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as Record<string, any>;
        const data = json?.data || json;
        const rawAiText = data?.content || data?.message || data?.response || '';
        if (rawAiText && rawAiText.trim().length > 0) {
          suggestedResult = unmask(rawAiText.trim().replace(/^"""\s*|\s*"""$/g, ''));
          explanation = `Applied ${action.replace('-', ' ')} via AI Copilot.`;
        }
      }
    } catch {
      // Fallback silently to heuristic engine
    }

    // Heuristic fallback if AI response was empty or failed
    if (!suggestedResult) {
      const fallbackMasked = applyHeuristicTransformation(maskedText, action);
      suggestedResult = unmask(fallbackMasked);
      explanation = `Enhanced ${action.replace('-', ' ')} using Academic Heuristic Rules.`;
    }

    const wordsOriginal = trimmed.split(/\s+/).filter(Boolean).length;
    const wordsSuggested = suggestedResult.split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      originalText: selectedText,
      suggestedText: suggestedResult,
      explanation,
      action,
      diffSummary: {
        charsOriginal: trimmed.length,
        charsSuggested: suggestedResult.length,
        wordsOriginal,
        wordsSuggested,
      },
    };
  }
}

/**
 * Request AI fix suggestion for a given compilation error.
 */
export async function suggestLatexFix(params: AiErrorFixParams): Promise<AiErrorFixResult> {
  const token = getAuthToken();

  const prompt = [
    'You are an expert LaTeX debugging assistant (Overleaf Error Assist).',
    'Analyze the following LaTeX compiler error and suggest an immediate, surgical fix.',
    `File: ${params.errorFile || 'main.tex'}`,
    `Line: ${params.errorLine || 'unknown'}`,
    `Error Message: ${params.errorMessage}`,
    params.detail ? `Detail: ${params.detail}` : '',
    params.surroundingCode ? `\nSurrounding Code:\n\`\`\`latex\n${params.surroundingCode}\n\`\`\`` : '',
    '',
    'Reply ONLY with a valid JSON object in this exact schema (no markdown fences, pure JSON):',
    '{',
    '  "explanation": "Brief 1-2 sentence description of what caused the error and how to fix it",',
    '  "originalSnippet": "Exact code line(s) that should be replaced",',
    '  "fixedSnippet": "The corrected code line(s)",',
    `  "startLine": ${params.errorLine || 1},`,
    `  "endLine": ${params.errorLine || 1},`,
    '  "confidence": "high"',
    '}',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        query: prompt,
        pageId: params.pageId,
        projectId: params.projectId,
      }),
    });

    if (!res.ok) {
      return heuristicLatexErrorFix(params);
    }

    const json = (await res.json()) as any;
    const data = json?.data || json;
    const rawContent: string =
      typeof data === 'string'
        ? data
        : (data?.content || data?.reply || data?.message || '');

    // Clean JSON text (strip markdown code blocks if returned)
    const jsonText = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(jsonText) as Record<string, any>;
    if (parsed && typeof parsed === 'object' && parsed.explanation && parsed.fixedSnippet !== undefined) {
      let explanation = String(parsed.explanation).trim();
      explanation = explanation
        .replace(/^Error on line \d+:\s*/i, '')
        .replace(/^LaTeX Error:\s*/i, '')
        .trim();

      return {
        explanation: explanation || String(parsed.explanation),
        originalSnippet: String(parsed.originalSnippet || ''),
        fixedSnippet: String(parsed.fixedSnippet || ''),
        startLine: Number(parsed.startLine) || params.errorLine || 1,
        endLine: Number(parsed.endLine) || params.errorLine || 1,
        confidence:
          parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
            ? parsed.confidence
            : 'high',
      };
    }
  } catch {
    // If AI network or parsing fails, seamlessly return heuristic fix
  }

  return heuristicLatexErrorFix(params);
}

export const ai = {
  executeAcademicAction: AcademicAiService.executeAction,
  suggestLatexFix,
  AcademicAiService,
};

export type {
  AiErrorFixParams,
  AiErrorFixResult,
} from '@/features/editor/domain/latex/ai-error-assist';

export type {
  AcademicAiActionParams,
  AcademicAiActionResult,
  AcademicAiActionType,
} from '@/features/editor/domain/latex/ai-academic-assistant';

