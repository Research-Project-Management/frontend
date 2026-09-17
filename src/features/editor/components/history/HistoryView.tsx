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
} from 'lucide-react';
import MonacoEditor, { DiffEditor } from '@monaco-editor/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import { filesQuery } from '@/features/editor/hooks/use-core';
import {
  versionsQuery,
  useProjectHistory,
  useVersionActions,
  useHistoryActions,
} from '@/features/editor/hooks/use-history';
import { versionService } from '@/features/editor/services/history.service';
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
  const { currentPage, activeFilePage, editorRef } = usePageStore();
  const { setIsHistoryOpen, editorTheme } = useSettingsStore();

  const rootPageId = params?.pageId || params?.projectId || '';
  const [timelineTab, setTimelineTab] = useState<'all' | 'labels'>('all');

  // Load project history events & versions
  const { history: events = [], isLoading: eventsLoading } = useProjectHistory(rootPageId);
  const { data: pageFiles = [] } = useQuery({
    ...filesQuery(rootPageId),
    enabled: !!rootPageId,
  });

  const { restoreToEvent } = useHistoryActions();
  const { restoreVersion } = useVersionActions();

  // Selected revision state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(activeFilePage?.id || null);

  // Content of the active file at the selected revision
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [compareTargetId, setCompareTargetId] = useState<string>('current');
  const [comparisonContent, setComparisonContent] = useState<string>('');

  const currentFileContent = useMemo(() => {
    const f = pageFiles.find((p: any) => p.id === activeFileId);
    return f?.content || editorRef.current?.getValue() || '';
  }, [pageFiles, activeFileId, editorRef]);

  // Default active file
  useEffect(() => {
    if (!activeFileId && pageFiles.length > 0) {
      setActiveFileId(pageFiles[0].id);
    }
  }, [activeFileId, pageFiles]);

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
        author: ev.savedBy?.name || 'You',
        pageId: ev.page,
      }));
    }
    return [];
  }, [events, activeFilePage]);

  // Set initial selected revision
  useEffect(() => {
    if (timelineItems.length > 0 && !selectedEventId) {
      setSelectedEventId(timelineItems[0].id);
    }
  }, [timelineItems, selectedEventId]);

  // Filtered timeline (All history vs Labels)
  const filteredItems = useMemo(() => {
    if (timelineTab === 'labels') {
      return timelineItems.filter((i) => Boolean(i.label));
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
        // 1. Try to load content from specific version
        const versions = await versionService.getByPageId(activeFileId);
        if (versions && versions.length > 0) {
          const match = versions.find((v) => v.id === selectedVersionId) || versions[0];
          const fullVersion = await versionService.getById(activeFileId, match.id);
          if (!isCancelled && fullVersion?.content !== undefined) {
            setPreviewContent(fullVersion.content);
            setIsLoadingContent(false);
            return;
          }
        }

        // 2. Fallback to current file content
        const activeFile = pageFiles.find((f: any) => f.id === activeFileId);
        if (!isCancelled) {
          setPreviewContent(activeFile?.content || editorRef.current?.getValue() || '');
          setIsLoadingContent(false);
        }
      } catch (err) {
        if (!isCancelled) {
          const activeFile = pageFiles.find((f: any) => f.id === activeFileId);
          setPreviewContent(activeFile?.content || '');
          setIsLoadingContent(false);
        }
      }
    }

    loadContent();
    return () => {
      isCancelled = true;
    };
  }, [activeFileId, selectedVersionId, selectedEventId, pageFiles, editorRef]);

  // Fetch content for comparison target version
  useEffect(() => {
    if (!diffMode) return;
    if (compareTargetId === 'current') {
      setComparisonContent(currentFileContent);
      return;
    }

    let isCancelled = false;
    async function loadTargetContent() {
      if (!activeFileId) return;
      try {
        const versions = await versionService.getByPageId(activeFileId);
        if (versions && versions.length > 0) {
          const match = versions.find((v) => v.id === compareTargetId) || versions[0];
          const fullVersion = await versionService.getById(activeFileId, match.id);
          if (!isCancelled && fullVersion?.content !== undefined) {
            setComparisonContent(fullVersion.content);
            return;
          }
        }
        if (!isCancelled) {
          setComparisonContent(currentFileContent);
        }
      } catch {
        if (!isCancelled) {
          setComparisonContent(currentFileContent);
        }
      }
    }
    loadTargetContent();
    return () => {
      isCancelled = true;
    };
  }, [diffMode, compareTargetId, activeFileId, currentFileContent]);

  // Handle Restore
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

  const formattedDate = formatRevisionDate(activeRevision?.date);

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-background text-foreground select-none z-50 animate-in fade-in duration-200">
      {/* ── 1. Top Navigation Bar (Overleaf 1:1) ────────────────────────────── */}
      <header className="h-11 border-b border-border bg-[#1b222d] dark:bg-[#161a22] flex items-center justify-between px-3 shrink-0 text-white">
        {/* Left: Back to Editor Pill Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(false)}
            className="flex items-center gap-2 h-7 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer outline-none border border-white/10"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            <span>Back to editor</span>
          </button>
        </div>

        {/* Center: Project Title */}
        <div className="flex items-center gap-1 text-xs font-semibold text-zinc-200 hover:text-white cursor-pointer">
          <span>{currentPage?.title || 'Project'}</span>
          <ChevronDown className="size-3 opacity-60 ml-0.5" />
        </div>

        {/* Right: Close & Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
            History View Mode
          </span>
        </div>
      </header>

      {/* ── 2. Three-Column Main Workspace ──────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Pane: Modified Files in this Revision (Width ~220px) ───── */}
        <div className="w-56 shrink-0 border-r border-border bg-background flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
            {pageFiles.length === 0 ? (
              <div
                className={cn(
                  'flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium cursor-pointer transition-colors',
                  'bg-[#1b5e3a] dark:bg-[#1a5632] text-white',
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{activeRevision?.fileName || 'name.tex'}</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/20 text-white leading-none">
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
                        ? 'bg-[#1b5e3a] dark:bg-[#1a5632] text-white shadow-2xs'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{file.title || 'untitled.tex'}</span>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded leading-none shrink-0',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      Edited
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Center Pane: Diff & Document Viewer (Flex-1) ───────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          {/* Subheader Banner matching Overleaf */}
          <div className="h-9 px-4 border-b border-border bg-secondary/30 flex items-center justify-between text-xs shrink-0 select-none">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground/90">
                Viewing {formattedDate.full}
              </span>
              <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
                <button
                  type="button"
                  onClick={() => setDiffMode(false)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                    !diffMode
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  onClick={() => setDiffMode(true)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                    diffMode
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Compare Diff
                </button>
              </div>

              {diffMode && (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-[11px] text-muted-foreground">Compare against:</span>
                  <select
                    value={compareTargetId}
                    onChange={(e) => setCompareTargetId(e.target.value)}
                    className="h-6 px-1.5 text-[11px] font-medium rounded border border-border bg-background text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
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
            </div>
            <span className="text-muted-foreground font-mono text-11">
              {activeRevision?.fileName || 'name.tex'}
            </span>
          </div>

          {/* Monaco Code / Snapshot or Diff Viewer */}
          <div className="flex-1 relative overflow-hidden bg-[var(--editor-bg,hsl(var(--background)))]">
            {diffMode ? (
              <DiffEditor
                height="100%"
                language="latex"
                original={comparisonContent || currentFileContent}
                modified={previewContent}
                theme={editorTheme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'var(--font-mono, Menlo, Monaco, "Courier New", monospace)',
                  lineHeight: 22,
                  wordWrap: 'on',
                }}
              />
            ) : (
              <MonacoEditor
                height="100%"
                language="latex"
                value={previewContent}
                theme={editorTheme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  fontSize: 14,
                  fontFamily: 'var(--font-mono, Menlo, Monaco, "Courier New", monospace)',
                  lineHeight: 22,
                  folding: true,
                  renderLineHighlight: 'none',
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'auto',
                  },
                }}
              />
            )}
          </div>
        </div>

        {/* ── Right Pane: History Timeline & Versions Panel (Width ~320px) ─ */}
        <div className="w-80 shrink-0 border-l border-border bg-[#1b222d] dark:bg-[#161a22] flex flex-col text-white overflow-hidden select-none">
          {/* Top Switcher: [ All history | Labels ] */}
          <div className="p-3 border-b border-border/40 shrink-0">
            <div className="flex items-center rounded-full bg-black/40 p-0.5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setTimelineTab('all')}
                className={cn(
                  'flex-1 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer text-center',
                  timelineTab === 'all'
                    ? 'bg-[#16a34a] text-white shadow-2xs'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                All history
              </button>
              <button
                type="button"
                onClick={() => setTimelineTab('labels')}
                className={cn(
                  'flex-1 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer text-center',
                  timelineTab === 'labels'
                    ? 'bg-[#16a34a] text-white shadow-2xs'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                Labels
              </button>
            </div>
          </div>

          {/* Timeline Revisions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {eventsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400 text-xs gap-2">
                <Clock className="size-5 animate-spin opacity-50" />
                <span>Loading revision history…</span>
              </div>
            ) : groupedTimeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400 text-xs text-center p-4">
                <Clock className="size-8 opacity-25 mb-2" />
                <p className="font-semibold text-zinc-200">No revisions found</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Changes will automatically be checkpointed as you compile and edit.
                </p>
              </div>
            ) : (
              groupedTimeline.map(({ groupName, items }) => (
                <div key={groupName} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">
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
                          'group relative rounded-lg p-3 transition-all cursor-pointer select-none border',
                          isSelected
                            ? 'bg-[#155e2e] dark:bg-[#124d25] border-emerald-500/50 text-white shadow-md'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 text-zinc-300',
                        )}
                      >
                        {/* Header: Timestamp & Actions */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold truncate text-white">
                            {dateMeta.full}
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label="Version actions"
                                onClick={(e) => e.stopPropagation()}
                                className="size-6 flex items-center justify-center rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                              >
                                <MoreVertical className="size-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 z-[9999]">
                              <DropdownMenuItem
                                onClick={() => handleRestore()}
                                className="cursor-pointer"
                              >
                                <RotateCcw className="size-3.5 mr-2 text-emerald-600" />
                                <span className="text-xs">Restore this version</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Status & Filename */}
                        <div className="text-xs text-white/90 mt-1 font-medium">
                          Edited
                        </div>
                        <div className="text-11 text-white/70 font-mono truncate mt-0.5">
                          {item.fileName}
                        </div>

                        {/* Author Tag */}
                        <div className="flex items-center gap-1.5 mt-2 text-11 text-white/80">
                          <span className="size-2 rounded-2xs bg-cyan-400 shrink-0" />
                          <span>{item.author}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Bottom Info Box: Overleaf 1:1 Parity Feature Promotion */}
          <div className="p-3 border-t border-border/40 bg-black/20 text-xs">
            <h4 className="font-semibold text-white text-xs mb-1">
              Get full project history
            </h4>
            <p className="text-11 text-zinc-400 mb-2 leading-relaxed">
              You&apos;re currently seeing the full revision history and checkpoints for this project.
            </p>
            <div className="space-y-1 text-11 text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Check className="size-3 text-emerald-400 shrink-0" />
                <span>Full document version checkpoints</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="size-3 text-emerald-400 shrink-0" />
                <span>One-click snapshot rollback</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="size-3 text-emerald-400 shrink-0" />
                <span>Collaborator presence & tracking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
