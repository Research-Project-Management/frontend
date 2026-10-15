/**
 * editor-spelling-port.ts
 *
 * Facet & Port for LaTeX Spell Checking in CodeMirror 6 extensions.
 * Location: `features/editor/engines/adapters/editor-spelling-port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Decouples CodeMirror extensions from coordinator and SDK singletons.
 * - Allows headless testing of extensions with in-memory spelling stand-ins.
 * - Bridges to manuscriptService and toast at application runtime.
 */

import { Facet } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type {
  SpellingServicePort,
  SpellingNotificationPort,
} from '@/features/editor/domain/types/ports/spelling.port';

const noopSpellingService: SpellingServicePort = {
  getProjectDictionary: async () => [],
  getUserDictionary: async () => [],
  learnProjectWord: async () => {},
  checkSpelling: async () => null,
};

const noopNotifier: SpellingNotificationPort = {
  success: () => {},
  error: () => {},
};

let defaultSpellingService: SpellingServicePort = noopSpellingService;
let defaultNotifier: SpellingNotificationPort = noopNotifier;

export function setDefaultSpellingService(service: SpellingServicePort): void {
  defaultSpellingService = service;
}

export function getDefaultSpellingService(): SpellingServicePort {
  return defaultSpellingService;
}

export function setDefaultSpellingNotifier(notifier: SpellingNotificationPort): void {
  defaultNotifier = notifier;
}

export function getDefaultSpellingNotifier(): SpellingNotificationPort {
  return defaultNotifier;
}

export const spellingServiceFacet = Facet.define<SpellingServicePort, SpellingServicePort>({
  combine: (values) => values[values.length - 1] || defaultSpellingService,
});

export const spellingNotifierFacet = Facet.define<SpellingNotificationPort, SpellingNotificationPort>({
  combine: (values) => values[values.length - 1] || defaultNotifier,
});

export function resolveSpellingService(
  view?: EditorView | null,
  overrideService?: SpellingServicePort
): SpellingServicePort {
  if (overrideService) return overrideService;
  if (view) {
    try {
      const facetVal = view.state.facet(spellingServiceFacet);
      if (facetVal) return facetVal;
    } catch {
      // view might not have state in synthetic test scenarios
    }
  }
  return defaultSpellingService;
}

export function resolveSpellingNotifier(
  view?: EditorView | null,
  overrideNotifier?: SpellingNotificationPort
): SpellingNotificationPort {
  if (overrideNotifier) return overrideNotifier;
  if (view) {
    try {
      const facetVal = view.state.facet(spellingNotifierFacet);
      if (facetVal) return facetVal;
    } catch {
      // view might not have state in synthetic test scenarios
    }
  }
  return defaultNotifier;
}
