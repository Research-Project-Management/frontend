/**
 * citation-refactor.ts
 *
 * Domain Engine for Project-Wide Citation Key Refactoring & Renaming.
 * Validates BibTeX/BibLaTeX/Natbib citation keys, delegates project-wide refactoring
 * to the backend Citations endpoint (`manuscriptService.citations.refactorKey`),
 * and synchronizes affected local Yjs/LRU buffers.
 */

import { PANDOC_BRACKET_REGEX } from './citation-formatter';
import type {
  WorkspaceServicePort,
  WorkspaceNotificationPort,
  WorkspaceStorePort,
} from '@/features/editor/domain/workspace/workspace-service-port';

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function validateCitationKey(key: string, oldKey?: string): ValidateKeyResult {
  const trimmed = (key || '').trim();
  if (!trimmed) return { isValid: false, error: 'Citation key cannot be empty.' };
  if (trimmed.startsWith('@')) {
    return { isValid: false, error: 'Citation key should not start with @ (it is detected automatically).' };
  }
  if (/\s/.test(trimmed)) return { isValid: false, error: 'Citation key cannot contain whitespace.' };
  if (/[\\{},~"%\$\^]/.test(trimmed)) {
    return { isValid: false, error: 'Citation key cannot contain special characters ({ }, \\, ~, ", %, $, ^).' };
  }
  if (oldKey && trimmed.toLowerCase() === oldKey.trim().toLowerCase()) {
    return { isValid: false, error: 'New citation key must be different from the current key.' };
  }
  if (!/^[a-zA-Z0-9_:.#/-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Citation key may only contain letters, numbers, and: _ : - . # /' };
  }
  return { isValid: true };
}

export function refactorCitationKeyInBibTeX(bibContent: string, oldKey: string, newKey: string): RefactorFileResult {
  if (!bibContent || !oldKey || !newKey || oldKey === newKey) return { content: bibContent, count: 0 };
  let count = 0;
  const escapedOld = escapeRegex(oldKey);
  const entryDefRegex = new RegExp(`(@[a-zA-Z0-9_-]+\\s*[{()]\\s*)(${escapedOld})(\\s*,)`, 'gi');
  let updated = bibContent.replace(entryDefRegex, (_m, p, _k, s) => (++count, `${p}${newKey}${s}`));
  const keyFieldRegex = new RegExp(`(\\bkey\\s*=\\s*[{"]\\s*)(${escapedOld})(\\s*[}"]\\s*,?)`, 'gi');
  updated = updated.replace(keyFieldRegex, (_m, p, _k, s) => (++count, `${p}${newKey}${s}`));
  return { content: updated, count };
}

export function refactorCitationKeyInLatex(text: string, oldKey: string, newKey: string): RefactorFileResult {
  if (!text || !oldKey || !newKey || oldKey === newKey) return { content: text, count: 0 };
  let count = 0;
  const targetLower = oldKey.toLowerCase();
  const LATEX_CITE_REPLACE_REGEX =
    /(\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num|a)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{)([^}]+)(\})/gi;

  let updated = text.replace(LATEX_CITE_REPLACE_REGEX, (fullMatch, prefix, innerKeys, suffix) => {
    let modified = false;
    const newParts = innerKeys.split(',').map((part: string) => {
      const trimmed = part.trim();
      if (trimmed.toLowerCase() === targetLower) {
        count++;
        modified = true;
        const lead = part.slice(0, part.indexOf(trimmed));
        const trail = part.slice(part.indexOf(trimmed) + trimmed.length);
        return `${lead}${newKey}${trail}`;
      }
      return part;
    });
    return modified ? `${prefix}${newParts.join(',')}${suffix}` : fullMatch;
  });

  updated = updated.replace(PANDOC_BRACKET_REGEX, (fullBracket, inner) => {
    const atRegex = new RegExp(`(@)(${escapeRegex(oldKey)})(?=[\\s,;\\]]|$)`, 'gi');
    let mod = false;
    const newInner = inner.replace(atRegex, (_m: string, at: string) => (++count, (mod = true), `${at}${newKey}`));
    return mod ? `[${newInner}]` : fullBracket;
  });

  const inlineRegex = new RegExp(`(^|[\\s(])(@)(${escapeRegex(oldKey)})(?=[\\s.,;:?!)\\]]|$)`, 'gi');
  updated = updated.replace(inlineRegex, (_m, before, at) => (++count, `${before}${at}${newKey}`));
  return { content: updated, count };
}

