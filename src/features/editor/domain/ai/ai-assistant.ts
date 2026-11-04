/**
 * ai-assistant.ts
 *
 * Types and fallback strategies for AI Academic Inline Rephrasing & Macro Masking.
 * Authoritative macro masking (`maskLatexEntities`), academic system prompts, and LLM execution
 * live on the backend in `backend/src/modules/manuscripts/clsi/domain/latex-ai-assistant.ts`
 * via `POST /api/v1/manuscripts/clsi/ai/transform`.
 */

export type AiActionType =
  | 'academic-tone'
  | 'make-concise'
  | 'fix-grammar'
  | 'translate-english'
  | 'custom';

export type AcademicAiActionType = AiActionType;

export interface AiActionParams {
  action: AiActionType;
  selectedText: string;
  customPrompt?: string;
  contextBefore?: string;
  contextAfter?: string;
  documentTitle?: string;
}

export type AcademicAiActionParams = AiActionParams;

export interface AiActionResult {
  success: boolean;
  originalText: string;
  suggestedText: string;
  explanation: string;
  action: AiActionType;
  diffSummary: {
    charsOriginal: number;
    charsSuggested: number;
    wordsOriginal: number;
    wordsSuggested: number;
  };
}

export type AcademicAiActionResult = AiActionResult;

export interface AiActionStrategy {
  readonly buildSystemPrompt: (customPrompt?: string) => string;
  readonly applyHeuristic: (text: string) => string;
}

export type AcademicAiActionStrategy = AiActionStrategy;

export function maskLatexEntities(text: string): { maskedText: string; unmask: (str: string) => string } {
  const tokens: string[] = [];
  const maskedText = text.replace(
    /(\$\$[\s\S]*?\$\$|\$[^$]+\$|\\(?:cite|citep|citet|ref|eqref|label)\*?(?:\[[^\]]*\])*\{[^}]*\})/g,
    (match) => {
      const idx = tokens.push(match) - 1;
      return `__LATEX_TOKEN_${idx}__`;
    },
  );
  return {
    maskedText,
    unmask: (str: string) =>
      str.replace(/__LATEX_TOKEN_(\d+)__/g, (_m, idx) => tokens[Number(idx)] ?? _m),
  };
}

export const AI_ACTION_STRATEGIES: Record<AiActionType, AiActionStrategy> = {
  'academic-tone': {
    buildSystemPrompt: () => 'Rewrite the text in a formal academic tone while preserving all LaTeX commands and math.',
    applyHeuristic: (text: string) =>
      text
        .replace(/\blook at\b/gi, 'investigate')
        .replace(/\ba lot of\b/gi, 'numerous')
        .replace(/\bto show that\b/gi, 'to demonstrate that'),
  },
  'make-concise': {
    buildSystemPrompt: () => 'Make the text more concise while preserving meaning and all LaTeX macros.',
    applyHeuristic: (text: string) =>
      text
        .replace(/\bIn order to\b/g, 'To')
        .replace(/\bin order to\b/g, 'to')
        .replace(/\bdue to the fact that\b/gi, 'because'),
  },
  'fix-grammar': {
    buildSystemPrompt: () => 'Fix grammar, spelling, and punctuation while keeping LaTeX commands intact.',
    applyHeuristic: (text: string) => text,
  },
  'translate-english': {
    buildSystemPrompt: () => 'Translate the text into formal academic English while preserving LaTeX macros.',
    applyHeuristic: (text: string) => text,
  },
  custom: {
    buildSystemPrompt: (customPrompt?: string) => customPrompt || 'Apply the requested academic transformation.',
    applyHeuristic: (text: string) => text,
  },
};

export const ACADEMIC_AI_STRATEGIES = AI_ACTION_STRATEGIES;

export function getAiSystemPrompt(action: AiActionType, customPrompt?: string): string {
  return AI_ACTION_STRATEGIES[action]?.buildSystemPrompt(customPrompt) ?? (customPrompt || `AI action: ${action}`);
}

export { getAiSystemPrompt as getAcademicSystemPrompt };

export function applyFallbackTransform(text: string, action: AiActionType): string {
  const { maskedText, unmask } = maskLatexEntities(text);
  const transformed = AI_ACTION_STRATEGIES[action]?.applyHeuristic(maskedText) ?? maskedText;
  return unmask(transformed);
}

export { applyFallbackTransform as applyHeuristicTransformation };
