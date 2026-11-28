'use client';

/**
 * use-pdf-compiler.ts
 *
 * Slim Presenter Hook bridging Previewer with CompilerLifecycleCoordinator (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/hooks/usePdfCompiler.ts`
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { editorCommandBus } from '@/features/editor/core';
import { useCompileStore } from '../store/compiler.store';
import { compilerCoordinator } from '../coordinator/compiler.coordinator';
import type { SyncTeXMap } from '../synctex/synctex';
import { toast } from 'sonner';

export interface UsePdfCompilerOptions {
  pageId: string | null;
  saveThumbnailMutation?: {
    mutate: (args: { pageId: string; dataUrl: string }) => void;
  };
}

export function usePdfCompiler({
  pageId,
  saveThumbnailMutation,
}: UsePdfCompilerOptions) {
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const compileLog = useCompileStore((s) => s.compileLog);
  const pdfUrl = useCompileStore((s) => s.pdfUrl);
  const lastCompiledAt = useCompileStore((s) => s.lastCompiledAt);

  const synctexMapRef = useRef<SyncTeXMap | null>(compilerCoordinator.getSynctexMap());
  const [synctexMap, setSynctexMap] = useState<SyncTeXMap | null>(() => compilerCoordinator.getSynctexMap());

  // Sync coordinator synctex maps into refs and reactive state for viewer compatibility
  useEffect(() => {
    const currentMap = compilerCoordinator.getSynctexMap();
    synctexMapRef.current = currentMap;
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

  const handleStopCompilation = useCallback(() => {
    compilerCoordinator.stop();
    toast.info('Compilation stopped', { id: 'compiler-status' });
  }, []);

  const handleClearCacheAndCompile = useCallback(() => {
    return handleCompile({ forceClean: true });
  }, [handleCompile]);

  return {
    compileStatus,
    compileLog,
    pdfUrl,
    synctexMap,
    synctexMapRef,
    handleCompile,
    handleClearCacheAndCompile,
    handleStopCompilation,
  };
}
