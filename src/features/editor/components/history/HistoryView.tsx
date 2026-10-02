'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Clock,
  Tag,
  RotateCcw,
  MoreVertical,
  GitBranch,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Download,
  Trash2,
  FileX,
  PanelLeft,
  PanelRight,
} from 'lucide-react';
import HistoryCodeMirrorViewer from './HistoryCodeMirrorViewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
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
  useHistoryActions,
  useVersionDiff,
} from '@/features/editor/hooks/use-history';
import {
  versionService,
  historyService,
  type VersionDiffResponse,
} from '@/features/editor/services/history.service';
import { useProjectExport } from '@/features/editor/hooks/use-export';
import { toast } from 'sonner';

// ── Date Formatting Helpers ───────────────────────────────────────────────────

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
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { group, time, full };
}

// ── Master Overleaf 1:1 History View Component ────────────────────────────────

export default function HistoryView() {
  const params = useParams<{ projectId?: string; pageId?: string }>();
  const { currentPage, activeFilePage } = usePageStore();
  const { engine, getContent } = useEditorInstance();
  const { setIsHistoryOpen, editorTheme } = useSettingsStore();

  const rootPageId = params?.pageId || params?.projectId || '';
  const [timelineTab, setTimelineTab] = useState<'all' | 'labels'>('all');

  // Responsive sidebar visibility
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState(true);

  // Load project history events & versions
  const { history: events = [], isLoading: eventsLoading } = useProjectHistory(rootPageId);
  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });
  const { data: deletedFiles = [] } = useQuery({
    ...deletedFilesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  const { restoreToEvent } = useHistoryActions();
  const { restoreVersion, updateLabel } = useVersionActions();
  const { exportVersionZip } = useProjectExport();

  // Selected revision state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(activeFilePage?.id || null);

  // Content of the active file at the selected revision
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  // View mode: 'diff' | 'snapshot' | 'timeline'
  const [viewMode, setViewMode] = useState<'diff' | 'snapshot' | 'timeline'>('diff');
  const diffMode = viewMode === 'diff';
  const [compareTargetId, setCompareTargetId] = useState<string>('current');

  // ─── Time Machine / Keystroke Scrubbing State ─────────────────────────────
  const targetPageId = activeFileId || rootPageId;
  const { data: timelineData, isLoading: isTimelineLoading } = useQuery({
    queryKey: ['pages', targetPageId, 'timeline'],
    queryFn: () => historyService.getTimeline(targetPageId),
    enabled: viewMode === 'timeline' && !!targetPageId,
  });

  const timelineOps = useMemo(() => timelineData?.entries || [], [timelineData]);
  const minTime =
    timelineData?.oldestMs ||
    (events[events.length - 1]
      ? new Date(events[events.length - 1].createdAt).getTime()
      : Date.now() - 3600000);
  const maxTime = timelineData?.newestMs || Date.now();

  const [scrubTimestamp, setScrubTimestamp] = useState<number>(maxTime);
  const [scrubContent, setScrubContent] = useState<string>('');
  const [isScrubLoading, setIsScrubLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (timelineData?.newestMs) {
      setScrubTimestamp(timelineData.newestMs);
    }
  }, [timelineData?.newestMs]);

  useEffect(() => {
    if (viewMode !== 'timeline' || !targetPageId) return;
    let cancelled = false;
    setIsScrubLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await historyService.getContentAt(targetPageId, scrubTimestamp);
        if (!cancelled) {
          setScrubContent(res.content ?? '');
        }
      } catch (err) {
        console.error('Failed to reconstruct content at scrub point', err);
      } finally {
        if (!cancelled) {
          setIsScrubLoading(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [viewMode, targetPageId, scrubTimestamp]);

  const handleStepPrev = () => {
    if (!timelineOps.length) return;
    const prior = [...timelineOps].reverse().find((op) => op.timestamp < scrubTimestamp);
    if (prior) setScrubTimestamp(prior.timestamp);
    else setScrubTimestamp(minTime);
  };

  const handleStepNext = () => {
    if (!timelineOps.length) return;
    const next = timelineOps.find((op) => op.timestamp > scrubTimestamp);
    if (next) setScrubTimestamp(next.timestamp);
    else setScrubTimestamp(maxTime);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setScrubTimestamp((curr) => {
        const next = timelineOps.find((op) => op.timestamp > curr);
        if (!next) {
          setIsPlaying(false);
          return curr;
        }
        return next.timestamp;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, timelineOps]);

  const {
    updateContent: updateContentMutation,
    restorePage: restorePageMutation,
  } = usePageActions();

  const handleRestoreScrubPoint = () => {
    if (scrubContent === undefined) return;
    if (targetPageId) {
      updateContentMutation.mutate(
        {
          pageId: targetPageId,
          content: scrubContent,
        },
        {
          onSuccess: () => {
            engine?.setContent(scrubContent);
            toast.success(
              `Document restored to ${new Date(scrubTimestamp).toLocaleTimeString()} successfully!`,
            );
            setIsHistoryOpen(false);
          },
        },
      );
    } else {
      engine?.setContent(scrubContent);
      setIsHistoryOpen(false);
    }
  };

  // Label modal state
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelingItem, setLabelingItem] = useState<{ id: string; label?: string } | null>(null);
  const [labelText, setLabelText] = useState('');

  const currentFileContent = useMemo(() => {
    const f =
      pageFiles.find((p: any) => p.id === activeFileId) ||
      deletedFiles.find((p: any) => p.id === activeFileId);
    return f?.content || getContent() || '';
  }, [pageFiles, deletedFiles, activeFileId, getContent]);

  // Default active file
  useEffect(() => {
    if (!activeFileId) {
      if (pageFiles.length > 0) {
        setActiveFileId(pageFiles[0].id);
      } else if (deletedFiles.length > 0) {
        setActiveFileId(deletedFiles[0].id);
      }
    }
  }, [activeFileId, pageFiles, deletedFiles]);

  // Combined timeline items
  const timelineItems = useMemo(() => {
    if (events && events.length > 0) {
      return events.map((ev) => ({
        id: ev.id,
        versionNumber: (ev as any).versionNumber || (ev as any).version,
        type: 'event' as const,
        title: ev.title || ev.fileName || 'Snapshot',
        label: ev.label,
        fileName: ev.fileName || activeFilePage?.title || 'main.tex',
        date: ev.createdAt,
        author: ev.savedBy?.name || 'Collaborator',
        authorAvatar: ev.savedBy?.avatar,
        eventType: ev.eventType,
        pageId: (ev as any).pageId || ev.page || rootPageId,
      }));
    }
    return [];
  }, [events, activeFilePage, rootPageId]);

  // Count of labeled milestone versions
  const labeledCount = useMemo(() => {
    return timelineItems.filter((i) => Boolean(i.label && i.label.trim())).length;
  }, [timelineItems]);

  // Set initial selected revision
  useEffect(() => {
    if (timelineItems.length > 0 && !selectedEventId) {
      setSelectedEventId(timelineItems[0].id);
    }
  }, [timelineItems, selectedEventId]);

  // Filtered timeline (All history vs Labels)
  const filteredItems = useMemo(() => {
    if (timelineTab === 'labels') {
      return timelineItems.filter((i) => Boolean(i.label && i.label.trim()));
    }
    return timelineItems;
  }, [timelineItems, timelineTab]);

  // Grouped timeline items by date
  const groupedTimeline = useMemo(() => {
    const map = new Map<string, typeof timelineItems>();
    filteredItems.forEach((item) => {
      const { group } = formatRevisionDate(item.date);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });
    return Array.from(map.entries()).map(([groupName, items]) => ({
      groupName,
      items,
    }));
  }, [filteredItems]);

  const activeRevision = useMemo(() => {
    return timelineItems.find((i) => i.id === selectedEventId) || timelineItems[0];
  }, [timelineItems, selectedEventId]);

  // Fetch content for selected revision
  useEffect(() => {
    let isCancelled = false;

    async function loadContent() {
      if (!activeFileId) return;
      setIsLoadingContent(true);
      try {
        // 1. Try project snapshot from backend
        if ((activeRevision as any)?.versionNumber && rootPageId) {
          try {
            const snap = await historyService.getProjectSnapshot(
              rootPageId,
              (activeRevision as any).versionNumber,
            );
            if (snap && snap.files) {
              const activeFile =
                pageFiles.find((f: any) => f.id === activeFileId) ||
                deletedFiles.find((f: any) => f.id === activeFileId);
              const fileName = activeFile?.title || (activeFile as any)?.name || (activeFile as any)?.path || 'main.tex';
              const fileEntry =
                snap.files[fileName] ||
                snap.files[`/${fileName}`] ||
                Object.entries(snap.files).find(([k]) => k.endsWith(fileName))?.[1];

              if (fileEntry) {
                const content =
                  typeof fileEntry === 'string'
                    ? fileEntry
                    : Array.isArray(fileEntry.lines)
                    ? fileEntry.lines.join('\n')
                    : fileEntry.content || '';
                if (!isCancelled) {
                  setPreviewContent(content);
                  setIsLoadingContent(false);
                  return;
                }
              }
            }
          } catch {
            // Proceed to doc-level versions
          }
        }

        // 2. Fallback to doc-level versions
        const versions = await versionService.getByPageId(activeFileId);
        if (versions && versions.length > 0) {
          const match = versions.find((v) => v.id === selectedVersionId || v.id === selectedEventId) || versions[0];
          const fullVersion = await versionService.getById(activeFileId, match.id);
          if (!isCancelled && fullVersion?.content !== undefined) {
            setPreviewContent(fullVersion.content);
            setIsLoadingContent(false);
            return;
          }
        }

        const activeFile =
          pageFiles.find((f: any) => f.id === activeFileId) ||
          deletedFiles.find((f: any) => f.id === activeFileId);
        if (!isCancelled) {
          setPreviewContent(activeFile?.content || getContent() || '');
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
  }, [activeFileId, selectedVersionId, selectedEventId, pageFiles, deletedFiles, getContent, activeRevision, rootPageId]);

  // Server-computed visual diff with TanStack Query caching
  const { data: serverDiffData, isLoading: isDiffLoading } = useVersionDiff(
    activeFileId,
    compareTargetId,
    selectedEventId,
    { enabled: diffMode && Boolean(activeFileId && selectedEventId) },
  );

  const diffData = useMemo<VersionDiffResponse | null>(() => {
    if (!diffMode) return null;
    if (serverDiffData) return serverDiffData;
    return {
      fromVersionId: compareTargetId,
      toVersionId: selectedEventId || '',
      fromContent: currentFileContent,
      toContent: previewContent,
      chunks: [],
      stats: { addedLines: 0, deletedLines: 0, unchangedLines: 0 },
    };
  }, [diffMode, serverDiffData, compareTargetId, selectedEventId, currentFileContent, previewContent]);

  const activeFileName = useMemo(() => {
    const f =
      pageFiles.find((p) => p.id === activeFileId) ||
      deletedFiles.find((p: any) => p.id === activeFileId);
    return f?.title || activeRevision?.fileName || 'main.tex';
  }, [pageFiles, deletedFiles, activeFileId, activeRevision]);

  const isSelectedFileDeleted = useMemo(() => {
    return deletedFiles.some((df: any) => df.id === activeFileId);
  }, [deletedFiles, activeFileId]);

  // Handle Restore Single File (Overleaf Parity)
  const handleRestoreFile = (targetId?: string) => {
    const fileId = targetId || activeFileId;
    if (!fileId || previewContent === undefined) return;

    const fileObj =
      pageFiles.find((f) => f.id === fileId) ||
      deletedFiles.find((f: any) => f.id === fileId);
    const fileName = fileObj?.title || activeFileName;

    updateContentMutation.mutate(
      {
        pageId: fileId,
        content: previewContent,
      },
      {
        onSuccess: () => {
          if (fileId === activeFilePage?.id) {
            engine?.setContent(previewContent);
          }
          toast.success(`Restored "${fileName}" to this revision successfully!`);
          setIsHistoryOpen(false);
        },
      },
    );
  };

  // Handle Restore Deleted File back to Project (Overleaf Parity)
  const handleRestoreDeletedFile = async (targetId?: string) => {
    const fileId = targetId || activeFileId;
    if (!fileId) return;

    try {
      await restorePageMutation.mutateAsync(fileId);
      if (previewContent !== undefined) {
        await updateContentMutation.mutateAsync({
          pageId: fileId,
          content: previewContent,
        });
      }
    } catch {
      // Error already notified by mutation hook
    }
  };

  // Handle Download Version as ZIP (Overleaf Parity)
  const handleDownloadVersionZip = (item?: any) => {
    const rev = item || activeRevision;
    if (!rev) return;
    exportVersionZip({
      parentPageId: rootPageId,
      versionId: rev.id,
      revisionDate: rev.date,
      revisionLabel: rev.label,
      projectTitle: currentPage?.title,
    });
  };

  // Handle Restore Entire Project
  const handleRestore = async () => {
    if (!activeRevision) return;
    try {
      if (activeRevision.id) {
        await restoreToEvent.mutateAsync({
          rootPageId,
          eventId: activeRevision.id,
          versionNumber: (activeRevision as any).versionNumber,
        });
      }
      setIsHistoryOpen(false);
    } catch {
      // Error already notified by mutation hook
    }
  };

  // Handle Save Label
  const handleSaveLabel = async () => {
    if (!labelingItem) return;
    try {
      await updateLabel.mutateAsync({
        pageId: (labelingItem as any).pageId || activeFileId || rootPageId,
        versionId: labelingItem.id,
        label: labelText.trim(),
        rootPageId,
        projectId: rootPageId,
        versionNumber: (labelingItem as any).versionNumber,
      });
      setLabelModalOpen(false);
    } catch {
      // Error already notified by mutation hook
    }
  };

  const handleOpenLabelModal = (item?: any) => {
    const target = item || activeRevision;
    if (target) {
      setLabelingItem(target);
      setLabelText(target.label || '');
      setLabelModalOpen(true);
    }
  };

  const formattedDate = formatRevisionDate(activeRevision?.date);

  return (
    <div className="flex flex-col h-dvh w-full bg-background text-foreground select-none z-50 animate-in fade-in duration-150 motion-reduce:animate-none font-sans">
      {/* ── 1. Top Navigation Bar ───────────────────────────────────────── */}
      <header className="h-11 border-b border-border bg-background flex items-center justify-between px-3 shrink-0 text-foreground">
        {/* Left: Back to Editor Button & Left Pane Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(false)}
            aria-label="Back to editor"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-muted hover:bg-muted/80 text-foreground text-12 font-medium transition-colors cursor-pointer outline-none border border-border focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Back to editor</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLeftPaneOpen((prev) => !prev)}
            aria-label={isLeftPaneOpen ? 'Hide project files pane' : 'Show project files pane'}
            title={isLeftPaneOpen ? 'Hide files' : 'Show files'}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-md border border-border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              isLeftPaneOpen ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <PanelLeft className="size-3.5 shrink-0" />
          </button>
        </div>

        {/* Center: Project Title */}
        <div className="flex items-center gap-1.5 text-12 font-semibold text-foreground/90 truncate max-w-md">
          <GitBranch className="size-3.5 text-primary shrink-0" />
          <span className="truncate">{currentPage?.title || 'Project History'}</span>
          <span className="text-11 font-normal text-muted-foreground shrink-0 hidden md:inline">/ Version History</span>
        </div>

        {/* Right: Right Pane Toggle & Status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRightPaneOpen((prev) => !prev)}
            aria-label={isRightPaneOpen ? 'Hide revision timeline pane' : 'Show revision timeline pane'}
            title={isRightPaneOpen ? 'Hide timeline' : 'Show timeline'}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-md border border-border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              isRightPaneOpen ? 'bg-muted text-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <PanelRight className="size-3.5 shrink-0" />
          </button>
        </div>
      </header>

      {/* ── 2. Three-Column Main Workspace ──────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 min-w-0">
        {/* ── Left Pane: Modified Files in this Revision (Width ~220px) ───── */}
        {isLeftPaneOpen && (
          <aside
            aria-label="Project files list"
            className="w-56 shrink-0 border-r border-border bg-background flex flex-col min-h-0 animate-in fade-in duration-150 motion-reduce:animate-none"
          >
            <div className="px-3 py-2 border-b border-border text-11 font-semibold text-muted-foreground select-none">
              Project Files
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
              {pageFiles.length === 0 ? (
                <div
                  className="flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors bg-primary text-primary-foreground"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{activeRevision?.fileName || 'main.tex'}</span>
                  </div>
                  <span className="text-10 font-mono font-medium px-1.5 py-0.5 rounded-md bg-primary-foreground/20 text-primary-foreground leading-none">
                    Edited
                  </span>
                </div>
              ) : (
                pageFiles.map((file: any) => {
                  const isActive = file.id === activeFileId;
                  return (
                    <div
                      key={file.id}
                      role="button"
                      tabIndex={0}
                      aria-selected={isActive}
                      aria-label={`Select file ${file.title || 'untitled.tex'}`}
                      onClick={() => setActiveFileId(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveFileId(file.id);
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground/85 hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <FileText className="size-3.5 shrink-0" />
                        <span className="truncate">{file.title || 'untitled.tex'}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1.5">
                        <span
                          className={cn(
                            'text-10 font-mono font-medium px-1.5 py-0.5 rounded-md leading-none shrink-0',
                            isActive
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          Edited
                        </span>
                        {isActive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreFile(file.id);
                            }}
                            title={`Restore only "${file.title || 'this file'}"`}
                            aria-label={`Restore only "${file.title || 'this file'}" to this revision`}
                            className="size-6 rounded-md hover:bg-primary-foreground/20 flex items-center justify-center text-primary-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {deletedFiles.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border">
                  <div className="px-2 py-1 flex items-center justify-between text-11 font-semibold text-destructive select-none">
                    <div className="flex items-center gap-1.5">
                      <Trash2 className="size-3 shrink-0" />
                      <span>Deleted Files</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive font-mono text-10 font-medium">
                      {deletedFiles.length}
                    </span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {deletedFiles.map((file: any) => {
                      const isActive = file.id === activeFileId;
                      return (
                        <div
                          key={file.id}
                          role="button"
                          tabIndex={0}
                          aria-selected={isActive}
                          aria-label={`Deleted file ${file.title || 'deleted_file.tex'}`}
                          onClick={() => setActiveFileId(file.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveFileId(file.id);
                            }
                          }}
                          className={cn(
                            'flex items-center justify-between h-8 px-2.5 rounded-md text-12 font-medium cursor-pointer transition-colors select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
                            isActive
                              ? 'bg-destructive/15 text-destructive border border-destructive/30 font-semibold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground line-through decoration-destructive/50',
                          )}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0">
                            <FileX className="size-3.5 shrink-0 text-destructive" />
                            <span className="truncate">{file.title || 'deleted_file.tex'}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-1.5">
                            <span className="text-10 font-mono font-medium px-1.5 py-0.5 rounded-md leading-none bg-destructive/15 text-destructive">
                              Deleted
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreDeletedFile(file.id);
                              }}
                              title={`Restore "${file.title}" back to project`}
                              aria-label={`Restore "${file.title}" back to project`}
                              className="size-6 rounded-md hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                            >
                              <RotateCcw className="size-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Center Pane: Diff & Document Viewer (Flex-1) ───────────────── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
          {/* Subheader Banner matching Overleaf */}
          <div className="h-10 px-3 border-b border-border bg-muted/30 flex items-center justify-between text-12 shrink-0 select-none gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="font-semibold text-foreground/90 truncate shrink-0">
                {viewMode === 'timeline'
                  ? `Time Machine: ${new Date(scrubTimestamp).toLocaleTimeString()} (${new Date(scrubTimestamp).toLocaleDateString()})`
                  : `Viewing ${formattedDate.full}`}
              </span>

              {/* View mode toggle: Compare Diff vs Snapshot vs Time Machine */}
              <div className="inline-flex items-center rounded-md bg-muted p-0.5 text-11 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('diff')}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-11 font-medium transition-colors cursor-pointer',
                    viewMode === 'diff'
                      ? 'bg-background text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Compare Diff
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('snapshot')}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-11 font-medium transition-colors cursor-pointer',
                    viewMode === 'snapshot'
                      ? 'bg-background text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={cn(
                    'px-2 py-0.5 rounded-md text-11 font-medium transition-colors cursor-pointer flex items-center gap-1',
                    viewMode === 'timeline'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Clock className="size-3 shrink-0" />
                  <span>Time Machine</span>
                </button>
              </div>

              {diffMode && (
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <label htmlFor="compare-target-select" className="text-11 text-muted-foreground shrink-0">
                    Compare against:
                  </label>
                  <select
                    id="compare-target-select"
                    aria-label="Compare against revision"
                    value={compareTargetId}
                    onChange={(e) => setCompareTargetId(e.target.value)}
                    className="h-6 px-1.5 text-11 font-medium rounded-md border border-border bg-background text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="current">Current Document</option>
                    {timelineItems
                      .filter((item) => item.id !== selectedEventId)
                      .map((item) => {
                        const d = formatRevisionDate(item.date);
                        return (
                          <option key={item.id} value={item.id}>
                            {d.group}, {d.time} ({item.author})
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              {/* Diff Stats Badge */}
              {diffMode && diffData?.stats && (
                <div className="hidden md:flex items-center gap-1 text-10 font-mono shrink-0">
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                    +{diffData.stats.addedLines}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive font-semibold border border-destructive/30">
                    -{diffData.stats.deletedLines}
                  </span>
                </div>
              )}
            </div>

            {/* Right actions on Subheader: Restore Buttons & Options */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-muted-foreground font-mono text-11 hidden lg:inline mr-1 truncate max-w-[140px]" title={activeFileName}>
                {activeFileName}
              </span>

              {/* Prominent Restore Buttons */}
              {viewMode === 'timeline' ? (
                <button
                  type="button"
                  onClick={handleRestoreScrubPoint}
                  disabled={isScrubLoading}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <RotateCcw className="size-3 shrink-0" />
                  <span>Restore this point</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* Single File Restore or Deleted File Restore */}
                  {isSelectedFileDeleted ? (
                    <button
                      type="button"
                      onClick={() => handleRestoreDeletedFile()}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                      title={`Restore deleted file "${activeFileName}" back to project`}
                      aria-label={`Restore deleted file "${activeFileName}" back to project`}
                    >
                      <RotateCcw className="size-3 shrink-0" />
                      <span>Restore file</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRestoreFile()}
                      disabled={isLoadingContent || previewContent === undefined}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground font-medium text-11 transition-colors cursor-pointer disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      title={`Restore only "${activeFileName}" to this revision`}
                      aria-label={`Restore only "${activeFileName}" to this revision`}
                    >
                      <FileText className="size-3 shrink-0" />
                      <span>Restore file</span>
                    </button>
                  )}

                  {/* Entire Project Restore */}
                  <button
                    type="button"
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-xs"
                    title="Restore all project files to this revision"
                    aria-label="Restore entire project to this revision"
                  >
                    <RotateCcw className="size-3 shrink-0" />
                    <span>Restore project</span>
                  </button>

                  {/* Desktop Quick Actions: Download & Label */}
                  <div className="hidden xl:flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadVersionZip()}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      title="Download project files at this revision as a ZIP archive"
                      aria-label="Download ZIP archive of this version"
                    >
                      <Download className="size-3 shrink-0 text-foreground" />
                      <span>Download ZIP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLabelModal()}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      title="Add or edit a milestone label for this revision"
                      aria-label={activeRevision?.label ? 'Edit milestone label' : 'Add milestone label'}
                    >
                      <Tag className="size-3 shrink-0" />
                      <span>{activeRevision?.label ? 'Edit label' : 'Label version'}</span>
                    </button>
                  </div>

                  {/* Responsive Dropdown for smaller screens */}
                  <div className="xl:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="More revision actions"
                          className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 p-1">
                        <DropdownMenuItem
                          onClick={() => handleOpenLabelModal()}
                          className="cursor-pointer gap-2 text-12 rounded-md"
                        >
                          <Tag className="size-3.5 text-primary shrink-0" />
                          <span>{activeRevision?.label ? 'Edit label' : 'Label version'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadVersionZip()}
                          className="cursor-pointer gap-2 text-12 rounded-md"
                        >
                          <Download className="size-3.5 text-foreground shrink-0" />
                          <span>Download ZIP archive</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Time Machine Scrubber Toolbar */}
          {viewMode === 'timeline' && (
            <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center gap-3 text-12 select-none">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={handleStepPrev}
                  aria-label="Previous edit"
                  title="Previous keystroke / edit"
                  disabled={isScrubLoading}
                >
                  <SkipBack className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md text-primary"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
                  title={isPlaying ? 'Pause replay' : 'Play replay'}
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  onClick={handleStepNext}
                  aria-label="Next edit"
                  title="Next keystroke / edit"
                  disabled={isScrubLoading}
                >
                  <SkipForward className="size-3.5" />
                </Button>
              </div>

              {/* Slider Track */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-11 font-mono text-muted-foreground shrink-0">
                  {new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min={minTime}
                    max={maxTime || minTime + 1}
                    value={scrubTimestamp}
                    onChange={(e) => setScrubTimestamp(Number(e.target.value))}
                    aria-label="Keystroke time machine revision scrubber"
                    aria-valuemin={minTime}
                    aria-valuemax={maxTime || minTime + 1}
                    aria-valuenow={scrubTimestamp}
                    aria-valuetext={new Date(scrubTimestamp).toLocaleString()}
                    className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
                  />
                </div>
                <span className="text-11 font-mono text-muted-foreground shrink-0">
                  {new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Status and Ops Count */}
              <div className="flex items-center gap-2 shrink-0">
                {isScrubLoading && (
                  <div className="flex items-center gap-1 text-11 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>Reconstructing…</span>
                  </div>
                )}
                <span className="px-2 py-0.5 rounded-md bg-background border border-border text-10 font-mono text-muted-foreground">
                  {timelineOps.length} ops recorded
                </span>
              </div>
            </div>
          )}

          {/* CodeMirror 6 Diff & Snapshot Viewer */}
          <div className="flex-1 relative min-h-0 bg-[var(--editor-bg,hsl(var(--background)))]">
            <HistoryCodeMirrorViewer
              viewMode={viewMode}
              original={diffData?.fromContent || currentFileContent}
              modified={diffData?.toContent || previewContent}
              singleContent={viewMode === 'timeline' ? scrubContent : previewContent}
              isDarkTheme={editorTheme === 'dark'}
              fontSize={13}
            />
          </div>
        </main>

        {/* ── Right Pane: History Timeline & Versions Panel (Width ~320px) ─ */}
        {isRightPaneOpen && (
          <aside
            aria-label="Revision history timeline"
            className="w-80 shrink-0 border-l border-border bg-card flex flex-col text-card-foreground min-h-0 select-none animate-in fade-in duration-150 motion-reduce:animate-none"
          >
            {/* Top Switcher: [ All history | Labels ] */}
            <div className="p-3 border-b border-border shrink-0">
              <div className="inline-flex w-full items-center rounded-md bg-muted p-0.5 text-12">
                <button
                  type="button"
                  onClick={() => setTimelineTab('all')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-12 font-medium transition-colors cursor-pointer text-center',
                    timelineTab === 'all'
                      ? 'bg-background text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  All history
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineTab('labels')}
                  className={cn(
                    'flex-1 py-1 rounded-md text-12 font-medium transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5',
                    timelineTab === 'labels'
                      ? 'bg-background text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>Labels</span>
                  {labeledCount > 0 && (
                    <span className="text-10 px-1.5 py-0.2 rounded-full bg-muted-foreground/20 text-foreground font-mono leading-none">
                      {labeledCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Timeline Revisions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {eventsLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-12 gap-2">
                  <Clock className="size-5 animate-spin opacity-50 text-primary" />
                  <span>Loading revision history…</span>
                </div>
              ) : groupedTimeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-12 text-center p-4">
                  {timelineTab === 'labels' ? (
                    <Tag className="size-8 opacity-25 mb-2 text-primary" />
                  ) : (
                    <Clock className="size-8 opacity-25 mb-2" />
                  )}
                  <p className="font-semibold text-foreground">
                    {timelineTab === 'labels' ? 'No labeled versions' : 'No revisions found'}
                  </p>
                  <p className="text-11 text-muted-foreground mt-1 leading-relaxed">
                    {timelineTab === 'labels'
                      ? 'Label milestone revisions (e.g. "Draft v1", "Submitted to arXiv") to bookmark key checkpoints.'
                      : 'Changes will automatically be checkpointed as you compile and edit.'}
                  </p>
                </div>
              ) : (
                groupedTimeline.map(({ groupName, items }) => (
                  <div key={groupName} className="space-y-1.5">
                    <div className="text-11 font-medium text-muted-foreground tracking-normal px-1">
                      {groupName}
                    </div>

                    {items.map((item) => {
                      const isSelected = item.id === activeRevision?.id;
                      const dateMeta = formatRevisionDate(item.date);

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-selected={isSelected}
                          aria-label={`Revision from ${dateMeta.full} by ${item.author}`}
                          onClick={() => setSelectedEventId(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedEventId(item.id);
                            }
                          }}
                          className={cn(
                            'group relative rounded-md p-2.5 transition-colors cursor-pointer select-none border outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            isSelected
                              ? 'bg-primary/10 border-primary/40 text-foreground font-medium'
                              : 'bg-card hover:bg-muted/50 border-border text-foreground',
                          )}
                        >
                          {/* Header: Timestamp & Actions */}
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn('text-12 font-semibold truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                              {dateMeta.full}
                            </span>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Actions for revision from ${dateMeta.full}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="size-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                  <MoreVertical className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 p-1">
                                <DropdownMenuItem
                                  onClick={() => handleOpenLabelModal(item)}
                                  className="cursor-pointer gap-2 text-12 rounded-md"
                                >
                                  <Tag className="size-3.5 text-primary shrink-0" />
                                  <span>{item.label ? 'Edit label' : 'Label this version'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadVersionZip(item);
                                  }}
                                  className="cursor-pointer gap-2 text-12 rounded-md"
                                >
                                  <Download className="size-3.5 text-foreground shrink-0" />
                                  <span>Download ZIP of this version</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem
                                  onClick={() => handleRestore()}
                                  className="cursor-pointer gap-2 text-12 rounded-md text-primary focus:text-primary font-medium"
                                >
                                  <RotateCcw className="size-3.5 shrink-0" />
                                  <span>Restore this version</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Label Badge if present */}
                          {item.label && (
                            <div className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-11 font-medium w-fit">
                              <Tag className="size-3 shrink-0" />
                              <span className="truncate max-w-[200px]">{item.label}</span>
                            </div>
                          )}

                          {/* Status & Filename */}
                          <div className="text-11 text-foreground/80 mt-1 font-medium">
                            {item.eventType === 'collaborative_checkpoint'
                              ? 'Auto Checkpoint'
                              : item.eventType === 'restore'
                                ? 'Restored Version'
                                : 'Edited'}
                          </div>
                          <div className="text-10 text-muted-foreground font-mono truncate mt-0.5">
                            {item.fileName}
                          </div>

                          {/* Author Tag */}
                          <div className="flex items-center gap-1.5 mt-2 text-10 text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-primary shrink-0" />
                            <span>{item.author}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── 3. Label / Milestone Dialog Modal ─────────────────────────────────── */}
      <Dialog open={labelModalOpen} onOpenChange={setLabelModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-md font-sans border border-border bg-popover text-popover-foreground shadow-raised-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-13 font-semibold text-foreground">
              <Tag className="size-4 text-primary" />
              <span>Label this version</span>
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground">
              Assign a milestone label to easily find and track this revision (e.g. &ldquo;Camera-Ready Submission&rdquo; or &ldquo;Pre-review Draft&rdquo;).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Input
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="e.g. Conference Submission v1"
              aria-label="Milestone version label"
              className="text-12 rounded-md h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveLabel();
                }
              }}
            />
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
            {labelingItem?.label ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setLabelText('');
                  handleSaveLabel();
                }}
                className="rounded-md text-12 h-8"
              >
                Remove label
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLabelModalOpen(false)}
                className="rounded-md text-12 h-8"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveLabel}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-12 h-8"
              >
                Save label
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
