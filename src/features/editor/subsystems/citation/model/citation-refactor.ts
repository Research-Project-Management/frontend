/**
 * citation-refactor.ts
 *
 * Pure Domain Engine for Project-Wide Citation Key Refactoring & Renaming.
 * Location: `features/editor/domain/citation/citation-refactor.ts`
 *
 * Responsibilities:
 * - Validates citation keys according to BibTeX / BibLaTeX / Natbib standards.
 * - Safely refactors citation keys across BibTeX entries without corrupting metadata.
 * - Accurately updates all LaTeX citation macros (\cite, \citep, \citet, \autocite, \nocite)
 *   and Pandoc Markdown citations (@key, [@key1; @key2]).
 * - Substring-safe: renaming 'lee20' will NEVER corrupt 'lee2020' or 'lee20a'.
 * - Pure TypeScript with zero UI or DOM dependencies; 100% testable.
 */

import { PANDOC_BRACKET_REGEX } from './citation-formatter';

export interface ValidateKeyResult {
  isValid: boolean;
  error?: string;
}

export interface RefactorFileResult {
  content: string;
  count: number;
}

export interface ProjectRefactorResult {
  modifiedFiles: Array<{
    id: string;
    path: string;
    oldContent: string;
    newContent: string;
    count: number;
  }>;
  totalCount: number;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a citation key string
 */
export function validateCitationKey(key: string, oldKey?: string): ValidateKeyResult {
  const trimmed = (key || '').trim();

  if (!trimmed) {
    return { isValid: false, error: 'Citation key cannot be empty.' };
  }

  if (trimmed.startsWith('@')) {
    return {
      isValid: false,
      error: 'Citation key should not start with @ (it is detected automatically).',
    };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Citation key cannot contain whitespace.' };
  }

  if (/[\\{},~"%\$\^]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Citation key cannot contain special characters ({ }, \\, ~, ", %, $, ^).',
    };
  }

  if (oldKey && trimmed.toLowerCase() === oldKey.trim().toLowerCase()) {
    return {
      isValid: false,
      error: 'New citation key must be different from the current key.',
    };
  }

  // Standard BibTeX citation key regex: alphanumeric + allowed punctuation (_ : - .)
  const validPattern = /^[a-zA-Z0-9_:.#/-]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Citation key may only contain letters, numbers, and: _ : - . # /',
    };
  }

  return { isValid: true };
}

/**
 * Refactors a citation key inside BibTeX bibliography source text.
 * Replaces `@type{oldKey,` and `key = {oldKey}` while preserving all inner formatting.
 */
export function refactorCitationKeyInBibTeX(
  bibContent: string,
  oldKey: string,
  newKey: string
): RefactorFileResult {
  if (!bibContent || !oldKey || !newKey || oldKey === newKey) {
    return { content: bibContent, count: 0 };
  }

  let count = 0;
  const escapedOld = escapeRegex(oldKey);

  // 1. Match BibTeX entry definition: @type{oldKey, or @type(oldKey,
  const entryDefRegex = new RegExp(
    `(@[a-zA-Z0-9_-]+\\s*[{()]\\s*)(${escapedOld})(\\s*,)`,
    'gi'
  );

  let updated = bibContent.replace(entryDefRegex, (_match, prefix, _key, suffix) => {
    count++;
    return `${prefix}${newKey}${suffix}`;
  });

  // 2. Match optional key = {oldKey} or key = "oldKey" fields inside BibTeX entries
  const keyFieldRegex = new RegExp(
    `(\\bkey\\s*=\\s*[{"]\\s*)(${escapedOld})(\\s*[}"]\\s*,?)`,
    'gi'
  );

  updated = updated.replace(keyFieldRegex, (_match, prefix, _key, suffix) => {
    count++;
    return `${prefix}${newKey}${suffix}`;
  });

  return { content: updated, count };
}

/**
 * Refactors citation keys in LaTeX / Pandoc Markdown source text.
 * Strictly matches command arguments and boundary-delimited Pandoc citations.
 */
