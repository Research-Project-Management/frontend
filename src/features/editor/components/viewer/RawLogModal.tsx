'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Terminal, Download, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface RawLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: string;
  hasErrors?: boolean;
}

export default function RawLogModal({
  open,
  onOpenChange,
  logs,
  hasErrors,
}: RawLogModalProps) {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!open || typeof document === 'undefined') return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      toast.success('Đã sao chép toàn bộ nhật ký biên dịch');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép nhật ký');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'compile-output.log';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const lines = logs ? logs.split('\n') : ['(No logs available)'];
  const filteredLines = searchQuery
    ? lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="raw-log-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-card shadow-raised-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'size-7 rounded-md flex items-center justify-center',
                hasErrors
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-primary/15 text-primary',
              )}
            >
              <Terminal className="size-4" />
            </div>
            <div>
              <h2 id="raw-log-title" className="text-sm font-semibold text-foreground">
                LaTeX Compilation Raw Logs
              </h2>
              <p className="text-xs text-muted-foreground">
                {lines.length} lines captured from TeX engine stdout/stderr
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="size-3.5 absolute left-2 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="h-7 w-40 sm:w-56 pl-7 pr-2 rounded-md border border-input bg-background text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted transition-colors cursor-pointer text-foreground"
              title="Copy to Clipboard"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border bg-background hover:bg-muted transition-colors cursor-pointer text-foreground"
              title="Download Log File"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Log Viewer Body */}
        <div className="flex-1 overflow-auto p-4 bg-zinc-950 text-zinc-100 font-mono text-xs leading-relaxed selection:bg-primary/30">
          <pre className="whitespace-pre-wrap break-all">
            {filteredLines.map((line, i) => {
              const isError =
                line.startsWith('!') ||
                line.includes('Error:') ||
                line.includes('Emergency stop');
              const isWarning = line.includes('Warning:');
              return (
                <div
                  key={i}
                  className={cn(
                    'py-0.5 px-1 rounded-xs',
                    isError && 'bg-rose-950/60 text-rose-300 font-semibold',
                    isWarning && 'bg-amber-950/40 text-amber-300',
                  )}
                >
                  <span className="inline-block w-10 select-none text-zinc-600 text-right pr-3">
                    {i + 1}
                  </span>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>,
    document.body,
  );
}
