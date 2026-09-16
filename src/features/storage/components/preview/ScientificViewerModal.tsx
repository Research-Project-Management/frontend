'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Search,
  Table,
  FileCode,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Terminal,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { renderMarkdown } from '@/features/ai/utils/render-markdown';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { resolveFileUrl, downloadFileUrl } from '@/shared/lib/file-client';
import { copyToClipboard } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface ScientificViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: StorageItem | null;
}

export default function ScientificViewerModal({
  open,
  onOpenChange,
  file,
}: ScientificViewerModalProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const filename = file?.filename || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const isCsv = ext === 'csv' || ext === 'tsv';
  const isNotebook = ext === 'ipynb';
  const isLatex = ext === 'tex';
  const isMarkdown = ext === 'md';

  // Fetch full text content when modal opens
  useEffect(() => {
    if (open && file?.url) {
      setLoading(true);
      const url = resolveFileUrl(file.url);
      if (!url) {
        setLoading(false);
        return;
      }

      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
          setCurrentPage(1);
          setSearchQuery('');
        })
        .catch((err) => {
          console.error('Failed to load scientific file content:', err);
          setContent('// Không thể tải nội dung tệp tin: ' + err.message);
          setLoading(false);
        });
    }
  }, [open, file?.id, file?.url]);

  // Copy handler
  const handleCopy = async () => {
    if (!content) return;
    await copyToClipboard(content);
    setCopied(true);
    toast.success('Đã sao chép nội dung tệp tin');
    setTimeout(() => setCopied(false), 2000);
  };

  // Download handler
  const handleDownload = async () => {
    if (!file?.url) return;
    const url = resolveFileUrl(file.url);
    if (url) {
      await downloadFileUrl(url, file.filename);
    }
  };

  // ── CSV Parser ────────────────────────────────────────────────────────
  const parsedCsv = useMemo(() => {
    if (!isCsv || !content) return null;
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map((line) => parseLine(line));

    return { headers, rows };
  }, [isCsv, content, ext]);

  // Filtered CSV rows
  const filteredRows = useMemo(() => {
    if (!parsedCsv) return [];
    if (!searchQuery.trim()) return parsedCsv.rows;
    const q = searchQuery.toLowerCase();
    return parsedCsv.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q)),
    );
  }, [parsedCsv, searchQuery]);

  // Paged CSV rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

  // ── Jupyter Notebook Parser ──────────────────────────────────────────
  const parsedNotebook = useMemo(() => {
    if (!isNotebook || !content) return null;
    try {
      const nb = JSON.parse(content) as any;
      const cells = (nb && Array.isArray(nb.cells)) ? nb.cells : [];
      return cells.map((cell: any, idx: number) => ({
        id: `cell-${idx}`,
        type: cell.cell_type, // 'markdown' or 'code'
        source: Array.isArray(cell.source) ? cell.source.join('') : cell.source || '',
        executionCount: cell.execution_count,
        outputs: (cell.outputs || []).map((out: any) => {
          if (out.text) {
            return {
              type: 'text',
              text: Array.isArray(out.text) ? out.text.join('') : out.text,
            };
          }
          if (out.data?.['image/png']) {
            return {
              type: 'image',
              src: `data:image/png;base64,${out.data['image/png']}`,
            };
          }
          if (out.data?.['text/plain']) {
            return {
              type: 'text',
              text: Array.isArray(out.data['text/plain'])
                ? out.data['text/plain'].join('')
                : out.data['text/plain'],
            };
          }
          return null;
        }).filter(Boolean),
      }));
    } catch {
      return null;
    }
  }, [isNotebook, content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden border border-border shadow-raised-200">
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-border bg-card/60 shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                {isCsv ? (
                  <FileSpreadsheet className="size-4" />
                ) : isNotebook ? (
                  <Terminal className="size-4" />
                ) : (
                  <FileCode className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-foreground truncate leading-tight">
                  {filename}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono uppercase text-10 px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                    {ext || 'file'}
                  </span>
                  {parsedCsv && (
                    <span>
                      {parsedCsv.rows.length} hàng • {parsedCsv.headers.length} cột
                    </span>
                  )}
                  {parsedNotebook && (
                    <span>{parsedNotebook.length} ô (cells)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                disabled={loading}
                title="Sao chép nội dung"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </button>
              <button
                onClick={handleDownload}
                title="Tải về tệp tin"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Download className="size-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Body View */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Đang tải và phân tích cấu trúc dữ liệu…</span>
            </div>
          ) : isCsv && parsedCsv ? (
            /* ── CSV Interactive Table View ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Table search & pagination bar */}
              <div className="px-4 py-2.5 border-b border-border bg-card/40 flex items-center justify-between gap-3 shrink-0">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Lọc dữ liệu bảng…"
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-border bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Hiển thị {paginatedRows.length} / {filteredRows.length} dòng
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="font-mono font-medium text-foreground px-1">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Table scroll area */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/50 sticky top-0 border-b border-border z-10">
                    <tr>
                      <th className="px-3 py-2 text-left font-mono text-11 text-muted-foreground/60 border-r border-border/60 w-12 bg-muted/50">
                        #
                      </th>
                      {parsedCsv.headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-semibold text-foreground border-r border-border/60 whitespace-nowrap bg-muted/50"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {paginatedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-1.5 text-muted-foreground/50 border-r border-border/40 text-11">
                          {(currentPage - 1) * pageSize + rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3 py-1.5 border-r border-border/40 whitespace-nowrap max-w-xs truncate text-foreground/90"
                            title={cell}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isNotebook && parsedNotebook ? (
            /* ── Jupyter Notebook View ── */
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {parsedNotebook.map((cell: any, idx: number) => (
                <div
                  key={cell.id}
                  className="rounded-md border border-border/80 bg-card overflow-hidden text-xs"
                >
                  <div className="px-3 py-1.5 bg-muted/30 border-b border-border/60 flex items-center justify-between text-11 text-muted-foreground font-mono">
                    <span>
                      {cell.type === 'code'
                        ? `In [${cell.executionCount ?? ' '}]`
                        : `Markdown Cell #${idx + 1}`}
                    </span>
                    <span className="uppercase text-10">{cell.type}</span>
                  </div>

                  <div className="p-3">
                    {cell.type === 'markdown' ? (
                      <div className="prose prose-xs dark:prose-invert max-w-none">
                        {renderMarkdown(cell.source)}
                      </div>
                    ) : (
                      <pre className="font-mono text-xs overflow-x-auto text-foreground/90 leading-relaxed">
                        <code>{cell.source}</code>
                      </pre>
                    )}
                  </div>

                  {cell.outputs && cell.outputs.length > 0 && (
                    <div className="border-t border-border/60 bg-muted/10 p-3 space-y-2">
                      <span className="text-10 font-mono text-muted-foreground/70 uppercase">
                        Output:
                      </span>
                      {cell.outputs.map((out: any, oIdx: number) => (
                        <div key={oIdx}>
                          {out.type === 'image' ? (
                            <img
                              src={out.src}
                              alt="Notebook output plot"
                              className="max-w-full rounded border border-border"
                            />
                          ) : (
                            <pre className="font-mono text-11 text-muted-foreground bg-muted/30 p-2 rounded overflow-x-auto">
                              {out.text}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* ── Preformatted Code / LaTeX / Text View ── */
            <div className="flex-1 overflow-auto p-4">
              {isLatex || isMarkdown ? (
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="p-4 rounded-lg border border-border bg-card/60">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <BookOpen className="size-3.5 text-primary" />
                      Bản xem trước nội dung:
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {renderMarkdown(content)}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-border bg-card/40">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Mã nguồn gốc ({ext}):
                    </p>
                    <pre className="font-mono text-xs overflow-x-auto text-muted-foreground whitespace-pre-wrap">
                      <code>{content}</code>
                    </pre>
                  </div>
                </div>
              ) : (
                <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  <code>{content}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
