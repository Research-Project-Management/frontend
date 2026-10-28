/**
 * ai-api.client.ts
 *
 * AI Academic Assistant & LaTeX Error Repair Sub-API (Part of manuscriptService SDK).
 * Connects frontend editor and logs to /api/ai/chat/sync endpoint, backed by
 * domain-level macro masking and robust offline heuristics.
 */

import { apiPost } from '@/shared/lib/api';
import type {
  AcademicAiActionParams,
  AcademicAiActionResult,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import type {
  AiErrorFixParams,
  AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';
import {
  maskLatexEntities,
  getAcademicSystemPrompt,
  applyHeuristicTransformation,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import { heuristicLatexErrorFix } from '@/features/editor/domain/ai/ai-error-assist';

export type {
  AcademicAiActionParams,
  AcademicAiActionResult,
  AiErrorFixParams,
  AiErrorFixResult,
};

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
      const systemPrompt = getAcademicSystemPrompt(action, customPrompt);
      const promptText = `Text to edit:\n"""\n${maskedText}\n"""`;

      const json = await apiPost<Record<string, unknown>>('/api/ai/chat/sync', {
        query: promptText,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        model: 'fast',
      }, { silent: true });

      const data = (json?.data && typeof json.data === 'object' ? json.data : json) as Record<string, unknown>;
      const rawAiText =
        typeof data?.content === 'string'
          ? data.content
          : typeof data?.message === 'string'
            ? data.message
            : typeof data?.response === 'string'
              ? data.response
              : '';
      if (rawAiText && rawAiText.trim().length > 0) {
        suggestedResult = unmask(rawAiText.trim().replace(/^"""\s*|\s*"""$/g, ''));
        explanation = `Applied ${action.replace('-', ' ')} via AI Copilot.`;
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
    type AiCompletionPayload = {
      content?: string;
      reply?: string;
      message?: string;
    };
    type AiCompletionResponse = {
      data?: AiCompletionPayload | string;
    } & AiCompletionPayload;

    const json = await apiPost<AiCompletionResponse | string>('/api/ai/chat/sync', {
      messages: [{ role: 'user', content: prompt }],
      query: prompt,
      pageId: params.pageId,
      projectId: params.projectId,
    }, { silent: true });

    const data = (typeof json === 'object' && json !== null && 'data' in json ? json.data : json) || json;
    const rawContent: string =
      typeof data === 'string'
        ? data
        : typeof data === 'object' && data !== null
          ? (data.content || data.reply || data.message || '')
          : '';

    const jsonText = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
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
    // If AI network or parsing fails, consult backend manuscript diagnostics autoFix before local heuristic fallback
  }

  if (params.surroundingCode) {
    try {
      const autoFixRes = await apiPost<{ fixedSource?: string; changesApplied?: number; summary?: string[] }>(
        '/api/v1/manuscripts/diagnostics/autofix',
        { source: params.surroundingCode },
        { silent: true },
      );
      if (
        autoFixRes &&
        typeof autoFixRes.fixedSource === 'string' &&
        (autoFixRes.changesApplied ?? 0) > 0 &&
        autoFixRes.fixedSource !== params.surroundingCode
      ) {
        return {
          explanation: (autoFixRes.summary && autoFixRes.summary.length > 0)
            ? autoFixRes.summary.join('; ')
            : 'Applied automated LaTeX syntax repair via Manuscript Diagnostics.',
          originalSnippet: params.surroundingCode,
          fixedSnippet: autoFixRes.fixedSource,
          startLine: params.errorLine || 1,
          endLine: params.errorLine || 1,
          confidence: 'medium',
        };
      }
    } catch {
      // Fall through to local heuristic
    }
  }

  return heuristicLatexErrorFix(params);
}

/**
 * Generate a clean LaTeX tabular or TSV table from an AI prompt.
 */
export async function generateLatexTable(prompt: string): Promise<string> {
  const systemPrompt = `You are an expert academic LaTeX assistant. Generate a clean LaTeX tabular or TSV table according to the user request.
Output ONLY the clean LaTeX tabular code starting with \\begin{tabular} and ending with \\end{tabular} or TSV data with tabs and newlines. Do not wrap in markdown quotes or add conversational preamble.`;

  const json = await apiPost<{
    data?: { content?: string; message?: string };
    content?: string;
    message?: string;
  } | null>('/api/ai/chat/sync', {
    query: `Create an academic table based on: ${prompt}`,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    model: 'fast',
  });

  const rawText = json?.data?.content || json?.data?.message || json?.content || json?.message || '';
  return rawText.replace(/```latex\n?|```tsv\n?|```\n?/g, '').trim();
}

export const ai = {
  executeAcademicAction: AcademicAiService.executeAction,
  suggestLatexFix,
  generateLatexTable,
  AcademicAiService,
};
