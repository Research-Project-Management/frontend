/**
 * subsystems/spelling/index.ts
 *
 * Spelling Subsystem Public Seam & Entry Point (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - CodeMirror 6 real-time LaTeX prose spell-check extension & language tag normalization.
 * - Space-scoped custom dictionary hook (`useDictionary` — Personal `'personal'` vs Project UUID).
 * - Settings UI (`SpellingTab`) and True-LRU singleflight `SpellingCache`.
 */

export {
  createSpellingExtension,
  normalizeSpellLanguage,
  type SpellingExtensionOptions,
} from './extensions/extension';
export { useDictionary } from './hooks/useDictionary';
export { SpellingTab, type SpellingTabProps } from './ui/SpellingTab';
export { SpellingCache, spellingCache, hashSpellingInput } from './model/cache';
