import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code,
  Columns,
  Copy,
  FileText,
  Hash,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Plus,
  Redo,
  Scissors,
  Sigma,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Tag,
  Type,
  Underline,
  Undo,
  X,
  ListChecks,
  Quote,
  CodeSquare,
} from "lucide-react";
import React, { useState } from "react";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useUpdatePageTitle } from "~/query/page";
import type { Page } from "~/types/page";
import { useEditorContext } from "./EditorLayout";

const toolGroups = [
  {
    name: "text-style",
    items: [
      { label: "Bold", icon: Bold, shortcut: "Ctrl+B", command: "\\textbf{}" },
      {
        label: "Italic",
        icon: Italic,
        shortcut: "Ctrl+I",
        command: "\\textit{}",
      },
      {
        label: "Underline",
        icon: Underline,
        shortcut: "Ctrl+U",
        command: "\\underline{}",
      },
      { label: "Strikethrough", icon: Strikethrough, command: "\\sout{}" },
      { label: "Code", icon: Code, command: "\\texttt{}" },
    ],
  },
  {
    name: "script",
    items: [
      { label: "Superscript", icon: Superscript, command: "^{}" },
      { label: "Subscript", icon: Subscript, command: "_{}" },
    ],
  },
  {
    name: "list",
    items: [
      { label: "Bullet List", icon: List, command: "\\begin{itemize}" },
      {
        label: "Numbered List",
        icon: ListOrdered,
        command: "\\begin{enumerate}",
      },
      { label: "Checklist", icon: ListChecks },
    ],
  },
  {
    name: "block",
    items: [
      { label: "Quote", icon: Quote },
      { label: "Code Block", icon: CodeSquare },
      { label: "Divider", icon: Minus },
    ],
  },
  {
    name: "insert",
    items: [
      { label: "Link", icon: Link },
      { label: "Image", icon: Image },
      { label: "Table", icon: Table },
    ],
  },
  {
    name: "format",
    items: [
      { label: "Font Style", icon: Type },
      { label: "Columns", icon: Columns },
    ],
  },
];

const SECTION_COMMANDS = [
  { label: "Part", command: "\\part{}" },
  { label: "Chapter", command: "\\chapter{}" },
  { label: "Section", command: "\\section{}" },
  { label: "Subsection", command: "\\subsection{}" },
  { label: "Subsubsection", command: "\\subsubsection{}" },
  { label: "Paragraph", command: "\\paragraph{}" },
];

const MATH_ENV_COMMANDS = [
  { label: "Equation", env: "equation" },
  { label: "Align", env: "align" },
  { label: "Gather", env: "gather" },
  { label: "Multline", env: "multline" },
];

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  isActive?: boolean;
  onClick?: () => void;
}

function ToolButton({
  label,
  icon: Icon,
  shortcut,
  isActive,
  onClick,
}: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "p-1.5 rounded-md transition-all duration-150",
            "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
            isActive && "bg-blue-50 text-blue-600",
          )}
        >
          <Icon className="size-[15px]" strokeWidth={1.8} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Thin vertical divider between tool groups */
function ToolDivider() {
  return <div className="w-px h-4 bg-gray-200 mx-1 self-center shrink-0" />;
}

interface ToolBarProps {
  page: Page;
}

