import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Braces,
  ChevronDown,
  Code,
  Copy,
  FileText,
  Hash,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo,
  Scissors,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Tag,
  Underline,
  Undo,
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
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { useUpdatePageTitle } from "~/query/page";
import type { Page } from "~/types/page";
import { useDebounce } from "~/hooks/useDebounce";
import { useEditorContext } from "./EditorLayout";


const toolGroups = [
  {
    name: "history",
    items: [
      { label: "Undo", icon: Undo, shortcut: "Ctrl+Z" },
      { label: "Redo", icon: Redo, shortcut: "Ctrl+Y" },
    ],
  },
  {
    name: "clipboard",
    items: [
      { label: "Cut", icon: Scissors, shortcut: "Ctrl+X" },
      { label: "Copy", icon: Copy, shortcut: "Ctrl+C" },
    ],
  },
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
    name: "align",
    items: [
      { label: "Align Left", icon: AlignLeft },
      { label: "Align Center", icon: AlignCenter },
      { label: "Align Right", icon: AlignRight },
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
    ],
  },
  {
    name: "math",
    items: [
      { label: "Inline Math", icon: Sigma, shortcut: "Ctrl+Shift+M" },
      { label: "Display Math", icon: Braces },
    ],
  },
  {
    name: "refs",
    items: [
      { label: "Label", icon: Tag, command: "\\label{}" },
      { label: "Ref", icon: Hash, command: "\\ref{}" },
      { label: "Cite", icon: BookOpen, command: "\\cite{}" },
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
            "p-1 rounded transition-colors",
            "text-muted-foreground hover:text-primary hover:bg-primary/10",
            isActive && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="text-[10px] bg-gray-500 px-1.5 py-0.5 rounded font-mono">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface ToolBarProps {
  page: Page;
}

export default function ToolBar({ page }: ToolBarProps) {
  const { editorRef } = useEditorContext();
  const [title, setTitle] = useState(page.title);
  const debouncedTitle = useDebounce(title, 1000);
  const updateTitleMutation = useUpdatePageTitle();

  React.useEffect(() => {
    if (debouncedTitle && debouncedTitle !== page.title) {
      updateTitleMutation.mutate({
        pageId: page._id,
        title: debouncedTitle,
      });
    }
  }, [debouncedTitle]);

  React.useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

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
      default:
        if (command) insertText(command);
    }
  };

  const handleSectionInsert = (command: string) => insertText(command);
  const handleMathEnvInsert = (env: string) =>
    wrapSelection(`\\begin{${env}}\n  `, `\n\\end{${env}}`);

  return (
    <div className="flex items-center gap-0.5 bg-background border-b border-border px-2 h-9 overflow-x-auto shrink-0">
      {/* File title */}
      <div className="flex items-center gap-1.5 mr-2 shrink-0">
        <FileText className="size-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-6 text-xs font-medium w-44 bg-muted/40 border-transparent focus:border-border focus:bg-background"
          placeholder="Page title"
        />
      </div>

      <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

      {/* Tool groups */}
      {toolGroups.map((group, groupIndex) => (
        <React.Fragment key={group.name}>
          <div className="flex items-center shrink-0">
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
            {/* Inline math env dropdown inside math group */}
            {group.name === "math" && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-0.5 px-1 py-1 rounded transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10">
                        <span className="text-[12px] font-serif leading-none">
                          ∑
                        </span>
                        <ChevronDown className="size-2" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Math Environments
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-42.5">
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
            )}
          </div>
          {groupIndex < toolGroups.length - 1 && (
            <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />
          )}
        </React.Fragment>
      ))}

      <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />

      {/* Section dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-0.5 px-1 py-1 rounded transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0">
                <Pilcrow className="size-3.5" strokeWidth={2} />
                <ChevronDown className="size-2" />
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

    </div>
  );
}
