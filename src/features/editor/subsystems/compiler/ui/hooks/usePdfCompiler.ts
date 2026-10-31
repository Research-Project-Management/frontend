'use client';

/**
 * use-pdf-compiler.ts
 *
 * Slim Presenter Hook bridging Previewer with CompilerLifecycleCoordinator (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-pdf-compiler.ts`
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useSettingsStore, editorCommandBus } from '@/features/editor/core';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import type { SyncTeXMap } from '@/features/editor/subsystems/compiler/synctex/synctex-index';
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

  const synctexMapRef = useRef<SyncTeXMap | null>(compilerCoordinator.getSynctexMap());
  const rawSynctexRef = useRef<string | null>(compilerCoordinator.getRawSynctex());
  const [synctexMap, setSynctexMap] = useState<SyncTeXMap | null>(() => compilerCoordinator.getSynctexMap());

  // Sync coordinator synctex maps into refs and reactive state for viewer compatibility
  useEffect(() => {
    const currentMap = compilerCoordinator.getSynctexMap();
    synctexMapRef.current = currentMap;
    rawSynctexRef.current = compilerCoordinator.getRawSynctex();
    setSynctexMap(currentMap);

    const unsub = editorCommandBus.subscribe('synctex:map-updated', (cmd) => {
      synctexMapRef.current = cmd.map;
      setSynctexMap(cmd.map);
    });
    return unsub;
  }, [lastCompiledAt]);

  const handleCompile = useCallback(
    async (options?: { forceClean?: boolean }) => {
      return compilerCoordinator.compile({
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
    return compilerCoordinator.forceSync();
  }, []);

  const handleStopCompilation = useCallback(() => {
    compilerCoordinator.stop();
    toast.info('Compilation stopped', { id: 'compiler-status' });
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
    synctexMap,
    synctexMapRef,
    rawSynctexRef,
    handleCompile,
    handleClearCacheAndCompile,
    handleForceSync,
    handleStopCompilation,
  };
}
