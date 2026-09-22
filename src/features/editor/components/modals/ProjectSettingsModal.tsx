'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  X,
  FileText,
  BookOpen,
  Paintbrush,
  Bell,
  Settings,
  Landmark,
  ExternalLink,
  SpellCheck,
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
import {
  useSettingsStore,
  usePageStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/store';
import { MONACO_THEMES } from '../editor/monaco-themes';
import { useTheme } from '@/shared/providers';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { useQuery } from '@tanstack/react-query';

type SettingsTab =
  | 'editor'
  | 'spelling'
  | 'compiler'
  | 'references'
  | 'appearance'
  | 'notifications';

// ── Overleaf 1:1 Code Icon (<>) ────────────────────────────────────────────────
function CodeIconBrackets({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
    </svg>
  );
}

// ── Overleaf 1:1 Switch (Green Pill Toggle) ────────────────────────────────────
function OverleafSwitch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'cursor-pointer transition-colors',
        'data-[state=checked]:bg-primary',
        'data-[state=unchecked]:bg-muted-foreground/30',
        'h-[22px] w-[42px]'
      )}
    />
  );
}

// ── Overleaf Setting Row (Title, Subtitle, Control) ────────────────────────────
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-b border-border/40 last:border-b-0">
      <div className="min-w-0 flex-1 pr-4">
        <h4 className="text-sm font-medium text-foreground leading-snug">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 leading-normal">{description}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

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
    stopOnFirstError,
    setStopOnFirstError,
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
    editorTheme,
    setEditorTheme,
    spellCheck,
    setSpellCheck,
    spellCheckLanguage,
    setSpellCheckLanguage,
    autoCloseBrackets,
    setAutoCloseBrackets,
    linterEnabled,
    setLinterEnabled,
    autoComplete,
    setAutoComplete,
    nonBlinkingCursor,
    setNonBlinkingCursor,
    showEditorTabs,
    setShowEditorTabs,
    previewEditorTabs,
    setPreviewEditorTabs,
    pdfViewer,
    setPdfViewer,
    notifyComments,
    setNotifyComments,
    notifyUpdates,
    setNotifyUpdates,
  } = useSettingsStore();

  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

  // Query project files to populate Main Document and Bib files
  const { data: projectFiles } = useQuery({
    ...filesQuery(pageId ?? projectId ?? ''),
    enabled: Boolean(pageId || projectId),
  });

  const texFiles = useMemo(() => {
    if (!projectFiles || !Array.isArray(projectFiles)) return ['main.tex'];
    const filtered = projectFiles
      .filter((f: any) => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.tex'))
      .map((f: any) => f.name);
    return filtered.length > 0 ? filtered : ['main.tex'];
  }, [projectFiles]);

  const bibFiles = useMemo(() => {
    if (!projectFiles || !Array.isArray(projectFiles)) return ['references.bib'];
    const filtered = projectFiles
      .filter((f: any) => typeof f.name === 'string' && f.name.toLowerCase().endsWith('.bib'))
      .map((f: any) => f.name);
    return filtered.length > 0 ? filtered : ['references.bib'];
  }, [projectFiles]);

  const navTabs = [
    { id: 'editor' as const, label: 'Editor', icon: CodeIconBrackets },
    { id: 'spelling' as const, label: 'Spelling and language', icon: SpellCheck },
    { id: 'compiler' as const, label: 'Compiler', icon: FileText },
    { id: 'references' as const, label: 'References', icon: BookOpen },
    { id: 'appearance' as const, label: 'Appearance', icon: Paintbrush },
    { id: 'notifications' as const, label: 'Project notifications', icon: Bell },
  ];

  return (
    <Dialog open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-300 rounded-lg text-foreground select-none flex flex-col max-h-[85vh] h-[580px]">
        {/* ── Dialog Header (Overleaf 1:1) ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-background shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Project and editor preferences configuration
          </DialogDescription>
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            aria-label="Close"
            className="size-7 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* ── 2-Column Split: Sidebar Navigation & Content Panel ────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-56 shrink-0 border-r border-border p-3 flex flex-col gap-1 overflow-y-auto bg-muted/15">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer w-full outline-none',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/80 hover:text-foreground hover:bg-muted/60 font-normal'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}

            {/* Separator before external links */}
            <div className="h-px bg-border/60 my-1.5" />

            {/* Account Settings Link */}
            <Link
              href="/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors group cursor-pointer outline-none"
            >
              <Settings className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="flex-1 truncate">Account settings</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>

            {/* Subscription Link */}
            <Link
              href="/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors group cursor-pointer outline-none"
            >
              <Landmark className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="flex-1 truncate">Subscription</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {/* 1. EDITOR TAB (Matching Overleaf Screenshot 1:1) */}
            {activeTab === 'editor' && (
              <div className="space-y-1">
                <SettingRow
                  title="Auto-complete"
                  description="Suggests code completions while typing"
                >
                  <OverleafSwitch
                    checked={autoComplete}
                    onCheckedChange={setAutoComplete}
                  />
                </SettingRow>

                <SettingRow
                  title="Auto-close brackets"
                  description="Automatically insert closing brackets and parentheses"
                >
                  <OverleafSwitch
                    checked={autoCloseBrackets}
                    onCheckedChange={setAutoCloseBrackets}
                  />
                </SettingRow>

                <SettingRow
                  title="Non-blinking cursor"
                  description="Reduces visual distraction by keeping the cursor solid"
                >
                  <OverleafSwitch
                    checked={nonBlinkingCursor}
                    onCheckedChange={setNonBlinkingCursor}
                  />
                </SettingRow>

                <SettingRow
                  title="Code check"
                  description="Enables real-time syntax checking in the editor"
                >
                  <OverleafSwitch
                    checked={linterEnabled}
                    onCheckedChange={setLinterEnabled}
                  />
                </SettingRow>

                <SettingRow
                  title="Open files in tabs"
                  description="Open each file in its own tab"
                >
                  <OverleafSwitch
                    checked={showEditorTabs}
                    onCheckedChange={setShowEditorTabs}
                  />
                </SettingRow>

                <SettingRow
                  title="Preview editor tabs"
                  description="Tabs open in preview mode until you interact with them"
                >
                  <OverleafSwitch
                    checked={previewEditorTabs}
                    onCheckedChange={setPreviewEditorTabs}
                  />
                </SettingRow>

                <SettingRow
                  title="Keybindings"
                  description="Work in Vim or Emacs emulation mode"
                >
                  <Select
                    value={keybinding}
                    onValueChange={(val) => setKeybinding(val as KeybindingMode)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Keybindings" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="standard" className="cursor-pointer text-xs">
                        None
                      </SelectItem>
                      <SelectItem value="vim" className="cursor-pointer text-xs">
                        Vim
                      </SelectItem>
                      <SelectItem value="emacs" className="cursor-pointer text-xs">
                        Emacs
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="PDF Viewer"
                  description="Choose built-in PDF viewer or native browser viewer"
                >
                  <Select
                    value={pdfViewer}
                    onValueChange={(val) => setPdfViewer(val as 'overleaf' | 'browser')}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="PDF Viewer" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="overleaf" className="cursor-pointer text-xs">
                        Overleaf
                      </SelectItem>
                      <SelectItem value="browser" className="cursor-pointer text-xs">
                        Browser
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Word wrap"
                  description="Wrap long lines of text to fit the editor window"
                >
                  <OverleafSwitch
                    checked={wordWrap}
                    onCheckedChange={setWordWrap}
                  />
                </SettingRow>

                <SettingRow
                  title="Line numbers"
                  description="Show or hide line numbers in the editor gutter"
                >
                  <OverleafSwitch
                    checked={lineNumbers}
                    onCheckedChange={setLineNumbers}
                  />
                </SettingRow>
              </div>
            )}

            {/* 2. SPELLING AND LANGUAGE TAB */}
            {activeTab === 'spelling' && (
              <div className="space-y-1">
                <SettingRow
                  title="Spell check"
                  description="Highlight misspelled words as you type in the editor"
                >
                  <OverleafSwitch
                    checked={spellCheck}
                    onCheckedChange={setSpellCheck}
                  />
                </SettingRow>

                <SettingRow
                  title="Spell check language"
                  description="Choose default dictionary language for spell checking"
                >
                  <Select
                    value={spellCheckLanguage}
                    onValueChange={setSpellCheckLanguage}
                  >
                    <SelectTrigger className="w-52 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="en_US" className="cursor-pointer text-xs">
                        English (United States)
                      </SelectItem>
                      <SelectItem value="en_GB" className="cursor-pointer text-xs">
                        English (United Kingdom)
                      </SelectItem>
                      <SelectItem value="vi_VN" className="cursor-pointer text-xs">
                        Tiếng Việt (Vietnamese)
                      </SelectItem>
                      <SelectItem value="fr_FR" className="cursor-pointer text-xs">
                        Français (French)
                      </SelectItem>
                      <SelectItem value="de_DE" className="cursor-pointer text-xs">
                        Deutsch (German)
                      </SelectItem>
                      <SelectItem value="es_ES" className="cursor-pointer text-xs">
                        Español (Spanish)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            )}

            {/* 3. COMPILER TAB */}
            {activeTab === 'compiler' && (
              <div className="space-y-1">
                <SettingRow
                  title="Compiler"
                  description="Select which LaTeX engine compiles your project"
                >
                  <Select
                    value={engine}
                    onValueChange={(val) => setEngine(val as CompilerEngine)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Engine" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="pdflatex" className="cursor-pointer text-xs">
                        pdfLaTeX
                      </SelectItem>
                      <SelectItem value="xelatex" className="cursor-pointer text-xs">
                        XeLaTeX
                      </SelectItem>
                      <SelectItem value="lualatex" className="cursor-pointer text-xs">
                        LuaLaTeX
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="TeX Live version"
                  description="The version of TeX Live used to compile your project"
                >
                  <Select
                    value={texLiveVersion}
                    onValueChange={setTexLiveVersion}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Version" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="2024" className="cursor-pointer text-xs">
                        2024
                      </SelectItem>
                      <SelectItem value="2023" className="cursor-pointer text-xs">
                        2023
                      </SelectItem>
                      <SelectItem value="2022" className="cursor-pointer text-xs">
                        2022
                      </SelectItem>
                      <SelectItem value="2021" className="cursor-pointer text-xs">
                        2021
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Main document"
                  description="The entrypoint LaTeX document to compile"
                >
                  <Select value={mainFile} onValueChange={setMainFile}>
                    <SelectTrigger className="w-44 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Main file" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {texFiles.map((file) => (
                        <SelectItem key={file} value={file} className="cursor-pointer text-xs">
                          {file}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Auto-compile"
                  description="Automatically recompile when files change"
                >
                  <OverleafSwitch
                    checked={autoCompile}
                    onCheckedChange={setAutoCompile}
                  />
                </SettingRow>

                <SettingRow
                  title="Fast [draft] compile"
                  description="Draft mode compiles faster by skipping heavy figures and fonts"
                >
                  <OverleafSwitch
                    checked={compileMode === 'draft'}
                    onCheckedChange={(v) => setCompileMode(v ? 'draft' : 'full')}
                  />
                </SettingRow>

                <SettingRow
                  title="Stop on first error"
                  description="Stop compilation immediately when the first LaTeX error occurs"
                >
                  <OverleafSwitch
                    checked={stopOnFirstError}
                    onCheckedChange={setStopOnFirstError}
                  />
                </SettingRow>

                <SettingRow
                  title="Cache auxiliary files"
                  description="Reuse previous build artifacts to accelerate re-compilation"
                >
                  <OverleafSwitch
                    checked={useCache}
                    onCheckedChange={setUseCache}
                  />
                </SettingRow>
              </div>
            )}

            {/* 4. REFERENCES TAB */}
            {activeTab === 'references' && (
              <div className="space-y-1">
                <SettingRow
                  title="Mendeley"
                  description="Link and synchronize your Mendeley reference library with this project"
                >
                  <button
                    type="button"
                    onClick={() => toast.info('Mendeley integration: connect your account in Account Settings.')}
                    className="h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    Link Mendeley
                  </button>
                </SettingRow>

                <SettingRow
                  title="Zotero"
                  description="Link and synchronize your Zotero reference library with this project"
                >
                  <button
                    type="button"
                    onClick={() => toast.info('Zotero integration: connect your account in Account Settings.')}
                    className="h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    Link Zotero
                  </button>
                </SettingRow>

                <SettingRow
                  title="Default bibliography file"
                  description="Primary .bib database file used for auto-completing citations"
                >
                  <Select defaultValue={bibFiles[0] || 'references.bib'}>
                    <SelectTrigger className="w-44 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Bib file" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {bibFiles.map((file) => (
                        <SelectItem key={file} value={file} className="cursor-pointer text-xs">
                          {file}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            )}

            {/* 5. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-1">
                <SettingRow
                  title="Editor theme"
                  description="Syntax highlighting color theme for the Code editor"
                >
                  <Select
                    value={editorTheme}
                    onValueChange={(val) => setEditorTheme(val as EditorTheme)}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {MONACO_THEMES.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="cursor-pointer text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Interface theme"
                  description="Light or Dark mode for the surrounding editor interface"
                >
                  <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="system" className="cursor-pointer text-xs">
                        System
                      </SelectItem>
                      <SelectItem value="light" className="cursor-pointer text-xs">
                        Light
                      </SelectItem>
                      <SelectItem value="dark" className="cursor-pointer text-xs">
                        Dark
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font size"
                  description="Size of text in the Code editor"
                >
                  <Select
                    value={String(fontSize)}
                    onValueChange={(val) => setFontSize(Number(val))}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {[12, 13, 14, 15, 16, 18, 20].map((size) => (
                        <SelectItem key={size} value={String(size)} className="cursor-pointer text-xs">
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font family"
                  description="Monospace font family for the code editor"
                >
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="w-44 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Font" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="default" className="cursor-pointer text-xs">
                        Default (Monaco)
                      </SelectItem>
                      <SelectItem value="fira" className="cursor-pointer text-xs">
                        Fira Code
                      </SelectItem>
                      <SelectItem value="jetbrains" className="cursor-pointer text-xs">
                        JetBrains Mono
                      </SelectItem>
                      <SelectItem value="courier" className="cursor-pointer text-xs">
                        Courier New
                      </SelectItem>
                      <SelectItem value="inconsolata" className="cursor-pointer text-xs">
                        Inconsolata
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            )}

            {/* 6. PROJECT NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="space-y-1">
                <SettingRow
                  title="Comments and mentions"
                  description="Receive emails when someone mentions you or replies to your comments"
                >
                  <OverleafSwitch
                    checked={notifyComments}
                    onCheckedChange={setNotifyComments}
                  />
                </SettingRow>

                <SettingRow
                  title="Project activity summary"
                  description="Receive weekly summaries of changes and collaboration in this project"
                >
                  <OverleafSwitch
                    checked={notifyUpdates}
                    onCheckedChange={setNotifyUpdates}
                  />
                </SettingRow>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
