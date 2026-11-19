'use client';

/**
 * useDiagnosticsSummary.ts
 *
 * Concurrent-safe React hooks for subscribing to DiagnosticsCoordinator metrics.
 * Built using React 18+ `useSyncExternalStore` for tear-free state subscriptions.
 * Location: `features/editor/subsystems/diagnostics/ui/hooks/useDiagnosticsSummary.ts`
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  diagnosticsCoordinator,
  type FileDiagnosticsSummary,
} from '../../coordinator/diagnostics.coordinator';

/**
 * Subscribes to a single file's diagnostics summary in the UI.
 */
export function useFileDiagnosticsSummary(
  fileIdOrPath: string,
  applyFilter = true
): FileDiagnosticsSummary {
  const subscribe = useCallback(
    (onStoreChange: () => void) => diagnosticsCoordinator.subscribe(onStoreChange),
    []
  );

  const getSnapshot = useCallback(
    () => diagnosticsCoordinator.getFileSummary(fileIdOrPath, applyFilter),
    [fileIdOrPath, applyFilter]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to a folder's aggregated diagnostics summary in the UI.
 */
export function useFolderDiagnosticsSummary(
  folderNameOrPath: string,
  applyFilter = true
): FileDiagnosticsSummary {
  const subscribe = useCallback(
    (onStoreChange: () => void) => diagnosticsCoordinator.subscribe(onStoreChange),
    []
  );

  const getSnapshot = useCallback(
    () => diagnosticsCoordinator.getFolderSummary(folderNameOrPath, applyFilter),
    [folderNameOrPath, applyFilter]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribes to the whole project's diagnostics summary in the UI.
 */
export function useProjectDiagnosticsSummary(
  applyFilter = true
): FileDiagnosticsSummary {
  const subscribe = useCallback(
    (onStoreChange: () => void) => diagnosticsCoordinator.subscribe(onStoreChange),
    []
  );

  const getSnapshot = useCallback(
    () => diagnosticsCoordinator.getProjectSummary(applyFilter),
    [applyFilter]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
