'use client';

import React, { useState } from 'react';
import {
  X,
  Cpu,
  Settings,
  FileCode2,
  Calendar,
  Layers,
  Zap,
  Moon,
  Sun,
  Type,
  WrapText,
  Hash,
  Keyboard,
  Languages,
  HardDrive,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore, usePageStore, type CompilerEngine, type CompileMode, type KeybindingMode } from '@/features/editor/store';
import { useTheme } from '@/shared/providers';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

export default function ProjectSettingsModal() {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const pageId = params?.pageId;
  const projectId = params?.projectId;

  const {
    settingsPanelOpen,
    setSettingsPanelOpen,
    engine,
    setEngine,
    texLiveVersion,
    setTexLiveVersion,
    mainFile,
    setMainFile,
    autoCompile,
    setAutoCompile,
    compileMode,
    setCompileMode,
    useCache,
    setUseCache,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    keybinding,
    setKeybinding,
    spellCheck,
    setSpellCheck,
    spellCheckLanguage,
    setSpellCheckLanguage,
  } = useSettingsStore();

  const { theme, setTheme } = useTheme();
  const { currentPage } = usePageStore();
  const [activeTab, setActiveTab] = useState<'compiler' | 'editor'>('compiler');

  // Query project files to populate Main Document selector
  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? projectId ?? ''),
    enabled: Boolean(pageId || projectId),
  });

  const texFiles = React.useMemo(() => {
    if (!projectFiles || !Array.isArray(projectFiles)) return ['main.tex'];
    const filtered = projectFiles
      .filter((f: any) => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.tex'))
      .map((f: any) => f.name);
    return filtered.length > 0 ? filtered : ['main.tex'];
  }, [projectFiles]);

  return (
    <Dialog open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/30">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Settings className="size-4 text-emerald-600 dark:text-emerald-500" />
              Project Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {currentPage?.title || 'Academic Paper Project'} · Configure compilation and editor environment
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border px-6 bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab('compiler')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2',
              activeTab === 'compiler'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Cpu className="size-3.5" />
            Compiler
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2',
              activeTab === 'editor'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Keyboard className="size-3.5" />
            Editor
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">
          {activeTab === 'compiler' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* 1. LaTeX Compiler Engine */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-muted-foreground" />
                    LaTeX Compiler
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Choose the typesetting engine for compiling your LaTeX document.
                  </p>
                </div>
                <Select value={engine} onValueChange={(val: CompilerEngine) => setEngine(val)}>
                  <SelectTrigger className="w-40 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    <SelectItem value="pdflatex">pdfLaTeX (Default)</SelectItem>
                    <SelectItem value="xelatex">XeLaTeX (Unicode)</SelectItem>
                    <SelectItem value="lualatex">LuaLaTeX (Modern)</SelectItem>
                    <SelectItem value="latex">Classic LaTeX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. TeX Live Version */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    TeX Live Version
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Select distribution year for reproducible build environments.
                  </p>
                </div>
                <Select value={texLiveVersion || '2024'} onValueChange={setTexLiveVersion}>
                  <SelectTrigger className="w-40 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    <SelectItem value="2024">TeX Live 2024 (Latest)</SelectItem>
                    <SelectItem value="2023">TeX Live 2023</SelectItem>
                    <SelectItem value="2022">TeX Live 2022</SelectItem>
                    <SelectItem value="2021">TeX Live 2021</SelectItem>
                    <SelectItem value="2020">TeX Live 2020</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Main Document */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileCode2 className="size-3.5 text-muted-foreground" />
                    Main Document
                  </div>
                  <p className="text-11 text-muted-foreground">
                    The root document file to compile as the entrypoint.
                  </p>
                </div>
                <Select value={mainFile || 'main.tex'} onValueChange={setMainFile}>
                  <SelectTrigger className="w-40 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    {texFiles.map((file) => (
                      <SelectItem key={file} value={file}>
                        {file}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Compilation Mode */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-muted-foreground" />
                    Compilation Mode
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Draft mode drafts placeholder boxes for images for instant preview.
                  </p>
                </div>
                <Select value={compileMode} onValueChange={(val: CompileMode) => setCompileMode(val)}>
                  <SelectTrigger className="w-40 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    <SelectItem value="full">Normal (Full)</SelectItem>
                    <SelectItem value="draft">Draft (Fast preview)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Auto Compile & Cache */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Zap className="size-3.5 text-muted-foreground" />
                      Auto-compile
                    </span>
                    <p className="text-10 text-muted-foreground">Compile as you type</p>
                  </div>
                  <Switch checked={autoCompile} onCheckedChange={setAutoCompile} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <HardDrive className="size-3.5 text-muted-foreground" />
                      Cache Acceleration
                    </span>
                    <p className="text-10 text-muted-foreground">Reuse unchanged files</p>
                  </div>
                  <Switch checked={useCache} onCheckedChange={setUseCache} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* 1. Theme Selection */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {theme === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
                    Workspace Theme
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Switch between Light and Dark interface appearance.
                  </p>
                </div>
                <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                  <SelectTrigger className="w-36 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    <SelectItem value="light">Overleaf Light</SelectItem>
                    <SelectItem value="dark">Overleaf Dark</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Keybindings */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Keyboard className="size-3.5 text-muted-foreground" />
                    Keybindings
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Select keyboard navigation mode for code editing.
                  </p>
                </div>
                <Select value={keybinding} onValueChange={(val: KeybindingMode) => setKeybinding(val)}>
                  <SelectTrigger className="w-36 h-8 text-xs cursor-pointer shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs z-[10000]">
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="vim">Vim Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Font Size & Family */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Type className="size-3.5 text-muted-foreground" />
                      Font Size
                    </span>
                    <p className="text-10 text-muted-foreground">{fontSize}px editor size</p>
                  </div>
                  <Select value={String(fontSize)} onValueChange={(val) => setFontSize(Number(val))}>
                    <SelectTrigger className="w-24 h-8 text-xs cursor-pointer shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs z-[10000]">
                      <SelectItem value="12">12px</SelectItem>
                      <SelectItem value="13">13px</SelectItem>
                      <SelectItem value="14">14px</SelectItem>
                      <SelectItem value="15">15px</SelectItem>
                      <SelectItem value="16">16px</SelectItem>
                      <SelectItem value="18">18px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Type className="size-3.5 text-muted-foreground" />
                      Font Family
                    </span>
                    <p className="text-10 text-muted-foreground">Monospace typeface</p>
                  </div>
                  <Select value={fontFamily || 'default'} onValueChange={setFontFamily}>
                    <SelectTrigger className="w-28 h-8 text-xs cursor-pointer shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs z-[10000]">
                      <SelectItem value="default">Default Mono</SelectItem>
                      <SelectItem value="jetbrains">JetBrains Mono</SelectItem>
                      <SelectItem value="fira">Fira Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 4. Spell Check */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/70 bg-muted/20">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Languages className="size-3.5 text-muted-foreground" />
                    Spell Check Dictionary
                  </div>
                  <p className="text-11 text-muted-foreground">
                    Highlight typing and spelling errors in comments and prose.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={spellCheck ? (spellCheckLanguage || 'en_US') : 'off'}
                    onValueChange={(val) => {
                      if (val === 'off') {
                        setSpellCheck(false);
                      } else {
                        setSpellCheck(true);
                        setSpellCheckLanguage(val);
                      }
                    }}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs z-[10000]">
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="en_GB">English (UK)</SelectItem>
                      <SelectItem value="vi_VN">Vietnamese</SelectItem>
                      <SelectItem value="off">Turned Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 5. Toggles: Word Wrap & Line Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <WrapText className="size-3.5 text-muted-foreground" />
                      Word Wrap
                    </span>
                    <p className="text-10 text-muted-foreground">Wrap long lines</p>
                  </div>
                  <Switch checked={wordWrap} onCheckedChange={setWordWrap} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Hash className="size-3.5 text-muted-foreground" />
                      Line Numbers
                    </span>
                    <p className="text-10 text-muted-foreground">Show gutter numbers</p>
                  </div>
                  <Switch checked={lineNumbers} onCheckedChange={setLineNumbers} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-muted/40 border-t border-border/80 flex items-center justify-between text-11 text-muted-foreground">
          <span>Preferences are saved automatically for this project.</span>
          <button
            type="button"
            onClick={() => {
              setSettingsPanelOpen(false);
              toast.success('Settings updated');
            }}
            className="px-4 py-1.5 rounded-md bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
