'use client';

/**
 * CompilerEditorSection.tsx
 *
 * Compiler and Editor settings panels for SettingsModal.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  usePageStore,
  useSettingsStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/core';
import {
  SettingRow,
  SettingsSwitch,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './settings-common';

export interface CompilerEditorSectionProps {
  texFiles: string[];
  onMainFileChange: (newMainFileName: string) => void;
  section?: 'compiler' | 'editor' | 'all';
}

export function CompilerEditorSection({
  texFiles,
  onMainFileChange,
  section = 'all',
}: CompilerEditorSectionProps) {
  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const texLiveVersion = useSettingsStore((s) => s.texLiveVersion || '2024');
  const setTexLiveVersion = useSettingsStore((s) => s.setTexLiveVersion);
  const mainFilePath = usePageStore((s) => s.mainFilePath);
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const setAutoCloseBrackets = useSettingsStore((s) => s.setAutoCloseBrackets);
  const autoComplete = useSettingsStore((s) => s.autoComplete);
  const setAutoComplete = useSettingsStore((s) => s.setAutoComplete);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useSettingsStore((s) => s.setLinterEnabled);
  const keybinding = useSettingsStore((s) => s.keybinding);
  const setKeybinding = useSettingsStore((s) => s.setKeybinding);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const setEditorTheme = useSettingsStore((s) => s.setEditorTheme);
  const pdfViewer = useSettingsStore((s) => s.pdfViewer);
  const setPdfViewer = useSettingsStore((s) => s.setPdfViewer);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const setSpellCheck = useSettingsStore((s) => s.setSpellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage || 'en-US');
  const setSpellCheckLanguage = useSettingsStore((s) => s.setSpellCheckLanguage);

  const showCompiler = section === 'all' || section === 'compiler';
  const showEditor = section === 'all' || section === 'editor';

  return (
    <div className="space-y-1">
      {showCompiler && (
        <>
          <SettingRow title="Compiler">
            <Select
              value={engine}
              onValueChange={(val) => setEngine(val as CompilerEngine)}
            >
              <SelectTrigger
                aria-label="Compiler engine"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdflatex" className="cursor-pointer text-xs">
                  pdfLaTeX
                </SelectItem>
                <SelectItem value="xelatex" className="cursor-pointer text-xs">
                  XeLaTeX
                </SelectItem>
                <SelectItem value="lualatex" className="cursor-pointer text-xs">
                  LuaLaTeX
                </SelectItem>
                <SelectItem value="latex" className="cursor-pointer text-xs">
                  LaTeX
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="TeX Live version">
            <Select value={texLiveVersion} onValueChange={setTexLiveVersion}>
              <SelectTrigger
                aria-label="TeX Live version"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026" className="cursor-pointer text-xs">2026</SelectItem>
                <SelectItem value="2025" className="cursor-pointer text-xs">2025</SelectItem>
                <SelectItem value="2024" className="cursor-pointer text-xs">2024</SelectItem>
                <SelectItem value="2023" className="cursor-pointer text-xs">2023</SelectItem>
                <SelectItem value="2022" className="cursor-pointer text-xs">2022</SelectItem>
                <SelectItem value="2021" className="cursor-pointer text-xs">2021</SelectItem>
                <SelectItem value="2020" className="cursor-pointer text-xs">2020</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Main document">
            <Select
              value={
                (mainFilePath && texFiles.includes(mainFilePath) ? mainFilePath : null) ||
                texFiles[0] ||
                'main.tex'
              }
              onValueChange={onMainFileChange}
            >
              <SelectTrigger
                aria-label="Main document"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Select file" />
              </SelectTrigger>
              <SelectContent>
                {texFiles.map((fn) => (
                  <SelectItem key={fn} value={fn} className="cursor-pointer text-xs">
                    {fn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}

      {showEditor && (
        <>
          <SettingRow title="Editor theme">
            <Select
              value={editorTheme}
              onValueChange={(val) => setEditorTheme(val as EditorTheme)}
            >
              <SelectTrigger
                aria-label="Editor theme"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="cursor-pointer text-xs">
                  Auto
                </SelectItem>
                <SelectItem value="latex-light" className="cursor-pointer text-xs">
                  LaTeX Light
                </SelectItem>
                <SelectItem value="latex-dark" className="cursor-pointer text-xs">
                  LaTeX Dark
                </SelectItem>
                <SelectItem value="monokai" className="cursor-pointer text-xs">
                  Monokai
                </SelectItem>
                <SelectItem value="dracula" className="cursor-pointer text-xs">
                  Dracula
                </SelectItem>
                <SelectItem value="solarized-light" className="cursor-pointer text-xs">
                  Solarized Light
                </SelectItem>
                <SelectItem value="solarized-dark" className="cursor-pointer text-xs">
                  Solarized Dark
                </SelectItem>
                <SelectItem value="github-light" className="cursor-pointer text-xs">
                  GitHub Light
                </SelectItem>
                <SelectItem value="github-dark" className="cursor-pointer text-xs">
                  GitHub Dark
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Font family">
            <Select value={fontFamily || 'default'} onValueChange={setFontFamily}>
              <SelectTrigger
                aria-label="Font family"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_FONT_FAMILIES.map((f) => (
                  <SelectItem key={f.id} value={f.id} className="cursor-pointer text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Font size">
            <Select
              value={String(fontSize)}
              onValueChange={(val) => setFontSize(Number(val))}
            >
              <SelectTrigger
                aria-label="Font size"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_FONT_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)} className="cursor-pointer text-xs">
                    {s}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Line height">
            <Select
              value={String(lineHeight === 1.5 ? 1.6 : lineHeight || 1.6)}
              onValueChange={(val) => setLineHeight(Number(val))}
            >
              <SelectTrigger
                aria-label="Line height"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Line height" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.2" className="cursor-pointer text-xs">
                  Compact
                </SelectItem>
                <SelectItem value="1.6" className="cursor-pointer text-xs">
                  Normal
                </SelectItem>
                <SelectItem value="1.8" className="cursor-pointer text-xs">
                  Comfortable
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Keybindings">
            <Select
              value={keybinding}
              onValueChange={(val) => setKeybinding(val as KeybindingMode)}
            >
              <SelectTrigger
                aria-label="Editor keybinding"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Keybinding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard" className="cursor-pointer text-xs">
                  Standard
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

          <SettingRow title="Spell check">
            <Select
              value={spellCheck ? spellCheckLanguage.replace('_', '-') : 'off'}
              onValueChange={(val) => {
                if (val === 'off') {
                  setSpellCheck(false);
                } else {
                  setSpellCheck(true);
                  setSpellCheckLanguage(val);
                }
              }}
            >
              <SelectTrigger
                aria-label="Spell check language"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off" className="cursor-pointer text-xs">Off</SelectItem>
                <SelectItem value="en-US" className="cursor-pointer text-xs">English (US)</SelectItem>
                <SelectItem value="en-GB" className="cursor-pointer text-xs">English (UK)</SelectItem>
                <SelectItem value="vi" className="cursor-pointer text-xs">Tiếng Việt</SelectItem>
                <SelectItem value="fr" className="cursor-pointer text-xs">Français</SelectItem>
                <SelectItem value="de" className="cursor-pointer text-xs">Deutsch</SelectItem>
                <SelectItem value="es" className="cursor-pointer text-xs">Español</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <SettingRow title="Auto-complete">
            <SettingsSwitch
              checked={autoComplete}
              onCheckedChange={setAutoComplete}
              aria-label="Auto-complete toggle"
            />
          </SettingRow>

          <SettingRow title="Auto-close brackets">
            <SettingsSwitch
              checked={autoCloseBrackets}
              onCheckedChange={setAutoCloseBrackets}
              aria-label="Auto-close brackets toggle"
            />
          </SettingRow>

          <SettingRow title="Code check">
            <SettingsSwitch
              checked={linterEnabled}
              onCheckedChange={setLinterEnabled}
              aria-label="Code check toggle"
            />
          </SettingRow>

          <SettingRow title="PDF viewer">
            <Select
              value={pdfViewer}
              onValueChange={(val) => setPdfViewer(val as 'overleaf' | 'browser')}
            >
              <SelectTrigger
                aria-label="PDF viewer"
                className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
              >
                <SelectValue placeholder="Viewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overleaf" className="cursor-pointer text-xs">
                  Built-in
                </SelectItem>
                <SelectItem value="browser" className="cursor-pointer text-xs">
                  Browser
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </>
      )}
    </div>
  );
}
