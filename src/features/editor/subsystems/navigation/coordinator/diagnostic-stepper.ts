/**
 * diagnostic-stepper.ts
 *
 * File-path resolution for SyncTeX/diagnostic jumps and F8 / Shift+F8 diagnostic
 * project-wide stepper logic extracted from NavigationCoordinator.
 */

import { getActiveEditorEngine } from '@/features/editor/core/bus/engine-registry';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import {
  useWorkspaceStore,
  type EditorTab,
} from '@/features/editor/core/store/workspace.store';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { documentFacade } from '@/features/editor/core/coordinator/document.facade';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

export interface ProjectDiagnosticEntry {
  file: string;
  line: number;
  message: string;
}

export function resolveJumpTargetByFilePath(
  fileId?: string,
  filePath?: string,
): { resolvedFileId: string | undefined; resolvedTitle: string } {
  let resolvedFileId = fileId;
  let resolvedTitle = filePath || fileId || 'main.tex';

  if (!resolvedFileId && filePath) {
    const normalizedTarget = filePath.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
    const matchesTargetPath = (candidate?: string): boolean => {
      if (!candidate) return false;
      const norm = candidate.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
      return Boolean(
        norm &&
          (norm === normalizedTarget ||
            norm.endsWith(`/${normalizedTarget}`) ||
            normalizedTarget.endsWith(`/${norm}`)),
      );
    };

    const model = lruDocumentCache.findByPath(filePath);
    if (model) {
      resolvedFileId = model.fileId;
      resolvedTitle = model.filePath;
    } else {
      const tabsByProject = useWorkspaceStore.getState().tabsByProject;
      const allTabs = Object.values(tabsByProject).flat();
      const matchingTab = allTabs.find(
        (t: EditorTab) =>
          t.path === filePath ||
          t.title === filePath ||
          t.id === filePath ||
          matchesTargetPath(t.path || t.title),
      );
      if (matchingTab) {
        resolvedFileId = matchingTab.id;
        resolvedTitle = matchingTab.title;
      } else {
        const projectFiles = workspaceCoordinator.getProjectFiles() || [];
        const matchingWsFile = projectFiles.find(
          (f) => f.id === filePath || matchesTargetPath(f.path || f.title),
        );
        if (matchingWsFile) {
          resolvedFileId = matchingWsFile.id;
          resolvedTitle = matchingWsFile.title || matchingWsFile.path || filePath;
        } else {
          const overlayFiles = documentFacade.getOverlayFiles() || [];
          const matchingOverlay = overlayFiles.find(
            (f) => f.id === filePath || matchesTargetPath(f.path),
          );
          if (matchingOverlay) {
            resolvedFileId = matchingOverlay.id;
            resolvedTitle = matchingOverlay.path || filePath;
          }
        }
      }
    }
  }

  return { resolvedFileId, resolvedTitle };
}

function getProjectDiagnosticsList(
  severity: 'error' | 'warning' = 'error',
): ProjectDiagnosticEntry[] {
  const all = diagnosticsCoordinator.getAllDiagnostics().filter((d) => d.severity === severity);
  if (all.length > 0) {
    return all.map((d) => ({
      file: d.file || d.normalizedPath || 'main.tex',
      line: d.line,
      message: d.message,
    }));
  }

  const compileErrors = useCompileStore.getState().compileErrors || [];
  return compileErrors
    .filter((e) => (e.severity || 'error') === severity && e.line !== null && e.line !== undefined)
    .map((e) => ({
      file: e.file || 'main.tex',
      line: e.line!,
      message: e.message,
    }));
}

export function computeDiagnosticStep(params: {
  direction: 1 | -1;
  severity: 'error' | 'warning';
  lastDiagnosticLine: number | null;
  lastDiagnosticFile: string | null;
}): { targetIndex: number; target: ProjectDiagnosticEntry } | null {
  const { direction, severity, lastDiagnosticLine, lastDiagnosticFile } = params;
  const list = getProjectDiagnosticsList(severity);
  if (list.length === 0) {
    if (severity === 'error') {
      const warnings = getProjectDiagnosticsList('warning');
      if (warnings.length > 0) {
        return computeDiagnosticStep({
          direction,
          severity: 'warning',
          lastDiagnosticLine,
          lastDiagnosticFile,
        });
      }
    }
    return null;
  }

  const activePage = usePageStore.getState().getActiveDocument();
  const currentFile = activePage?.title || activePage?.path || activePage?.id || '';
  const engine = getActiveEditorEngine();
  const currentCursor = engine?.getCursorPosition();
  const isSameFile = (file: string) =>
    file === currentFile || currentFile.endsWith(`/${file}`) || file.endsWith(`/${currentFile}`);
  const isCurrentFileSameAsLast =
    Boolean(lastDiagnosticFile) && isSameFile(lastDiagnosticFile!);
  const fallbackLine = direction === 1 ? 0 : 999999;
  const currentLine =
    currentCursor?.line ??
    (isCurrentFileSameAsLast && lastDiagnosticLine !== null ? lastDiagnosticLine : fallbackLine);

  let targetIndex = -1;
  if (direction === 1) {
    targetIndex = list.findIndex((d) => isSameFile(d.file) && d.line > currentLine);
    if (targetIndex === -1) {
      const lastSameFileIndex = list.map((d) => isSameFile(d.file)).lastIndexOf(true);
      targetIndex = lastSameFileIndex !== -1 ? (lastSameFileIndex + 1) % list.length : 0;
    }
  } else {
    for (let i = list.length - 1; i >= 0; i--) {
      if (isSameFile(list[i].file) && list[i].line < currentLine) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) {
      const firstSameFileIndex = list.findIndex((d) => isSameFile(d.file));
      targetIndex =
        firstSameFileIndex !== -1 ? (firstSameFileIndex - 1 + list.length) % list.length : list.length - 1;
    }
  }

  const target = list[targetIndex];
  return target ? { targetIndex, target } : null;
}
