import { useState, useEffect, useRef, useCallback } from 'react';
import type { ProjectVersionListItem } from '@/features/editor/domain/types/history.types';

export type HistoryMode = 'single' | 'compare';
export type HistoryFilter = 'all' | 'labelled';

export function useHistoryState(initialVersion?: number) {
  const [mode, setMode] = useState<HistoryMode>('compare');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [targetVersion, setTargetVersion] = useState<number | null>(initialVersion ?? null);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmFileRestore, setConfirmFileRestore] = useState(false);
  const skipNextRestoreResetRef = useRef(false);

  const prevSelectionRef = useRef({
    mode,
    file: activeFile,
    base: baseVersion,
    target: targetVersion,
  });

  useEffect(() => {
    const prev = prevSelectionRef.current;
    if (
      prev.mode !== mode ||
      (prev.file && prev.file !== activeFile) ||
      (prev.base !== null && prev.base !== baseVersion) ||
      (prev.target !== null && prev.target !== targetVersion)
    ) {
      setConfirmFileRestore(false);
    }
    if (prev.target !== null && prev.target !== targetVersion) {
      if (skipNextRestoreResetRef.current) {
        skipNextRestoreResetRef.current = false;
      } else {
        setConfirmRestore(false);
      }
    }
    prevSelectionRef.current = {
      mode,
      file: activeFile,
      base: baseVersion,
      target: targetVersion,
    };
  }, [mode, activeFile, baseVersion, targetVersion]);

  const selectVersion = useCallback(
    (version: number, versions: ProjectVersionListItem[]) => {
      setTargetVersion(version);
      const idx = versions.findIndex((v) => v.version === version);
      setBaseVersion(
        idx >= 0 && idx < versions.length - 1
          ? versions[idx + 1].version
          : Math.max(1, version - 1),
      );
    },
    [],
  );

  const requestRestoreVersion = useCallback(
    (version: number, versions: ProjectVersionListItem[]) => {
      if (version !== targetVersion) {
        skipNextRestoreResetRef.current = true;
        selectVersion(version, versions);
      }
      setConfirmRestore(true);
    },
    [targetVersion, selectVersion],
  );

  return {
    mode,
    setMode,
    filter,
    setFilter,
    targetVersion,
    setTargetVersion,
    baseVersion,
    setBaseVersion,
    activeFile,
    setActiveFile,
    confirmRestore,
    setConfirmRestore,
    confirmFileRestore,
    setConfirmFileRestore,
    selectVersion,
    requestRestoreVersion,
  };
}

export function useHistoryAutoSelect(
  versions: ProjectVersionListItem[],
  sidebarFiles: { path: string }[],
  state: ReturnType<typeof useHistoryState>,
) {
  const {
    targetVersion,
    setTargetVersion,
    baseVersion,
    setBaseVersion,
    activeFile,
    setActiveFile,
  } = state;

  useEffect(() => {
    if (versions.length === 0) return;
    if (targetVersion === null) {
      const latest = versions[0].version;
      setTargetVersion(latest);
      setBaseVersion(versions.length > 1 ? versions[1].version : Math.max(1, latest - 1));
    } else if (baseVersion === null) {
      const idx = versions.findIndex((v) => v.version === targetVersion);
      setBaseVersion(
        idx >= 0 && idx < versions.length - 1
          ? versions[idx + 1].version
          : Math.max(1, targetVersion - 1),
      );
    }
  }, [versions, targetVersion, baseVersion, setTargetVersion, setBaseVersion]);

  useEffect(() => {
    if (sidebarFiles.length === 0) return;
    if (!activeFile || !sidebarFiles.some((f) => f.path === activeFile)) {
      setActiveFile(sidebarFiles[0].path);
    }
  }, [sidebarFiles, activeFile, setActiveFile]);
}
