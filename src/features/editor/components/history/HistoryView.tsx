'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import HistoryCodeMirrorViewer from './HistoryCodeMirrorViewer';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import {
  filesQuery,
  deletedFilesQuery,
  usePageActions,
} from '@/features/editor/hooks/use-core';
import {
  useProjectHistory,
  useVersionActions,
  useVersionDiff,
  useProjectDiff,
  useProjectSnapshot,
} from '@/features/editor/hooks/use-history';
import {
  versionService,
  type VersionDiffResponse,
  type ProjectSnapshotDetail,
} from '@/features/editor/services/history.service';
import { useProjectExport } from '@/features/editor/hooks/use-export';
import { useHistoryViewActions } from './useHistoryViewActions';

// Subcomponents
import { HistoryHeader } from './subcomponents/HistoryHeader';
import { HistoryChangedFiles } from './subcomponents/HistoryChangedFiles';
import { HistoryViewerHeader } from './subcomponents/HistoryViewerHeader';
import { HistoryTimeline, type TimelineCardItem } from './subcomponents/HistoryTimeline';
import { HistoryRestoreModal } from './subcomponents/HistoryRestoreModal';
import { HistoryLabelModal } from './subcomponents/HistoryLabelModal';

// ── Snapshot Content Extractor ───────────────────────────────────────────────

