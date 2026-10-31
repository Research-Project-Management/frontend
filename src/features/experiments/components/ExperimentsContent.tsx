'use client';

import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUp,
  ArrowDown,
  Star,
  MoreVertical,
  GitCompare,
  Table2,
  Box,
  FileCode2,
  RotateCcw,
  Trash2,
  Download,
  Copy,
  CheckCircle2,
  Circle,
  Terminal,
  Eye,
  TrendingUp,
  Cpu,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  useExperimentsUIStore,
  type ExperimentsDisplayOptions,
} from '../store/experiments-ui.store';
import {
  MOCK_SWEEP,
  MOCK_REPRO_CAPSULE,
  type ExperimentRun,
} from '../data/mock-experiments.data';

const CHART_STROKES = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const CHART_DOT_CLASSES = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

export function ExperimentsContent() {
  const activeView = useExperimentsUIStore((s) => s.activeView);
  const setActiveView = useExperimentsUIStore((s) => s.setActiveView);
  const subMode = useExperimentsUIStore((s) => s.subMode);
  const runs = useExperimentsUIStore((s) => s.runs);
  const datasets = useExperimentsUIStore((s) => s.datasets);
  const checkpoints = useExperimentsUIStore((s) => s.checkpoints);
  const protocols = useExperimentsUIStore((s) => s.protocols);
  const toggleProtocolStep = useExperimentsUIStore((s) => s.toggleProtocolStep);
  const groups = useExperimentsUIStore((s) => s.groups);
  const selectedRunId = useExperimentsUIStore((s) => s.selectedRunId);
  const setSelectedRunId = useExperimentsUIStore((s) => s.setSelectedRunId);
  const checkedRunIds = useExperimentsUIStore((s) => s.checkedRunIds);
  const toggleCheckRun = useExperimentsUIStore((s) => s.toggleCheckRun);
  const selectAllRuns = useExperimentsUIStore((s) => s.selectAllRuns);
  const clearCheckedRuns = useExperimentsUIStore((s) => s.clearCheckedRuns);
  const topbarSearchQuery = useExperimentsUIStore((s) => s.topbarSearchQuery);
  const statusFilter = useExperimentsUIStore((s) => s.statusFilter);
  const deviceFilter = useExperimentsUIStore((s) => s.deviceFilter);
  const displayOptions = useExperimentsUIStore((s) => s.displayOptions);
  const setDisplayOptions = useExperimentsUIStore((s) => s.setDisplayOptions);
  const setInspectorOpen = useExperimentsUIStore((s) => s.setInspectorOpen);
  const toggleStarRun = useExperimentsUIStore((s) => s.toggleStarRun);
  const deleteRun = useExperimentsUIStore((s) => s.deleteRun);
  const restoreRun = useExperimentsUIStore((s) => s.restoreRun);
  const setPreviewArtifactName = useExperimentsUIStore(
    (s) => s.setPreviewArtifactName,
  );
  const setLatexModalOpen = useExperimentsUIStore((s) => s.setLatexModalOpen);
  const setLogRunModalOpen = useExperimentsUIStore((s) => s.setLogRunModalOpen);

  const currentGroup = groups.find((g) => g.id === activeView);
  const isTrashView = activeView === 'trash';

  // Filter and sort runs
  const visibleRuns = useMemo(() => {
    let list = runs.filter((r) =>
      isTrashView ? Boolean(r.isDeleted) : !r.isDeleted,
    );

    if (currentGroup) {
      list = list.filter((r) => r.experimentId === currentGroup.id);
    }

    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (deviceFilter) {
      list = list.filter((r) =>
        r.device.toLowerCase().includes(deviceFilter.toLowerCase()),
      );
    }

    const q = topbarSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.dataset.toLowerCase().includes(q) ||
          r.gitCommit.toLowerCase().includes(q),
      );
    }

    const dir = displayOptions.orderDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (displayOptions.orderBy) {
        case 'f1':
          return ((a.f1 ?? -1) - (b.f1 ?? -1)) * dir;
        case 'bleu':
          return ((a.bleu ?? -1) - (b.bleu ?? -1)) * dir;
        case 'loss':
          return ((a.loss ?? 999) - (b.loss ?? 999)) * dir;
        case 'id':
        default:
          return a.id.localeCompare(b.id) * dir;
      }
    });
  }, [
    runs,
    isTrashView,
    currentGroup,
    statusFilter,
    deviceFilter,
    topbarSearchQuery,
    displayOptions.orderBy,
    displayOptions.orderDirection,
  ]);

  const handleSort = (colKey: ExperimentsDisplayOptions['orderBy']) => {
    const nextDir =
      displayOptions.orderBy === colKey &&
      displayOptions.orderDirection === 'desc'
        ? 'asc'
        : 'desc';
    setDisplayOptions({
      ...displayOptions,
      orderBy: colKey,
      orderDirection: nextDir,
    });
  };

  const getAriaSort = (
    colKey: ExperimentsDisplayOptions['orderBy'],
  ): 'ascending' | 'descending' | 'none' => {
    if (displayOptions.orderBy !== colKey) return 'none';
    return displayOptions.orderDirection === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortIcon = (colKey: ExperimentsDisplayOptions['orderBy']) => {
    if (displayOptions.orderBy !== colKey) return null;
    return displayOptions.orderDirection === 'asc' ? (
      <ArrowUp
        className="size-3.5 text-foreground ml-1 shrink-0"
        strokeWidth={1.5}
      />
    ) : (
      <ArrowDown
        className="size-3.5 text-foreground ml-1 shrink-0"
        strokeWidth={1.5}
      />
    );
  };

  // ── 1. COMPARE RUNS (Table-first reading order, flush with Topbar) ──
  if (activeView === 'compare-runs') {
    const comparedRuns = runs.filter(
      (r) => checkedRunIds.includes(r.id) && !r.isDeleted,
    );
    const effectiveCompared =
      comparedRuns.length > 0 ? comparedRuns : runs.slice(0, 3);
    const bestF1 = Math.max(...effectiveCompared.map((r) => r.f1 ?? 0));
    const bestBleu = Math.max(...effectiveCompared.map((r) => r.bleu ?? 0));
    const minLoss = Math.min(...effectiveCompared.map((r) => r.loss ?? 999));

    const renderDiffSection = (
      title: string,
      rows: ReadonlyArray<{
        label: string;
        getter: (r: ExperimentRun) => string;
      }>,
    ) => (
      <>
        <tr className="bg-muted/20 h-7">
          <td
            colSpan={effectiveCompared.length + 1}
            className="px-3 font-semibold text-12 text-foreground"
          >
            {title}
          </td>
        </tr>
        {rows.map((row) => {
          const values = effectiveCompared.map(row.getter);
          const hasDiff = new Set(values).size > 1;
          return (
            <tr
              key={row.label}
              className={cn('h-8', hasDiff && 'bg-warning/5')}
            >
              <td className="px-3 font-medium text-muted-foreground border-r border-border flex items-center justify-between h-8">
                <span>{row.label}</span>
                {hasDiff && (
                  <span className="text-10 px-1.5 py-0.5 rounded bg-muted text-foreground font-medium">
                    diff
                  </span>
                )}
              </td>
              {effectiveCompared.map((r) => (
                <td
                  key={r.id}
                  className="px-3 font-mono tabular-nums text-12 text-foreground border-r border-border last:border-r-0"
                >
                  {row.getter(r)}
                </td>
              ))}
            </tr>
          );
        })}
      </>
    );

    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        {/* Primary Element: Full-width Comparison Matrix Table flush with Topbar */}
        <div className="w-full overflow-x-auto border-b border-border">
          <table className="w-full border-collapse text-13 text-left">
            <thead className="sticky top-0 z-10 bg-background select-none">
              <tr className="border-b border-border h-8 text-12 font-medium text-foreground">
                <th className="px-3 text-left w-48 border-r border-border bg-background">
                  Parameter
                </th>
                {effectiveCompared.map((r) => (
                  <th
                    key={r.id}
                    onClick={() => {
                      setSelectedRunId(r.id);
                      setInspectorOpen(true);
                    }}
                    className="px-3 text-left border-r border-border last:border-r-0 cursor-pointer hover:bg-muted transition-colors bg-background"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-11 font-medium px-1.5 py-0.5 rounded bg-muted text-foreground shrink-0">
                        {r.id}
                      </span>
                      <span className="font-medium text-foreground truncate">
                        {r.name}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-12">
              <tr className="bg-muted/20 h-7">
                <td
                  colSpan={effectiveCompared.length + 1}
                  className="px-3 font-semibold text-12 text-foreground"
                >
                  Evaluation Metrics
                </td>
              </tr>
              <tr className="h-8">
                <td className="px-3 font-medium text-muted-foreground border-r border-border">
                  Test F1
                </td>
                {effectiveCompared.map((r) => {
                  const isBest = r.f1 === bestF1;
                  return (
                    <td
                      key={r.id}
                      className={cn(
                        'px-3 font-mono tabular-nums border-r border-border last:border-r-0',
                        isBest && 'font-semibold text-foreground bg-primary/5',
                      )}
                    >
                      {r.f1 !== null ? `${r.f1.toFixed(2)}%` : '—'}
                      {r.f1Delta && (
                        <span className="text-11 text-muted-foreground ml-2">
                          {r.f1Delta}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="h-8">
                <td className="px-3 font-medium text-muted-foreground border-r border-border">
                  BLEU Score
                </td>
                {effectiveCompared.map((r) => {
                  const isBest = r.bleu === bestBleu;
                  return (
                    <td
                      key={r.id}
                      className={cn(
                        'px-3 font-mono tabular-nums border-r border-border last:border-r-0',
                        isBest && 'font-semibold text-foreground bg-primary/5',
                      )}
                    >
                      {r.bleu !== null ? r.bleu.toFixed(2) : '—'}
                    </td>
                  );
                })}
              </tr>
              <tr className="h-8">
                <td className="px-3 font-medium text-muted-foreground border-r border-border">
                  Eval Loss
                </td>
                {effectiveCompared.map((r) => {
                  const isBest = r.loss === minLoss;
                  return (
                    <td
                      key={r.id}
                      className={cn(
                        'px-3 font-mono tabular-nums border-r border-border last:border-r-0',
                        isBest && 'font-semibold text-foreground bg-primary/5',
                      )}
                    >
                      {r.loss !== null ? r.loss.toFixed(4) : '—'}
                    </td>
                  );
                })}
              </tr>

              {renderDiffSection('Hyperparameters', [
                {
                  label: 'Model',
                  getter: (r: ExperimentRun) => r.hyperparameters.backbone,
                },
                {
                  label: 'Learning Rate',
                  getter: (r: ExperimentRun) => r.hyperparameters.learningRate,
                },
                {
                  label: 'Batch Size',
                  getter: (r: ExperimentRun) => r.hyperparameters.batchSize,
                },
                {
                  label: 'Optimizer',
                  getter: (r: ExperimentRun) => r.hyperparameters.optimizer,
                },
                {
                  label: 'Warmup Ratio',
                  getter: (r: ExperimentRun) => r.hyperparameters.warmupRatio,
                },
                {
                  label: 'Dropout',
                  getter: (r: ExperimentRun) => r.hyperparameters.dropout,
                },
                {
                  label: 'Max Seq Length',
                  getter: (r: ExperimentRun) => r.hyperparameters.maxSeqLen,
                },
                {
                  label: 'Random Seed',
                  getter: (r: ExperimentRun) => String(r.hyperparameters.seed),
                },
              ])}

              {renderDiffSection('Reproducibility Lineage', [
                {
                  label: 'Dataset',
                  getter: (r: ExperimentRun) => r.dataset,
                },
                {
                  label: 'Dataset SHA256',
                  getter: (r: ExperimentRun) => r.datasetSha,
                },
                {
                  label: 'Protocol',
                  getter: (r: ExperimentRun) => r.protocolId,
                },
                {
                  label: 'Git Commit',
                  getter: (r: ExperimentRun) =>
                    `${r.gitBranch}@${r.gitCommit}`,
                },
                {
                  label: 'Hardware',
                  getter: (r: ExperimentRun) => r.device,
                },
                {
                  label: 'Duration',
                  getter: (r: ExperimentRun) => r.duration,
                },
              ])}
            </tbody>
          </table>
        </div>

        {/* Secondary Element: Trajectory Curves */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-12 font-semibold text-foreground">
                Validation F1 Across Epochs
              </span>
              <span className="inline-flex items-center gap-1 text-11 text-muted-foreground">
                <span>Higher is better</span>
                <ArrowUp className="size-3" strokeWidth={1.5} />
              </span>
            </div>
            <svg viewBox="0 0 360 110" className="w-full h-28 overflow-visible">
              <line
                x1="0"
                y1="20"
                x2="360"
                y2="20"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="55"
                x2="360"
                y2="55"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="90"
                x2="360"
                y2="90"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              {effectiveCompared.map((r, idx) => {
                const pts = r.valF1Curve
                  .map((v, i) => {
                    const x =
                      (i / Math.max(r.valF1Curve.length - 1, 1)) * 340 + 10;
                    const y = 95 - ((v - 60) / 35) * 75;
                    return `${x},${Math.max(10, Math.min(98, y))}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={r.id}
                    fill="none"
                    stroke={CHART_STROKES[idx % CHART_STROKES.length]}
                    strokeWidth={r.isSota ? '2.2' : '1.5'}
                    points={pts}
                  />
                );
              })}
            </svg>
            <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-border text-11 font-mono tabular-nums">
              {effectiveCompared.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      CHART_DOT_CLASSES[idx % CHART_DOT_CLASSES.length],
                    )}
                  />
                  <span className="text-foreground font-semibold">{r.id}</span>
                  <span className="text-muted-foreground">
                    {r.f1 !== null ? `${r.f1.toFixed(2)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-12 font-semibold text-foreground">
                Training Loss Convergence
              </span>
              <span className="inline-flex items-center gap-1 text-11 text-muted-foreground">
                <span>Lower is better</span>
                <ArrowDown className="size-3" strokeWidth={1.5} />
              </span>
            </div>
            <svg viewBox="0 0 360 110" className="w-full h-28 overflow-visible">
              <line
                x1="0"
                y1="20"
                x2="360"
                y2="20"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="55"
                x2="360"
                y2="55"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="90"
                x2="360"
                y2="90"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              {effectiveCompared.map((r, idx) => {
                const pts = r.lossCurve
                  .map((v, i) => {
                    const x =
                      (i / Math.max(r.lossCurve.length - 1, 1)) * 340 + 10;
                    const y = 95 - (v / 1.5) * 75;
                    return `${x},${Math.max(10, Math.min(98, y))}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={r.id}
                    fill="none"
                    stroke={CHART_STROKES[idx % CHART_STROKES.length]}
                    strokeWidth={r.isSota ? '2.2' : '1.5'}
                    points={pts}
                  />
                );
              })}
            </svg>
            <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-border text-11 font-mono tabular-nums">
              {effectiveCompared.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      CHART_DOT_CLASSES[idx % CHART_DOT_CLASSES.length],
                    )}
                  />
                  <span className="text-foreground font-semibold">{r.id}</span>
                  <span className="text-muted-foreground">
                    {r.loss !== null ? r.loss.toFixed(4) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. HYPERPARAMETER SWEEPS VIEW ──
  if (activeView === 'sweeps') {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        {/* Primary Element: Trial History Table flush with Topbar */}
        <div className="w-full overflow-x-auto border-b border-border">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-background select-none">
              <tr className="h-8 text-12 font-medium text-foreground border-b border-border">
                <th className="pl-3 pr-3 h-8">Trial</th>
                <th className="px-3 h-8">Run</th>
                <th className="px-3 h-8 text-right">learning_rate</th>
                <th className="px-3 h-8 text-right">warmup_ratio</th>
                <th className="px-3 h-8 text-right">batch_size</th>
                <th className="px-3 h-8 text-right">lora_rank</th>
                <th className="px-3 h-8 text-right">val/f1_macro</th>
                <th className="px-3 h-8 text-right">val/loss</th>
                <th className="px-3 h-8 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-12 font-mono tabular-nums">
              {MOCK_SWEEP.trials.map((t) => {
                const isBest = t.runId === MOCK_SWEEP.bestRunId;
                return (
                  <tr
                    key={t.trialId}
                    onClick={() => {
                      setSelectedRunId(t.runId);
                      setInspectorOpen(true);
                    }}
                    className={cn(
                      'h-8 hover:bg-muted cursor-pointer transition-colors',
                      isBest && 'bg-primary/5 font-semibold',
                    )}
                  >
                    <td className="pl-3 pr-3 text-foreground">{t.trialId}</td>
                    <td className="px-3 text-muted-foreground">{t.runId}</td>
                    <td className="px-3 text-right text-foreground">
                      {t.learningRate}
                    </td>
                    <td className="px-3 text-right text-foreground">
                      {t.warmupRatio.toFixed(2)}
                    </td>
                    <td className="px-3 text-right text-foreground">
                      {t.batchSize}
                    </td>
                    <td className="px-3 text-right text-foreground">
                      {t.loraRank}
                    </td>
                    <td className="px-3 text-right text-foreground">
                      {t.valF1.toFixed(2)}%
                    </td>
                    <td className="px-3 text-right text-muted-foreground">
                      {t.evalLoss.toFixed(4)}
                    </td>
                    <td className="px-3 text-right font-sans">
                      <span
                        className={cn(
                          'text-11 capitalize font-medium',
                          t.status === 'completed'
                            ? 'text-success'
                            : 'text-warning',
                        )}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Secondary Element: Parameter Importance + Parallel Coordinates */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-12 font-semibold text-foreground">
                Parameter Importance
              </h3>
              <span className="text-11 text-muted-foreground">
                Linear correlation
              </span>
            </div>

            <div className="space-y-2.5">
              {MOCK_SWEEP.parameterImportance.map((item) => {
                const pct = Math.round(Math.abs(item.correlation) * 100);
                return (
                  <div key={item.param} className="space-y-1">
                    <div className="flex items-center justify-between text-11 font-mono tabular-nums">
                      <span className="text-foreground font-medium">
                        {item.param}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'text-11',
                            item.impact === 'positive'
                              ? 'text-success'
                              : 'text-warning',
                          )}
                        >
                          {item.correlation > 0
                            ? `+${item.correlation}`
                            : item.correlation}
                        </span>
                        <span className="text-foreground font-semibold w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-background flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-12 font-semibold text-foreground">
                Parallel Coordinates
              </h3>
              <span className="text-11 text-muted-foreground font-mono">
                {MOCK_SWEEP.method} · Best {MOCK_SWEEP.bestRunId} (
                {MOCK_SWEEP.bestF1}%)
              </span>
            </div>

            <svg viewBox="0 0 420 135" className="w-full h-36 overflow-visible">
              {[
                {
                  x: 35,
                  label: 'learning_rate',
                  top: '1e-4',
                  bottom: '1e-5',
                },
                {
                  x: 150,
                  label: 'warmup_ratio',
                  top: '0.10',
                  bottom: '0.00',
                },
                {
                  x: 265,
                  label: 'syntactic_mask',
                  top: 'true',
                  bottom: 'false',
                },
                {
                  x: 385,
                  label: 'val/f1_macro',
                  top: '90.0%',
                  bottom: '80.0%',
                },
              ].map((axis) => (
                <g key={axis.label}>
                  <line
                    x1={axis.x}
                    y1="18"
                    x2={axis.x}
                    y2="110"
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="1.5"
                  />
                  <text
                    x={axis.x}
                    y="10"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-mono"
                  >
                    {axis.top}
                  </text>
                  <text
                    x={axis.x}
                    y="122"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-mono"
                  >
                    {axis.bottom}
                  </text>
                  <text
                    x={axis.x}
                    y="133"
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-mono font-medium"
                  >
                    {axis.label}
                  </text>
                </g>
              ))}

              <polyline
                fill="none"
                stroke="var(--destructive)"
                strokeWidth="1.2"
                strokeOpacity="0.5"
                points="35,20 150,110 265,105 385,105"
              />
              <polyline
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1.3"
                strokeOpacity="0.6"
                points="35,98 150,85 265,100 385,78"
              />
              <polyline
                fill="none"
                stroke="var(--chart-3)"
                strokeWidth="1.5"
                strokeOpacity="0.75"
                points="35,55 150,35 265,24 385,48"
              />
              <polyline
                fill="none"
                stroke="var(--chart-2)"
                strokeWidth="1.7"
                strokeOpacity="0.85"
                points="35,78 150,62 265,24 385,38"
              />
              <polyline
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="1.8"
                strokeOpacity="0.85"
                points="35,84 150,55 265,24 385,29"
              />
              <polyline
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.6"
                points="35,78 150,55 265,24 385,22"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. PROTOCOLS & SOPs VIEW ──
  if (activeView === 'protocols') {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background p-4 space-y-4">
        {protocols.map((proto) => {
          const doneCount = proto.steps.filter((s) => s.isVerified).length;
          return (
            <div
              key={proto.id}
              className="rounded-lg border border-border bg-background overflow-hidden"
            >
              <div className="p-3.5 border-b border-border bg-muted/20 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-11 font-semibold px-1.5 py-0.5 rounded bg-background border border-border text-foreground">
                      {proto.code}
                    </span>
                    <span className="font-mono text-11 px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {proto.version}
                    </span>
                    <span className="text-13 font-semibold text-foreground">
                      {proto.title}
                    </span>
                  </div>
                  <p className="text-12 text-muted-foreground max-w-3xl">
                    {proto.abstract}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-11 text-muted-foreground">
                  <span className="font-mono">DOI: {proto.doi}</span>
                  <span>
                    {proto.author} ·{' '}
                    <span className="font-mono tabular-nums">
                      {doneCount}/{proto.steps.length}
                    </span>{' '}
                    verified
                  </span>
                </div>
              </div>

              <div className="divide-y divide-border">
                {proto.steps.map((st) => (
                  <div
                    key={st.stepNumber}
                    onClick={() => toggleProtocolStep(proto.id, st.stepNumber)}
                    className="p-3 hover:bg-muted/40 transition-colors cursor-pointer flex items-start gap-3"
                  >
                    <button
                      type="button"
                      className="mt-0.5 text-foreground shrink-0 cursor-pointer"
                      aria-label={`Toggle step ${st.stepNumber}`}
                    >
                      {st.isVerified ? (
                        <CheckCircle2
                          className="size-4 text-success"
                          strokeWidth={1.8}
                        />
                      ) : (
                        <Circle
                          className="size-4 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-12 font-semibold',
                            st.isVerified
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {st.stepNumber}. {st.title}
                        </span>
                        <span className="font-mono tabular-nums text-11 text-muted-foreground">
                          {st.duration}
                        </span>
                      </div>
                      {st.commandOrAction && (
                        <div className="px-2.5 py-1.5 rounded bg-muted/60 font-mono text-11 text-foreground flex items-center justify-between gap-2">
                          <span className="truncate">
                            $ {st.commandOrAction}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard?.writeText(
                                st.commandOrAction,
                              );
                              toast.success('Copied command');
                            }}
                            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                            aria-label="Copy command"
                          >
                            <Copy className="size-3" strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                      <div className="text-11 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Output:
                        </span>{' '}
                        <span className="font-mono">{st.expectedOutput}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── 4. REPRODUCIBILITY CAPSULE & DVC DAG VIEW ──
  if (activeView === 'reproducibility') {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        {/* Primary Element: Pipeline Stages Table flush with Topbar */}
        <div className="w-full overflow-x-auto border-b border-border">
          <table className="w-full border-collapse text-left text-12">
            <thead className="sticky top-0 z-10 bg-background select-none">
              <tr className="h-8 border-b border-border text-foreground font-medium">
                <th className="pl-3 pr-3 h-8 w-20">Stage</th>
                <th className="px-3 h-8 w-44">Step</th>
                <th className="px-3 h-8">Command</th>
                <th className="px-3 h-8">Inputs / Outputs</th>
                <th className="px-3 h-8 text-right w-28">Lock MD5</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MOCK_REPRO_CAPSULE.dvcStages.map((stage, idx) => (
                <tr
                  key={stage.stage}
                  className="h-9 hover:bg-muted/40 transition-colors"
                >
                  <td className="pl-3 pr-3 font-mono tabular-nums text-11 text-muted-foreground">
                    0{idx + 1}
                  </td>
                  <td className="px-3 font-mono text-12 font-medium text-foreground">
                    {stage.stage}
                  </td>
                  <td className="px-3 font-mono text-11 text-foreground">
                    $ {stage.cmd}
                  </td>
                  <td className="px-3 font-mono text-11 text-muted-foreground">
                    <span>In: {stage.deps.join(', ')}</span>
                    <span className="mx-1.5 text-border">·</span>
                    <span>Out: {stage.outs.join(', ')}</span>
                  </td>
                  <td className="px-3 text-right font-mono text-11 text-success">
                    {stage.md5}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Secondary Element: Runtime Specs & Pinned Dependencies */}
        <div className="p-4 space-y-4">
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 font-mono text-12 text-foreground">
              <Terminal
                className="size-4 text-muted-foreground shrink-0"
                strokeWidth={1.5}
              />
              <span className="truncate">
                $ {MOCK_REPRO_CAPSULE.reproCommand}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(MOCK_REPRO_CAPSULE.reproCommand);
                toast.success('Copied reproduce command');
              }}
              className="h-7 px-2.5 text-12 cursor-pointer shrink-0"
            >
              <Copy className="size-3.5 mr-1.5" strokeWidth={1.5} />
              <span>Copy Command</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-border bg-background space-y-2 text-12">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Cpu className="size-4" strokeWidth={1.5} />
                <span>Container Runtime</span>
              </div>
              <div className="divide-y divide-border pt-1 font-mono text-11">
                <div className="flex justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">
                    Base Image
                  </span>
                  <span className="text-foreground">
                    {MOCK_REPRO_CAPSULE.baseImage}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">
                    Docker Digest
                  </span>
                  <span className="text-foreground">
                    {MOCK_REPRO_CAPSULE.dockerDigest}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">
                    Linked Run
                  </span>
                  <span className="text-foreground">
                    {MOCK_REPRO_CAPSULE.linkedRunId}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="font-sans text-muted-foreground">
                    Python / CUDA
                  </span>
                  <span className="text-foreground">
                    {MOCK_REPRO_CAPSULE.pythonVersion} ·{' '}
                    {MOCK_REPRO_CAPSULE.cudaVersion}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-background space-y-2 text-12">
              <div className="font-semibold text-foreground">
                Pinned Dependencies
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                {MOCK_REPRO_CAPSULE.packages.map((pkg) => (
                  <div
                    key={pkg}
                    className="py-1 border-b border-border font-mono text-11 text-foreground truncate"
                  >
                    {pkg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 5. RAW CORPUS & TABLES VIEW ──
  if (activeView === 'raw-corpus') {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background select-none">
            <tr className="h-8 text-foreground font-medium text-12 border-b border-border">
              <th className="pl-3 pr-3 h-8">Dataset</th>
              <th className="px-3 h-8">Version</th>
              <th className="px-3 h-8">Format</th>
              <th className="px-3 h-8">SHA256</th>
              <th className="px-3 h-8 text-right">Records</th>
              <th className="px-3 h-8 text-right">Size</th>
              <th className="px-3 h-8 text-right">Runs</th>
              <th className="px-3 h-8 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((ds) => (
              <tr
                key={ds.id}
                onClick={() => setPreviewArtifactName('eval_predictions.csv')}
                className="h-8 text-13 border-b border-border hover:bg-muted cursor-pointer transition-colors"
              >
                <td className="pl-3 pr-3 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Table2
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="truncate font-mono text-12">
                      {ds.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 font-mono text-12">
                  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {ds.version}
                  </span>
                </td>
                <td className="px-3 font-mono text-11 text-muted-foreground">
                  {ds.format}
                </td>
                <td className="px-3 font-mono text-11 text-muted-foreground">
                  {ds.sha256}
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 text-foreground">
                  {ds.rows}
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 text-muted-foreground">
                  {ds.size}
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 text-foreground">
                  {ds.linkedRunsCount}
                </td>
                <td className="px-3 text-right text-12 text-muted-foreground">
                  {ds.updatedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── 6. CHECKPOINTS & WEIGHTS VIEW ──
  if (activeView === 'checkpoints') {
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background select-none">
            <tr className="h-8 text-foreground font-medium text-12 border-b border-border">
              <th className="pl-3 pr-3 h-8">Checkpoint</th>
              <th className="px-3 h-8">Run</th>
              <th className="px-3 h-8">Architecture</th>
              <th className="px-3 h-8">Stage</th>
              <th className="px-3 h-8 text-right">Val F1</th>
              <th className="px-3 h-8 text-right">Size</th>
              <th className="px-3 h-8 text-right">Created</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((ckpt) => (
              <tr
                key={ckpt.id}
                onClick={() => {
                  setSelectedRunId(ckpt.runId);
                  setInspectorOpen(true);
                  setPreviewArtifactName(ckpt.name);
                }}
                className="h-8 text-13 border-b border-border hover:bg-muted cursor-pointer transition-colors"
              >
                <td className="pl-3 pr-3 font-mono text-12 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Box
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{ckpt.name}</span>
                  </div>
                </td>
                <td className="px-3 font-mono text-12 text-foreground">
                  {ckpt.runId}
                </td>
                <td className="px-3 text-12 text-foreground">
                  {ckpt.architecture}
                </td>
                <td className="px-3 text-11">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded font-medium',
                      ckpt.stage === 'Production'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {ckpt.stage}
                  </span>
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 font-semibold text-foreground">
                  {ckpt.f1Score.toFixed(2)}%
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 text-muted-foreground">
                  {ckpt.size}
                </td>
                <td className="px-3 text-right text-12 text-muted-foreground">
                  {ckpt.updatedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── 7. ANALYSIS NOTEBOOKS VIEW ──
  if (activeView === 'notebooks') {
    const notebooks = [
      {
        id: 'nb-01',
        name: 'ablation_attention_viz.ipynb',
        runId: 'run-042',
        kernel: 'Python 3.11 · PyTorch 2.4 · CUDA 12.1',
        size: '842 KB',
        updated: '12 mins ago',
      },
      {
        id: 'nb-02',
        name: 'hard_negatives_confusion.ipynb',
        runId: 'run-029',
        kernel: 'Python 3.11 · PyTorch 2.4',
        size: '612 KB',
        updated: '4 days ago',
      },
      {
        id: 'nb-03',
        name: 'overfit_loss_curve_analysis.ipynb',
        runId: 'run-021',
        kernel: 'Python 3.11 · Matplotlib',
        size: '520 KB',
        updated: '1 week ago',
      },
      {
        id: 'nb-04',
        name: 'frozen_layers_speedup.ipynb',
        runId: 'run-015',
        kernel: 'Python 3.11 · Triton',
        size: '410 KB',
        updated: '2 weeks ago',
      },
    ];
    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background select-none">
            <tr className="h-8 text-foreground font-medium text-12 border-b border-border">
              <th className="pl-3 pr-3 h-8">Notebook</th>
              <th className="px-3 h-8">Run</th>
              <th className="px-3 h-8">Kernel</th>
              <th className="px-3 h-8 text-right">Size</th>
              <th className="px-3 h-8 text-right">Updated</th>
              <th className="px-3 h-8 text-right">Preview</th>
            </tr>
          </thead>
          <tbody>
            {notebooks.map((nb) => (
              <tr
                key={nb.id}
                onClick={() => {
                  setSelectedRunId(nb.runId);
                  setInspectorOpen(true);
                  setPreviewArtifactName(nb.name);
                }}
                className="h-8 text-13 border-b border-border hover:bg-muted cursor-pointer transition-colors"
              >
                <td className="pl-3 pr-3 font-mono text-12 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <FileCode2
                      className="size-4 text-foreground shrink-0"
                      strokeWidth={1.5}
                    />
                    <span>{nb.name}</span>
                  </div>
                </td>
                <td className="px-3 font-mono text-12 text-foreground">
                  {nb.runId}
                </td>
                <td className="px-3 font-mono text-11 text-muted-foreground">
                  {nb.kernel}
                </td>
                <td className="px-3 text-right font-mono tabular-nums text-12 text-muted-foreground">
                  {nb.size}
                </td>
                <td className="px-3 text-right text-12 text-muted-foreground">
                  {nb.updated}
                </td>
                <td className="px-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1 text-12 text-muted-foreground hover:text-foreground">
                    <Eye className="size-3.5" strokeWidth={1.5} />
                    <span>Open</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── 8. CHARTS SUBMODE ──
  if (subMode === 'charts') {
    const chartRuns = visibleRuns.filter((r) => r.valF1Curve.length > 1);

    return (
      <div className="flex flex-col h-full w-full overflow-y-auto bg-background">
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel 1: Val F1 Progression */}
          <div className="p-3.5 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp
                  className="size-3.5 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-12 font-semibold text-foreground">
                  val/f1_macro
                </span>
              </div>
              <span className="text-11 text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {chartRuns.length}
                </span>{' '}
                runs
              </span>
            </div>
            <svg viewBox="0 0 380 130" className="w-full h-36 overflow-visible">
              <line
                x1="0"
                y1="20"
                x2="380"
                y2="20"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="65"
                x2="380"
                y2="65"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="110"
                x2="380"
                y2="110"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              {chartRuns.map((r, idx) => {
                const pts = r.valF1Curve
                  .map((v, i) => {
                    const x =
                      (i / Math.max(r.valF1Curve.length - 1, 1)) * 360 + 10;
                    const y = 115 - ((v - 60) / 32) * 95;
                    return `${x},${Math.max(10, Math.min(118, y))}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={r.id}
                    fill="none"
                    stroke={CHART_STROKES[idx % CHART_STROKES.length]}
                    strokeWidth={r.id === selectedRunId ? '2.5' : '1.5'}
                    points={pts}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedRunId(r.id);
                      setInspectorOpen(true);
                    }}
                  />
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border text-11 font-mono tabular-nums">
              {chartRuns.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(r.id);
                    setInspectorOpen(true);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 px-1.5 py-0.5 rounded cursor-pointer',
                    r.id === selectedRunId
                      ? 'bg-muted font-semibold'
                      : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      CHART_DOT_CLASSES[idx % CHART_DOT_CLASSES.length],
                    )}
                  />
                  <span className="text-foreground">{r.id}</span>
                  <span className="text-muted-foreground">
                    {r.f1 !== null ? `${r.f1.toFixed(1)}%` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Panel 2: Train Loss Decay */}
          <div className="p-3.5 rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-12 font-semibold text-foreground">
                train/cross_entropy_loss
              </span>
              <span className="text-11 text-muted-foreground">Convergence</span>
            </div>
            <svg viewBox="0 0 380 130" className="w-full h-36 overflow-visible">
              <line
                x1="0"
                y1="20"
                x2="380"
                y2="20"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="65"
                x2="380"
                y2="65"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              <line
                x1="0"
                y1="110"
                x2="380"
                y2="110"
                stroke="currentColor"
                className="text-border"
                strokeDasharray="3 3"
              />
              {chartRuns.map((r, idx) => {
                const pts = r.lossCurve
                  .map((v, i) => {
                    const x =
                      (i / Math.max(r.lossCurve.length - 1, 1)) * 360 + 10;
                    const y = 115 - (v / 1.5) * 95;
                    return `${x},${Math.max(10, Math.min(118, y))}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={r.id}
                    fill="none"
                    stroke={CHART_STROKES[idx % CHART_STROKES.length]}
                    strokeWidth={r.id === selectedRunId ? '2.5' : '1.5'}
                    points={pts}
                  />
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border text-11 font-mono tabular-nums">
              {chartRuns.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      CHART_DOT_CLASSES[idx % CHART_DOT_CLASSES.length],
                    )}
                  />
                  <span className="text-foreground">{r.id}</span>
                  <span className="text-muted-foreground">
                    {r.loss !== null ? r.loss.toFixed(4) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3: Model Comparison Bar Chart */}
          <div className="p-3.5 rounded-lg border border-border bg-background lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-12 font-semibold text-foreground">
                Benchmark Summary
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLatexModalOpen(true)}
                className="h-7 px-2.5 text-11 cursor-pointer"
              >
                <Copy className="size-3 mr-1.5" strokeWidth={1.5} />
                <span>Export LaTeX</span>
              </Button>
            </div>
            <div className="space-y-2.5">
              {visibleRuns
                .filter((r) => r.f1 !== null)
                .map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRunId(r.id);
                      setInspectorOpen(true);
                    }}
                    className="space-y-1 cursor-pointer hover:bg-muted/30 p-1.5 rounded transition-colors"
                  >
                    <div className="flex items-center justify-between text-11 font-mono tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {r.id}
                        </span>
                        <span className="font-sans text-muted-foreground">
                          {r.name}
                        </span>
                      </div>
                      <span className="text-foreground font-semibold">
                        F1 {r.f1?.toFixed(2)}% · BLEU {r.bleu?.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          r.isSota ? 'bg-chart-1' : 'bg-foreground/75',
                        )}
                        style={{
                          width: `${Math.max(15, ((r.f1 ?? 75) - 70) * 4)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 9. MAIN EXPERIMENT RUNS TABLE (Flush with Topbar, matching ItemTableHeader & ItemTableRow) ──
  const allVisibleIds = visibleRuns.map((r) => r.id);
  const isAllSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => checkedRunIds.includes(id));

  const bestF1InView = Math.max(
    ...visibleRuns.map((r) => (r.f1 !== null ? r.f1 : -1)),
  );

  const batchBarPortal =
    checkedRunIds.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-md select-none shadow-raised-200 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span className="text-12 font-medium text-foreground px-1">
              <span className="font-mono tabular-nums">
                {checkedRunIds.length}
              </span>{' '}
              selected
            </span>

            <div className="h-3.5 w-px bg-border mx-1" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('compare-runs')}
              className="h-8 px-2.5 gap-1.5 text-12 font-normal text-foreground hover:bg-muted rounded-xs cursor-pointer transition-colors"
            >
              <GitCompare className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Compare</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLatexModalOpen(true)}
              className="h-8 px-2.5 gap-1.5 text-12 font-normal text-foreground hover:bg-muted rounded-xs cursor-pointer transition-colors"
            >
              <Download className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Export LaTeX</span>
            </Button>

            <div className="h-3.5 w-px bg-border mx-1" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearCheckedRuns}
              aria-label="Clear selection"
              className="size-8 rounded-xs text-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              <X className="size-3.5 shrink-0" strokeWidth={1.5} />
            </Button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background relative">
      {/* Runs Table flush at y=44px matching Library */}
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background select-none">
            <tr className="h-8 text-foreground font-medium text-12">
              <th
                scope="col"
                aria-sort={getAriaSort('id')}
                className="pl-1.5 pr-3 h-8 py-0 align-middle font-medium select-none text-left bg-background border-b border-border"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Select all runs"
                    onClick={() => {
                      if (isAllSelected) clearCheckedRuns();
                      else selectAllRuns(allVisibleIds);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (isAllSelected) clearCheckedRuns();
                        else selectAllRuns(allVisibleIds);
                      }
                    }}
                    className={cn(
                      'relative size-5 flex items-center justify-center rounded shrink-0 cursor-pointer transition-opacity before:absolute before:-inset-1.5 md:before:hidden',
                      isAllSelected || checkedRunIds.length > 0
                        ? 'opacity-100'
                        : 'opacity-0 hover:opacity-100 focus-within:opacity-100',
                    )}
                  >
                    <Checkbox
                      checked={isAllSelected}
                      tabIndex={-1}
                      className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="flex items-center gap-1 cursor-pointer text-foreground text-12 font-medium outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
                  >
                    <span>Run</span>
                    {renderSortIcon('id')}
                  </button>
                </div>
              </th>

              {displayOptions.columns.status && (
                <th
                  scope="col"
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border"
                >
                  Status
                </th>
              )}

              {activeView === 'all-runs' &&
                displayOptions.columns.experiment && (
                  <th
                    scope="col"
                    className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border"
                  >
                    Experiment
                  </th>
                )}

              {displayOptions.columns.model && (
                <th
                  scope="col"
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border"
                >
                  Model
                </th>
              )}

              {displayOptions.columns.dataset && (
                <th
                  scope="col"
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border"
                >
                  Dataset
                </th>
              )}

              {displayOptions.columns.f1 && (
                <th
                  scope="col"
                  tabIndex={0}
                  aria-sort={getAriaSort('f1')}
                  onClick={() => handleSort('f1')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('f1');
                    }
                  }}
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-right bg-background border-b border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>F1</span>
                    {renderSortIcon('f1')}
                  </div>
                </th>
              )}

              {displayOptions.columns.bleu && (
                <th
                  scope="col"
                  tabIndex={0}
                  aria-sort={getAriaSort('bleu')}
                  onClick={() => handleSort('bleu')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('bleu');
                    }
                  }}
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-right bg-background border-b border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>BLEU</span>
                    {renderSortIcon('bleu')}
                  </div>
                </th>
              )}

              {displayOptions.columns.loss && (
                <th
                  scope="col"
                  tabIndex={0}
                  aria-sort={getAriaSort('loss')}
                  onClick={() => handleSort('loss')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('loss');
                    }
                  }}
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-right bg-background border-b border-border cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Loss</span>
                    {renderSortIcon('loss')}
                  </div>
                </th>
              )}

              {displayOptions.columns.duration && (
                <th
                  scope="col"
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-right bg-background border-b border-border"
                >
                  Duration
                </th>
              )}

              {displayOptions.columns.updatedAt && (
                <th
                  scope="col"
                  className="px-3 h-8 py-0 align-middle font-medium text-foreground text-right bg-background border-b border-border"
                >
                  Created
                </th>
              )}

              <th
                scope="col"
                aria-label="Actions"
                className="w-11 px-1.5 h-8 py-0 align-middle bg-background border-b border-border"
              />
            </tr>
          </thead>

          <tbody>
            {visibleRuns.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="py-16 text-center text-13 text-muted-foreground"
                >
                  {isTrashView
                    ? 'Trash is empty.'
                    : 'No runs match the active filters.'}
                </td>
              </tr>
            ) : (
              visibleRuns.map((run, idx) => {
                const isSelected = selectedRunId === run.id;
                const isChecked = checkedRunIds.includes(run.id);
                const isBestF1 =
                  run.f1 !== null && run.f1 === bestF1InView && bestF1InView > 0;
                const isLast = idx === visibleRuns.length - 1;

                return (
                  <tr
                    key={run.id}
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setInspectorOpen(true);
                    }}
                    className={cn(
                      'cursor-pointer group text-13 h-8 transition-colors',
                      !isLast && 'border-b border-border',
                      isChecked
                        ? 'bg-primary/10 font-medium'
                        : isSelected
                          ? 'bg-muted'
                          : 'hover:bg-muted',
                    )}
                  >
                    {/* Run ID + Name matching ItemTableRow */}
                    <td className="pl-1.5 pr-3 py-0 align-middle max-w-[300px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Select run ${run.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCheckRun(run.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleCheckRun(run.id);
                            }
                          }}
                          className={cn(
                            'relative size-5 flex items-center justify-center rounded shrink-0 cursor-pointer transition-opacity before:absolute before:-inset-1.5 md:before:hidden',
                            !isChecked &&
                              'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            tabIndex={-1}
                            className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
                          />
                        </div>
                        <span className="truncate text-foreground">
                          {run.name}
                        </span>
                        {run.isStarred && (
                          <Star
                            className="size-3 fill-warning text-warning shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    {displayOptions.columns.status && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-12">
                          <span
                            className={cn(
                              'size-2 rounded-full shrink-0',
                              run.status === 'completed'
                                ? 'bg-success'
                                : run.status === 'running'
                                  ? 'bg-warning animate-pulse'
                                  : 'bg-destructive',
                            )}
                          />
                          <span className="capitalize text-foreground">
                            {run.status}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Experiment Group */}
                    {activeView === 'all-runs' &&
                      displayOptions.columns.experiment && (
                        <td className="px-3 py-0 align-middle whitespace-nowrap text-12 text-muted-foreground">
                          <span className="font-mono text-11 px-1.5 py-0.5 rounded bg-muted text-foreground">
                            {run.experimentId.toUpperCase()}
                          </span>
                        </td>
                      )}

                    {/* Model */}
                    {displayOptions.columns.model && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap text-12 text-foreground max-w-[200px] truncate">
                        {run.model}
                      </td>
                    )}

                    {/* Dataset */}
                    {displayOptions.columns.dataset && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap font-mono text-11 text-muted-foreground">
                        {run.dataset}
                      </td>
                    )}

                    {/* F1 */}
                    {displayOptions.columns.f1 && (
                      <td
                        className={cn(
                          'px-3 py-0 align-middle whitespace-nowrap text-right font-mono text-12 tabular-nums',
                          isBestF1
                            ? 'font-semibold text-foreground'
                            : 'text-foreground',
                        )}
                      >
                        {run.f1 !== null ? run.f1.toFixed(2) : '—'}
                      </td>
                    )}

                    {/* BLEU */}
                    {displayOptions.columns.bleu && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap text-right font-mono text-12 tabular-nums text-foreground">
                        {run.bleu !== null ? run.bleu.toFixed(2) : '—'}
                      </td>
                    )}

                    {/* Loss */}
                    {displayOptions.columns.loss && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap text-right font-mono text-12 tabular-nums text-muted-foreground">
                        {run.loss !== null ? run.loss.toFixed(4) : '—'}
                      </td>
                    )}

                    {/* Duration */}
                    {displayOptions.columns.duration && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap text-right font-mono tabular-nums text-11 text-muted-foreground">
                        {run.duration}
                      </td>
                    )}

                    {/* UpdatedAt */}
                    {displayOptions.columns.updatedAt && (
                      <td className="px-3 py-0 align-middle whitespace-nowrap text-right text-12 text-muted-foreground">
                        {run.updatedAt}
                      </td>
                    )}

                    {/* Row Actions matching ItemRowActions */}
                    <td
                      className="w-11 px-1.5 py-0 align-middle text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Run actions"
                            className="relative size-7 rounded-md text-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-muted transition-all cursor-pointer select-none before:absolute before:-inset-2 md:before:hidden"
                          >
                            <MoreVertical
                              className="size-3.5 text-foreground"
                              strokeWidth={1.5}
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={4}
                          onCloseAutoFocus={(e) => e.preventDefault()}
                          className="w-48 p-1.5 rounded-lg border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none space-y-0.5"
                        >
                          <DropdownMenuItem
                            onClick={() => toggleStarRun(run.id)}
                            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                          >
                            <Star
                              className={cn(
                                'size-4 shrink-0',
                                run.isStarred
                                  ? 'fill-warning text-warning'
                                  : 'text-foreground',
                              )}
                              strokeWidth={1.5}
                            />
                            <span>
                              {run.isStarred ? 'Unpin Run' : 'Pin Run'}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!checkedRunIds.includes(run.id)) {
                                toggleCheckRun(run.id);
                              }
                              setActiveView('compare-runs');
                            }}
                            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                          >
                            <GitCompare
                              className="size-4 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                            <span>Compare Run</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLatexModalOpen(true)}
                            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                          >
                            <Download
                              className="size-4 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                            <span>Export LaTeX Table</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          {isTrashView ? (
                            <DropdownMenuItem
                              onClick={() => {
                                restoreRun(run.id);
                                toast.success(`Restored ${run.id}`);
                              }}
                              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                            >
                              <RotateCcw
                                className="size-4 text-foreground shrink-0"
                                strokeWidth={1.5}
                              />
                              <span>Restore Run</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                deleteRun(run.id);
                                toast.success(`Moved ${run.id} to Trash`);
                              }}
                              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive rounded-md hover:bg-destructive/10 focus:bg-destructive/10 outline-none transition-colors"
                            >
                              <Trash2
                                className="size-4 text-destructive shrink-0"
                                strokeWidth={1.5}
                              />
                              <span>Move to Trash</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {batchBarPortal}
    </div>
  );
}
export default ExperimentsContent;