export function refactorCitationKeyAcrossFiles(
  files: Array<{ id: string; path: string; content: string }>,
  oldKey: string,
  newKey: string,
): ProjectRefactorResult {
  const modifiedFiles: ProjectRefactorResult['modifiedFiles'] = [];
  let totalCount = 0;
  for (const file of files) {
    const isBib = file.path.toLowerCase().endsWith('.bib');
    const res = isBib
      ? refactorCitationKeyInBibTeX(file.content, oldKey, newKey)
      : refactorCitationKeyInLatex(file.content, oldKey, newKey);
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

export interface CitekeyRefactorContext {
  service?: WorkspaceServicePort;
  notification?: WorkspaceNotificationPort;
  store?: WorkspaceStorePort;
  projectFiles?: Array<{ id: string; title?: string; name?: string; path?: string; content?: unknown }>;
  projectId?: string;
}

export async function executeProjectCitekeyRefactor(
  oldKey: string,
  newKey: string,
  optProjectId?: string | null | CitekeyRefactorContext,
  ctx?: CitekeyRefactorContext,
): Promise<{ success: boolean; modifiedCount: number; replacedCount: number }> {
  const effectiveCtx = typeof optProjectId === 'object' && optProjectId !== null ? optProjectId : ctx;
  const rawProjectId = typeof optProjectId === 'string' ? optProjectId : null;
  const { toast } = await import('sonner');
  const notifyError = (m: string, id?: string) =>
    effectiveCtx?.notification ? effectiveCtx.notification.notifyError(m, id) : toast.error(m, id ? { id } : undefined);
  const notifyInfo = (m: string, id?: string) =>
    effectiveCtx?.notification ? effectiveCtx.notification.notifyInfo(m, id) : toast.info(m, id ? { id } : undefined);
  const notifySuccess = (m: string, id?: string) =>
    effectiveCtx?.notification ? effectiveCtx.notification.notifySuccess(m, id) : toast.success(m, id ? { id } : undefined);

  const validation = validateCitationKey(newKey, oldKey);
  if (!validation.isValid) {
    notifyError(validation.error || 'Invalid citation key', 'refactor-citekey');
    return { success: false, modifiedCount: 0, replacedCount: 0 };
  }

  const { usePageStore, editorCommandBus, getActiveEditorEngine, documentFacade, sessionCoordinator } =
    await import('@/features/editor/core');
  const { manuscriptService } = await import('@/features/editor/sdk/manuscript.service');
  const { lruDocumentCache } = await import('@/features/editor/domain/document/lru-document-cache');
  const { latexSymbolsIndex } = await import('@/features/editor/domain/latex/latex-symbols-index');
  const { latexDependencyGraph } = await import('@/features/editor/domain/latex/dependency-graph');
  const { applyTextDiff } = await import('@/features/editor/sdk/realtime/yjs-socket-provider');

  const pageState = usePageStore.getState();
  const activeDoc = pageState.getActiveDocument();
  const activeDocId = effectiveCtx?.store ? effectiveCtx.store.getActiveDocumentId() : (activeDoc?.id ?? null);
  const effectiveProjectId =
    rawProjectId ||
    effectiveCtx?.store?.getActiveProjectId() ||
    effectiveCtx?.projectId ||
    pageState.projectId ||
    pageState.parentPageId ||
    activeDoc?.id ||
    '';

  if (!effectiveProjectId) {
    notifyError('No active project found', 'refactor-citekey');
    return { success: false, modifiedCount: 0, replacedCount: 0 };
  }

  if (activeDocId && !effectiveCtx?.service) {
    await sessionCoordinator.flushFile(activeDocId).catch(() => {});
  }

  let modifiedFiles: Array<{ id: string; path: string; newContent: string; count: number }> = [];
  let totalCount = 0;
  let handledByBackend = false;

  if (!effectiveCtx?.service) {
    try {
      const serverResult = await manuscriptService.citations.refactorKey(effectiveProjectId, { oldKey, newKey });
      if (serverResult && Array.isArray(serverResult.affectedFiles)) {
        handledByBackend = true;
        totalCount = serverResult.totalReplacements ?? 0;
        modifiedFiles = serverResult.affectedFiles.map((f) => ({
          id: f.docId,
          path: f.path,
          newContent: f.newContent,
          count: f.count,
        }));
      }
    } catch {
      // Fallback for custom service port or offline tests
    }
  }

  if (!handledByBackend && effectiveCtx?.service) {
    const serverFiles = await effectiveCtx.service.getFilesByProjectId(effectiveProjectId).catch(() => []);
    const local = refactorCitationKeyAcrossFiles(
      serverFiles.map((f) => ({
        id: f.id,
        path: f.title || ('name' in f && f.name ? f.name : '') || '',
        content: documentFacade.getDocumentContent(f.id) || f.content || '',
      })),
      oldKey,
      newKey,
    );
    modifiedFiles = local.modifiedFiles;
    totalCount = local.totalCount;
    const service = effectiveCtx.service;
    await Promise.all(
      modifiedFiles.map((mod) => service.updateFileContent(mod.id, mod.newContent).catch(() => {})),
    );
  }

  if (modifiedFiles.length === 0) {
    notifyInfo(`No citations found referencing @${oldKey}`, 'refactor-citekey');
    return { success: true, modifiedCount: 0, replacedCount: 0 };
  }

  const liveEngine = getActiveEditorEngine();
  const Y = await import('yjs');

  for (const mod of modifiedFiles) {
    const model = lruDocumentCache.getModel(mod.id);
    const yText = model?.yText instanceof Y.Text ? model.yText : null;
    if (yText) {
      if (yText.doc) yText.doc.transact(() => applyTextDiff(yText, mod.newContent), 'citekey-refactor');
      else applyTextDiff(yText, mod.newContent);
    }
    const targetEngine = documentFacade?.getEditorEngineForFile(mod.id) ?? (activeDocId === mod.id ? liveEngine : null);
    if (targetEngine && !yText) targetEngine.setContent(mod.newContent);
    else if (!targetEngine && !yText) {
      editorCommandBus.dispatch({ type: 'editor:set-content', content: mod.newContent, fileId: mod.id });
    }
    lruDocumentCache.updateContent(mod.id, mod.newContent, !handledByBackend);
    sessionCoordinator.notifyContentChange(mod.id, mod.newContent);
    latexSymbolsIndex.indexFile(mod.id, mod.path, mod.newContent, true);
    latexDependencyGraph.parseAndRegister(mod.path, mod.newContent, mod.id);
  }

  editorCommandBus.dispatch({
    type: 'filetree:updated',
    payload: { action: 'refactor-citekey', oldKey, newKey, totalCount },
  });
  notifySuccess(`Renamed @${oldKey} to @${newKey} (${totalCount} occurrences in ${modifiedFiles.length} files)!`, 'refactor-citekey');
  return { success: true, modifiedCount: modifiedFiles.length, replacedCount: totalCount };
}