export default function ToolBar({ page }: ToolBarProps) {
  const { editorRef, toggleAIPanel, aiPanelOpen } = useEditorContext();
  const [title, setTitle] = useState(page.title);
  const updateTitleMutation = useUpdatePageTitle();

  React.useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

  const isDirty = title !== page.title;

  const handleCommitTitle = () => {
    if (!title.trim() || !isDirty) return;
    updateTitleMutation.mutate({ pageId: page._id, title: title.trim(), oldTitle: page.title });
  };

  const handleCancelTitle = () => {
    setTitle(page.title);
  };

  const handleUndo = () => {
    editorRef.current?.trigger("toolbar", "undo", null);
    editorRef.current?.focus();
  };

  const handleRedo = () => {
    editorRef.current?.trigger("toolbar", "redo", null);
    editorRef.current?.focus();
  };

  const insertText = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const id = { major: 1, minor: 1 };
    const op = {
      identifier: id,
      range: selection,
      text: text,
      forceMoveMarkers: true,
    };
    editor.executeEdits("toolbar", [op]);
    editor.focus();
  };

  const wrapSelection = (before: string, after: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel()?.getValueInRange(selection) || "";
    const newText = `${before}${selectedText}${after}`;

    const id = { major: 1, minor: 1 };
    const op = {
      identifier: id,
      range: selection,
      text: newText,
      forceMoveMarkers: true,
    };
    editor.executeEdits("toolbar", [op]);
    editor.focus();
  };

  const handleToolClick = (label?: string, command?: string) => {
    const editor = editorRef.current;
    switch (label) {
      case "Undo":
        handleUndo();
        return;
      case "Redo":
        handleRedo();
        return;
      case "Cut":
        editor?.trigger("toolbar", "editor.action.clipboardCutAction", null);
        editor?.focus();
        return;
      case "Copy":
        editor?.trigger("toolbar", "editor.action.clipboardCopyAction", null);
        editor?.focus();
        return;
      case "Paste":
        editor?.trigger("toolbar", "editor.action.clipboardPasteAction", null);
        editor?.focus();
        return;
      case "Bold":
      case "Italic":
      case "Underline":
      case "Strikethrough":
      case "Code":
        if (command) wrapSelection(command.replace("}", ""), "}");
        return;
      case "Superscript":
        wrapSelection("^{", "}");
        return;
      case "Subscript":
        wrapSelection("_{", "}");
        return;
      case "Align Left":
        wrapSelection("\\begin{flushleft}\n", "\n\\end{flushleft}");
        return;
      case "Align Center":
        wrapSelection("\\begin{center}\n", "\n\\end{center}");
        return;
      case "Align Right":
        wrapSelection("\\begin{flushright}\n", "\n\\end{flushright}");
        return;
      case "Bullet List":
        insertText("\n\\begin{itemize}\n  \\item \n\\end{itemize}\n");
        return;
      case "Numbered List":
        insertText("\n\\begin{enumerate}\n  \\item \n\\end{enumerate}\n");
        return;
      case "Inline Math":
        wrapSelection("$", "$");
        return;
      case "Display Math":
        wrapSelection("\\[\n  ", "\n\\]");
        return;
      case "Label":
      case "Ref":
      case "Cite":
        if (command) insertText(command);
        return;
      case "Quote":
        wrapSelection("\\begin{quote}\n", "\n\\end{quote}");
        return;
      case "Code Block":
        wrapSelection("\\begin{verbatim}\n", "\n\\end{verbatim}");
        return;
      case "Divider":
        insertText("\n\\noindent\\rule{\\textwidth}{0.4pt}\n");
        return;
      case "Link":
        wrapSelection("\\href{url}{", "}");
        return;
      case "Image":
        insertText("\\includegraphics[width=\\textwidth]{}");
        return;
      case "Table":
        insertText(
          "\n\\begin{tabular}{|c|c|c|}\n\\hline\n  &  &  \\\\\n\\hline\n\\end{tabular}\n",
        );
        return;
      default:
        if (command) insertText(command);
    }
  };

  const handleSectionInsert = (command: string) => insertText(command);
  const handleMathEnvInsert = (env: string) =>
    wrapSelection(`\\begin{${env}}\n  `, `\n\\end{${env}}`);

  // Project name from the page's populated project
  const projectName =
    page && typeof page.project === "object"
      ? (page.project as any).name
      : null;

  return (
    <div className="flex flex-col shrink-0 select-none">
      {/* ── Row 1: Tab bar ───────────────────────────────────────────── */}
      <div className="flex items-center h-9 bg-[#f8f8f8] border-b border-gray-200">
        {/* Active tab */}
        <div className="flex items-center gap-1.5 h-full px-3 bg-white border-r border-gray-200 border-t-2 border-t-blue-500 min-w-0 max-w-[200px]">
          <FileText className="size-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-700 truncate">
            {title || "Untitled"}
          </span>
          <button
            onClick={handleCancelTitle}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-auto"
            title="Close tab"
          >
            <X className="size-3" />
          </button>
        </div>
        {/* Add tab button */}
        <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
          <Plus className="size-3.5" />
        </button>
        <div className="flex-1" />
      </div>

      {/* ── Row 2: Breadcrumb + Actions ─────────────────────────────── */}
      <div className="flex items-center h-8 px-3 bg-white border-b border-gray-200">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0 flex-1">
          {projectName && (
            <>
              <span className="truncate max-w-[120px] hover:text-gray-600 cursor-pointer transition-colors">
                {projectName}
              </span>
              <ChevronRight className="size-3 shrink-0" />
            </>
          )}
          {/* Editable page title inline */}
          <div className="flex items-center gap-1 min-w-0">
            <FileText className="size-3 shrink-0 text-gray-400" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitTitle();
                if (e.key === "Escape") handleCancelTitle();
              }}
              onBlur={handleCommitTitle}
              className="text-xs font-medium text-gray-600 bg-transparent border-none outline-none min-w-0 max-w-[160px] truncate hover:text-gray-800 focus:text-gray-800 transition-colors"
              placeholder="Untitled"
              spellCheck={false}
            />
            {isDirty && (
              <>
                <button
                  onClick={handleCommitTitle}
                  disabled={!title.trim() || updateTitleMutation.isPending}
                  className="p-0.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors shrink-0"
                  title="Confirm rename"
                >
                  {updateTitleMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                </button>
                <button
                  onClick={handleCancelTitle}
                  className="p-0.5 rounded text-gray-400 hover:bg-gray-100 transition-colors shrink-0"
                  title="Cancel"
                >
                  <X className="size-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right-side action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolButton
            label="Copy"
            icon={Copy}
            shortcut="Ctrl+C"
            onClick={() => handleToolClick("Copy")}
          />
          <ToolButton
            label="Cut"
            icon={Scissors}
            shortcut="Ctrl+X"
            onClick={() => handleToolClick("Cut")}
          />
          <ToolButton
            label="Paste"
            icon={Clipboard}
            shortcut="Ctrl+V"
            onClick={() => handleToolClick("Paste")}
          />
          <div className="w-px h-4 bg-gray-200 mx-1 self-center shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleAIPanel}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-150",
                  aiPanelOpen
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                    : "text-gray-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10"
                )}
              >
                <Sparkles className="size-3.5" strokeWidth={1.8} />
                AI
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle AI Chat Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Row 3: Formatting toolbar ───────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 h-9 bg-[#fafafa] border-b border-gray-200 overflow-x-auto">
        {/* Undo / Redo */}
        <ToolButton
          label="Undo"
          icon={Undo}
          shortcut="Ctrl+Z"
          onClick={handleUndo}
        />
        <ToolButton
          label="Redo"
          icon={Redo}
          shortcut="Ctrl+Y"
          onClick={handleRedo}
        />

        <ToolDivider />

        {/* Tool groups */}
        {toolGroups.map((group, groupIndex) => (
          <React.Fragment key={group.name}>
            <div className="flex items-center">
              {group.items.map((item) => (
                <ToolButton
                  key={item.label}
                  label={item.label}
                  icon={item.icon}
                  shortcut={(item as any).shortcut}
                  onClick={() =>
                    handleToolClick(item.label, (item as any).command)
                  }
                />
              ))}
            </div>
            {groupIndex < toolGroups.length - 1 && <ToolDivider />}
          </React.Fragment>
        ))}

        <ToolDivider />

        {/* Heading / Section dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-0.5 px-1.5 py-1 rounded-md transition-all duration-150 text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-xs font-medium">
                  <span>H1</span>
                  <ChevronDown className="size-2.5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Insert Section</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="min-w-50">
            {SECTION_COMMANDS.map((s) => (
              <DropdownMenuItem
                key={s.label}
                onClick={() => handleSectionInsert(s.command)}
              >
                <span className="text-[11px] font-mono text-muted-foreground mr-2">
                  {`\\${s.label.toLowerCase()}{}`}
                </span>
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Math dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-0.5 px-1.5 py-1 rounded-md transition-all duration-150 text-gray-500 hover:text-gray-800 hover:bg-gray-100">
                  <Sigma className="size-[15px]" strokeWidth={1.8} />
                  <ChevronDown className="size-2.5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Math Environments</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="min-w-42.5">
            <DropdownMenuItem
              onClick={() => handleToolClick("Inline Math")}
            >
              <span className="text-[11px] font-mono text-muted-foreground mr-2">
                $...$
              </span>
              Inline Math
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleToolClick("Display Math")}
            >
              <span className="text-[11px] font-mono text-muted-foreground mr-2">
                \[...\]
              </span>
              Display Math
            </DropdownMenuItem>
            {MATH_ENV_COMMANDS.map((m) => (
              <DropdownMenuItem
                key={m.env}
                onClick={() => handleMathEnvInsert(m.env)}
              >
                <span className="text-[11px] font-mono text-muted-foreground mr-2">
                  {`\\begin{${m.env}}`}
                </span>
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refs group */}
        <ToolDivider />
        <ToolButton
          label="Label"
          icon={Tag}
          onClick={() => handleToolClick("Label", "\\label{}")}
        />
        <ToolButton
          label="Ref"
          icon={Hash}
          onClick={() => handleToolClick("Ref", "\\ref{}")}
        />
        <ToolButton
          label="Cite"
          icon={BookOpen}
          onClick={() => handleToolClick("Cite", "\\cite{}")}
        />
      </div>
    </div>
  );
}
