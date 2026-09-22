'use client';

import { useRef, useEffect, useCallback } from 'react';
import { usePageStore, useSettingsStore, useCompileStore } from '../../../store';
import { LatexCompilerEngine, type SyncTeXMap } from '../../../utils/viewer.util';
import { EditorEventBus } from '../../../utils/editor.util';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { useEditorInstance } from '../../../core/context/editor-instance.context';
import type { CompileError } from '../../../types/compiler.types';
import { toast } from 'sonner';

export interface UsePdfCompilerOptions {
  projectId?: string;
  pageId: string | null;
  saveThumbnailMutation?: {
    mutate: (args: { pageId: string; dataUrl: string }) => void;
  };
}

export function usePdfCompiler({
  projectId,
  pageId,
  saveThumbnailMutation,
}: UsePdfCompilerOptions) {
  const { getContent } = useEditorInstance();
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);

  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const mainFile = useSettingsStore((s) => s.mainFile);
  const useCache = useSettingsStore((s) => s.useCache);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const texLiveVersion = useSettingsStore((s) => s.texLiveVersion);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);

  const compileStatus = useCompileStore((s) => s.compileStatus);
  const setCompileStatus = useCompileStore((s) => s.setCompileStatus);
  const compileLog = useCompileStore((s) => s.compileLog);
  const setCompileLog = useCompileStore((s) => s.setCompileLog);
  const setCompileErrors = useCompileStore((s) => s.setCompileErrors);
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const setPdfUrl = useCompileStore((s) => s.setPdfUrl);
  const lastCompiledAt = useCompileStore((s) => s.lastCompiledAt);
  const setLastCompiledAt = useCompileStore((s) => s.setLastCompiledAt);
  const pendingCompile = useCompileStore((s) => s.pendingCompile);
  const setPendingCompile = useCompileStore((s) => s.setPendingCompile);
  const getDirtyFiles = useCompileStore((s) => s.getDirtyFiles);
  const clearDirty = useCompileStore((s) => s.clearDirty);
  const clearAllDirty = useCompileStore((s) => s.clearAllDirty);

  const prevPdfUrlRef = useRef<string | null>(null);
  const synctexMapRef = useRef<SyncTeXMap | null>(null);
  const rawSynctexRef = useRef<string | null>(null);

  // Compile runner using unified LatexCompilerEngine
  const handleCompile = useCallback(
    async (options?: { forceClean?: boolean }) => {
      if (!pageId) return;

      EditorEventBus.emit('flux:compile-started');

      // Collect dirty file buffers
      const dirtyFiles = getDirtyFiles();
      const currentVal = getContent();
      if (activeFilePage?.id && currentVal !== undefined) {
        const idx = dirtyFiles.findIndex((f) => f.fileId === activeFilePage.id);
        if (idx >= 0) dirtyFiles[idx].content = currentVal;
        else dirtyFiles.push({ fileId: activeFilePage.id, content: currentVal });
      }

      const effectiveProjectId = currentPage?.projectId || projectId || '';
      const res = await LatexCompilerEngine.compile({
        projectId: effectiveProjectId,
        pageId,
        mainFile: mainFile || 'main.tex',
        engine: engine || 'pdflatex',
        texLiveVersion,
        draft: compileMode === 'draft',
        useCache: options?.forceClean ? false : useCache,
        stopOnFirstError,
        dirtyFiles,
        onPhaseChange: setCompileStatus,
        onThumbnailGenerated: (base64) => {
          saveThumbnailMutation?.mutate({
            pageId,
            dataUrl: `data:image/jpeg;base64,${base64}`,
          });
        },
      });

      if (res.success) {
        if (
          prevPdfUrlRef.current &&
          prevPdfUrlRef.current.startsWith('blob:') &&
          prevPdfUrlRef.current !== res.pdfUrl
        ) {
          URL.revokeObjectURL(prevPdfUrlRef.current);
        }
        prevPdfUrlRef.current = res.pdfUrl;

        setPdfUrl(res.pdfUrl);
        synctexMapRef.current = res.synctexMap;
        rawSynctexRef.current = res.rawSynctex || null;
        setCompileLog(res.logs);
        setCompileStatus('done');
        setLastCompiledAt(res.compiledAt);

        const warningDiagnostics: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics
                .filter((d) => d.severity === 'warning')
                .map((d) => ({
                  line: d.line,
                  message: d.message,
                  context: d.context || '',
                  file: d.file,
                  severity: 'warning' as const,
                  code: d.code,
                  suggestion: d.suggestion,
                }))
            : [];
        setCompileErrors(warningDiagnostics);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid) => clearDirty(fid));
        } else if (!res.flushErrors || res.flushErrors.length === 0) {
          clearAllDirty();
        }

        EditorEventBus.emit('flux:compile-finished', { success: true });

        if (useCompileStore.getState().pendingCompile) {
          useCompileStore.getState().setPendingCompile(false);
          setTimeout(() => {
            editorCommandBus.dispatch({ type: 'compiler:trigger' });
          }, 400);
        }
      } else {
        setCompileStatus('error');
        setCompileLog(res.logs);

        const formattedErrors: CompileError[] =
          res.diagnostics && res.diagnostics.length > 0
            ? res.diagnostics.map((d) => ({
                line: d.line,
                message: d.message,
                context: d.context || '',
                file: d.file,
                severity: d.severity,
                code: d.code,
                suggestion: d.suggestion,
              }))
            : (res.errors || []).map((err) => ({
                line: err.line,
                message: err.message,
                context: err.context,
                file: err.file,
                severity: err.severity,
                code: err.code,
                suggestion: err.suggestion,
              }));

        setCompileErrors(formattedErrors);

        if (res.flushedFileIds && res.flushedFileIds.length > 0) {
          res.flushedFileIds.forEach((fid) => clearDirty(fid));
        }

        EditorEventBus.emit('flux:compile-finished', { success: false });

        if (useCompileStore.getState().pendingCompile) {
          useCompileStore.getState().setPendingCompile(false);
          setTimeout(() => {
            editorCommandBus.dispatch({ type: 'compiler:trigger' });
          }, 400);
        }
      }
    },
    [
      pageId,
      getDirtyFiles,
      activeFilePage?.id,
      currentPage?.projectId,
      projectId,
      mainFile,
      engine,
      texLiveVersion,
      compileMode,
      useCache,
      stopOnFirstError,
      setCompileStatus,
      saveThumbnailMutation,
      setPdfUrl,
      setCompileLog,
      setLastCompiledAt,
      setCompileErrors,
      clearDirty,
      clearAllDirty,
      getContent,
    ],
  );

  const handleForceSync = useCallback(async () => {
    if (!pageId) return;
    setCompileStatus('syncing');
    try {
      await LatexCompilerEngine.forceSync(pageId);
      await handleCompile();
    } catch {
      setCompileStatus('error');
    }
  }, [pageId, setCompileStatus, handleCompile]);

  const handleStopCompilation = useCallback(() => {
    LatexCompilerEngine.cancelInFlightCompile();
    setCompileStatus('idle');
    toast.info('Compilation stopped');
  }, [setCompileStatus]);

  // Subscribe to compiler commands from EditorCommandBus
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('compiler:trigger', (cmd) => {
      if (cmd.forceSync) {
        handleForceSync();
      } else {
        handleCompile();
      }
    });
    return unsub;
  }, [handleCompile, handleForceSync]);

  // Handle pending compile trigger from auto-compile
  useEffect(() => {
    if (pendingCompile) {
      setPendingCompile(false);
      handleCompile();
    }
  }, [pendingCompile, setPendingCompile, handleCompile]);

  // Cleanup blob object URLs on unmount
  useEffect(() => {
    return () => {
      if (prevPdfUrlRef.current && prevPdfUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevPdfUrlRef.current);
      }
    };
  }, []);

  return {
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    autoCompile,
    setAutoCompile,
    compileStatus,
    compileLog,
    pdfUrl,
    lastCompiledAt,
    synctexMapRef,
    rawSynctexRef,
    handleCompile,
    handleForceSync,
    handleStopCompilation,
  };
}