export function refactorCitationKeyInLatex(
  text: string,
  oldKey: string,
  newKey: string
): RefactorFileResult {
  if (!text || !oldKey || !newKey || oldKey === newKey) {
    return { content: text, count: 0 };
  }

  let count = 0;
  const targetLower = oldKey.toLowerCase();

  // 1. LaTeX citation commands regex matching \cite, \citep, \citet, \newcite, \shortcite, \autocite, \nocite, etc.
  const LATEX_CITE_REPLACE_REGEX =
    /(\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num|a)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{)([^}]+)(\})/gi;

  let updated = text.replace(LATEX_CITE_REPLACE_REGEX, (_fullMatch, prefix, innerKeys, suffix) => {
    const parts = innerKeys.split(',');
    let modified = false;

    const newParts = parts.map((part: string) => {
      const trimmed = part.trim();
      if (trimmed.toLowerCase() === targetLower) {
        count++;
        modified = true;
        // Preserve surrounding whitespace inside comma segment
        const leadingSpace = part.slice(0, part.indexOf(trimmed));
        const trailingSpace = part.slice(part.indexOf(trimmed) + trimmed.length);
        return `${leadingSpace}${newKey}${trailingSpace}`;
      }
      return part;
    });

    if (modified) {
      return `${prefix}${newParts.join(',')}${suffix}`;
    }
    return _fullMatch;
  });

  // 2. Pandoc bracketed citations: [@key1; @key2, p. 20]
  updated = updated.replace(PANDOC_BRACKET_REGEX, (fullBracket, inner) => {
    const atRegex = new RegExp(`(@)(${escapeRegex(oldKey)})(?=[\\s,;\\]]|\$)`, 'gi');
    let bracketModified = false;
    const newInner = inner.replace(atRegex, (_m: string, atPrefix: string) => {
      count++;
      bracketModified = true;
      return `${atPrefix}${newKey}`;
    });

    return bracketModified ? `[${newInner}]` : fullBracket;
  });

  // 3. Inline Pandoc citations: @oldKey in prose
  const INLINE_CITE_REGEX = new RegExp(
    `(^|[\\s(])(@)(${escapeRegex(oldKey)})(?=[\\s.,;:?!)\\]]|\$)`,
    'gi'
  );
  updated = updated.replace(INLINE_CITE_REGEX, (_m, before, atPrefix) => {
    count++;
    return `${before}${atPrefix}${newKey}`;
  });

  return { content: updated, count };
}

/**
 * Refactors a citation key across all files in a project
 */
export function refactorCitationKeyAcrossFiles(
  files: Array<{ id: string; path: string; content: string }>,
  oldKey: string,
  newKey: string
): ProjectRefactorResult {
  const modifiedFiles: ProjectRefactorResult['modifiedFiles'] = [];
  let totalCount = 0;

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    let res: RefactorFileResult;

    if (ext === 'bib') {
      res = refactorCitationKeyInBibTeX(file.content, oldKey, newKey);
    } else {
      res = refactorCitationKeyInLatex(file.content, oldKey, newKey);
    }

    if (res.count > 0 && res.content !== file.content) {
      totalCount += res.count;
      modifiedFiles.push({
        id: file.id,
        path: file.path,
        oldContent: file.content,
        newContent: res.content,
        count: res.count,
      });
    }
  }

  return { modifiedFiles, totalCount };
}

/**
 * Orchestrates project-wide citation key refactoring across backend files, LRU cache,
 * symbol index, DAG engine, and the active CodeMirror buffer.
 */
