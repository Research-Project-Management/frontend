'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileSpreadsheet,
  Terminal,
  FileCode2,
  Activity,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useExperimentsUIStore } from '../store/experiments-ui.store';
import { MOCK_ARTIFACT_PREVIEW_CONTENT } from '../data/mock-experiments.data';

export function ExperimentsModals() {
  const previewArtifactName = useExperimentsUIStore(
    (s) => s.previewArtifactName,
  );
  const setPreviewArtifactName = useExperimentsUIStore(
    (s) => s.setPreviewArtifactName,
  );
  const isLogRunModalOpen = useExperimentsUIStore((s) => s.isLogRunModalOpen);
  const setLogRunModalOpen = useExperimentsUIStore((s) => s.setLogRunModalOpen);
  const isLatexModalOpen = useExperimentsUIStore((s) => s.isLatexModalOpen);
  const setLatexModalOpen = useExperimentsUIStore((s) => s.setLatexModalOpen);

  const runs = useExperimentsUIStore((s) => s.runs);
  const checkedRunIds = useExperimentsUIStore((s) => s.checkedRunIds);
  const groups = useExperimentsUIStore((s) => s.groups);
  const datasets = useExperimentsUIStore((s) => s.datasets);
  const addRun = useExperimentsUIStore((s) => s.addRun);

  const [runName, setRunName] = useState('phobert-large-syntactic-v3');
  const [expId, setExpId] = useState('exp-01');
  const [backbone, setBackbone] = useState('vinai/phobert-large');
  const [datasetName, setDatasetName] = useState('vi-academic-corpus-v2.csv');
  const [lr, setLr] = useState('2e-5');
  const [batchSize, setBatchSize] = useState('32');
  const [f1Val, setF1Val] = useState('89.65');
  const [bleuVal, setBleuVal] = useState('44.50');
  const [lossVal, setLossVal] = useState('0.1790');
  const [copiedLatex, setCopiedLatex] = useState(false);

  const handleCreateRun = (e: React.FormEvent) => {
    e.preventDefault();
    const nextNum = 43 + runs.length - 12;
    const newId = `run-0${nextNum}`;
    const grp = groups.find((g) => g.id === expId) || groups[0];
    const parsedF1 = parseFloat(f1Val) || 88.5;
    const parsedBleu = parseFloat(bleuVal) || 43.0;
    const parsedLoss = parseFloat(lossVal) || 0.21;

    addRun({
      id: newId,
      name: runName || `run-${nextNum}`,
      experimentId: grp.id,
      experimentName: grp.name,
      status: 'completed',
      model: backbone,
      dataset: datasetName,
      datasetSha: 'sha256:9f84c2a1b0e7',
      gitBranch: 'main',
      gitCommit: 'f49c20e',
      protocolId: 'prot-01',
      capsuleId: 'cap-01',
      device: '2x A100 80GB',
      f1: parsedF1,
      f1Delta: `${parsedF1 >= 87.1 ? '+' : ''}${(parsedF1 - 87.1).toFixed(2)}%`,
      bleu: parsedBleu,
      loss: parsedLoss,
      duration: '1h 12m',
      updatedAt: 'Just now',
      author: 'Khoa Nguyen',
      isStarred: true,
      isSota: parsedF1 > 89.42,
      notes: 'Logged from workspace run dialog.',
      hyperparameters: {
        backbone,
        learningRate: lr,
        batchSize,
        optimizer: 'AdamW',
        warmupRatio: '0.06',
        maxSeqLen: '512',
        seed: 42,
        dropout: '0.1',
      },
      lossCurve: [1.4, 0.94, 0.65, 0.46, 0.33, 0.25, 0.2, parsedLoss],
      valF1Curve: [72.0, 79.1, 83.4, 86.2, 87.9, 88.8, 89.3, parsedF1],
      stdoutLogs: [
        `[2026-10-31 10:30:00] INFO | Initialized ${newId} on 2x A100`,
        `[2026-10-31 10:30:05] INFO | Dataset ${datasetName} verified · sha256:9f84c2a1b0e7`,
        `[2026-10-31 10:31:00] DONE | Final Test F1=${parsedF1.toFixed(2)}% | BLEU=${parsedBleu.toFixed(2)} | Loss=${parsedLoss.toFixed(4)}`,
      ],
      artifacts: [
        {
          id: `art-${Date.now()}-1`,
          name: `checkpoint_${newId}_best.h5`,
          size: '1.42 GB',
          type: 'hdf5',
        },
        {
          id: `art-${Date.now()}-2`,
          name: 'eval_predictions_test.csv',
          size: '4.8 MB',
          type: 'csv',
        },
      ],
    });

    setLogRunModalOpen(false);
    toast.success(`Logged ${newId} to ${grp.code}`);
  };

  // LaTeX Table Generator
  const targetRunsForLatex =
    checkedRunIds.length > 0
      ? runs.filter((r) => checkedRunIds.includes(r.id) && !r.isDeleted)
      : runs.slice(0, 4);
  const maxLatexF1 = Math.max(...targetRunsForLatex.map((r) => r.f1 ?? 0));
  const maxLatexBleu = Math.max(...targetRunsForLatex.map((r) => r.bleu ?? 0));
  const minLatexLoss = Math.min(
    ...targetRunsForLatex.map((r) => r.loss ?? 999),
  );

  const latexCode = `\\begin{table}[htbp]
\\centering
\\caption{Experimental comparison on Vietnamese Scientific Claim Verification (\\texttt{vi-academic-corpus-v2}). Best results are in \\textbf{bold}.}
\\label{tab:nckh_main_results}
\\begin{tabular}{llccc}
\\toprule
\\textbf{Run ID} & \\textbf{Model} & \\textbf{Test F1 (\\%)} $\\uparrow$ & \\textbf{BLEU} $\\uparrow$ & \\textbf{Eval Loss} $\\downarrow$ \\\\
\\midrule
${targetRunsForLatex
  .map((r) => {
    const f1Str =
      r.f1 !== null
        ? r.f1 === maxLatexF1
          ? `\\textbf{${r.f1.toFixed(2)}}`
          : r.f1.toFixed(2)
        : '—';
    const bleuStr =
      r.bleu !== null
        ? r.bleu === maxLatexBleu
          ? `\\textbf{${r.bleu.toFixed(2)}}`
          : r.bleu.toFixed(2)
        : '—';
    const lossStr =
      r.loss !== null
        ? r.loss === minLatexLoss
          ? `\\textbf{${r.loss.toFixed(4)}}`
          : r.loss.toFixed(4)
        : '—';
    return `\\texttt{${r.id}} & ${r.model.replace(/&/g, '\\&')} & ${f1Str} & ${bleuStr} & ${lossStr} \\\\`;
  })
  .join('\n')}
\\bottomrule
\\end{tabular}
\\end{table}`;

  const isCsvPreview = previewArtifactName?.endsWith('.csv');
  const isNotebookPreview = previewArtifactName?.endsWith('.ipynb');
  const rawPreviewContent = previewArtifactName
    ? MOCK_ARTIFACT_PREVIEW_CONTENT[previewArtifactName] ||
      MOCK_ARTIFACT_PREVIEW_CONTENT['eval_predictions_test.csv']
    : '';

  return (
    <>
      {/* 1. Artifact Viewer Modal */}
      <Dialog
        open={Boolean(previewArtifactName)}
        onOpenChange={(open) => {
          if (!open) setPreviewArtifactName(null);
        }}
      >
        <DialogContent className="max-w-[920px] w-[92vw] max-h-[85vh] p-0 flex flex-col overflow-hidden border border-border bg-background shadow-raised-200">
          <DialogHeader className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-muted flex items-center justify-center border border-border">
                  {isCsvPreview ? (
                    <FileSpreadsheet
                      className="size-4 text-foreground"
                      strokeWidth={1.5}
                    />
                  ) : isNotebookPreview ? (
                    <Terminal
                      className="size-4 text-foreground"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <FileCode2
                      className="size-4 text-foreground"
                      strokeWidth={1.5}
                    />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-13 font-semibold font-mono text-foreground">
                    {previewArtifactName}
                  </DialogTitle>
                  <p className="text-11 text-muted-foreground">
                    Read-only artifact snapshot
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-background">
            {isCsvPreview ? (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-12 border-collapse text-left font-mono">
                  <thead className="bg-muted/60 border-b border-border">
                    <tr className="h-8">
                      <th className="px-3 border-r border-border">sample_id</th>
                      <th className="px-3 border-r border-border">claim_text</th>
                      <th className="px-3 border-r border-border">gold</th>
                      <th className="px-3 border-r border-border">pred</th>
                      <th className="px-3 border-r border-border text-right">
                        conf
                      </th>
                      <th className="px-3 text-center">match</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rawPreviewContent
                      .split('\n')
                      .slice(1)
                      .map((line, idx) => {
                        const parts =
                          line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        const id = parts[0] || `00${idx + 1}`;
                        const claim = (parts[1] || '').replace(/^"|"$/g, '');
                        const gold = parts[2] || 'SUPPORTS';
                        const pred = parts[3] || 'SUPPORTS';
                        const conf = parts[4] || '0.95';
                        const ok = parts[6] === 'true';
                        return (
                          <tr key={idx} className="h-8 hover:bg-muted/40">
                            <td className="px-3 border-r border-border text-muted-foreground">
                              {id}
                            </td>
                            <td className="px-3 border-r border-border font-sans text-foreground max-w-[380px] truncate">
                              {claim}
                            </td>
                            <td className="px-3 border-r border-border text-11">
                              {gold}
                            </td>
                            <td className="px-3 border-r border-border text-11 font-semibold">
                              {pred}
                            </td>
                            <td className="px-3 border-r border-border text-right tabular-nums">
                              {conf}
                            </td>
                            <td className="px-3 text-center font-sans">
                              <span
                                className={
                                  ok
                                    ? 'px-1.5 py-0.5 rounded bg-success/10 text-success text-10 font-medium'
                                    : 'px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-10 font-medium'
                                }
                              >
                                {ok ? 'Pass' : 'Mismatch'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : isNotebookPreview ? (
              <div className="space-y-3">
                {(() => {
                  try {
                    const nb = JSON.parse(
                      MOCK_ARTIFACT_PREVIEW_CONTENT[
                        'ablation_attention_viz.ipynb'
                      ],
                    ) as {
                      cells: Array<{
                        cell_type: string;
                        execution_count?: number;
                        source: string[];
                        outputs?: Array<{ text: string[] }>;
                      }>;
                    };
                    return nb.cells.map(
                      (
                        cell: {
                          cell_type: string;
                          execution_count?: number;
                          source: string[];
                          outputs?: Array<{ text: string[] }>;
                        },
                        idx: number,
                      ) => (
                        <div
                          key={idx}
                          className="rounded-md border border-border overflow-hidden"
                        >
                          <div className="px-3 py-1 bg-muted/40 border-b border-border flex items-center justify-between font-mono text-11 text-muted-foreground">
                            <span>
                              {cell.cell_type === 'code'
                                ? `Cell ${cell.execution_count || idx}`
                                : `Markdown`}
                            </span>
                            <span className="text-11 capitalize">
                              {cell.cell_type}
                            </span>
                          </div>
                          <pre className="p-3 font-mono text-12 text-foreground overflow-x-auto bg-background leading-relaxed">
                            {cell.source.join('')}
                          </pre>
                          {cell.outputs && cell.outputs.length > 0 && (
                            <div className="p-3 border-t border-border bg-muted/20 font-mono text-11 text-foreground">
                              <pre className="overflow-x-auto">
                                {cell.outputs[0].text.join('')}
                              </pre>
                            </div>
                          )}
                        </div>
                      ),
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            ) : (
              <div className="p-4 rounded-md border border-border bg-muted/20 font-mono text-12 space-y-2">
                <div className="font-semibold text-foreground">
                  Layer Manifest
                </div>
                <div className="text-muted-foreground text-11">
                  vinai/phobert-large · 24 layers · 1024 hidden · 16 heads
                </div>
                <div className="border-t border-border pt-2 space-y-1 text-11">
                  <div className="flex justify-between">
                    <span>embeddings.word_embeddings.weight</span>
                    <span className="text-muted-foreground">
                      64001 × 1024 · float16
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      encoder.layer.0..23.attention.self.syntactic_gate
                    </span>
                    <span className="text-muted-foreground">
                      16 × 512 × 512 · float16
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>classifier.dense.weight</span>
                    <span className="text-muted-foreground">
                      1024 × 1024 · float32
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>classifier.out_proj.weight</span>
                    <span className="text-muted-foreground">
                      3 × 1024 · float32
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Log Experiment Run Modal */}
      <Dialog open={isLogRunModalOpen} onOpenChange={setLogRunModalOpen}>
        <DialogContent className="max-w-[520px] p-5 border border-border bg-background shadow-raised-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-15 font-semibold text-foreground">
              <Activity className="size-4 text-foreground" strokeWidth={1.5} />
              <span>Log Experiment Run</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRun} className="space-y-3 mt-2 text-13">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="exp-run-name"
                  className="text-12 font-medium text-foreground"
                >
                  Run Name
                </label>
                <Input
                  id="exp-run-name"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="h-8 text-12 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="exp-study-group"
                  className="text-12 font-medium text-foreground"
                >
                  Experiment Group
                </label>
                <select
                  id="exp-study-group"
                  value={expId}
                  onChange={(e) => setExpId(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-12 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="exp-backbone"
                  className="text-12 font-medium text-foreground"
                >
                  Model
                </label>
                <Input
                  id="exp-backbone"
                  value={backbone}
                  onChange={(e) => setBackbone(e.target.value)}
                  className="h-8 text-12 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="exp-dataset"
                  className="text-12 font-medium text-foreground"
                >
                  Dataset
                </label>
                <select
                  id="exp-dataset"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-12 font-mono text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} · {d.version}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="exp-lr"
                  className="text-12 font-medium text-foreground"
                >
                  Learning Rate
                </label>
                <Input
                  id="exp-lr"
                  value={lr}
                  onChange={(e) => setLr(e.target.value)}
                  className="h-8 text-12 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="exp-batch-size"
                  className="text-12 font-medium text-foreground"
                >
                  Batch Size
                </label>
                <Input
                  id="exp-batch-size"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  className="h-8 text-12 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="exp-f1"
                  className="text-12 font-medium text-foreground"
                >
                  Test F1
                </label>
                <Input
                  id="exp-f1"
                  value={f1Val}
                  onChange={(e) => setF1Val(e.target.value)}
                  className="h-8 text-12 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="exp-bleu"
                  className="text-12 font-medium text-foreground"
                >
                  BLEU Score
                </label>
                <Input
                  id="exp-bleu"
                  value={bleuVal}
                  onChange={(e) => setBleuVal(e.target.value)}
                  className="h-8 text-12 font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="exp-loss"
                  className="text-12 font-medium text-foreground"
                >
                  Eval Loss
                </label>
                <Input
                  id="exp-loss"
                  value={lossVal}
                  onChange={(e) => setLossVal(e.target.value)}
                  className="h-8 text-12 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogRunModalOpen(false)}
                className="h-8 px-3 text-12"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-8 px-3 text-12">
                Save Run
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. LaTeX Table Modal */}
      <Dialog open={isLatexModalOpen} onOpenChange={setLatexModalOpen}>
        <DialogContent className="max-w-[680px] p-5 border border-border bg-background shadow-raised-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-15 font-semibold text-foreground">
              <BookOpen className="size-4 text-foreground" strokeWidth={1.5} />
              <span>Export LaTeX Table</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            <p className="text-12 text-muted-foreground">
              Booktabs table with best metrics formatted in{' '}
              <code className="font-mono text-foreground">
                \textbf&#123;...&#125;
              </code>
              .
            </p>

            <div className="relative rounded-md border border-border bg-muted/30 p-3">
              <pre className="font-mono text-11 text-foreground overflow-x-auto leading-relaxed">
                {latexCode}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLatexModalOpen(false)}
                className="h-8 px-3 text-12"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    void navigator.clipboard.writeText(latexCode);
                  }
                  setCopiedLatex(true);
                  setTimeout(() => setCopiedLatex(false), 1800);
                  toast.success('Copied LaTeX table');
                }}
                className="h-8 px-3 text-12 gap-1.5"
              >
                {copiedLatex ? (
                  <Check className="size-3.5" strokeWidth={1.5} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={1.5} />
                )}
                <span>Copy Code</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ExperimentsModals;