function extractFileContentFromSnapshot(
  snapshot?: ProjectSnapshotDetail | any | null,
  filePath?: string | null,
): string {
  if (!snapshot || !snapshot.files || !filePath) return '';
  const clean = filePath.replace(/^\//, '');
  const entry =
    snapshot.files[clean] ||
    snapshot.files[`/${clean}`] ||
    Object.entries(snapshot.files).find(([k]) => k.replace(/^\//, '') === clean)?.[1];

  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry.lines)) return entry.lines.join('\n');
  if (typeof entry.content === 'string') return entry.content;
  return '';
}

// ── Date Formatting Helpers (Zero Parentheses) ───────────────────────────────

function formatRevisionDate(dateStr?: string | Date): { group: string; time: string; full: string } {
  if (!dateStr) return { group: 'Earlier', time: 'Unknown time', full: 'Unknown' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { group: 'Earlier', time: 'Unknown time', full: 'Unknown' };

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  let group = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
  if (isToday) group = 'Today';
  else if (isYesterday) group = 'Yesterday';

  const time = d.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const full = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + ' at ' + time;

  return { group, time, full };
}

// ── Main History View Orchestrator ───────────────────────────────────────────

export default function HistoryView() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const storeProjectId = usePageStore((s) => s.projectId);
  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const { engine } = useEditorInstance();
  const setIsHistoryOpen = useSettingsStore((s) => s.setIsHistoryOpen);
  const editorTheme = useSettingsStore((s) => s.editorTheme);

  const projectId = params?.projectId || storeProjectId || '';
  const rootPageId = params?.pageId || projectId;

  // Layout panes state
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState(true);
  const [timelineTab, setTimelineTab] = useState<'all' | 'labels'>('all');

  // Queries
  const { history: events = [], isLoading: eventsLoading } = useProjectHistory(projectId || rootPageId);
  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });
  const { data: deletedFiles = [] } = useQuery({
    ...deletedFilesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  // Action hooks
  const { updateLabel } = useVersionActions();
  const { exportVersionZip } = useProjectExport();
  const { updateContent: updateContentMutation, restorePage: restorePageMutation } = usePageActions();
  const { isRestoringProject, restoreFileRevision, restoreProjectVersion } = useHistoryViewActions({
    projectId,
    rootPageId,
    engine,
  });

  // Selection & View state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(activeFilePage?.id || null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'snapshot'>('diff');
  const [compareTargetId, setCompareTargetId] = useState<string>('current');

  // Modals state
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  // Timeline items
  const timelineItems: TimelineCardItem[] = useMemo(() => {
    if (events && events.length > 0) {
      return events.map((ev) => ({
        id: ev.id,
        versionNumber: (ev as any).versionNumber || (ev as any).version,
        title: ev.title || ev.fileName || 'Snapshot',
        label: ev.label,
        fileName: ev.fileName || activeFilePage?.title || 'main.tex',
        date: ev.createdAt,
        author: ev.savedBy?.name || 'Collaborator',
        eventType: ev.eventType,
      }));
    }
    return [];
  }, [events, activeFilePage]);

  // Initial selection
  useEffect(() => {
    if (timelineItems.length > 0 && !selectedEventId) {
      setSelectedEventId(timelineItems[0].id);
    }
  }, [timelineItems, selectedEventId]);

  // Labeled count
  const labeledCount = useMemo(() => {
    return timelineItems.filter((i) => Boolean(i.label && i.label.trim())).length;
  }, [timelineItems]);

  // Filtered and grouped timeline
  const filteredTimelineItems = useMemo(() => {
    if (timelineTab === 'labels') {
      return timelineItems.filter((i) => Boolean(i.label && i.label.trim()));
    }
    return timelineItems;
  }, [timelineItems, timelineTab]);

  const groupedTimeline = useMemo(() => {
    const map = new Map<string, TimelineCardItem[]>();
    filteredTimelineItems.forEach((item) => {
      const { group } = formatRevisionDate(item.date);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });
    return Array.from(map.entries()).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [filteredTimelineItems]);

  const activeRevision = useMemo(() => {
    return timelineItems.find((i) => i.id === selectedEventId) || timelineItems[0];
  }, [timelineItems, selectedEventId]);

  const activeVersionNumber = useMemo(() => {
    return (activeRevision as any)?.versionNumber || (timelineItems.length > 0 ? timelineItems.length : 1);
  }, [activeRevision, timelineItems]);

  const isComparingAgainstCurrent = compareTargetId === 'current';
  const resolvedBaseVersion = useMemo(() => {
    if (isComparingAgainstCurrent) return activeVersionNumber;
    if (compareTargetId === 'previous') return Math.max(1, activeVersionNumber - 1);
    const match = timelineItems.find((i) => i.id === compareTargetId);
    return (match as any)?.versionNumber || Math.max(1, activeVersionNumber - 1);
  }, [isComparingAgainstCurrent, compareTargetId, activeVersionNumber, timelineItems]);

  const baseVersionForDiff = Math.min(resolvedBaseVersion, activeVersionNumber);
  const targetVersionForDiff = Math.max(resolvedBaseVersion, activeVersionNumber);
  const shouldFetchProjectDiff =
    viewMode === 'diff' && !isComparingAgainstCurrent && baseVersionForDiff !== targetVersionForDiff;

  // Diff & Snapshot Queries
  const { data: projectDiffData } = useProjectDiff(
    projectId || rootPageId,
    baseVersionForDiff,
    targetVersionForDiff,
    { enabled: shouldFetchProjectDiff },
  );

  const { data: targetSnapshot } = useProjectSnapshot(
    projectId || rootPageId,
    activeVersionNumber,
    { enabled: Boolean(activeVersionNumber) },
  );

  const { data: baseSnapshot } = useProjectSnapshot(
    projectId || rootPageId,
    baseVersionForDiff,
    {
      enabled: Boolean(
        baseVersionForDiff &&
          !isComparingAgainstCurrent &&
          baseVersionForDiff !== activeVersionNumber,
      ),
    },
  );

  // File synchronization
  useEffect(() => {
    if (viewMode === 'diff' && projectDiffData?.files && projectDiffData.files.length > 0) {
      const match = projectDiffData.files.find(
        (f) => f.path.replace(/^\//, '') === selectedFilePath?.replace(/^\//, ''),
      );
      if (!match) {
        setSelectedFilePath(projectDiffData.files[0].path.replace(/^\//, ''));
      }
    } else if (viewMode === 'snapshot' && targetSnapshot?.files) {
      const keys = Object.keys(targetSnapshot.files).map((k) => k.replace(/^\//, ''));
      if (keys.length > 0 && (!selectedFilePath || !keys.includes(selectedFilePath.replace(/^\//, '')))) {
        setSelectedFilePath(keys[0]);
      }
    } else if (!selectedFilePath) {
      const activeFile =
        pageFiles.find((p: any) => p.id === activeFileId) ||
        deletedFiles.find((p: any) => p.id === activeFileId);
      if (activeFile?.title) {
        setSelectedFilePath(activeFile.title);
      } else if (pageFiles.length > 0) {
        setSelectedFilePath(pageFiles[0].title || 'main.tex');
      }
    }
  }, [viewMode, projectDiffData, targetSnapshot, selectedFilePath, pageFiles, deletedFiles, activeFileId]);

  useEffect(() => {
    if (!selectedFilePath) return;
    const clean = selectedFilePath.replace(/^\//, '');
    const found =
      pageFiles.find((p: any) => (p.title || p.name || p.path) === clean) ||
      deletedFiles.find((p: any) => (p.title || p.name || p.path) === clean);
    if (found && found.id !== activeFileId) {
      setActiveFileId(found.id);
    }
  }, [selectedFilePath, pageFiles, deletedFiles, activeFileId]);

  const activeFileName = useMemo(() => {
    if (selectedFilePath) return selectedFilePath.replace(/^\//, '');
    const f =
      pageFiles.find((p: any) => p.id === activeFileId) ||
      deletedFiles.find((p: any) => p.id === activeFileId);
    return f?.title || activeRevision?.fileName || 'main.tex';
  }, [selectedFilePath, pageFiles, deletedFiles, activeFileId, activeRevision]);

  const currentFileContent = useMemo(() => {
    const f =
      pageFiles.find((p: any) => p.id === activeFileId) ||
      deletedFiles.find((p: any) => p.id === activeFileId);
    return f?.content || '';
  }, [pageFiles, deletedFiles, activeFileId]);

  // Load preview content
  useEffect(() => {
    let isCancelled = false;

    async function loadContent() {
      if (!activeFileId && !selectedFilePath) return;
      setIsLoadingContent(true);
      try {
        if (targetSnapshot?.files) {
          const content = extractFileContentFromSnapshot(targetSnapshot, selectedFilePath || activeFileName);
          if (content && !isCancelled) {
            setPreviewContent(content);
            setIsLoadingContent(false);
            return;
          }
        }

        if (activeFileId) {
          const versions = await versionService.getByPageId(activeFileId);
          if (versions && versions.length > 0) {
            const match =
              versions.find((v) => v.id === selectedEventId) || versions[0];
            const fullVersion = await versionService.getById(activeFileId, match.id);
            if (!isCancelled && fullVersion?.content !== undefined) {
              setPreviewContent(fullVersion.content);
              setIsLoadingContent(false);
              return;
            }
          }
        }

        const activeFile =
          pageFiles.find((f: any) => f.id === activeFileId) ||
          deletedFiles.find((f: any) => f.id === activeFileId);
        if (!isCancelled) {
          setPreviewContent(activeFile?.content || '');
          setIsLoadingContent(false);
        }
      } catch {
        if (!isCancelled) {
          const activeFile =
            pageFiles.find((f: any) => f.id === activeFileId) ||
            deletedFiles.find((f: any) => f.id === activeFileId);
          setPreviewContent(activeFile?.content || '');
          setIsLoadingContent(false);
        }
      }
    }

    loadContent();
    return () => {
      isCancelled = true;
    };
  }, [activeFileId, selectedFilePath, selectedEventId, pageFiles, deletedFiles, targetSnapshot, activeFileName]);

  // Visual Diff Data
  const { data: serverDiffData } = useVersionDiff(
    activeFileId,
    compareTargetId,
    selectedEventId,
    { enabled: viewMode === 'diff' && Boolean(activeFileId && selectedEventId && !projectDiffData) },
  );

  const diffData = useMemo<VersionDiffResponse | null>(() => {
    if (viewMode !== 'diff') return null;
    if (serverDiffData) return serverDiffData;
    return {
      fromVersionId: compareTargetId,
      toVersionId: selectedEventId || '',
      fromContent: currentFileContent,
      toContent: previewContent,
      chunks: [],
      stats: {
        addedLines: projectDiffData?.totalAdditions ?? 0,
        deletedLines: projectDiffData?.totalDeletions ?? 0,
        unchangedLines: 0,
      },
    };
  }, [viewMode, serverDiffData, compareTargetId, selectedEventId, currentFileContent, previewContent, projectDiffData]);

  const diffViewerOriginal = useMemo(() => {
    if (viewMode !== 'diff') return '';
    if (isComparingAgainstCurrent) {
      const snapText = extractFileContentFromSnapshot(targetSnapshot, selectedFilePath || activeFileName);
      return snapText || previewContent;
    }
    const fromBase = extractFileContentFromSnapshot(baseSnapshot, selectedFilePath || activeFileName);
    if (fromBase !== undefined && fromBase !== '') return fromBase;
    return diffData?.fromContent || currentFileContent;
  }, [viewMode, isComparingAgainstCurrent, targetSnapshot, baseSnapshot, selectedFilePath, activeFileName, previewContent, diffData?.fromContent, currentFileContent]);

  const diffViewerModified = useMemo(() => {
    if (viewMode !== 'diff') return '';
    if (isComparingAgainstCurrent) {
      return currentFileContent;
    }
    const fromTarget = extractFileContentFromSnapshot(targetSnapshot, selectedFilePath || activeFileName);
    if (fromTarget !== undefined && fromTarget !== '') return fromTarget;
    return diffData?.toContent || previewContent;
  }, [viewMode, isComparingAgainstCurrent, targetSnapshot, selectedFilePath, activeFileName, currentFileContent, diffData?.toContent, previewContent]);

  const singleViewerContent = useMemo(() => {
    const fromSnap = extractFileContentFromSnapshot(targetSnapshot, selectedFilePath || activeFileName);
    if (fromSnap !== undefined && fromSnap !== '') return fromSnap;
    return previewContent;
  }, [targetSnapshot, selectedFilePath, activeFileName, previewContent]);

  // Changed files data structure
  const diffChangedFiles = useMemo(() => {
    if (viewMode !== 'diff') return [];
    if (projectDiffData?.files && projectDiffData.files.length > 0) {
      return projectDiffData.files.map((df) => {
        const cleanPath = df.path.replace(/^\//, '');
        const matchingPage = pageFiles.find((p: any) => (p.title || p.name || p.path) === cleanPath);
        return {
          ...df,
          cleanPath,
          id: matchingPage?.id || cleanPath,
        };
      });
    }
    return [];
  }, [viewMode, projectDiffData, pageFiles]);

  const unchangedFiles = useMemo(() => {
    if (viewMode !== 'diff' || diffChangedFiles.length === 0) return [];
    const changedPaths = new Set(diffChangedFiles.map((f) => f.cleanPath));
    return pageFiles.filter((p: any) => !changedPaths.has(p.title || p.name || p.path));
  }, [viewMode, diffChangedFiles, pageFiles]);

  const snapshotFiles = useMemo(() => {
    if (targetSnapshot?.files) {
      return Object.entries(targetSnapshot.files).map(([path, data]) => {
        const cleanPath = path.replace(/^\//, '');
        const matchingPage = pageFiles.find((p: any) => (p.title || p.name || p.path) === cleanPath);
        return {
          path: cleanPath,
          id: matchingPage?.id || cleanPath,
          type: (data as any)?.type || 'doc',
          isRootDoc: (data as any)?.isRootDoc,
        };
      });
    }
    return pageFiles.map((p: any) => ({
      path: p.title || p.name || p.path || 'untitled.tex',
      id: p.id,
      type: 'doc',
      isRootDoc: p.isRootDoc,
    }));
  }, [targetSnapshot, pageFiles]);

  // Handlers for single canonical version action group
  const handleRestoreFile = async () => {
    const fileId = activeFileId;
    const contentToRestore =
      extractFileContentFromSnapshot(targetSnapshot, selectedFilePath || activeFileName) || previewContent;
    if (!fileId || contentToRestore === undefined) return;

    const fileObj =
      pageFiles.find((f: any) => f.id === fileId) ||
      deletedFiles.find((f: any) => f.id === fileId);
    const fileName = fileObj?.title || activeFileName;

    // If deleted, also restore page metadata first
    const isDeleted = deletedFiles.some((df: any) => df.id === fileId);
    if (isDeleted) {
      await restorePageMutation.mutateAsync(fileId);
    }

    restoreFileRevision(
      fileId,
      fileName,
      contentToRestore,
      activeFilePage?.id,
      updateContentMutation,
      () => {
        setRestoreModalOpen(false);
        setIsHistoryOpen(false);
      },
    );
  };

  const handleRestoreProject = async () => {
    if (!activeRevision) return;
    await restoreProjectVersion(activeVersionNumber, () => {
      setRestoreModalOpen(false);
      setIsHistoryOpen(false);
    });
  };

  const handleDownloadZip = () => {
    if (!activeRevision) return;
    exportVersionZip({
      parentPageId: rootPageId,
      versionId: activeRevision.id,
      revisionDate: activeRevision.date,
      revisionLabel: activeRevision.label,
      projectTitle: currentPage?.title,
    });
  };

  const handleOpenLabelModal = () => {
    setLabelText(activeRevision?.label || '');
    setLabelModalOpen(true);
  };

  const handleSaveLabel = async () => {
    if (!activeRevision) return;
    setIsSavingLabel(true);
    try {
      await updateLabel.mutateAsync({
        pageId: (activeRevision as any).pageId || activeFileId || rootPageId,
        versionId: activeRevision.id,
        label: labelText.trim(),
        rootPageId,
        projectId: rootPageId,
        versionNumber: (activeRevision as any).versionNumber,
      });
      setLabelModalOpen(false);
    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleRemoveLabel = async () => {
    if (!activeRevision) return;
    setIsSavingLabel(true);
    try {
      await updateLabel.mutateAsync({
        pageId: (activeRevision as any).pageId || activeFileId || rootPageId,
        versionId: activeRevision.id,
        label: '',
        rootPageId,
        projectId: rootPageId,
        versionNumber: (activeRevision as any).versionNumber,
      });
      setLabelModalOpen(false);
    } finally {
      setIsSavingLabel(false);
    }
  };

  const formattedDate = formatRevisionDate(activeRevision?.date);

  return (
    <div className="flex flex-col h-dvh w-full bg-background text-foreground select-none z-50 animate-in fade-in duration-150 motion-reduce:animate-none">
      {/* 1. Header Bar */}
      <HistoryHeader
        projectTitle={currentPage?.title || 'Project History'}
        isLeftPaneOpen={isLeftPaneOpen}
        isRightPaneOpen={isRightPaneOpen}
        onToggleLeftPane={() => setIsLeftPaneOpen((prev) => !prev)}
        onToggleRightPane={() => setIsRightPaneOpen((prev) => !prev)}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* 2. Main 3-Column Workspace */}
      <div className="flex-1 flex min-h-0 min-w-0">
        {/* Left Pane: Changed Files List */}
        <HistoryChangedFiles
          isOpen={isLeftPaneOpen}
          viewMode={viewMode}
          diffChangedFiles={diffChangedFiles}
          unchangedFiles={unchangedFiles}
          snapshotFiles={snapshotFiles}
          deletedFiles={deletedFiles}
          selectedFilePath={selectedFilePath}
          onSelectFile={(path) => setSelectedFilePath(path)}
          activeVersionNumber={activeVersionNumber}
        />

        {/* Center Pane: Diff / Source CodeMirror 6 Viewer */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
          <HistoryViewerHeader
            viewMode={viewMode}
            onChangeViewMode={(mode) => setViewMode(mode)}
            activeFileName={activeFileName}
            formattedRevisionDate={formattedDate.full}
            compareTargetId={compareTargetId}
            onChangeCompareTargetId={(id) => setCompareTargetId(id)}
            timelineItems={timelineItems}
            selectedEventId={selectedEventId}
            additions={projectDiffData?.totalAdditions ?? diffData?.stats?.addedLines ?? 0}
            deletions={projectDiffData?.totalDeletions ?? diffData?.stats?.deletedLines ?? 0}
            filesChangedCount={projectDiffData?.filesChanged}
            activeVersionLabel={activeRevision?.label}
            onOpenRestoreModal={() => setRestoreModalOpen(true)}
            onOpenLabelModal={handleOpenLabelModal}
            onDownloadZip={handleDownloadZip}
          />

          <div className="flex-1 relative min-h-0 bg-[var(--editor-bg,hsl(var(--background)))]">
            <HistoryCodeMirrorViewer
              viewMode={viewMode}
              original={diffViewerOriginal}
              modified={diffViewerModified}
              singleContent={singleViewerContent}
              isDarkTheme={editorTheme === 'dark'}
              fontSize={13}
            />
          </div>
        </main>

        {/* Right Pane: Timeline */}
        <HistoryTimeline
          isOpen={isRightPaneOpen}
          timelineTab={timelineTab}
          onChangeTab={(tab) => setTimelineTab(tab)}
          labeledCount={labeledCount}
          isLoading={eventsLoading}
          groupedTimeline={groupedTimeline}
          selectedEventId={selectedEventId}
          onSelectRevision={(id) => setSelectedEventId(id)}
        />
      </div>

      {/* 3. Canonical Restore Modal */}
      <HistoryRestoreModal
        isOpen={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        activeFileName={activeFileName}
        activeVersionNumber={activeVersionNumber}
        formattedRevisionDate={formattedDate.full}
        isRestoring={isRestoringProject}
        onConfirmRestoreFile={handleRestoreFile}
        onConfirmRestoreProject={handleRestoreProject}
      />

      {/* 4. Canonical Milestone Label Modal */}
      <HistoryLabelModal
        isOpen={labelModalOpen}
        onOpenChange={setLabelModalOpen}
        labelText={labelText}
        onChangeLabelText={setLabelText}
        existingLabel={activeRevision?.label}
        onSaveLabel={handleSaveLabel}
        onRemoveLabel={handleRemoveLabel}
        isSaving={isSavingLabel}
      />
    </div>
  );
}
