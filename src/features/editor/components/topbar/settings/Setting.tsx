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
import { Separator } from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui";
import { useTheme } from "@/shared/providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

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
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground truncate">{description}</div>
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

  const { setTheme } = useTheme();

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
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    />
  );

  return (
    <div className="h-full w-[280px] border-l border-border bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0">
        <span className="text-sm font-semibold">Settings</span>
        <button
          type="button"
          onClick={toggleSettingsPanel}
          aria-label="Close settings"
          className="p-1 rounded-md hover:bg-muted text-foreground transition-colors"
        >
          <X className="size-4 shrink-0" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {/* Compiler Section */}
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground px-4">Compiler</h3>
          
          <SettingRow icon={Cpu} label="Engine" description="LaTeX compiler">
            <Tabs value={engine} onValueChange={(v) => setEngine(v as LaTeXEngine)}>
              <TabsList className="h-7 p-0.5 border-none bg-secondary">
                <TabsTrigger value="pdflatex" className="text-xs px-2 py-1">pdf</TabsTrigger>
                <TabsTrigger value="xelatex" className="text-xs px-2 py-1">Xe</TabsTrigger>
                <TabsTrigger value="lualatex" className="text-xs px-2 py-1">Lua</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingRow>

          <SettingRow icon={Zap} label="Compile mode" description="Full = renders images">
            <Tabs value={compileMode} onValueChange={(v) => setCompileMode(v as CompileMode)}>
              <TabsList className="h-7 p-0.5 border-none bg-secondary">
                <TabsTrigger value="full" className="text-xs px-2 py-1">Full</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs px-2 py-1">Draft</TabsTrigger>
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
            <div className="w-36">
              <Select
                value={texFiles.includes(currentMainFile) ? currentMainFile : undefined}
                onValueChange={(val) => handleMainFileChange(val)}
              >
                <SelectTrigger className="h-7 text-xs bg-secondary">
                  <SelectValue placeholder="Select file…" />
                </SelectTrigger>
                <SelectContent>
                  {texFiles.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingRow>
        </div>

        <Separator />

        {/* Editor Section */}
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground px-4">Editor</h3>

          <SettingRow icon={editorTheme === 'light' ? Sun : Moon} label="Theme">
            <Tabs
              value={editorTheme}
              onValueChange={(v) => {
                const next = v as 'light' | 'dark';
                setEditorTheme(next);
                setTheme(next);
              }}
            >
              <TabsList className="h-7 p-0.5 border-none bg-secondary">
                <TabsTrigger value="light" className="text-xs px-2 py-1">Light</TabsTrigger>
                <TabsTrigger value="dark" className="text-xs px-2 py-1">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </SettingRow>

          <SettingRow icon={Type} label="Font size">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                aria-label="Decrease font size"
                className="p-1 rounded-md hover:bg-muted text-foreground transition-colors"
              >
                <Minus className="size-3 shrink-0" />
              </button>
              <span className="text-xs font-mono w-6 text-center">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                aria-label="Increase font size"
                className="p-1 rounded-md hover:bg-muted text-foreground transition-colors"
              >
                <Plus className="size-3 shrink-0" />
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
