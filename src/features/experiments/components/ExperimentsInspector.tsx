'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Info,
  SlidersHorizontal,
  TrendingUp,
  GitBranch,
  Paperclip,
  StickyNote,
  PanelRight,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Table2,
  Box,
  FileCode2,
  Terminal,
  ClipboardCheck,
  Container,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import {
  useExperimentsUIStore,
  type ExperimentsInspectorTab,
} from '../store/experiments-ui.store';

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

interface TabItem {
  id: ExperimentsInspectorTab;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  badge?: number;
}

export function ExperimentsInspector() {
  const isInspectorOpen = useExperimentsUIStore((s) => s.isInspectorOpen);
  const toggleInspector = useExperimentsUIStore((s) => s.toggleInspector);
  const width = useExperimentsUIStore((s) => s.inspectorWidth);
  const setWidth = useExperimentsUIStore((s) => s.setInspectorWidth);
  const activeTab = useExperimentsUIStore((s) => s.activeInspectorTab);
  const setActiveTab = useExperimentsUIStore((s) => s.setActiveInspectorTab);
  const selectedRunId = useExperimentsUIStore((s) => s.selectedRunId);
  const runs = useExperimentsUIStore((s) => s.runs);
  const groups = useExperimentsUIStore((s) => s.groups);
  const updateRunNotes = useExperimentsUIStore((s) => s.updateRunNotes);
  const setActiveView = useExperimentsUIStore((s) => s.setActiveView);
  const setPreviewArtifactName = useExperimentsUIStore(
    (s) => s.setPreviewArtifactName,
  );

  const selectedRun = runs.find((r) => r.id === selectedRunId) || runs[0];
  const selectedGroup = groups.find(
    (g) => g.id === selectedRun?.experimentId,
  );

  const [expandedSections, setExpandedSections] = useState<
    Record<ExperimentsInspectorTab, boolean>
  >({
    overview: true,
    params: true,
    metrics: true,
    lineage: true,
    artifacts: true,
    logs: true,
    notes: true,
  });

  const [copiedSha, setCopiedSha] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedSection, setHighlightedSection] = useState<ExperimentsInspectorTab | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      setIsMobile(mql.matches);
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, []);

  const { isDragging, handleMouseDown } = usePanelResize({
    width,
    setWidth,
    direction: 'left',
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
  });

  if (!isInspectorOpen) {
    return null;
  }

  const toggleSection = (id: ExperimentsInspectorTab) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleTabChange = (tabId: ExperimentsInspectorTab) => {
    setActiveTab(tabId);
    setExpandedSections((prev) => ({ ...prev, [tabId]: true }));
    setHighlightedSection(tabId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedSection(null);
    }, 900);

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const el = document.getElementById(`exp-inspector-section-${tabId}`);
      if (container && el) {
        const containerRect = container.getBoundingClientRect();
        const sectionRect = el.getBoundingClientRect();
        const targetTop = Math.max(
          0,
          container.scrollTop + (sectionRect.top - containerRect.top),
        );
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'metrics', label: 'Metrics', icon: TrendingUp },
    { id: 'params', label: 'Hyperparameters', icon: SlidersHorizontal },
    { id: 'lineage', label: 'Lineage', icon: GitBranch },
    {
      id: 'artifacts',
      label: 'Artifacts',
      icon: Paperclip,
      badge: selectedRun?.artifacts.length || 0,
    },
    {
      id: 'logs',
      label: 'Execution Logs',
      icon: Terminal,
      badge: selectedRun?.stdoutLogs?.length || 0,
    },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ];

  const renderSectionHeader = (
    id: ExperimentsInspectorTab,
    title: string,
    count?: number,
  ) => {
    const isExpanded = expandedSections[id];
    const isHighlighted = highlightedSection === id;
    return (
      <div
        onClick={() => toggleSection(id)}
        className={cn(
          'flex items-center justify-between px-2.5 h-8 box-border select-none transition-colors w-full cursor-pointer hover:bg-muted/50',
          isHighlighted && 'bg-muted/80',
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono tabular-nums font-medium text-foreground px-1.5 py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSection(id);
          }}
          className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors"
          aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
        >
          {isExpanded ? (
            <ChevronDown
              className="size-3.5 text-foreground shrink-0"
              strokeWidth={1.5}
            />
          ) : (
            <ChevronRight
              className="size-3.5 text-foreground shrink-0"
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>
    );
  };

  const renderFieldRow = (label: string, content: React.ReactNode) => (
    <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
      <div className="text-11 text-muted-foreground font-normal select-none leading-none text-right">
        {label}
      </div>
      <div className="min-w-0">{content}</div>
    </div>
  );

  const inspectorBody = selectedRun ? (
    <>
      {/* Header matching InspectorHeader of Library */}
      <div className="h-11 px-2.5 flex items-center justify-between gap-2 w-full min-w-0 border-b border-border bg-background shrink-0 select-none">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-13 font-semibold tracking-tight text-foreground truncate">
            {selectedRun.name}
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={toggleInspector}
            className="size-8 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
            aria-label="Close inspector"
          >
            <X className="size-4 shrink-0" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Scrollable Sections matching LibraryInspector */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[60vh] bg-background inspector-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* 1. Overview (matching GeneralFields 2-col layout) */}
        <div
          id="exp-inspector-section-overview"
          className="border-b border-border w-full"
        >
          {renderSectionHeader('overview', 'Overview')}
          {expandedSections.overview && (
            <div className="px-2.5 pt-1 pb-2 flex flex-col gap-0.5">
              {renderFieldRow(
                'Status',
                <div className="flex items-center gap-1.5 h-7 px-2 py-1 text-13">
                  <span
                    className={cn(
                      'size-2 rounded-full shrink-0',
                      selectedRun.status === 'completed'
                        ? 'bg-success'
                        : selectedRun.status === 'running'
                          ? 'bg-warning animate-pulse'
                          : 'bg-destructive',
                    )}
                  />
                  <span className="font-medium capitalize text-foreground">
                    {selectedRun.status}
                  </span>
                </div>,
              )}

              {renderFieldRow(
                'Experiment',
                <div className="h-7 px-2 py-1 rounded-md text-13 text-foreground truncate flex items-center">
                  <span className="truncate">{selectedRun.experimentName}</span>
                </div>,
              )}

              {selectedGroup?.hypothesis && (
                <div className="grid grid-cols-[84px_1fr] gap-2 items-start py-1">
                  <div className="text-11 text-muted-foreground font-normal select-none leading-none text-right pt-1">
                    Hypothesis
                  </div>
                  <div className="px-2 py-0.5 text-12 text-foreground leading-relaxed">
                    {selectedGroup.hypothesis}
                  </div>
                </div>
              )}

              {selectedGroup?.paperRef &&
                renderFieldRow(
                  'Reference',
                  <div className="h-7 px-2 py-1 rounded-md text-12 text-foreground truncate flex items-center">
                    <span className="truncate">{selectedGroup.paperRef}</span>
                  </div>,
                )}

              {renderFieldRow(
                'Hardware',
                <div className="h-7 px-2 py-1 rounded-md font-mono text-12 text-foreground truncate flex items-center">
                  <span className="truncate">{selectedRun.device}</span>
                </div>,
              )}

              {renderFieldRow(
                'Duration',
                <div className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-12 text-foreground flex items-center">
                  <span>{selectedRun.duration}</span>
                </div>,
              )}

              {renderFieldRow(
                'Author',
                <div className="h-7 px-2 py-1 rounded-md text-13 text-foreground truncate flex items-center">
                  <span className="truncate">{selectedRun.author}</span>
                </div>,
              )}
            </div>
          )}
        </div>

        {/* 2. Evaluation Metrics */}
        <div
          id="exp-inspector-section-metrics"
          className="border-b border-border w-full"
        >
          {renderSectionHeader('metrics', 'Metrics')}
          {expandedSections.metrics && (
            <div className="px-2.5 pt-1 pb-2 flex flex-col gap-0.5">
              {renderFieldRow(
                'Test F1',
                <div className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-13 font-medium text-foreground flex items-center gap-2">
                  <span>
                    {selectedRun.f1 !== null
                      ? `${selectedRun.f1.toFixed(2)}%`
                      : '—'}
                  </span>
                  {selectedRun.f1Delta && (
                    <span className="text-11 font-normal text-muted-foreground">
                      {selectedRun.f1Delta}
                    </span>
                  )}
                </div>,
              )}

              {renderFieldRow(
                'BLEU Score',
                <div className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-13 text-foreground flex items-center">
                  <span>
                    {selectedRun.bleu !== null
                      ? selectedRun.bleu.toFixed(2)
                      : '—'}
                  </span>
                </div>,
              )}

              {renderFieldRow(
                'Eval Loss',
                <div className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-13 text-foreground flex items-center">
                  <span>
                    {selectedRun.loss !== null
                      ? selectedRun.loss.toFixed(4)
                      : '—'}
                  </span>
                </div>,
              )}

              {renderFieldRow(
                'Loss Curve',
                <div className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-11 text-muted-foreground flex items-center truncate">
                  <span className="truncate">
                    {selectedRun.lossCurve.join(' → ')}
                  </span>
                </div>,
              )}
            </div>
          )}
        </div>

        {/* 3. Hyperparameters */}
        <div
          id="exp-inspector-section-params"
          className="border-b border-border w-full"
        >
          {renderSectionHeader('params', 'Hyperparameters')}
          {expandedSections.params && (
            <div className="px-2.5 pt-1 pb-2 flex flex-col gap-0.5">
              {Object.entries({
                Backbone: selectedRun.hyperparameters.backbone,
                'Learn Rate': selectedRun.hyperparameters.learningRate,
                'Batch Size': selectedRun.hyperparameters.batchSize,
                Optimizer: selectedRun.hyperparameters.optimizer,
                Warmup: selectedRun.hyperparameters.warmupRatio,
                'Max Seq': selectedRun.hyperparameters.maxSeqLen,
                Dropout: selectedRun.hyperparameters.dropout,
                Seed: String(selectedRun.hyperparameters.seed),
              }).map(([label, val]) =>
                renderFieldRow(
                  label,
                  <div
                    key={label}
                    className="h-7 px-2 py-1 rounded-md font-mono tabular-nums text-12 text-foreground truncate flex items-center hover:bg-muted/60 transition-colors"
                  >
                    <span className="truncate">{val}</span>
                  </div>,
                ),
              )}
            </div>
          )}
        </div>

        {/* 4. Data, Protocol & Code Lineage (Reproducibility) */}
        <div
          id="exp-inspector-section-lineage"
          className="border-b border-border w-full"
        >
          {renderSectionHeader('lineage', 'Lineage')}
          {expandedSections.lineage && (
            <div className="px-2.5 pt-1 pb-2 flex flex-col gap-0.5">
              {renderFieldRow(
                'Dataset',
                <div className="flex items-center justify-between gap-1.5 h-7 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors">
                  <span className="font-mono text-12 text-foreground truncate">
                    {selectedRun.dataset}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveView('raw-corpus')}
                    className="inline-flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    aria-label="Inspect dataset"
                  >
                    <ExternalLink className="size-3" strokeWidth={1.5} />
                  </button>
                </div>,
              )}

              {renderFieldRow(
                'SHA256',
                <div className="flex items-center justify-between gap-1.5 h-7 px-2 py-1 rounded-md hover:bg-muted/60 transition-colors">
                  <span className="font-mono text-11 text-muted-foreground truncate">
                    {selectedRun.datasetSha}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        typeof navigator !== 'undefined' &&
                        navigator.clipboard
                      ) {
                        void navigator.clipboard.writeText(
                          selectedRun.datasetSha,
                        );
                      }
                      setCopiedSha(true);
                      setTimeout(() => setCopiedSha(false), 1500);
                      toast.success('Copied dataset SHA256 digest');
                    }}
                    className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer shrink-0"
                    aria-label="Copy SHA256"
                  >
                    {copiedSha ? (
                      <Check className="size-3" strokeWidth={1.5} />
                    ) : (
                      <Copy className="size-3" strokeWidth={1.5} />
                    )}
                  </button>
                </div>,
              )}

              {renderFieldRow(
                'Git Commit',
                <div className="flex items-center gap-1.5 h-7 px-2 py-1 font-mono text-12 text-foreground">
                  <GitBranch className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span>{selectedRun.gitBranch}</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted text-11">
                    #{selectedRun.gitCommit}
                  </span>
                </div>,
              )}

              {renderFieldRow(
                'Protocol',
                <button
                  type="button"
                  onClick={() => setActiveView('protocols')}
                  className="inline-flex items-center gap-1.5 h-7 px-2 py-1 rounded-md text-12 text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <ClipboardCheck
                    className="size-3.5 shrink-0"
                    strokeWidth={1.5}
                  />
                  <span className="font-mono">SOP-01 · v2.1</span>
                  <ExternalLink
                    className="size-3 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </button>,
              )}

              {renderFieldRow(
                'Capsule',
                <button
                  type="button"
                  onClick={() => setActiveView('reproducibility')}
                  className="inline-flex items-center gap-1.5 h-7 px-2 py-1 rounded-md text-12 text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Container className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span>CUDA 12.1 · DVC DAG</span>
                  <ExternalLink
                    className="size-3 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </button>,
              )}
            </div>
          )}
        </div>

        {/* 5. Linked Artifacts */}
        <div
          id="exp-inspector-section-artifacts"
          className="border-b border-border w-full"
        >
          {renderSectionHeader(
            'artifacts',
            'Artifacts',
            selectedRun.artifacts.length,
          )}
          {expandedSections.artifacts && (
            <div className="px-2.5 pt-1 pb-2 flex flex-col gap-0.5">
              {selectedRun.artifacts.map((art) => {
                const ArtIcon =
                  art.type === 'hdf5'
                    ? Box
                    : art.type === 'csv'
                      ? Table2
                      : FileCode2;
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => setPreviewArtifactName(art.name)}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors text-left w-full"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ArtIcon
                        className="size-4 text-foreground shrink-0"
                        strokeWidth={1.5}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-12 text-foreground truncate">
                          {art.name}
                        </span>
                        <span className="font-mono text-11 text-muted-foreground">
                          {art.type} · {art.size}
                        </span>
                      </div>
                    </div>
                    <ExternalLink
                      className="size-3.5 text-muted-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Execution Logs */}
        <div
          id="exp-inspector-section-logs"
          className="border-b border-border w-full"
        >
          {renderSectionHeader(
            'logs',
            'Execution Logs',
            selectedRun.stdoutLogs?.length || 0,
          )}
          {expandedSections.logs && (
            <div className="px-2.5 pt-1 pb-2.5">
              <div className="p-2 rounded-md border border-border bg-muted/30 font-mono text-11 text-foreground space-y-1 max-h-40 overflow-y-auto leading-relaxed">
                {(selectedRun.stdoutLogs || []).map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      'break-all',
                      line.includes('ERROR')
                        ? 'text-destructive font-semibold'
                        : line.includes('WARN')
                          ? 'text-warning'
                          : 'text-foreground/90',
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 7. Lab Notes */}
        <div id="exp-inspector-section-notes" className="w-full">
          {renderSectionHeader('notes', 'Notes')}
          {expandedSections.notes && (
            <div className="px-2.5 pt-1 pb-3">
              <textarea
                rows={4}
                aria-label="Observation and lab notes"
                value={selectedRun.notes}
                onChange={(e) => updateRunNotes(selectedRun.id, e.target.value)}
                placeholder="Write observations, convergence behavior, or manuscript table references..."
                className="w-full rounded-md border border-border bg-transparent p-2 text-13 text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  const mobileDrawer =
    isMobile && isMounted && typeof document !== 'undefined'
      ? createPortal(
          <div className="md:hidden">
            <div
              onClick={toggleInspector}
              className="fixed inset-0 bg-black/50 z-40"
              aria-hidden="true"
            />
            <aside
              aria-label="Run Inspector"
              className="fixed inset-y-0 right-0 z-50 w-[calc(100vw-32px)] max-w-sm h-full border-l border-border bg-background flex flex-col select-text shadow-raised-200"
            >
              {inspectorBody}
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {mobileDrawer}
      <div className="flex h-full min-h-full self-stretch shrink-0 select-none">
        {!isMobile && isInspectorOpen && (
          <aside
            style={{ width: `${width}px` }}
            className={cn(
              'relative h-full min-h-full self-stretch border-l border-border bg-background flex flex-col shrink-0 select-text',
              isDragging && 'select-none transition-none',
            )}
          >
            {/* Resize Handle matching LibraryInspector */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              aria-label="Resize inspector panel"
              tabIndex={0}
              onMouseDown={handleMouseDown}
              onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 40 : 16;
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setWidth(Math.min(MAX_WIDTH, width + step));
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setWidth(Math.max(MIN_WIDTH, width - step));
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setWidth(MIN_WIDTH);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setWidth(MAX_WIDTH);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  setWidth(DEFAULT_WIDTH);
                }
              }}
              className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-30 flex items-center justify-center group focus-visible:outline-none"
              title="Drag to resize · Double-click to reset"
            >
              <div
                className={cn(
                  'w-0.5 h-full transition-colors duration-150 group-hover:bg-primary group-focus-visible:bg-primary',
                  isDragging && 'bg-primary',
                )}
              />
            </div>

            {inspectorBody}
          </aside>
        )}

        {/* Right Vertical Icon Rail matching InspectorTabs */}
        <aside
          aria-label="Inspector panel bar"
          className="w-10 shrink-0 h-full min-h-full self-stretch border-l border-border bg-background flex flex-col items-center select-none z-20"
        >
          <div className="h-11 w-full flex items-center justify-center shrink-0 border-b border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleInspector}
                  className="size-8 flex items-center justify-center rounded-md outline-none transition-colors text-foreground hover:bg-muted cursor-pointer focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Collapse inspector"
                >
                  <PanelRight
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={6}>
                Collapse inspector
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col items-center gap-1 w-full px-1 pt-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = isInspectorOpen && activeTab === tab.id;
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={cn(
                        'relative size-8 flex items-center justify-center rounded-md outline-none transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-primary',
                        isActive
                          ? 'bg-muted text-foreground font-semibold'
                          : 'text-foreground hover:bg-muted font-normal',
                      )}
                      aria-label={tab.label}
                    >
                      <Icon
                        className="size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={6} className="text-11">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{tab.label}</span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="text-10 px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono tabular-nums">
                          {tab.badge}
                        </span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex-1" />
        </aside>
      </div>
    </>
  );
}
export default ExperimentsInspector;
