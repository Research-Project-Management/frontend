import React from "react";
import { useEditorContext } from "./EditorLayout";
import { useEditorSettingsStore } from "~/stores/editor-settings";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import {
  Bold,
  Italic,
  Underline,
  Code,
  Strikethrough,
  Superscript,
  Subscript,
  Sigma,
  Braces,
  List,
  BookOpen,
  Tag,
  Sparkles,
  Undo,
  Redo,
  ChevronDown,
  Hash,
  Pilcrow,
  FileCode,
  Type,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "~/components/ui/dropdown-menu";

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  variant?: "default" | "ai" | "settings";
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  tooltip,
  kbd,
  active = false,
  variant = "default"
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "h-8 min-w-[32px] px-2 flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all duration-150 outline-none select-none",
            "active:scale-95",
            active
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            variant === "ai" && "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/15",
            variant === "settings" && "text-muted-foreground hover:bg-accent/40"
          )}
        >
          {Icon && <Icon className="size-4 shrink-0" />}
          {label && <span>{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="flex items-center gap-2">
        <span>{tooltip}</span>
        {kbd && (
          <kbd className="bg-muted px-1 rounded text-[10px] text-muted-foreground font-mono leading-none border border-border/40">
            {kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default function EditorToolbar() {
  const { editorRef } = useEditorContext();
  const { setPendingAiContext } = useWorkspaceActionsStore();
  const {
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    fontSize,
    setFontSize
  } = useEditorSettingsStore();

  const wrapSel = (before: string, after: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const text = ed.getModel()?.getValueInRange(sel) ?? "";
    ed.executeEdits("toolbar", [
      { range: sel, text: `${before}${text}${after}`, forceMoveMarkers: true },
    ]);
    ed.focus();
  };

  const insertAt = (text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    ed.executeEdits("toolbar", [{ range: sel, text, forceMoveMarkers: true }]);
    ed.focus();
  };

  const handleUndo = () => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.trigger("toolbar", "undo", null);
    ed.focus();
  };

  const handleRedo = () => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.trigger("toolbar", "redo", null);
    ed.focus();
  };

  const handleAiAsk = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (sel) {
      const text = ed.getModel()?.getValueInRange(sel) ?? "";
      if (text.trim()) {
        setPendingAiContext({
          selectedText: text,
          startLine: sel.startLineNumber,
          endLine: sel.endLineNumber,
        });
      }
    }
    document.dispatchEvent(new CustomEvent("flux:open-ai-panel"));
  };

  const handleFontSizeChange = (direction: "in" | "out") => {
    if (direction === "in") {
      setFontSize(Math.min(fontSize + 1, 30));
    } else {
      setFontSize(Math.max(fontSize - 1, 10));
    }
  };

  return (
    <TooltipProvider>
      <div className="h-11 border-b border-border bg-background/95 px-3 flex items-center justify-between shrink-0 select-none backdrop-blur-md">
        
        {/* Left Side: Document editing helpers */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* History Operations */}
          <div className="flex items-center gap-px pr-1.5 border-r border-border/80">
            <ToolbarButton
              onClick={handleUndo}
              icon={Undo}
              label=""
              tooltip="Undo"
              kbd="Ctrl+Z"
            />
            <ToolbarButton
              onClick={handleRedo}
              icon={Redo}
              label=""
              tooltip="Redo"
              kbd="Ctrl+Y"
            />
          </div>

          {/* Basic Text Formatting */}
          <div className="flex items-center gap-px px-1.5 border-r border-border/80">
            <ToolbarButton
              onClick={() => wrapSel("\\textbf{", "}")}
              icon={Bold}
              label=""
              tooltip="Bold"
            />
            <ToolbarButton
              onClick={() => wrapSel("\\textit{", "}")}
              icon={Italic}
              label=""
              tooltip="Italic"
            />
            <ToolbarButton
              onClick={() => wrapSel("\\underline{", "}")}
              icon={Underline}
              label=""
              tooltip="Underline"
            />
            <ToolbarButton
              onClick={() => wrapSel("\\texttt{", "}")}
              icon={Code}
              label=""
              tooltip="Typewriter (Monospace)"
            />
            <ToolbarButton
              onClick={() => wrapSel("\\sout{", "}")}
              icon={Strikethrough}
              label=""
              tooltip="Strikethrough"
            />
            <ToolbarButton
              onClick={() => wrapSel("^{", "}")}
              icon={Superscript}
              label=""
              tooltip="Superscript"
            />
            <ToolbarButton
              onClick={() => wrapSel("_{", "}")}
              icon={Subscript}
              label=""
              tooltip="Subscript"
            />
          </div>

          {/* Math & Formulas */}
          <div className="flex items-center gap-px px-1.5 border-r border-border/80">
            <ToolbarButton
              onClick={() => wrapSel("$", "$")}
              icon={Sigma}
              label=""
              tooltip="Inline Math ($...$)"
              kbd="$"
            />
            <ToolbarButton
              onClick={() => wrapSel("\\[\n  ", "\n\\]")}
              icon={Braces}
              label=""
              tooltip="Display Math"
            />

            {/* Dropdown for Advanced Environments */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 px-1.5 flex items-center justify-center gap-0.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Env</span>
                  <ChevronDown className="size-3 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Môi trường toán</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => wrapSel("\\begin{equation}\n  ", "\n\\end{equation}")}>
                  Equation Env
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => wrapSel("\\begin{align}\n  ", "\n\\end{align}")}>
                  Align Env
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Khối mã nguồn</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => wrapSel("\\begin{verbatim}\n  ", "\n\\end{verbatim}")}>
                  Verbatim
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Document Layout & Structure */}
          <div className="flex items-center gap-px px-1.5">
            {/* Headers Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 px-1.5 flex items-center justify-center gap-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none">
                  <Type className="size-4 shrink-0" />
                  <ChevronDown className="size-3 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 z-[9999]">
                <DropdownMenuItem onClick={() => insertAt("\\section{}")}>
                  Section (H1)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAt("\\subsection{}")}>
                  Subsection (H2)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAt("\\subsubsection{}")}>
                  Subsubsection (H3)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => wrapSel("\\part{", "}")}>
                  Part
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => wrapSel("\\chapter{", "}")}>
                  Chapter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarButton
              onClick={() => insertAt("\\item ")}
              icon={List}
              label=""
              tooltip="List Item"
            />
            <ToolbarButton
              onClick={() => insertAt("\\cite{}")}
              icon={BookOpen}
              label=""
              tooltip="Citation"
            />
            <ToolbarButton
              onClick={() => insertAt("\\label{}")}
              icon={Tag}
              label=""
              tooltip="Label"
            />
          </div>
        </div>

        {/* Right Side: AI & Custom Settings Quick-Toggles */}
        <div className="flex items-center gap-1.5 shrink-0 pl-3 border-l border-border/80">
          {/* Ask AI Trigger */}
          <ToolbarButton
            onClick={handleAiAsk}
            icon={Sparkles}
            label="AI"
            tooltip="Ask Flux AI"
            variant="ai"
          />

          <div className="h-4 w-px bg-border/80 mx-1" />

          {/* Quick Settings Toggles */}
          <ToolbarButton
            onClick={() => setWordWrap(!wordWrap)}
            icon={Pilcrow}
            label=""
            tooltip={wordWrap ? "Word Wrap: Bật" : "Word Wrap: Tắt"}
            active={wordWrap}
            variant="settings"
          />
          <ToolbarButton
            onClick={() => setLineNumbers(!lineNumbers)}
            icon={Hash}
            label=""
            tooltip={lineNumbers ? "Số thứ tự dòng: Bật" : "Số thứ tự dòng: Tắt"}
            active={lineNumbers}
            variant="settings"
          />

          <div className="flex items-center bg-muted/40 rounded-md border border-border/60 ml-0.5">
            <ToolbarButton
              onClick={() => handleFontSizeChange("out")}
              icon={ZoomOut}
              label=""
              tooltip="Giảm cỡ chữ"
              variant="settings"
            />
            <span className="text-[11px] font-mono font-semibold px-1 w-9 text-center text-muted-foreground select-none">
              {fontSize}px
            </span>
            <ToolbarButton
              onClick={() => handleFontSizeChange("in")}
              icon={ZoomIn}
              label=""
              tooltip="Tăng cỡ chữ"
              variant="settings"
            />
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
