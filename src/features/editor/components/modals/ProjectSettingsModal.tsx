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
  Plus,
} from 'lucide-react';
import { useSpellingDictionary } from '../../hooks/use-spelling';
import { ProjectReferencesTab } from './ProjectReferencesTab';
import { ProjectGithubTab } from './ProjectGithubTab';
import { GitHubIcon } from '@/shared/components/icons';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';
import {
  useSettingsStore,
  usePageStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/store';
import { EDITOR_THEMES } from '../editor/editor-themes';
import { useTheme } from '@/shared/providers';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { useQuery } from '@tanstack/react-query';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

type SettingsTab =
  | 'editor'
  | 'spelling'
  | 'compiler'
  | 'references'
  | 'github'
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
  const { currentPage } = usePageStore();
  const pageId = params?.pageId;
  const projectId = params?.projectId || params?.pageId || currentPage?.id;
  const projectTitle = currentPage?.title || 'manuscript';

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
    lineHeight,
    setLineHeight,
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

  const [newWordInput, setNewWordInput] = useState('');
  const {
    userWords,
    projectWords,
    addWord,
    removeWord,
  } = useSpellingDictionary(projectId, settingsPanelOpen && activeTab === 'spelling');

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWordInput.trim().toLowerCase();
    if (!trimmed) return;
    addWord({ word: trimmed, isProject: !!projectId });
    setNewWordInput('');
  };

  const handleRemoveWord = (word: string, isProject: boolean) => {
    removeWord({ word, isProject });
  };

  const navTabs = [
    { id: 'editor' as const, label: 'Editor', icon: CodeIconBrackets },
    { id: 'spelling' as const, label: 'Spelling and language', icon: SpellCheck },
    { id: 'compiler' as const, label: 'Compiler', icon: FileText },
    { id: 'references' as const, label: 'References', icon: BookOpen },
    { id: 'github' as const, label: 'GitHub Sync', icon: GitHubIcon },
    { id: 'appearance' as const, label: 'Appearance', icon: Paintbrush },
    { id: 'notifications' as const, label: 'Project notifications', icon: Bell },
  ];

  return (
    <Dialog open={settingsPanelOpen} onOpenChange={setSettingsPanelOpen}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-300 rounded-lg text-foreground select-none flex flex-col max-h-[85vh] h-[580px]">
        {/* ── Dialog Header (Overleaf 1:1) ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-background shrink-0">
          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Project and editor preferences configuration
          </DialogDescription>
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* ── 2-Column Split: Sidebar Navigation & Content Panel ────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-56 shrink-0 border-r border-border p-3 flex flex-col gap-1 overflow-y-auto bg-muted/15" role="tablist">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left cursor-pointer w-full outline-none focus-visible:ring-1 focus-visible:ring-primary',
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

            {/* Project Functions / Actions (Overleaf Parity) */}
            <div className="h-px bg-border/60 my-1.5" />
            <button
              type="button"
              onClick={() => {
                setSettingsPanelOpen(false);
                EditorEventBus.emit('flux:open-word-count');
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors text-left cursor-pointer w-full outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Word count</span>
            </button>

            {/* Separator before external links */}
            <div className="h-px bg-border/60 my-1.5" />

            {/* Account Settings Link */}
            <Link
              href="/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors group cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors group cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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

                <SettingRow
                  title="Font size"
                  description="Adjust editor text size in pixels"
                >
                  <Select
                    value={String(fontSize || 15)}
                    onValueChange={(val) => setFontSize(Number(val))}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Font size" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {[11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((sz) => (
                        <SelectItem key={sz} value={String(sz)} className="cursor-pointer text-xs">
                          {sz}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Font family"
                  description="Select typeface used in the editor"
                >
                  <Select
                    value={fontFamily || 'default'}
                    onValueChange={(val) => setFontFamily(val)}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Font family" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="default" className="cursor-pointer text-xs">
                        Default Monospace
                      </SelectItem>
                      <SelectItem value="menlo" className="cursor-pointer text-xs">
                        Menlo / Monaco
                      </SelectItem>
                      <SelectItem value="consolas" className="cursor-pointer text-xs">
                        Consolas
                      </SelectItem>
                      <SelectItem value="fira" className="cursor-pointer text-xs">
                        Fira Code
                      </SelectItem>
                      <SelectItem value="source-code" className="cursor-pointer text-xs">
                        Source Code Pro
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Line height"
                  description="Spacing between lines of text in the editor"
                >
                  <Select
                    value={String(lineHeight || 1.6)}
                    onValueChange={(val) => setLineHeight(Number(val))}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background">
                      <SelectValue placeholder="Line height" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="1.3" className="cursor-pointer text-xs">
                        Compact (1.3)
                      </SelectItem>
                      <SelectItem value="1.6" className="cursor-pointer text-xs">
                        Normal (1.6)
                      </SelectItem>
                      <SelectItem value="1.9" className="cursor-pointer text-xs">
                        Relaxed (1.9)
                      </SelectItem>
                    </SelectContent>
                  </Select>
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

                {/* ── Personal & Project Learned Words (Overleaf Parity) ── */}
                <div className="pt-4 mt-3 border-t border-border/50">
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Learned words
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Words added to your personal and project custom dictionaries will not be flagged as spelling errors.
                  </p>

                  {/* Add word input form */}
                  <form onSubmit={handleAddWord} className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Add a custom word..."
                      value={newWordInput}
                      onChange={(e) => setNewWordInput(e.target.value)}
                      className="flex-1 h-8 px-2.5 text-xs rounded-md border border-border bg-background outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    />
                    <button
                      type="submit"
                      disabled={!newWordInput.trim()}
                      className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 hover:bg-primary-hover disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <Plus className="size-3.5 shrink-0" />
                      <span>Add word</span>
                    </button>
                  </form>

                  {/* Word Badges */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border/40 rounded-md bg-muted/20">
                    {userWords.length === 0 && projectWords.length === 0 ? (
                      <span className="text-xs text-muted-foreground/80 italic p-1">
                         No learned words in your dictionary yet.
                      </span>
                    ) : (
                      <>
                        {userWords.map((word) => (
                          <span
                            key={`user-${word}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-background border border-border text-foreground group"
                          >
                            <span>{word}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWord(word, false)}
                              title={`Remove "${word}" from dictionary`}
                              className="size-3.5 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))}
                        {projectWords.map((word) => (
                          <span
                            key={`proj-${word}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary group"
                            title="Project dictionary word"
                          >
                            <span>{word}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveWord(word, true)}
                              title={`Remove "${word}" from project dictionary`}
                              className="size-3.5 rounded-full inline-flex items-center justify-center text-primary/70 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
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
              <ProjectReferencesTab projectId={projectId} bibFiles={bibFiles} />
            )}

            {/* 5. GITHUB SYNC TAB */}
            {activeTab === 'github' && (
              <ProjectGithubTab projectId={projectId} projectTitle={projectTitle} />
            )}

            {/* 6. APPEARANCE TAB */}
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
                      {EDITOR_THEMES.map((t) => (
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
