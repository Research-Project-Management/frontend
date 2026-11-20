/**
 * ai-prompts.ts
 *
 * Core Domain prompts and quick actions for Academic AI Assistant.
 * Location: `features/editor/domain/ai/ai-prompts.ts`
 */

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'polish',
    label: 'Academic Polish',
    prompt:
      'Rewrite this text in a rigorous, concise, and formal academic style using standard LaTeX.',
  },
  {
    id: 'explain',
    label: 'Explain Content',
    prompt:
      'Provide a detailed explanation of the mathematical derivation, algorithm, or theoretical concept in this LaTeX snippet.',
  },
  {
    id: 'abstract',
    label: 'Draft Abstract',
    prompt:
      'Based on the current document context, compose a concise, publication-ready academic abstract between 150-250 words.',
  },
  {
    id: 'bibtex',
    label: 'BibTeX Suggestions',
    prompt:
      'Suggest classic references and properly formatted BibTeX citation entries appropriate for this topic.',
  },
  {
    id: 'citation_review',
    label: 'Review Citations',
    prompt:
      'Scan this manuscript for unsupported claims, undefined citation keys, and bibliography gaps.',
  },
  {
    id: 'structure_audit',
    label: 'Audit Structure',
    prompt:
      'Audit the multi-file manuscript structure, outline balance, cross-references (\\ref/\\label), \\input links, and missing LaTeX packages.',
  },
] as const;
