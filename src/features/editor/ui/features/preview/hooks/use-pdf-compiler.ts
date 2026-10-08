'use client';

/**
 * use-pdf-compiler.ts
 *
 * Slim Presenter Hook bridging Previewer with CompilerLifecycleCoordinator (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-pdf-compiler.ts`
 */

import { useRef, useEffect, useCallback } from 'react';
import { useSettingsStore, useCompileStore } from '../../../../store';
import { compilerLifecycleCoordinator } from '../../../../coordinators/compiler.coordinator';
import type { SyncTeXMap } from '@/features/editor/domain/document/synctex-index';
import { toast } from 'sonner';

export interface UsePdfCompilerOptions {
  projectId?: string;
  pageId: string | null;
  saveThumbnailMutation?: {
    mutate: (args: { pageId: string; dataUrl: string }) => void;
  };
}

export function usePdfCompiler({
  pageId,
  saveThumbnailMutation,
}: UsePdfCompilerOptions) {
  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);

  const compileStatus = useCompileStore((s) => s.compileStatus);
  const compileLog = useCompileStore((s) => s.compileLog);
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const lastCompiledAt = useCompileStore((s) => s.lastCompiledAt);

  const synctexMapRef = useRef<SyncTeXMap | null>(null);
  const rawSynctexRef = useRef<string | null>(null);

  // Sync coordinator synctex maps into refs for viewer compatibility
  useEffect(() => {
    synctexMapRef.current = compilerLifecycleCoordinator.getSynctexMap();
    rawSynctexRef.current = compilerLifecycleCoordinator.getRawSynctex();
  }, [lastCompiledAt]);

  const handleCompile = useCallback(
    async (options?: { forceClean?: boolean }) => {
      return compilerLifecycleCoordinator.compile({
        forceClean: options?.forceClean,
        onThumbnailGenerated: (dataUrl: string) => {
          if (pageId) {
            saveThumbnailMutation?.mutate({
              pageId,
              dataUrl,
            });
          }
        },
      });
    },
    [pageId, saveThumbnailMutation]
  );

  const handleForceSync = useCallback(async () => {
    return compilerLifecycleCoordinator.forceSync();
  }, []);

  const handleStopCompilation = useCallback(() => {
    compilerLifecycleCoordinator.stop();
    toast.info('Compilation stopped');
  }, []);

  const handleClearCacheAndCompile = useCallback(() => {
    return handleCompile({ forceClean: true });
  }, [handleCompile]);

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
    handleClearCacheAndCompile,
    handleForceSync,
    handleStopCompilation,
  };
}
