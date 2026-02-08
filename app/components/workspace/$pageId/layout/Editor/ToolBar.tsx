import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ClipboardPaste,
  Code,
  Copy,
  Italic,
  List,
  ListOrdered,
  Redo,
  Scissors,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo,
  Save,
  FileText,
} from "lucide-react";
import React, { useState } from "react";
import { useParams } from "react-router";
import { Input } from "~/components/ui/input";
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
      { label: "Paste", icon: ClipboardPaste, shortcut: "Ctrl+V" },
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
      { label: "Justify", icon: AlignJustify },
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
    name: "code",
    items: [{ label: "Code", icon: Code, command: "\\texttt{}" }],
  },
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
            "p-1.5 rounded transition-colors",
            "text-muted-foreground hover:text-primary hover:bg-primary/10",
            isActive && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
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

  const handleToolClick = (command?: string, label?: string) => {
    if (!command) return;

    switch (label) {
      case "Bold":
      case "Italic":
      case "Underline":
      case "Strikethrough":
      case "Code":
        wrapSelection(command.replace("}", ""), "}");
        break;
      case "Superscript":
        wrapSelection("^{", "}");
        break;
      case "Subscript":
        wrapSelection("_{", "}");
        break;
      case "Bullet List":
        insertText("\n\\begin{itemize}\n\\item \n\\end{itemize}\n");
        break;
      case "Numbered List":
        insertText("\n\\begin{enumerate}\n\\item \n\\end{enumerate}\n");
        break;
      default:
        if (command) insertText(command);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-secondary border-b border-border px-3 py-1.5">
      {/* File info */}
      <div className="flex items-center gap-2 mr-2">
        <FileText className="size-4 text-muted-foreground" />
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-7 text-sm font-medium w-48 bg-background border-border focus:ring-1 focus:ring-primary/20"
          placeholder="Page title"
        />
      </div>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Tool groups */}
      {toolGroups.map((group, groupIndex) => (
        <React.Fragment key={group.name}>
          <div className="flex items-center">
            {group.items.map((item) => (
              <ToolButton
                key={item.label}
                label={item.label}
                icon={item.icon}
              />
            ))}
          </div>
          {groupIndex < toolGroups.length - 1 && (
            <Separator orientation="vertical" className="h-5 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
