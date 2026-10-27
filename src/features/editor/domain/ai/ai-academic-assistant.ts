/**
 * ai-academic-assistant.ts
 *
 * Domain logic for Overleaf AI Academic Inline Rephrasing & Macro Masking:
 * - Macro masking to preserve \cite{}, \ref{}, \label{}, and Math blocks ($...$, $$...$$) verbatim
 * - Academic prompt scaffolding
 * - Offline heuristic transformations for academic tone, conciseness, and grammar
 *
 * Domain: Layer 1 (Pure Domain Model & Academic AI Rules).
 */

export type AcademicAiActionType =
  | 'academic-tone'
  | 'make-concise'
  | 'fix-grammar'
  | 'translate-english'
  | 'custom';

export interface AcademicAiActionParams {
  action: AcademicAiActionType;
  selectedText: string;
  customPrompt?: string;
  contextBefore?: string;
  contextAfter?: string;
  documentTitle?: string;
}

export interface AcademicAiActionResult {
  success: boolean;
  originalText: string;
  suggestedText: string;
  explanation: string;
  action: AcademicAiActionType;
  diffSummary: {
    charsOriginal: number;
    charsSuggested: number;
    wordsOriginal: number;
    wordsSuggested: number;
  };
}

/**
 * LaTeX Token Masker to guarantee macros and math equations are preserved verbatim.
 */
export function maskLatexEntities(text: string): { maskedText: string; unmask: (str: string) => string } {
  const placeholders: Map<string, string> = new Map();
  let counter = 0;

  // 1. Mask Display Math $$...$$, \[...\], and display math environments (equation, align, gather, multline)
  let masked = text.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?|displaymath)\}[\s\S]*?\\end\{\2\})/g,
    (match) => {
      const id = `__LATEX_DISPLAY_MATH_${counter++}__`;
      placeholders.set(id, match);
      return id;
    },
  );

  // 2. Mask Inline Math $...$ and \(...\)
  masked = masked.replace(/(\$[^$\n]+\$|\\\(.*?\\\))/g, (match) => {
    const id = `__LATEX_INLINE_MATH_${counter++}__`;
    placeholders.set(id, match);
    return id;
  });

  // 3. Mask Citations \cite{...}, \citep{...}, \newcite{...}, \shortcite{...}, etc.
  masked = masked.replace(
    /(\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*\{[^}]+\})/g,
    (match) => {
      const id = `__LATEX_CITE_${counter++}__`;
      placeholders.set(id, match);
      return id;
    },
  );

  // 4. Mask References \ref{...}, \eqref{...}, \cref{...}, \Cref{...}, \autoref{...}, \pageref{...}, \nameref{...}, \label{...}
  masked = masked.replace(
    /(\\label\{[^}]+\}|\\(?:eq|c|C|auto|page|name)?ref\*?\{[^}]+\})/g,
    (match) => {
      const id = `__LATEX_REF_${counter++}__`;
      placeholders.set(id, match);
      return id;
    },
  );

  const unmask = (str: string): string => {
    let result = str;
    for (const [id, original] of placeholders.entries()) {
      result = result.replaceAll(id, original);
    }
    return result;
  };

  return { maskedText: masked, unmask };
}

export interface AcademicAiActionStrategy {
  readonly buildSystemPrompt: (customPrompt?: string) => string;
  readonly applyHeuristic: (text: string) => string;
}

export const ACADEMIC_AI_STRATEGIES: Readonly<
  Record<AcademicAiActionType, AcademicAiActionStrategy>
> = {
  'academic-tone': {
    buildSystemPrompt: () =>
      'You are an expert scientific editor for top-tier peer-reviewed journals (Nature, IEEE, ACM, Science). Rewrite the provided text to elevate its academic tone, scholarly vocabulary, clarity, and precision. Maintain third-person or formal academic voice. Do NOT add preamble or meta-commentary, return ONLY the rewritten text.',
    applyHeuristic: (text) =>
      text
        .replace(/\ba lot of\b/gi, 'a substantial volume of')
        .replace(/\bvery good\b/gi, 'superior')
        .replace(/\bshow that\b/gi, 'demonstrate that')
        .replace(/\bmake sure\b/gi, 'ensure')
        .replace(/\blook at\b/gi, 'investigate')
        .replace(/\bbig\b/gi, 'significant')
        .replace(/\bget\b/gi, 'obtain')
        .replace(/\bfind out\b/gi, 'determine')
        .replace(/\buse\b/gi, 'utilize')
        .replace(/\babout\b(?=\s+\d+)/gi, 'approximately'),
  },
  'make-concise': {
    buildSystemPrompt: () =>
      'You are an expert scientific editor. Rewrite the provided text to make it significantly more concise and direct. Eliminate redundant modifiers, passive fluff, and wordiness while strictly preserving all technical nuance and factual points. Return ONLY the rewritten text.',
    applyHeuristic: (text) =>
      text
        .replace(/\bin order to\b/gi, 'to')
        .replace(/\bdue to the fact that\b/gi, 'because')
        .replace(/\bat the present time\b/gi, 'currently')
        .replace(/\bfor the purpose of\b/gi, 'for')
        .replace(/\bin spite of the fact that\b/gi, 'although')
        .replace(/\ba large number of\b/gi, 'many')
        .replace(/\bis able to\b/gi, 'can')
        .replace(/\bit is important to note that\b/gi, 'notably,'),
  },
  'fix-grammar': {
    buildSystemPrompt: () =>
      'You are an expert academic proofreader. Fix all grammatical, typographical, punctuation, and structural flow errors in the following text. Improve transition phrases. Return ONLY the corrected text.',
    applyHeuristic: (text) => {
      const trimmed = text.trim();
      return trimmed.length > 0
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
        : trimmed;
    },
  },
  'translate-english': {
    buildSystemPrompt: () =>
      'You are an expert academic translator. Translate the provided text into formal, publication-ready academic English suitable for high-impact research papers. Return ONLY the translated English text.',
    applyHeuristic: (text) => text,
  },
  custom: {
    buildSystemPrompt: (customPrompt) =>
      `You are an expert scientific writing assistant. Follow this instruction carefully: ${customPrompt || 'Improve the text'}. Return ONLY the resulting text without conversational commentary.`,
    applyHeuristic: (text) => text,
  },
};

/**
 * System Prompts tailored for LaTeX academic writing.
 */
export function getAcademicSystemPrompt(action: AcademicAiActionType, customPrompt?: string): string {
  const strategy = ACADEMIC_AI_STRATEGIES[action] ?? ACADEMIC_AI_STRATEGIES.custom;
  return strategy.buildSystemPrompt(customPrompt);
}

/**
 * Heuristic fallback transformation when offline or AI backend is unreachable.
 */
export function applyHeuristicTransformation(text: string, action: AcademicAiActionType): string {
  const strategy = ACADEMIC_AI_STRATEGIES[action] ?? ACADEMIC_AI_STRATEGIES.custom;
  let result = strategy.applyHeuristic(text);
  if (result.length > 0 && text.length > 0 && text[0] === text[0].toUpperCase()) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}
