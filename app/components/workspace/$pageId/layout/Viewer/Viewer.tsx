import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router";
import { Document, Page, pdfjs } from "react-pdf";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Image,
  Info,
  Loader2,
  Play,
  Terminal,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import { usePageContext } from "../PageContext";
import { useEditorSettingsStore, type CompileMode, type LaTeXEngine } from "~/stores/editor-settings";

import { toast } from "sonner";
import { useUpdatePageThumbnail, useSyncProjectToCompiler } from "~/query/page";


import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ── Toolbar Button ─────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string | null;
  variant?: "default" | "primary";
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  title = null,
  variant = "default",
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            "p-1.5 px-2 rounded transition-colors disabled:opacity-50 flex items-center gap-2",
            variant === "default" &&
              "text-muted-foreground hover:text-primary hover:bg-primary/10",
            variant === "primary" &&
              "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" strokeWidth={2} />
          )}
          {title && <span className="text-sm font-medium">{title}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Log Parser ─────────────────────────────────────────────────────────────

interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
}

interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

function parseLatexLog(raw: string): ParsedLog {
  const lines = raw.split("\n");
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry) => {
    const key = `${entry.file ?? ""}|${entry.line ?? ""}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(entry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith("!")) {
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
    const fle = line.match(
      /^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/,
    );
    if (fle) {
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ""),
        line: parseInt(fle[2], 10),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (
      /(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(
        line,
      )
    ) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += " " + lines[j].trim();
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

// ── Log Panel ──────────────────────────────────────────────────────────────

type LogTab = "errors" | "warnings" | "badboxes" | "raw";

function EntryRow({
  type,
  entry,
}: {
  type: "error" | "warning" | "badbox";
  entry: LogEntry;
}) {
  return (
    <div className="flex gap-2.5 px-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      {type === "error" && (
        <AlertCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
      )}
      {type === "warning" && (
        <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
      )}
      {type === "badbox" && (
        <Info className="size-3.5 text-blue-400 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-zinc-200 font-mono text-[11px] leading-snug wrap-break-word">
          {entry.message}
        </p>
        {(entry.file || entry.line !== undefined) && (
          <p className="text-[10px] mt-0.5 text-zinc-500">
            {entry.file && <span className="text-zinc-400">{entry.file}</span>}
            {entry.file && entry.line !== undefined && <span> · </span>}
            {entry.line !== undefined && <span>Line {entry.line}</span>}
          </p>
        )}
        {entry.detail && (
          <p className="text-zinc-600 text-[10px] mt-0.5 truncate">
            {entry.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function LogEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-600">
      <CheckCircle2 className="size-5" />
      <span className="text-xs">{text}</span>
    </div>
  );
}

function LogPanel({ log, onClose }: { log: string; onClose: () => void }) {
  const parsed = useMemo(() => parseLatexLog(log), [log]);
  const [activeTab, setActiveTab] = useState<LogTab>(() => {
    const p = parseLatexLog(log);
    if (p.errors.length > 0) return "errors";
    if (p.warnings.length > 0) return "warnings";
    return "raw";
  });

  const countOf = (key: LogTab) => {
    if (key === "errors") return parsed.errors.length;
    if (key === "warnings") return parsed.warnings.length;
    if (key === "badboxes") return parsed.badBoxes.length;
    return null;
  };

  const badgeClass = (key: LogTab) => {
    const n = countOf(key);
    if (n === null) return "";
    if (key === "errors")
      return n > 0 ? "bg-red-500 text-white" : "bg-zinc-700 text-zinc-400";
    if (key === "warnings")
      return n > 0 ? "bg-amber-500 text-white" : "bg-zinc-700 text-zinc-400";
    if (key === "badboxes")
      return n > 0 ? "bg-blue-500 text-white" : "bg-zinc-700 text-zinc-400";
    return "";
  };

  const tabs: { key: LogTab; label: string }[] = [
    { key: "errors", label: "Errors" },
    { key: "warnings", label: "Warnings" },
    { key: "badboxes", label: "Bad Boxes" },
    { key: "raw", label: "Raw Log" },
  ];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 bg-zinc-950 flex flex-col border-t border-zinc-700"
      style={{ height: 300 }}
    >
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 shrink-0 transition-colors",
                activeTab === tab.key
                  ? "border-primary text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tab.label}
              {countOf(tab.key) !== null && (
                <span
                  className={cn(
                    "px-1 min-w-4 text-center rounded-full text-[10px] font-bold leading-4",
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
          onClick={onClose}
          className="px-3 py-2 text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "raw" && (
          <pre className="p-3 text-green-400 font-mono text-[11px] whitespace-pre-wrap leading-5">
            {log}
          </pre>
        )}
        {activeTab === "errors" &&
          (parsed.errors.length === 0 ? (
            <LogEmpty text="No errors" />
          ) : (
            parsed.errors.map((e, i) => (
              <EntryRow key={i} type="error" entry={e} />
            ))
          ))}
        {activeTab === "warnings" &&
          (parsed.warnings.length === 0 ? (
            <LogEmpty text="No warnings" />
          ) : (
            parsed.warnings.map((e, i) => (
              <EntryRow key={i} type="warning" entry={e} />
            ))
          ))}
        {activeTab === "badboxes" &&
          (parsed.badBoxes.length === 0 ? (
            <LogEmpty text="No bad boxes" />
          ) : (
            parsed.badBoxes.map((e, i) => (
              <EntryRow key={i} type="badbox" entry={e} />
            ))
          ))}
      </div>
    </div>
  );
}

// ── Thumbnail Generation ───────────────────────────────────────────────────

async function generateThumbnail(pdfBlob: Blob): Promise<string | null> {
  try {
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    // Scale 1.5 gives ~892 × 1263 px for A4 — crisp on retina displays
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    // Return base64 payload (strip the data-URL prefix — backend needs raw base64)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return dataUrl.split(",")[1]; // raw base64 only
  } catch {
    return null;
  }
}

// ── SyncTeX types & parser ─────────────────────────────────────────────────
//
// After compilation the server returns the decompressed SyncTeX text.  We
// parse it once into a bidirectional map so both scroll-sync directions have
// O(log n) lookups instead of linear scans.

interface SyncTeXMap {
  /** source line (1-based) → first PDF page (1-based) it appears on */
  lineToPage: Map<number, number>;
  /** PDF page (1-based) → sorted list of source lines rendered on it */
  pageToLines: Map<number, number[]>;
  /** all mapped source lines, sorted ascending — used for binary search */
  sortedLines: number[];
}

/**
 * Parse a decompressed SyncTeX text into a bidirectional line↔page map.
 * Only considers records referencing Input tag 1 (main.tex).
 */
function parseSyncTeX(text: string): SyncTeXMap {
  const lineToPage = new Map<number, number>();
  const pageToLines = new Map<number, number[]>();
  let currentPage = 0;

  for (const raw of text.split("\n")) {
    const s = raw.trimEnd();
    if (!s) continue;
    const first = s.charCodeAt(0);

    // Page start marker: {N
    if (first === 123 /* { */) {
      const m = s.match(/^\{(\d+)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        if (!pageToLines.has(currentPage)) pageToLines.set(currentPage, []);
      }
      continue;
    }
    // Page end marker or header lines — skip
    if (first === 125 /* } */ || currentPage === 0) continue;

    let srcLine: number | null = null;

    // Box open: (1,LINE:...
    if (first === 40 /* ( */) {
      const m = s.match(/^\(1,(\d+):/);
      if (m) srcLine = parseInt(m[1], 10);
    }
    // Node types h/v/g/x/k/$: e.g. "h1:LINE,col:x,y:w"
    else if (
      first === 104 /* h */ ||
      first === 118 /* v */ ||
      first === 103 /* g */ ||
      first === 120 /* x */ ||
      first === 107 /* k */ ||
      first === 36 /* $ */
    ) {
      const m = s.match(/^[hvgxk$]1:(\d+),/);
      if (m) srcLine = parseInt(m[1], 10);
    }

    if (srcLine !== null) {
      if (!lineToPage.has(srcLine)) lineToPage.set(srcLine, currentPage);
      const arr = pageToLines.get(currentPage)!;
      if (!arr.includes(srcLine)) arr.push(srcLine);
    }
  }

  for (const arr of pageToLines.values()) arr.sort((a, b) => a - b);
  const sortedLines = [...lineToPage.keys()].sort((a, b) => a - b);
  return { lineToPage, pageToLines, sortedLines };
}

/** Binary-search: index of first element ≥ target in a sorted array. */
function lowerBound(sorted: number[], target: number): number {
  let lo = 0,
    hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Monaco line → PDF page (1-based), with nearest-line fallback. */
function syncTeXLineToPage(line: number, map: SyncTeXMap): number {
  if (map.lineToPage.has(line)) return map.lineToPage.get(line)!;
  if (map.sortedLines.length === 0) return 1;
  const idx = lowerBound(map.sortedLines, line);
  if (idx === 0) return map.lineToPage.get(map.sortedLines[0])!;
  if (idx === map.sortedLines.length)
    return map.lineToPage.get(map.sortedLines[idx - 1])!;
  const before = map.sortedLines[idx - 1],
    after = map.sortedLines[idx];
  return map.lineToPage.get(line - before <= after - line ? before : after)!;
}

/**
 * PDF page + Y-fraction (0..1) → Monaco line.
 * Uses the list of source lines known to render on that page and distributes
 * them proportionally by fraction — much better than a document-wide ratio.
 */
function syncTeXPageFractionToLine(
  page: number,
  fraction: number,
  map: SyncTeXMap,
): number {
  const lines = map.pageToLines.get(page);
  if (lines && lines.length > 0) {
    const idx = Math.round(fraction * (lines.length - 1));
    return lines[Math.max(0, Math.min(lines.length - 1, idx))];
  }
  // Nearest page fallback
  for (let d = 1; d <= map.pageToLines.size; d++) {
    for (const p of [page - d, page + d]) {
      const arr = map.pageToLines.get(p);
      if (arr && arr.length > 0)
        return d <= 2 && p < page ? arr[arr.length - 1] : arr[0];
    }
  }
  return 1;
}

// ── Sync helpers ──────────────────────────────────────────────────────────
// LaTeX preamble lines (before \begin{document}) produce no PDF output, so we
// skip them for a more accurate line ↔ page approximation.

function getContentBounds(content: string): {
  firstContentLine: number; // 1-based line number of the first content line
  contentLineCount: number; // number of lines from firstContentLine to EOF
} {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.trim().startsWith("\\begin{document}"));
  const firstContentLine = idx >= 0 ? idx + 2 : 1; // +1 for \begin{document} itself, +1 for 1-based
  const contentLineCount = Math.max(1, lines.length - (firstContentLine - 1));
  return { firstContentLine, contentLineCount };
}

/**
 * (pageIndex 0-based, clickFraction within page 0..1) → Monaco line (1-based).
 * clickFraction = e.nativeEvent.offsetY / pageHeight gives sub-page precision.
 */
function pdfPositionToLine(
  pageIndex: number,
  clickFraction: number,
  numPages: number,
  content: string,
): number {
  const { firstContentLine, contentLineCount } = getContentBounds(content);
  const docFraction =
    (pageIndex + Math.max(0, Math.min(1, clickFraction))) /
    Math.max(1, numPages);
  return Math.max(
    1,
    firstContentLine + Math.round(docFraction * contentLineCount),
  );
}

// ── Compile Split Button ──────────────────────────────────────────────────

const ENGINE_SHORT: Record<LaTeXEngine, string> = {
  pdflatex: "pdf",
  xelatex: "Xe",
  lualatex: "Lua",
};

const COMPILE_MODE_OPTIONS: {
  value: CompileMode;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { value: "normal", label: "Normal", icon: Image, description: "Full compile" },
  { value: "fast", label: "Fast", icon: Zap, description: "No project" },
  { value: "draft", label: "Draft", icon: Zap, description: "Skip images" },
];

function CompileButton({
  isCompiling,
  onCompile,
  engine,
  compileMode,
  setCompileMode,
}: {
  isCompiling: boolean;
  onCompile: () => void;
  engine: LaTeXEngine;
  compileMode: CompileMode;
  setCompileMode: (m: CompileMode) => void;
}) {
  return (
    <div className="flex items-center">
      <button
        onClick={onCompile}
        disabled={isCompiling}
        title={`Compile (Ctrl+Enter) — ${ENGINE_SHORT[engine]} · ${compileMode}`}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-l-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {isCompiling ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
        {isCompiling ? "Compiling…" : "Compile"}
        {!isCompiling && (
          <span className="opacity-60 font-normal">
            · {ENGINE_SHORT[engine]}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isCompiling}
            className="flex items-center justify-center h-7 w-5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 border-l border-primary-foreground/20"
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {COMPILE_MODE_OPTIONS.map(({ value, label, description }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setCompileMode(value)}
              className={cn(
                compileMode === value && "font-semibold text-primary",
                "text-xs",
              )}
            >
              {label}
              <span className="ml-auto text-xs text-muted-foreground">
                {description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Main Viewer ────────────────────────────────────────────────────────────

export default function Viewer() {
  const {
    getEditorContent,
    pdfUrl,
    setPdfUrl,
    isCompiling,
    setIsCompiling,
    compileLog,
    setCompileLog,
    compileRef,
    currentPage,
    gotoPageRef,
    pdfDocRef,
    scrollToPdfLineRef,
    scrollToLineRef,
  } = usePageContext();
  const { engine, compileMode, setCompileMode, mainFile } = useEditorSettingsStore();


  const saveThumbnailMutation = useUpdatePageThumbnail();
  const syncProjectMutation = useSyncProjectToCompiler();

  // pageId from URL is always the project root (never changes when switching files).
  const { pageId: urlPageId } = useParams<{ pageId: string }>();
  const parentPageIdRef = useRef<string | null>(null);
  parentPageIdRef.current = urlPageId ?? null;

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [lastCompiled, setLastCompiled] = useState<Date | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [scrollMode] = useState(true);
  const [compilerStatus, setCompilerStatus] = useState<"idle" | "syncing" | "ready" | "error">("idle");

  const parsedLog = useMemo(
    () => (compileLog ? parseLatexLog(compileLog) : null),
    [compileLog],
  );

  const downloadRef = useRef<HTMLAnchorElement>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pdfScrollContainerRef = useRef<HTMLDivElement>(null);
  const synctexMapRef = useRef<SyncTeXMap | null>(null);

  // Register scroll-to-page function so OutlineTab can call it.
  useEffect(() => {
    gotoPageRef.current = (n: number) => {
      const el = pageElemRefs.current[n];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return () => {
      gotoPageRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Register line→page scroll function so Editor/ReviewTab can sync the PDF.
  useEffect(() => {
    scrollToPdfLineRef.current = (line: number) => {
      if (numPages === 0) return;
      const container = pdfScrollContainerRef.current;
      if (!container) return;

      let pageNum: number;
      const smap = synctexMapRef.current;
      if (smap && smap.sortedLines.length > 0) {
        // SyncTeX path — accurate, compiler-derived mapping
        pageNum = syncTeXLineToPage(line, smap);
      } else {
        // Fallback: linear heuristic (skips preamble before \begin{document})
        const content = getEditorContent.current?.() ?? "";
        const { firstContentLine, contentLineCount } =
          getContentBounds(content);
        const contentLine = Math.max(0, line - firstContentLine);
        const continuousPage =
          (contentLine / Math.max(1, contentLineCount)) * numPages;
        pageNum = Math.min(
          numPages,
          Math.max(1, Math.floor(continuousPage) + 1),
        );
      }

      const pageEl = pageElemRefs.current[pageNum];
      if (!pageEl) return;

      // Use live pixel positions — accounts for padding/gaps between PDF pages.
      const containerRect = container.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      const targetScrollTop =
        container.scrollTop + (pageRect.top - containerRect.top);
      container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    };
    return () => {
      scrollToPdfLineRef.current = null;
    };
  }, [numPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compile ──────────────────────────────────────────────────────────────

  const handleCompile = async () => {
    const isProjectMode = compileMode !== "fast";

    // In fast mode: require non-empty editor content
    if (!isProjectMode) {
      const source = getEditorContent.current?.() ?? "";
      if (!source.trim()) return;
    }

    setIsCompiling(true);
    setCompileLog(null);
    setShowLog(false);

    try {
      // ── Pre-compile save: flush current editor content to backend + compiler ──
      // The autosave is debounced (1s), so if the user edits and immediately
      // compiles, the compiler folder still has stale content.  We do an
      // immediate save here to guarantee the compiler always sees the latest.
      //
      // IMPORTANT: Only save when the editor is actually mounted (getEditorContent
      // is non-null).  In "viewer-only" layout the Monaco editor is unmounted, so
      // getEditorContent.current is null.  Saving in that case would write an
      // empty string to the DB and wipe the file content.
      if (isProjectMode && currentPage?._id && getEditorContent.current !== null) {
        const latestContent = getEditorContent.current();
        if (latestContent) {
          try {
            await fetch(`${API_URL}/api/pages/${currentPage._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ content: latestContent }),
            });
          } catch (syncErr) {
            console.warn("[compile] pre-compile save failed, compiling anyway:", syncErr);
          }
        }
      }

      // Build payload - omit source in project mode (compiler uses synced files)
      const payload: Record<string, any> = {
        engine,
        draft: compileMode === "draft",
      };
      
      if (isProjectMode) {
        // Project mode: send parentPageId and mainFile, DON'T send source
        payload.project_id = parentPageIdRef.current;
        payload.main_file = mainFile || "main.tex";
      } else {
        // Fast mode: send source directly
        payload.source = getEditorContent.current?.() ?? "";
      }

      const response = await fetch(`${API_URL}/api/latex/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // API now returns JSON { pdf: base64, synctex: string }
        const data = await response.json();
        const pdfBytes = Uint8Array.from(atob(data.pdf), (c) =>
          c.charCodeAt(0),
        );
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        // Build SyncTeX map for accurate line↔page sync
        synctexMapRef.current = data.synctex
          ? parseSyncTeX(data.synctex)
          : null;

        setPdfUrl(url);
        setLastCompiled(new Date());
        setPageNumber(1);

        // Generate first-page thumbnail asynchronously (non-blocking)
        const pid = parentPageIdRef.current;
        if (pid) {
          generateThumbnail(blob).then((base64) => {
            if (base64)
              saveThumbnailMutation.mutate({ pageId: pid, dataUrl: base64 });
          });
        }
      } else {
        let data: any = {};
        try {
          data = await response.json();
        } catch {
          data = { detail: { log: response.statusText } };
        }
        const log =
          data?.detail?.log ??
          data?.log ??
          data?.message ??
          "Compilation failed (unknown error).";
        setCompileLog(log);
        setShowLog(true);

        // Handle specific errors with actionable steps
        if (data?.error === "compiler_folder_missing") {
          toast.error("Project not synced to compiler", {
            description: "The compiler needs your project files to compile.",
            action: {
              label: "Sync Now",
              onClick: () => {
                syncProjectMutation.mutate({ pageId: parentPageIdRef.current! });
              }
            },
            id: "compiler-folder-missing",
          });
        }
      }
    } catch (err) {
      setCompileLog(String(err));
      setShowLog(true);
    } finally {
      setIsCompiling(false);
    }
  };

  // ── Register compile ref so ToolBar/Menu can trigger compile ────────────
  // Use a stable wrapper ref so compileRef always calls the latest handleCompile,
  // regardless of which deps changed — avoids stale parentPageId in the closure.
  const handleCompileLatestRef = useRef(handleCompile);
  handleCompileLatestRef.current = handleCompile;

  useEffect(() => {
    compileRef.current = () => handleCompileLatestRef.current();
    return () => {
      compileRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ctrl+Enter shortcut ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleCompileLatestRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom ─────────────────────────────────────────────────────────────────

  const handleZoomIn = () => setScale((p) => Math.min(p + 0.25, 3));
  const handleZoomOut = () => setScale((p) => Math.max(p - 0.25, 0.5));
  const handleResetZoom = () => setScale(1.0);

  // ── Pages ─────────────────────────────────────────────────────────────────

  const handlePrevPage = () => setPageNumber((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setPageNumber((p) => Math.min(p + 1, numPages));

  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages);
    pdfDocRef.current = pdf;
  };

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!pdfUrl || !downloadRef.current) return;
    downloadRef.current.href = pdfUrl;
    downloadRef.current.download = "output.pdf";
    downloadRef.current.click();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col bg-background relative">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 h-9 bg-secondary shrink-0">
        {/* Left: compile button */}
        <div className="flex items-center gap-1">
          <CompileButton
            isCompiling={isCompiling}
            onCompile={handleCompile}
            engine={engine}
            compileMode={compileMode}
            setCompileMode={setCompileMode}
          />

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* Zoom */}
          <ToolbarButton
            icon={ZoomOut}
            label="Zoom Out (-)"
            onClick={handleZoomOut}
          />
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-primary min-w-12 text-center"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarButton
            icon={ZoomIn}
            label="Zoom In (+)"
            onClick={handleZoomIn}
          />
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {/* Page navigation */}
          <ToolbarButton
            icon={ChevronLeft}
            label="Previous Page"
            onClick={handlePrevPage}
            disabled={pageNumber <= 1}
          />
          <span className="text-xs text-muted-foreground px-1 min-w-16 text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : "- / -"}
          </span>
          <ToolbarButton
            icon={ChevronRight}
            label="Next Page"
            onClick={handleNextPage}
            disabled={pageNumber >= numPages}
          />

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {compileLog && (
            <ToolbarButton
              icon={Terminal}
              label={showLog ? "Hide log" : "Show log"}
              onClick={() => setShowLog((p) => !p)}
              variant={showLog ? "primary" : "default"}
            />
          )}
          <ToolbarButton
            icon={Download}
            label="Download PDF"
            onClick={handleDownload}
            disabled={!pdfUrl}
          />
          {/* Hidden anchor for programmatic download */}
          <a ref={downloadRef} className="hidden" aria-hidden="true" />
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={pdfScrollContainerRef}
        className="flex-1 overflow-auto bg-muted/30 flex justify-center relative"
      >
        {!pdfUrl ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="text-center">
              <p className="text-sm font-medium">No PDF yet</p>
              <p className="text-xs mt-1">
                Click <strong>Compile</strong> or press{" "}
                <kbd className="px-1 py-0.5 text-[10px] bg-muted border rounded">
                  Ctrl+Enter
                </kbd>{" "}
                to generate the PDF
              </p>
            </div>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCompiling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {isCompiling ? "Compiling…" : "Compile"}
            </button>
          </div>
        ) : (
          /* Real PDF */
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            {scrollMode ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: numPages }, (_, i) => (
                  <div
                    key={`page_${i + 1}`}
                    ref={(el) => {
                      pageElemRefs.current[i + 1] = el;
                    }}
                    onDoubleClickCapture={(e) => {
                      // Use capture phase so this fires even when the PDF text layer
                      // calls stopPropagation on the bubble phase.
                      const pageHeight = (e.currentTarget as HTMLDivElement)
                        .offsetHeight;
                      const clickFraction =
                        pageHeight > 0 ? e.nativeEvent.offsetY / pageHeight : 0;
                      const smap = synctexMapRef.current;
                      let approxLine: number;
                      if (smap && smap.sortedLines.length > 0) {
                        // SyncTeX path — knows exactly which lines are on this page
                        approxLine = syncTeXPageFractionToLine(
                          i + 1,
                          clickFraction,
                          smap,
                        );
                      } else {
                        // Fallback heuristic
                        const content = getEditorContent.current?.() ?? "";
                        approxLine = pdfPositionToLine(
                          i,
                          clickFraction,
                          numPages,
                          content,
                        );
                      }
                      scrollToLineRef.current?.(approxLine);
                    }}
                  >
                    <Page
                      pageNumber={i + 1}
                      scale={scale}
                      className="shadow-lg"
                      renderTextLayer
                      renderAnnotationLayer
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                className="shadow-lg"
                renderTextLayer
                renderAnnotationLayer
              />
            )}
          </Document>
        )}

        {/* Compilation log overlay */}
        {showLog && compileLog && (
          <LogPanel log={compileLog} onClose={() => setShowLog(false)} />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-secondary text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-2">
          {!isCompiling && lastCompiled && (
            <span>Last compiled: {lastCompiled.toLocaleTimeString()}</span>
          )}
          {parsedLog && !isCompiling && (
            <button
              onClick={() => setShowLog((p) => !p)}
              className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
            >
              {parsedLog.errors.length > 0 && (
                <span className="flex items-center gap-0.5 text-red-400">
                  <AlertCircle className="size-3" />
                  {parsedLog.errors.length} error
                  {parsedLog.errors.length !== 1 ? "s" : ""}
                </span>
              )}
              {parsedLog.warnings.length > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400">
                  <AlertTriangle className="size-3" />
                  {parsedLog.warnings.length} warning
                  {parsedLog.warnings.length !== 1 ? "s" : ""}
                </span>
              )}
              {parsedLog.errors.length === 0 &&
                parsedLog.warnings.length === 0 && (
                  <span className="flex items-center gap-0.5 text-zinc-500">
                    <Terminal className="size-3" />
                    Log
                  </span>
                )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl && <span className="text-green-600">PDF ready</span>}
        </div>
      </div>
    </div>
  );
}
