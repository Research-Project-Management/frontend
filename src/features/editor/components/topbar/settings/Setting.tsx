'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Cpu,
  Zap,
  RefreshCw,
  Moon,
  Sun,
  FileText,
  HardDrive,
  WrapText,
  Hash,
  Type,
  Minus,
  Plus,
  ChevronDown,
} from 'lucide-react';

import {
  useSettingsStore,
  type CompileMode,
  type LaTeXEngine,
} from '@/features/editor/store/settings.store';
import { usePageStore } from '@/features/editor/store/page.store';
import { filesQuery, useFileActions } from '@/features/editor/hooks/use-page';
import { Separator, Tabs, TabsList, TabsTrigger } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

// ── Setting Row Helper ───────────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-[11px] text-muted-foreground truncate">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Main Setting Panel ───────────────────────────────────────────────────────

export default function Setting() {
  const {
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    autoCompile,
    setAutoCompile,
    editorTheme,
    setEditorTheme,
    useCache,
    setUseCache,
    mainFile,
    setMainFile,
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    toggleSettingsPanel,
  } = useSettingsStore();

  const { texFiles, currentPage } = usePageStore();
  const { setMainFile: setMainFileMutation } = useFileActions();

  const { data: files } = useQuery({
    ...filesQuery(currentPage?.id ?? ''),
    enabled: !!currentPage?.id,
  });

  const dbMainFile =
    currentPage?.mainFile && typeof currentPage.mainFile === 'object'
      ? (currentPage.mainFile as any).title
      : null;
  const currentMainFile = dbMainFile || mainFile || 'main.tex';

  useEffect(() => {
    if (texFiles.length === 0) return;
    if (texFiles.includes('main.tex')) {
      setMainFile('main.tex');
    } else if (!texFiles.includes(currentMainFile)) {
      toast.warning('Please select a main file for compilation', {
        description: 'No "main.tex" found. Choose the root .tex file from the Settings panel.',
        duration: 6000,
        id: 'select-main-file',
      });
    }
  }, [texFiles, currentMainFile, setMainFile]);

  const handleMainFileChange = (newTitle: string) => {
    setMainFile(newTitle);
    if (files && currentPage) {
      const matchedPage = files.find((f) => f.title === newTitle);
      if (matchedPage) {
        setMainFileMutation.mutate({
          pageId: currentPage.id,
          fileId: matchedPage.id,
        });
        toast.success(`Main file updated to "${newTitle}"!`);
      }
    }
  };

  const renderToggle = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-muted-foreground/20',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform shadow-xs',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );

  return (
    <div className="h-full w-[280px] border-l border-border bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Settings</span>
        <button
          type="button"
          onClick={toggleSettingsPanel}
          aria-label="Close settings"
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {/* Compiler Section */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-medium text-muted-foreground px-4">Compiler</h3>
          
          <SettingRow icon={Cpu} label="Engine" description="LaTeX compiler">
            <Tabs value={engine} onValueChange={(v) => setEngine(v as LaTeXEngine)}>
              <TabsList className="h-7 p-0.5 border-none bg-secondary/80">
                <TabsTrigger value="pdflatex" className="text-[11px] px-2 py-1">pdf</TabsTrigger>
                <TabsTrigger value="xelatex" className="text-[11px] px-2 py-1">Xe</TabsTrigger>
                <TabsTrigger value="lualatex" className="text-[11px] px-2 py-1">Lua</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingRow>

          <SettingRow icon={Zap} label="Compile mode" description="Full = renders images">
            <Tabs value={compileMode} onValueChange={(v) => setCompileMode(v as CompileMode)}>
              <TabsList className="h-7 p-0.5 border-none bg-secondary/80">
                <TabsTrigger value="full" className="text-[11px] px-2 py-1">Full</TabsTrigger>
                <TabsTrigger value="draft" className="text-[11px] px-2 py-1">Draft</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingRow>

          <SettingRow icon={RefreshCw} label="Auto compile" description="Compile on save">
            {renderToggle(autoCompile, setAutoCompile, 'Auto compile on save')}
          </SettingRow>

          <SettingRow icon={HardDrive} label="Use cache" description="Incremental builds">
            {renderToggle(useCache, setUseCache, 'Use incremental build cache')}
          </SettingRow>

          <SettingRow icon={FileText} label="Main file" description="Root document">
            <div className="relative">
              <select
                aria-label="Select root document"
                value={texFiles.includes(currentMainFile) ? currentMainFile : ''}
                onChange={(e) => handleMainFileChange(e.target.value)}
                className={cn(
                  'w-28 text-xs bg-secondary border border-border rounded px-2 py-1 pr-6',
                  'text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary',
                  'cursor-pointer truncate',
                  !texFiles.includes(currentMainFile) && 'text-muted-foreground',
                )}
              >
                {!texFiles.includes(currentMainFile) && (
                  <option value="" disabled>Select file…</option>
                )}
                {texFiles.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            </div>
          </SettingRow>
        </div>

        <Separator />

        {/* Editor Section */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-medium text-muted-foreground px-4">Editor</h3>

          <SettingRow icon={editorTheme === 'light' ? Sun : Moon} label="Theme">
            <Tabs value={editorTheme} onValueChange={(v) => setEditorTheme(v as 'light' | 'dark')}>
              <TabsList className="h-7 p-0.5 border-none bg-secondary/80">
                <TabsTrigger value="light" className="text-[11px] px-2 py-1">Light</TabsTrigger>
                <TabsTrigger value="dark" className="text-[11px] px-2 py-1">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingRow>

          <SettingRow icon={Type} label="Font size">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                aria-label="Decrease font size"
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Minus className="size-3" />
              </button>
              <span className="text-xs font-mono w-6 text-center">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                aria-label="Increase font size"
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </SettingRow>

          <SettingRow icon={WrapText} label="Word wrap">
            {renderToggle(wordWrap, setWordWrap, 'Word wrap')}
          </SettingRow>

          <SettingRow icon={Hash} label="Line numbers">
            {renderToggle(lineNumbers, setLineNumbers, 'Line numbers')}
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
