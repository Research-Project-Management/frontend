'use client';

import React from 'react';
import { usePageStore } from '@/features/editor/store/page.store';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useActionsStore } from '@/features/editor/store/actions.store';
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
  Undo,
  Redo,
  ChevronDown,
  Hash,
  Pilcrow,
  Type,
  ZoomIn,
  ZoomOut,
  MoreHorizontal,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/shared/components/ui';
import {
  EditorCommandBus,
  EditorEventBus,
  type LatexFormatType,
} from '@/features/editor/utils/editor.util';

// ── Declarative Toolbar Action Config ──────────────────────────────────────────

interface FormatAction {
  id: LatexFormatType;
  label: string;
  icon: React.ElementType;
  tooltip: string;
  kbd?: string;
}

const BASIC_FORMATS: FormatAction[] = [
  { id: 'bold', label: 'Bold', icon: Bold, tooltip: 'Bold', kbd: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', icon: Italic, tooltip: 'Italic', kbd: 'Ctrl+I' },
  { id: 'underline', label: 'Underline', icon: Underline, tooltip: 'Underline', kbd: 'Ctrl+U' },
  { id: 'code', label: 'Monospace', icon: Code, tooltip: 'Monospace' },
  { id: 'strikethrough', label: 'Strikethrough', icon: Strikethrough, tooltip: 'Strikethrough' },
  { id: 'superscript', label: 'Superscript', icon: Superscript, tooltip: 'Superscript' },
  { id: 'subscript', label: 'Subscript', icon: Subscript, tooltip: 'Subscript' },
];

const MATH_ENVIRONMENTS = [
  { label: 'Equation Env', snippet: '\\begin{equation}\n  \n\\end{equation}' },
  { label: 'Align Env', snippet: '\\begin{align}\n  \n\\end{align}' },
  { label: 'Verbatim', snippet: '\\begin{verbatim}\n  \n\\end{verbatim}' },
];

const STRUCTURE_ITEMS = [
  { label: 'Section (H1)', snippet: '\\section{}' },
  { label: 'Subsection (H2)', snippet: '\\subsection{}' },
  { label: 'Subsubsection (H3)', snippet: '\\subsubsection{}' },
];

// ── Toolbar Button Primitive ───────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  variant?: 'default' | 'ai' | 'settings';
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  tooltip,
  kbd,
  active = false,
  variant = 'default',
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={tooltip || label}
          className={cn(
            'h-7 min-w-[28px] px-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium transition-all duration-150 outline-none select-none',
            'active:scale-95',
            active
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            variant === 'ai' && 'text-primary hover:bg-primary/10',
            variant === 'settings' && 'text-muted-foreground hover:bg-accent/40',
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" />}
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

// ── Master Format Toolbar Component ───────────────────────────────────────────

export default function Format() {
  const { editorRef } = usePageStore();
  const { setPendingAiContext } = useActionsStore();
  const {
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    fontSize,
    setFontSize,
  } = useSettingsStore();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(1000);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frameId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
    });

    observer.observe(el);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      observer.unobserve(el);
    };
  }, []);

  const showStructure = width >= 900;
  const showMath = width >= 760;
  const showFormat = width >= 620;
  const showQuickSettings = width >= 480;
  const hasOverflow = !showStructure || !showMath || !showFormat;

  const handleFormat = (type: LatexFormatType) => {
    EditorCommandBus.format(editorRef.current, type);
  };

  const handleInsert = (snippet: string) => {
    EditorCommandBus.insertSnippet(editorRef.current, snippet);
  };

  const handleAiAsk = () => {
    const ed = editorRef.current;
    if (ed) {
      const sel = ed.getSelection();
      if (sel) {
        const text = ed.getModel()?.getValueInRange(sel) ?? '';
        if (text.trim()) {
          setPendingAiContext({
            selectedText: text,
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
          });
        }
      }
    }
    EditorEventBus.emit('flux:open-ai-panel');
  };

  const handleFontSizeChange = (direction: 'in' | 'out') => {
    setFontSize(
      direction === 'in'
        ? Math.min(fontSize + 1, 30)
        : Math.max(fontSize - 1, 10),
    );
  };

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className="h-9 border-b border-border/40 bg-secondary/20 px-2 flex items-center justify-between shrink-0 select-none"
      >
        {/* Left Side: Document editing tools */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* History Undo / Redo */}
          <div className="flex items-center gap-px pr-1.5 border-r border-border/80">
            <ToolbarButton
              onClick={() => EditorCommandBus.undo(editorRef.current)}
              icon={Undo}
              tooltip="Undo"
              kbd="Ctrl+Z"
            />
            <ToolbarButton
              onClick={() => EditorCommandBus.redo(editorRef.current)}
              icon={Redo}
              tooltip="Redo"
              kbd="Ctrl+Y"
            />
          </div>

          {/* Basic Text Formatting */}
          {showFormat && (
            <div className="flex items-center gap-px px-1.5 border-r border-border/80">
              {BASIC_FORMATS.map((item) => (
                <ToolbarButton
                  key={item.id}
                  onClick={() => handleFormat(item.id)}
                  icon={item.icon}
                  tooltip={item.tooltip}
                  kbd={item.kbd}
                />
              ))}
            </div>
          )}

          {/* Math & Formulas */}
          {showMath && (
            <div className="flex items-center gap-px px-1.5 border-r border-border/80">
              <ToolbarButton
                onClick={() => handleFormat('inlineMath')}
                icon={Sigma}
                tooltip="Inline Math ($...$)"
                kbd="$"
              />
              <ToolbarButton
                onClick={() => handleFormat('displayMath')}
                icon={Braces}
                tooltip="Display Math"
              />

              {/* Environments Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none">
                    <span className="text-[10px] font-bold">Env</span>
                    <ChevronDown className="size-3 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44 z-[9999]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Environments
                  </DropdownMenuLabel>
                  {MATH_ENVIRONMENTS.map((env) => (
                    <DropdownMenuItem
                      key={env.label}
                      onClick={() => handleInsert(env.snippet)}
                    >
                      {env.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Layout & Structure */}
          {showStructure && (
            <div className="flex items-center gap-px px-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 px-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none">
                    <Type className="size-3.5 shrink-0" />
                    <ChevronDown className="size-3 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40 z-[9999]">
                  {STRUCTURE_ITEMS.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      onClick={() => handleInsert(item.snippet)}
                    >
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <ToolbarButton
                onClick={() => handleInsert('\\item ')}
                icon={List}
                tooltip="List Item"
              />
              <ToolbarButton
                onClick={() => handleFormat('cite')}
                icon={BookOpen}
                tooltip="Citation"
              />
              <ToolbarButton
                onClick={() => handleFormat('ref')}
                icon={Tag}
                tooltip="Cross-Reference"
              />
            </div>
          )}

          {/* Overflow Menu */}
          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More editing tools"
                  className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none shrink-0"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 z-[9999]">
                {!showFormat && (
                  <>
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                      Formatting
                    </DropdownMenuLabel>
                    {BASIC_FORMATS.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => handleFormat(item.id)}
                      >
                        <item.icon className="size-4 mr-2" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}

                {!showMath && (
                  <>
                    {!showFormat && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                      Math
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleFormat('inlineMath')}>
                      <Sigma className="size-4 mr-2" />
                      <span>Inline Math</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleFormat('displayMath')}>
                      <Braces className="size-4 mr-2" />
                      <span>Display Math</span>
                    </DropdownMenuItem>
                  </>
                )}

                {!showStructure && (
                  <>
                    {(!showFormat || !showMath) && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                      Structure
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleInsert('\\section{}')}>
                      <Type className="size-4 mr-2" />
                      <span>Section (H1)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleInsert('\\item ')}>
                      <List className="size-4 mr-2" />
                      <span>List Item</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleFormat('cite')}>
                      <BookOpen className="size-4 mr-2" />
                      <span>Citation</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right Side: AI & Quick-Settings */}
        <div className="flex items-center gap-1.5 shrink-0 pl-3 border-l border-border/80">
          <ToolbarButton
            onClick={handleAiAsk}
            icon={Sparkles}
            tooltip="Ask AI"
            variant="ai"
          />

          <div className="h-4 w-px bg-border/80 mx-1" />

          {showQuickSettings ? (
            <>
              <ToolbarButton
                onClick={() => setWordWrap(!wordWrap)}
                icon={Pilcrow}
                tooltip={wordWrap ? 'Word Wrap: On' : 'Word Wrap: Off'}
                active={wordWrap}
                variant="settings"
              />
              <ToolbarButton
                onClick={() => setLineNumbers(!lineNumbers)}
                icon={Hash}
                tooltip={lineNumbers ? 'Line Numbers: On' : 'Line Numbers: Off'}
                active={lineNumbers}
                variant="settings"
              />

              <div className="flex items-center bg-muted/40 rounded-md border border-border/60 ml-0.5">
                <ToolbarButton
                  onClick={() => handleFontSizeChange('out')}
                  icon={ZoomOut}
                  tooltip="Decrease Font Size"
                  variant="settings"
                />
                <span className="text-[11px] font-mono font-semibold px-1 w-9 text-center text-muted-foreground select-none">
                  {fontSize}px
                </span>
                <ToolbarButton
                  onClick={() => handleFontSizeChange('in')}
                  icon={ZoomIn}
                  tooltip="Increase Font Size"
                  variant="settings"
                />
              </div>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Editor Settings"
                  className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none shrink-0"
                >
                  <Settings className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[9999]">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold px-2 py-1">
                  Settings
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setWordWrap(!wordWrap)}>
                  <Pilcrow className={cn('size-4 mr-2', wordWrap && 'text-primary')} />
                  <span>Word Wrap</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-semibold">
                    {wordWrap ? 'On' : 'Off'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLineNumbers(!lineNumbers)}>
                  <Hash className={cn('size-4 mr-2', lineNumbers && 'text-primary')} />
                  <span>Line Numbers</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-semibold">
                    {lineNumbers ? 'On' : 'Off'}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
