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
  Check,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  GitBranch,
  Cloud,
  FileCode2,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Download,
  Trash2,
  FileX,
} from 'lucide-react';
import HistoryCodeMirrorViewer from './HistoryCodeMirrorViewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Button,
} from '@/shared/components/ui';
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
} from '@/features/editor/hooks/use-history';
import {
  versionService,
  historyService,
  type VersionDiffResponse,
} from '@/features/editor/services/history.service';
import { exportVersionAsZip } from '@/features/editor/utils/export-zip.util';
import type { PageVersion, PageEvent } from '@/features/editor/types';
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

  const full = `${d.getDate()}th ${d.toLocaleString('en-GB', { month: 'long' })}, ${time}`;

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

  // Server-computed visual diff data
  const [diffData, setDiffData] = useState<VersionDiffResponse | null>(null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

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
  const handleRestoreScrubPoint = async () => {
    if (scrubContent === undefined) return;
    try {
      if (targetPageId) {
        await updateContentMutation.mutateAsync({
          pageId: targetPageId,
          content: scrubContent,
        });
      }
      engine?.setContent(scrubContent);
      toast.success(
        `Document restored to ${new Date(scrubTimestamp).toLocaleTimeString()} successfully!`,
      );
      setIsHistoryOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to restore document at this point');
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
  }, [activeFileId, selectedVersionId, selectedEventId, pageFiles, deletedFiles, getContent]);

  // Fetch server-computed diff when diffMode is active
  useEffect(() => {
    if (!diffMode || !activeFileId || !selectedEventId) {
      setDiffData(null);
      return;
    }

    let isCancelled = false;
    setIsDiffLoading(true);

    async function fetchDiff() {
      try {
        const res = await versionService.compareVersions(
          activeFileId!,
          compareTargetId,
          selectedEventId!,
        );
        if (!isCancelled) {
          setDiffData(res);
          setIsDiffLoading(false);
        }
      } catch {
        if (!isCancelled) {
          // Fallback to client strings if diff endpoint fails
          setDiffData({
            fromVersionId: compareTargetId,
            toVersionId: selectedEventId!,
            fromContent: currentFileContent,
            toContent: previewContent,
            chunks: [],
            stats: { addedLines: 0, deletedLines: 0, unchangedLines: 0 },
          });
          setIsDiffLoading(false);
        }
      }
    }

    fetchDiff();
    return () => {
      isCancelled = true;
    };
  }, [diffMode, activeFileId, selectedEventId, compareTargetId, currentFileContent, previewContent]);

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
  const handleRestoreFile = async (targetId?: string) => {
    const fileId = targetId || activeFileId;
    if (!fileId) return;

    const fileObj =
      pageFiles.find((f) => f.id === fileId) ||
      deletedFiles.find((f: any) => f.id === fileId);
    const fileName = fileObj?.title || activeFileName;

    try {
      if (previewContent !== undefined) {
        await updateContentMutation.mutateAsync({
          pageId: fileId,
          content: previewContent,
        });

        if (fileId === activeFilePage?.id) {
          engine?.setContent(previewContent);
        }

        toast.success(`Restored "${fileName}" to this revision successfully!`);
        setIsHistoryOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to restore ${fileName}`);
    }
  };

  // Handle Restore Deleted File back to Project (Overleaf Parity)
  const handleRestoreDeletedFile = async (targetId?: string) => {
    const fileId = targetId || activeFileId;
    if (!fileId) return;

    const fileObj = deletedFiles.find((f: any) => f.id === fileId);
    const fileName = fileObj?.title || activeFileName;

    try {
      await restorePageMutation.mutateAsync(fileId);
      if (previewContent !== undefined && previewContent !== fileObj?.content) {
        await updateContentMutation.mutateAsync({
          pageId: fileId,
          content: previewContent,
        });
      }
      toast.success(`Restored "${fileName}" back to project!`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to restore ${fileName}`);
    }
  };

  // Handle Download Version as ZIP (Overleaf Parity)
  const handleDownloadVersionZip = async (item?: any) => {
    const rev = item || activeRevision;
    if (!rev) return;
    await exportVersionAsZip({
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
        });
      }
      toast.success('Restored project to revision successfully!');
      setIsHistoryOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore revision');
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
      });
      setLabelModalOpen(false);
      toast.success(labelText.trim() ? 'Version labeled successfully' : 'Label removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update label');
    }
  };

  const formattedDate = formatRevisionDate(activeRevision?.date);

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-background text-foreground select-none z-50 animate-in fade-in duration-200">
      {/* ── 1. Top Navigation Bar ───────────────────────────────────────── */}
      <header className="h-11 border-b border-border bg-background flex items-center justify-between px-3 shrink-0 text-foreground">
        {/* Left: Back to Editor Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(false)}
            className="flex items-center gap-2 h-7 px-3 rounded-md bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors cursor-pointer outline-none border border-border"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            <span>Back to editor</span>
          </button>
        </div>

        {/* Center: Project Title */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90 hover:text-foreground cursor-pointer">
          <GitBranch className="size-3.5 text-primary" />
          <span>{currentPage?.title || 'Project History'}</span>
          <span className="text-[11px] font-normal text-muted-foreground">/ Version History</span>
        </div>

        {/* Right: Close & Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            Version History
          </span>
        </div>
      </header>

      {/* ── 2. Three-Column Main Workspace ──────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Pane: Modified Files in this Revision (Width ~220px) ───── */}
        <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Project Files
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
            {pageFiles.length === 0 ? (
              <div
                className={cn(
                  'flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
                  'bg-primary text-primary-foreground shadow-2xs',
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{activeRevision?.fileName || 'main.tex'}</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-sm bg-primary-foreground/20 text-primary-foreground leading-none">
                  Edited
                </span>
              </div>
            ) : (
              pageFiles.map((file: any) => {
                const isActive = file.id === activeFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={cn(
                      'flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-colors select-none',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{file.title || 'untitled.tex'}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded-sm leading-none shrink-0',
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
                          className="size-5 rounded-sm hover:bg-primary-foreground/20 flex items-center justify-center text-primary-foreground transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {deletedFiles.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border">
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-rose-500/90 dark:text-rose-400 uppercase tracking-wider select-none">
                  <div className="flex items-center gap-1.5">
                    <Trash2 className="size-3 shrink-0" />
                    <span>Deleted Files</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[10px]">
                    {deletedFiles.length}
                  </span>
                </div>
                <div className="space-y-1 mt-1">
                  {deletedFiles.map((file: any) => {
                    const isActive = file.id === activeFileId;
                    return (
                      <div
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={cn(
                          'flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-colors select-none',
                          isActive
                            ? 'bg-rose-950/60 dark:bg-rose-900/60 text-white border border-rose-500/40 shadow-2xs'
                            : 'text-muted-foreground/80 hover:bg-muted hover:text-foreground line-through decoration-rose-500/50',
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileX className="size-3.5 shrink-0 text-rose-500" />
                          <span className="truncate">{file.title || 'deleted_file.tex'}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm leading-none bg-rose-500/20 text-rose-300">
                            Deleted
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreDeletedFile(file.id);
                            }}
                            title={`Restore "${file.title}" back to project`}
                            className="size-5 rounded-sm hover:bg-rose-500/30 flex items-center justify-center text-rose-300 hover:text-white transition-colors cursor-pointer"
                          >
                            <RotateCcw className="size-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Center Pane: Diff & Document Viewer (Flex-1) ───────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {/* Subheader Banner matching Overleaf */}
          <div className="h-10 px-4 border-b border-border bg-muted/30 flex items-center justify-between text-xs shrink-0 select-none">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground/90">
                {viewMode === 'timeline'
                  ? `Time Machine: ${new Date(scrubTimestamp).toLocaleTimeString()} (${new Date(scrubTimestamp).toLocaleDateString()})`
                  : `Viewing ${formattedDate.full}`}
              </span>

              {/* View mode toggle: Compare Diff vs Snapshot vs Time Machine */}
              <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
                <button
                  type="button"
                  onClick={() => setViewMode('diff')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors cursor-pointer',
                    viewMode === 'diff'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Compare Diff
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('snapshot')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors cursor-pointer',
                    viewMode === 'snapshot'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1',
                    viewMode === 'timeline'
                      ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Clock className="size-3 shrink-0" />
                  <span>Time Machine</span>
                </button>
              </div>

              {diffMode && (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-[11px] text-muted-foreground">Compare against:</span>
                  <select
                    value={compareTargetId}
                    onChange={(e) => setCompareTargetId(e.target.value)}
                    className="h-6 px-1.5 text-[11px] font-medium rounded-sm border border-border bg-background text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
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
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    +{diffData.stats.addedLines}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                    -{diffData.stats.deletedLines}
                  </span>
                </div>
              )}
            </div>

            {/* Right actions on Subheader: Restore Buttons & File Name */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-11 hidden md:inline mr-1">
                {activeFileName}
              </span>

              {/* Prominent Restore Buttons */}
              {viewMode === 'timeline' ? (
                <button
                  type="button"
                  onClick={handleRestoreScrubPoint}
                  disabled={isScrubLoading}
                  className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
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
                      className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                      title={`Restore deleted file "${activeFileName}" back to project`}
                    >
                      <RotateCcw className="size-3 shrink-0" />
                      <span>Restore to project</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRestoreFile()}
                      disabled={isLoadingContent || previewContent === undefined}
                      className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                      title={`Restore only "${activeFileName}" to this revision`}
                    >
                      <FileText className="size-3 shrink-0" />
                      <span>Restore this file</span>
                    </button>
                  )}

                  {/* Entire Project Restore */}
                  <button
                    type="button"
                    onClick={handleRestore}
                    className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                    title="Restore all project files to this revision"
                  >
                    <RotateCcw className="size-3 shrink-0" />
                    <span>Restore entire project</span>
                  </button>

                  {/* Download Version ZIP */}
                  <button
                    type="button"
                    onClick={() => handleDownloadVersionZip()}
                    className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm border border-border bg-background hover:bg-muted text-foreground font-medium text-[11px] transition-colors cursor-pointer shadow-2xs"
                    title="Download project files at this revision as a ZIP archive"
                  >
                    <Download className="size-3 shrink-0 text-sky-500" />
                    <span className="hidden lg:inline">Download ZIP</span>
                  </button>

                  {/* Label Version (Milestone) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRevision) {
                        setLabelingItem(activeRevision);
                        setLabelText(activeRevision.label || '');
                        setLabelModalOpen(true);
                      }
                    }}
                    className="flex items-center gap-1.5 h-6 px-2.5 rounded-sm border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                    title="Add or edit a milestone label for this revision"
                  >
                    <Tag className="size-3 shrink-0" />
                    <span>{activeRevision?.label ? 'Edit label' : 'Label version'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Time Machine Scrubber Toolbar */}
          {viewMode === 'timeline' && (
            <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-4 text-xs select-none">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleStepPrev}
                  title="Previous keystroke / edit"
                  disabled={isScrubLoading}
                >
                  <SkipBack className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-primary"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause replay' : 'Play replay'}
                >
                  {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleStepNext}
                  title="Next keystroke / edit"
                  disabled={isScrubLoading}
                >
                  <SkipForward className="size-3.5" />
                </Button>
              </div>

              {/* Slider Track */}
              <div className="flex-1 flex items-center gap-3">
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="relative flex-1 flex items-center">
                  <input
                    type="range"
                    min={minTime}
                    max={maxTime || minTime + 1}
                    value={scrubTimestamp}
                    onChange={(e) => setScrubTimestamp(Number(e.target.value))}
                    className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
                  />
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Status and Ops Count */}
              <div className="flex items-center gap-2 shrink-0">
                {isScrubLoading && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin text-primary" />
                    <span>Reconstructing…</span>
                  </div>
                )}
                <span className="px-2 py-0.5 rounded-sm bg-background border border-border text-[11px] font-mono text-muted-foreground">
                  {timelineOps.length} ops recorded
                </span>
              </div>
            </div>
          )}

          {/* CodeMirror 6 Diff & Snapshot Viewer */}
          <div className="flex-1 relative overflow-hidden bg-[var(--editor-bg,hsl(var(--background)))]">
            <HistoryCodeMirrorViewer
              viewMode={viewMode}
              original={diffData?.fromContent || currentFileContent}
              modified={diffData?.toContent || previewContent}
              singleContent={viewMode === 'timeline' ? scrubContent : previewContent}
              isDarkTheme={editorTheme === 'dark'}
              fontSize={13}
            />
          </div>
        </div>

        {/* ── Right Pane: History Timeline & Versions Panel (Width ~320px) ─ */}
        <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col text-card-foreground overflow-hidden select-none">
          {/* Top Switcher: [ All history | Labels ] */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-xs">
              <button
                type="button"
                onClick={() => setTimelineTab('all')}
                className={cn(
                  'flex-1 py-1 rounded-sm text-xs font-medium transition-colors cursor-pointer text-center',
                  timelineTab === 'all'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All history
              </button>
              <button
                type="button"
                onClick={() => setTimelineTab('labels')}
                className={cn(
                  'flex-1 py-1 rounded-sm text-xs font-medium transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5',
                  timelineTab === 'labels'
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>Labels</span>
                {labeledCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted-foreground/20 text-foreground font-mono leading-none">
                    {labeledCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Timeline Revisions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {eventsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
                <Clock className="size-5 animate-spin opacity-50 text-primary" />
                <span>Loading revision history…</span>
              </div>
            ) : groupedTimeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center p-4">
                {timelineTab === 'labels' ? (
                  <Tag className="size-8 opacity-25 mb-2 text-indigo-500" />
                ) : (
                  <Clock className="size-8 opacity-25 mb-2" />
                )}
                <p className="font-semibold text-foreground">
                  {timelineTab === 'labels' ? 'No labeled versions' : 'No revisions found'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {timelineTab === 'labels'
                    ? 'Label milestone revisions (e.g. "Draft v1", "Submitted to arXiv") to bookmark key checkpoints.'
                    : 'Changes will automatically be checkpointed as you compile and edit.'}
                </p>
              </div>
            ) : (
              groupedTimeline.map(({ groupName, items }) => (
                <div key={groupName} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    {groupName}
                  </div>

                  {items.map((item) => {
                    const isSelected = item.id === activeRevision?.id;
                    const dateMeta = formatRevisionDate(item.date);

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedEventId(item.id)}
                        className={cn(
                          'group relative rounded-md p-3 transition-all cursor-pointer select-none border',
                          isSelected
                            ? 'bg-primary/10 border-primary/40 text-foreground shadow-2xs'
                            : 'bg-muted/30 hover:bg-muted/60 border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {/* Header: Timestamp & Actions */}
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-xs font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>
                            {dateMeta.full}
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Version actions"
                                onClick={(e) => e.stopPropagation()}
                                className="size-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              >
                                <MoreVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 z-[9999]">
                              <DropdownMenuItem
                                onClick={() => {
                                  setLabelingItem(item);
                                  setLabelText(item.label || '');
                                  setLabelModalOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Tag className="size-3.5 mr-2 text-indigo-500" />
                                <span className="text-xs">
                                  {item.label ? 'Edit label' : 'Label this version'}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadVersionZip(item);
                                }}
                                className="cursor-pointer text-sky-500 focus:text-sky-600"
                              >
                                <Download className="size-3.5 mr-2" />
                                <span className="text-xs">Download ZIP of this version</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRestore()}
                                className="cursor-pointer text-primary focus:text-primary"
                              >
                                <RotateCcw className="size-3.5 mr-2" />
                                <span className="text-xs">Restore this version</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Label Badge if present */}
                        {item.label && (
                          <div className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-sm bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[11px] font-medium w-fit">
                            <Tag className="size-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{item.label}</span>
                          </div>
                        )}

                        {/* Status & Filename */}
                        <div className="text-xs text-foreground/90 mt-1.5 font-medium">
                          {item.eventType === 'collaborative_checkpoint'
                            ? 'Auto Checkpoint'
                            : item.eventType === 'restore'
                              ? 'Restored Version'
                              : 'Edited'}
                        </div>
                        <div className="text-11 text-muted-foreground font-mono truncate mt-0.5">
                          {item.fileName}
                        </div>

                        {/* Author Tag */}
                        <div className="flex items-center gap-1.5 mt-2 text-11 text-muted-foreground">
                          <span className="size-2 rounded-full bg-primary shrink-0" />
                          <span>{item.author}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Bottom Info Box */}
          <div className="p-3 border-t border-border bg-muted/20 text-xs">
            <h4 className="font-semibold text-foreground text-xs mb-1">
              Version History
            </h4>
            <p className="text-11 text-muted-foreground mb-2 leading-relaxed">
              Full version checkpoints and CRDT delta history with one-click snapshot rollback.
            </p>
            <div className="space-y-1 text-11 text-foreground/80">
              <div className="flex items-center gap-1.5">
                <Check className="size-3 text-primary shrink-0" />
                <span>Realtime Collaborative Restore</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="size-3 text-primary shrink-0" />
                <span>Monaco Side-by-Side Diff</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Label / Milestone Dialog Modal ─────────────────────────────────── */}
      <Dialog open={labelModalOpen} onOpenChange={setLabelModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-indigo-500" />
              <span>Label this version</span>
            </DialogTitle>
            <DialogDescription>
              Assign a milestone label to easily find and track this revision (e.g. &ldquo;Camera-Ready Submission&rdquo; or &ldquo;Pre-review Draft&rdquo;).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <Input
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="e.g. Conference Submission v1"
              className="text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveLabel();
                }
              }}
            />
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {labelingItem?.label ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setLabelText('');
                  handleSaveLabel();
                }}
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
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveLabel}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