export async function executeProjectCitekeyRefactor(
  oldKey: string,
  newKey: string,
  optProjectId?: string
): Promise<{ success: boolean; modifiedCount: number; replacedCount: number }> {
  const { toast } = await import('sonner');
  const validation = validateCitationKey(newKey, oldKey);
  if (!validation.isValid) {
    toast.error(validation.error || 'Invalid citation key', { id: 'refactor-citekey' });
    return { success: false, modifiedCount: 0, replacedCount: 0 };
  }

  const {
    usePageStore,
    editorCommandBus,
    getActiveEditorEngine,
    workspaceCoordinator,
    sessionCoordinator,
  } = await import('@/features/editor/core');
  const { manuscriptService, fileService } = await import('@/features/editor/sdk/manuscript.service');
  const { lruDocumentCache } = await import('@/features/editor/domain/document/lru-document-cache');
  const { extractDocumentContentString } = await import('@/features/editor/domain/types/core.types');
  const { latexSymbolsIndex } = await import('@/features/editor/domain/latex/latex-symbols-index');
  const { latexDagEngine } = await import('@/features/editor/domain/latex/latex-dag-engine');
  const { applyTextDiff } = await import('@/features/editor/sdk/realtime/yjs-socket-provider');

  const pageState = usePageStore.getState();
  const activeDoc = pageState.getActiveDocument();
  const activeDocId = activeDoc?.id ?? null;
  const effectiveProjectId =
    optProjectId ||
    pageState.projectId ||
    pageState.parentPageId ||
    activeDoc?.id ||
    '';

  if (!effectiveProjectId) {
    toast.error('No active project found', { id: 'refactor-citekey' });
    return { success: false, modifiedCount: 0, replacedCount: 0 };
  }

  const fileMap = new Map<string, { id: string; path: string; content: string }>();

  // 1. Include files registered in workspaceCoordinator
  const wsFiles = workspaceCoordinator.getProjectFiles() || [];
  for (const wf of wsFiles) {
    if (wf.id) {
      const cached = lruDocumentCache.get(wf.id);
      fileMap.set(wf.id, {
        id: wf.id,
        path: cached?.filePath || wf.path || wf.title || '',
        content: cached?.content ?? extractDocumentContentString(wf.content),
      });
    }
  }

  // 2. Fetch backend files and merge (preferring unsaved local edits in lruDocumentCache)
  try {
    const files = await fileService.getByPageId(effectiveProjectId);
    for (const f of files) {
      if (f.id) {
        const cached = lruDocumentCache.get(f.id);
        fileMap.set(f.id, {
          id: f.id,
          path: cached?.filePath || f.title || '',
          content: cached?.content ?? f.content ?? '',
        });
      }
    }
  } catch {
    // Non-blocking fallback to cache and active doc
  }

  if (fileMap.size === 0 && activeDoc?.id && activeDoc.id !== effectiveProjectId) {
    try {
      const pageFiles = await fileService.getByPageId(activeDoc.id);
      for (const f of pageFiles) {
        if (f.id) {
          const cached = lruDocumentCache.get(f.id);
          fileMap.set(f.id, {
            id: f.id,
            path: cached?.filePath || f.title || '',
            content: cached?.content ?? f.content ?? '',
          });
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  // 3. Ensure all models in lruDocumentCache take precedence over server snapshots
  const cachedModels = lruDocumentCache.getAllModels();
  for (const m of cachedModels) {
    if (m.fileId) {
      fileMap.set(m.fileId, {
        id: m.fileId,
        path: m.filePath,
        content: m.content,
      });
    }
  }

  const liveEngine = getActiveEditorEngine();
  if (activeDocId) {
    const activeDocMatches = activeDoc?.id === activeDocId;
    const cachedActive = lruDocumentCache.get(activeDocId);
    const liveContent =
      liveEngine?.getContent?.() ||
      cachedActive?.content ||
      (activeDocMatches ? extractDocumentContentString(activeDoc) : '') ||
      fileMap.get(activeDocId)?.content ||
      '';
    const activePath =
      cachedActive?.filePath ||
      (activeDocMatches
        ? (activeDoc as { title?: string; name?: string })?.title ||
          (activeDoc as { title?: string; name?: string })?.name
        : null) ||
      fileMap.get(activeDocId)?.path ||
      'main.tex';
    if (liveContent) {
      fileMap.set(activeDocId, {
        id: activeDocId,
        path: activePath,
        content: liveContent,
      });
    }
  }

  const projectFiles = Array.from(fileMap.values());
  const { modifiedFiles, totalCount } = refactorCitationKeyAcrossFiles(projectFiles, oldKey, newKey);

  if (modifiedFiles.length === 0) {
    toast.info(`No citations found referencing @${oldKey}`, { id: 'refactor-citekey' });
    return { success: true, modifiedCount: 0, replacedCount: 0 };
  }

  const Y = await import('yjs');

  for (const mod of modifiedFiles) {
    const model = lruDocumentCache.getModel(mod.id);
    const yText = model?.yText instanceof Y.Text ? model.yText : null;
    if (yText) {
      try {
        if (yText.doc) {
          yText.doc.transact(() => {
            applyTextDiff(yText, mod.newContent);
          }, 'citekey-refactor');
        } else {
          applyTextDiff(yText, mod.newContent);
        }
      } catch {
        // Fallback if Y.Doc transaction fails
      }
    }

    lruDocumentCache.updateContent(mod.id, mod.newContent, true);
    sessionCoordinator.notifyContentChange(mod.id, mod.newContent);
    latexSymbolsIndex.indexFile(mod.id, mod.path, mod.newContent, true);
    latexDagEngine.parseAndRegister(mod.path, mod.newContent, mod.id);

    try {
      await manuscriptService.docs.updateContent(mod.id, mod.newContent);
    } catch (err) {
      console.warn(`[CitationRefactor] Failed to save updated file ${mod.path} to backend:`, err);
    }

    if (activeDocId && activeDocId === mod.id) {
      const store = usePageStore.getState();
      if (store.activeFilePage?.id === mod.id) {
        store.setActiveFilePage({
          ...store.activeFilePage,
          content: mod.newContent,
        });
      }
      store.setCurrentPage((prev) =>
        prev && prev.id === mod.id ? { ...prev, content: mod.newContent, docContent: mod.newContent } : prev
      );
      editorCommandBus.dispatch({ type: 'editor:set-content', content: mod.newContent });
    }
  }

  editorCommandBus.dispatch({
    type: 'filetree:updated',
    payload: { action: 'refactor-citekey', oldKey, newKey, totalCount },
  });

  toast.success(
    `Renamed @${oldKey} to @${newKey} (${totalCount} occurrences in ${modifiedFiles.length} files)!`,
    { id: 'refactor-citekey' }
  );
  return { success: true, modifiedCount: modifiedFiles.length, replacedCount: totalCount };
}

