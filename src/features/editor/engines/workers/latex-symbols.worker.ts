/**
 * latex-symbols.worker.ts
 *
 * Dedicated Web Worker for Project Symbols & Metadata Indexing (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-symbols.worker.ts`
 *
 * Architecture (Overleaf Parity):
 * - Offloads all regex parsing, line-by-line comment stripping, and BibTeX extraction
 *   off the main UI thread into a background worker.
 * - Keeps an in-memory symbol graph across all project files.
 * - Broadcasts immutable SymbolSnapshot back to the UI thread for instant 0ms autocomplete queries.
 */

import {
  LatexSymbolsIndexCore,
  type SymbolSnapshot,
} from '../../domain/latex/latex-symbols-core';

export type SymbolsWorkerMessageIn =
  | { type: 'indexFile'; fileId: string; filePath: string; content: string; id: number }
  | { type: 'removeFile'; fileId: string; filePath?: string; id: number }
  | { type: 'clear'; id: number }
  | { type: 'getSnapshot'; id: number };

export interface SymbolsWorkerMessageOut {
  id: number;
  snapshot: SymbolSnapshot;
}

const core = new LatexSymbolsIndexCore();

self.onmessage = (event: MessageEvent<SymbolsWorkerMessageIn>) => {
  const msg = event.data;
  if (!msg) return;

  try {
    switch (msg.type) {
      case 'indexFile':
        core.indexFile(msg.fileId, msg.filePath, msg.content);
        break;
      case 'removeFile':
        core.removeFile(msg.fileId, msg.filePath);
        break;
      case 'clear':
        core.clear();
        break;
      case 'getSnapshot':
        break;
    }

    const snapshot = core.exportSnapshot();
    const response: SymbolsWorkerMessageOut = {
      id: msg.id,
      snapshot,
    };
    self.postMessage(response);
  } catch (err) {
    console.error('[latex-symbols.worker] Indexing error:', err);
    // Never crash the worker; return latest valid snapshot
    self.postMessage({
      id: msg.id,
      snapshot: core.exportSnapshot(),
    });
  }
};
