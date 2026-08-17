'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
}

export interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

export function parseLatexLog(raw: string): ParsedLog {
  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry) => {
    const key = `${entry.file ?? ''}|${entry.line ?? ''}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(entry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
      let lineNum: number | undefined;
      let detail: string | undefined;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          detail = m[2].trim() || undefined;
          break;
        }
      }
      tryAdd(errors, { message, line: lineNum, detail });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (/(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += ' ' + lines[j].trim();
        else break;
      }
      const lineRef = msg.match(/input line (\d+)/);
      tryAdd(warnings, {
        message: msg,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines? (\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  return { errors, warnings, badBoxes };
}

type LogTab = 'errors' | 'warnings' | 'badboxes' | 'raw';

function EntryRow({
  type,
  entry,
}: {
  type: 'error' | 'warning' | 'badbox';
  entry: LogEntry;
}) {
  return (
    <div className="flex gap-2.5 px-3 py-2.5 border-b border-border/40 last:border-0">
      {type === 'error' && <AlertCircle className="size-3.5 text-red-500 shrink-0 mt-0.5" />}
      {type === 'warning' && <AlertTriangle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />}
      {type === 'badbox' && <Info className="size-3.5 text-blue-500 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-mono text-[11px] leading-snug break-words">
          {entry.message}
        </p>
        {(entry.file || entry.line !== undefined) && (
          <p className="text-[10px] mt-0.5 text-muted-foreground">
            {entry.file && <span className="text-foreground/70">{entry.file}</span>}
            {entry.file && entry.line !== undefined && <span> · </span>}
            {entry.line !== undefined && <span>Line {entry.line}</span>}
          </p>
        )}
        {entry.detail && (
          <p className="text-muted-foreground/80 text-[10px] mt-0.5 truncate">{entry.detail}</p>
        )}
      </div>
    </div>
  );
}

function LogEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
      <CheckCircle2 className="size-5" />
      <span className="text-xs">{text}</span>
    </div>
  );
}

export interface LogsProps {
  log: string;
  onClose: () => void;
}

export default function Logs({ log, onClose }: LogsProps) {
  const parsed = useMemo(() => parseLatexLog(log), [log]);
  const [activeTab, setActiveTab] = useState<LogTab>(() => {
    const p = parseLatexLog(log);
    if (p.errors.length > 0) return 'errors';
    if (p.warnings.length > 0) return 'warnings';
    return 'raw';
  });

  const countOf = (key: LogTab) => {
    if (key === 'errors') return parsed.errors.length;
    if (key === 'warnings') return parsed.warnings.length;
    if (key === 'badboxes') return parsed.badBoxes.length;
    return null;
  };

  const badgeClass = (key: LogTab) => {
    const n = countOf(key);
    if (n === null) return '';
    const inactive = 'bg-muted text-muted-foreground';
    if (key === 'errors') {
      if (n > 0) return 'bg-red-500 text-white';
      return inactive;
    }
    if (key === 'warnings') {
      if (n > 0) return 'bg-amber-500 text-white';
      return inactive;
    }
    if (key === 'badboxes') {
      if (n > 0) return 'bg-blue-500 text-white';
      return inactive;
    }
    return '';
  };

  const tabs: { key: LogTab; label: string }[] = [
    { key: 'errors', label: 'Errors' },
    { key: 'warnings', label: 'Warnings' },
    { key: 'badboxes', label: 'Bad Boxes' },
    { key: 'raw', label: 'Raw Log' },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col border-t border-border shadow-lg"
      style={{ height: 280 }}
    >
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 shrink-0">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 shrink-0 transition-colors outline-none',
                activeTab === tab.key
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {countOf(tab.key) !== null && (
                <span
                  className={cn(
                    'px-1 min-w-4 text-center rounded-full text-[10px] font-bold leading-4',
                    badgeClass(tab.key),
                  )}
                >
                  {countOf(tab.key)}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close log panel"
          className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'raw' && (
          <pre className="p-3 text-foreground/90 font-mono text-[11px] whitespace-pre-wrap leading-5">
            {log}
          </pre>
        )}
        {activeTab === 'errors' &&
          (parsed.errors.length === 0 ? (
            <LogEmpty text="No errors" />
          ) : (
            parsed.errors.map((e, i) => <EntryRow key={i} type="error" entry={e} />)
          ))}
        {activeTab === 'warnings' &&
          (parsed.warnings.length === 0 ? (
            <LogEmpty text="No warnings" />
          ) : (
            parsed.warnings.map((e, i) => <EntryRow key={i} type="warning" entry={e} />)
          ))}
        {activeTab === 'badboxes' &&
          (parsed.badBoxes.length === 0 ? (
            <LogEmpty text="No bad boxes" />
          ) : (
            parsed.badBoxes.map((e, i) => <EntryRow key={i} type="badbox" entry={e} />)
          ))}
      </div>
    </div>
  );
}

export const LogPanel = Logs;
