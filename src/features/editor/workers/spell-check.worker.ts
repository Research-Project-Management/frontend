/**
 * spell-check.worker.ts
 *
 * Browser WebWorker for spell checking using nspell + Hunspell dictionaries.
 * Architecture mirrors Overleaf's HunspellManager WebWorker approach.
 *
 * Dictionary files are served statically from /public/dictionaries/<lang>/
 * because `dictionary-en` (v4 ESM) uses node:fs which is unavailable in browsers.
 */

// @ts-ignore - nspell is CJS, no official types bundle
import nspell from 'nspell';

type SpellMessage =
  | { type: 'init'; language: string }
  | { type: 'spell'; id: string; words: string[] }
  | { type: 'suggest'; id: string; word: string }
  | { type: 'add_word'; word: string }
  | { type: 'remove_word'; word: string };

type SpellResult =
  | { id: string; type: 'spell'; misspellings: number[] }
  | { id: string; type: 'suggest'; suggestions: string[] }
  | { type: 'error'; message: string }
  | { type: 'ready' };

// nspell checker instance (reset on re-init)
let checker: ReturnType<typeof nspell> | null = null;

// Personal dictionary — persists across re-inits
const learnedWords = new Set<string>();

/**
 * Fetch a dictionary file as ArrayBuffer and return as Uint8Array.
 * Files live in /public/dictionaries/<lang>/index.{aff,dic}
 */
async function fetchDictFile(lang: string, ext: 'aff' | 'dic'): Promise<Uint8Array> {
  const url = `/dictionaries/${lang}/index.${ext}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch dictionary ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function initSpellChecker(language: string) {
  try {
    // 'en_US' / 'en_GB' → folder 'en'
    const lang = language.split('_')[0].toLowerCase();

    const [aff, dic] = await Promise.all([
      fetchDictFile(lang, 'aff'),
      fetchDictFile(lang, 'dic'),
    ]);

    checker = nspell({ aff, dic });

    // Restore learned words after re-init
    for (const word of learnedWords) {
      checker.add(word);
    }

    postMessage({ type: 'ready' } satisfies SpellResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to init spell checker';
    postMessage({ type: 'error', message: msg } satisfies SpellResult);
  }
}

self.onmessage = async (event: MessageEvent<SpellMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'init':
      await initSpellChecker(msg.language);
      break;

    case 'spell': {
      if (!checker) {
        postMessage({ id: msg.id, type: 'spell', misspellings: [] } satisfies SpellResult);
        return;
      }
      const misspellings: number[] = [];
      for (let i = 0; i < msg.words.length; i++) {
        if (!checker.correct(msg.words[i])) {
          misspellings.push(i);
        }
      }
      postMessage({ id: msg.id, type: 'spell', misspellings } satisfies SpellResult);
      break;
    }

    case 'suggest': {
      if (!checker) {
        postMessage({ id: msg.id, type: 'suggest', suggestions: [] } satisfies SpellResult);
        return;
      }
      const suggestions: string[] = (checker.suggest(msg.word) as string[]).slice(0, 8);
      postMessage({ id: msg.id, type: 'suggest', suggestions } satisfies SpellResult);
      break;
    }

    case 'add_word':
      if (checker) checker.add(msg.word);
      learnedWords.add(msg.word);
      break;

    case 'remove_word':
      if (checker) {
        // nspell.remove exists in newer builds; guard defensively
        (checker as any).remove?.(msg.word);
      }
      learnedWords.delete(msg.word);
      break;
  }
};
