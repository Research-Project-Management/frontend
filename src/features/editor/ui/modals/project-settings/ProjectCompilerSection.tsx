'use client';

/**
 * ProjectCompilerSection.tsx
 *
 * Compiler, Editor, Typography, and Diagnostic Settings section inside the Overleaf Menu Drawer.
 */

import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  useSettingsStore,
  type CompilerEngine,
  type KeybindingMode,
  type EditorTheme,
} from '@/features/editor/core';
import {
  SettingRow,
  OverleafSwitch,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './settings-common';

export interface ProjectCompilerSectionProps {
  texFiles: string[];
  bibFiles: string[];
  onMainFileChange: (newMainFileName: string) => void;
  onClearCache: () => void;
  isClearingCache: boolean;
}

export function ProjectCompilerSection({
  texFiles,
  bibFiles,
  onMainFileChange,
  onClearCache,
  isClearingCache,
}: ProjectCompilerSectionProps) {
  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const texLiveVersion = useSettingsStore((s) => s.texLiveVersion || '2024');
  const setTexLiveVersion = useSettingsStore((s) => s.setTexLiveVersion);
  const mainFile = useSettingsStore((s) => s.mainFile);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const setAutoCloseBrackets = useSettingsStore((s) => s.setAutoCloseBrackets);
  const autoComplete = useSettingsStore((s) => s.autoComplete);
  const setAutoComplete = useSettingsStore((s) => s.setAutoComplete);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useSettingsStore((s) => s.setLinterEnabled);
  const errorLensEnabled = useSettingsStore((s) => s.errorLensEnabled);
  const setErrorLensEnabled = useSettingsStore((s) => s.setErrorLensEnabled);
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
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useSettingsStore((s) => s.setStopOnFirstError);
  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const setSpellCheck = useSettingsStore((s) => s.setSpellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage || 'en-US');
  const setSpellCheckLanguage = useSettingsStore((s) => s.setSpellCheckLanguage);
  const mainBibFile = useSettingsStore((s) => s.mainBibFile);
  const setMainBibFile = useSettingsStore((s) => s.setMainBibFile);
  const referenceSearchStyle = useSettingsStore((s) => s.referenceSearchStyle);
  const setReferenceSearchStyle = useSettingsStore((s) => s.setReferenceSearchStyle);
  const suppressBadBoxes = useSettingsStore((s) => s.suppressBadBoxes);
  const setSuppressBadBoxes = useSettingsStore((s) => s.setSuppressBadBoxes);
  const suppressFontWarnings = useSettingsStore((s) => s.suppressFontWarnings);
  const setSuppressFontWarnings = useSettingsStore((s) => s.setSuppressFontWarnings);
  const suppressPackageWarnings = useSettingsStore((s) => s.suppressPackageWarnings);
  const setSuppressPackageWarnings = useSettingsStore((s) => s.setSuppressPackageWarnings);
  const customSuppressedWarnings = useSettingsStore((s) => s.customSuppressedWarnings);
  const addSuppressedWarning = useSettingsStore((s) => s.addSuppressedWarning);
  const removeSuppressedWarning = useSettingsStore((s) => s.removeSuppressedWarning);

  const [newWarningPattern, setNewWarningPattern] = useState('');

  return (
    <section aria-labelledby="menu-settings-heading" className="space-y-1">
      <h3
        id="menu-settings-heading"
        className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
      >
        Settings
      </h3>

      {/* Compiler */}
      <SettingRow
        title="Compiler"
        description="Select which LaTeX engine compiles your project"
      >
        <Select
          value={engine}
          onValueChange={(val) => setEngine(val as CompilerEngine)}
        >
          <SelectTrigger
            aria-label="Compiler engine"
            className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
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

      {/* TeX Live Version */}
      <SettingRow
        title="TeX Live version"
        description="The version of TeX Live used to compile"
      >
        <Select
          value={texLiveVersion}
          onValueChange={setTexLiveVersion}
        >
          <SelectTrigger
            aria-label="TeX Live version"
            className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Version" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024" className="cursor-pointer text-xs">2024</SelectItem>
            <SelectItem value="2023" className="cursor-pointer text-xs">2023</SelectItem>
            <SelectItem value="2022" className="cursor-pointer text-xs">2022</SelectItem>
            <SelectItem value="2021" className="cursor-pointer text-xs">2021</SelectItem>
            <SelectItem value="2020" className="cursor-pointer text-xs">2020</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Main Document */}
      <SettingRow
        title="Main document"
        description="The root .tex document passed to the compiler"
      >
        <Select
          value={mainFile || texFiles[0] || 'main.tex'}
          onValueChange={onMainFileChange}
        >
          <SelectTrigger
            aria-label="Main document"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Select entrypoint" />
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

      {/* Main Bibliography File (Overleaf Parity) */}
      <SettingRow
        title="Main bibliography file"
        description="The primary .bib file used for citation autocomplete & reference search"
      >
        <Select
          value={mainBibFile || 'auto'}
          onValueChange={setMainBibFile}
        >
          <SelectTrigger
            aria-label="Main bibliography file"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Select bib file" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto" className="cursor-pointer text-xs">
              Auto-detect
            </SelectItem>
            {bibFiles.map((fn) => (
              <SelectItem key={fn} value={fn} className="cursor-pointer text-xs">
                {fn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Reference Search Style (Overleaf Parity) */}
      <SettingRow
        title="Reference search style"
        description="Citation format for searching and referencing entries"
      >
        <Select
          value={referenceSearchStyle || 'author-year'}
          onValueChange={(val) => setReferenceSearchStyle(val as 'author-year' | 'numeric' | 'alphanumeric')}
        >
          <SelectTrigger
            aria-label="Reference search style"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="author-year" className="cursor-pointer text-xs">
              Author-Year
            </SelectItem>
            <SelectItem value="numeric" className="cursor-pointer text-xs">
              Numeric ([1])
            </SelectItem>
            <SelectItem value="alphanumeric" className="cursor-pointer text-xs">
              Alphanumeric ([Knu84])
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Spell Check */}
      <SettingRow
        title="Spell check"
        description="Spell check language for LaTeX text"
      >
        <Select
          value={spellCheck ? spellCheckLanguage : 'off'}
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

      {/* Auto-compile */}
      <SettingRow
        title="Auto-compile"
        description="Automatically compile on document changes"
      >
        <OverleafSwitch
          checked={autoCompile}
          onCheckedChange={setAutoCompile}
          aria-label="Auto-compile toggle"
        />
      </SettingRow>

      {/* Auto-complete */}
      <SettingRow
        title="Auto-complete"
        description="Show LaTeX command, environment, and citation suggestions"
      >
        <OverleafSwitch
          checked={autoComplete}
          onCheckedChange={setAutoComplete}
          aria-label="Auto-complete toggle"
        />
      </SettingRow>

      {/* Auto-close brackets */}
      <SettingRow
        title="Auto-close brackets"
        description="Automatically insert matching brackets and quotes"
      >
        <OverleafSwitch
          checked={autoCloseBrackets}
          onCheckedChange={setAutoCloseBrackets}
          aria-label="Auto-close brackets toggle"
        />
      </SettingRow>

      {/* Code check (Linter) */}
      <SettingRow
        title="Code check"
        description="Inline syntax linting and LaTeX warnings"
      >
        <OverleafSwitch
          checked={linterEnabled}
          onCheckedChange={setLinterEnabled}
          aria-label="Code check toggle"
        />
      </SettingRow>

      {/* Error Lens (Inline LaTeX Errors & AI Fix) */}
      <SettingRow
        title="Error lens"
        description="Inline error badges at erroneous lines with 1-click AI fix"
      >
        <OverleafSwitch
          checked={errorLensEnabled}
          onCheckedChange={setErrorLensEnabled}
          aria-label="Error lens toggle"
        />
      </SettingRow>

      {/* Keybindings */}
      <SettingRow
        title="Keybindings"
        description="Keyboard navigation and shortcut behavior"
      >
        <Select
          value={keybinding}
          onValueChange={(val) => setKeybinding(val as KeybindingMode)}
        >
          <SelectTrigger
            aria-label="Editor keybinding"
            className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Keybinding" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard" className="cursor-pointer text-xs">Standard</SelectItem>
            <SelectItem value="vim" className="cursor-pointer text-xs">Vim</SelectItem>
            <SelectItem value="emacs" className="cursor-pointer text-xs">Emacs</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Font Size */}
      <SettingRow
        title="Font size"
        description="Editor editor font size in pixels"
      >
        <Select
          value={String(fontSize)}
          onValueChange={(val) => setFontSize(Number(val))}
        >
          <SelectTrigger
            aria-label="Font size"
            className="w-24 h-8 text-xs font-medium cursor-pointer border-border bg-background"
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

      {/* Font Family */}
      <SettingRow
        title="Font family"
        description="Monospace typeface for code editing"
      >
        <Select
          value={fontFamily || 'default'}
          onValueChange={setFontFamily}
        >
          <SelectTrigger
            aria-label="Font family"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_FAMILIES.map((f) => (
              <SelectItem key={f.id} value={f.id} className="cursor-pointer text-xs">
                {f.label.split(' ')[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Line Height */}
      <SettingRow
        title="Line height"
        description="Vertical spacing between lines of code"
      >
        <Select
          value={String(lineHeight || 1.5)}
          onValueChange={(val) => setLineHeight(Number(val))}
        >
          <SelectTrigger
            aria-label="Line height"
            className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Line height" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1.2" className="cursor-pointer text-xs">Compact</SelectItem>
            <SelectItem value="1.5" className="cursor-pointer text-xs">Normal</SelectItem>
            <SelectItem value="1.8" className="cursor-pointer text-xs">Comfortable</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Editor Theme */}
      <SettingRow
        title="Editor theme"
        description="Code editor syntax highlighting color theme"
      >
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
            <SelectItem value="latex-light" className="cursor-pointer text-xs">LaTeX Light</SelectItem>
            <SelectItem value="latex-dark" className="cursor-pointer text-xs">LaTeX Dark</SelectItem>
            <SelectItem value="monokai" className="cursor-pointer text-xs">Monokai</SelectItem>
            <SelectItem value="dracula" className="cursor-pointer text-xs">Dracula</SelectItem>
            <SelectItem value="solarized-light" className="cursor-pointer text-xs">Solarized Light</SelectItem>
            <SelectItem value="solarized-dark" className="cursor-pointer text-xs">Solarized Dark</SelectItem>
            <SelectItem value="github-light" className="cursor-pointer text-xs">GitHub Light</SelectItem>
            <SelectItem value="github-dark" className="cursor-pointer text-xs">GitHub Dark</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* PDF Viewer */}
      <SettingRow
        title="PDF viewer"
        description="Document viewer engine"
      >
        <Select
          value={pdfViewer}
          onValueChange={(val) => setPdfViewer(val as 'overleaf' | 'browser')}
        >
          <SelectTrigger
            aria-label="PDF viewer"
            className="w-32 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Viewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overleaf" className="cursor-pointer text-xs">Overleaf</SelectItem>
            <SelectItem value="browser" className="cursor-pointer text-xs">Native</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {/* Draft Mode (Fast compile) - Overleaf Parity */}
      <SettingRow
        title="Draft mode"
        description="Speeds up compilation by skipping image inclusion"
      >
        <OverleafSwitch
          checked={compileMode === 'draft'}
          onCheckedChange={(checked) => setCompileMode(checked ? 'draft' : 'full')}
          aria-label="Draft mode toggle"
        />
      </SettingRow>

      {/* Stop on First Error */}
      <SettingRow
        title="Stop on first error"
        description="Halt compiler immediately on fatal TeX error"
      >
        <OverleafSwitch
          checked={stopOnFirstError}
          onCheckedChange={setStopOnFirstError}
          aria-label="Stop on first error toggle"
        />
      </SettingRow>

      {/* Hide Bad Boxes (Overleaf Parity) */}
      <SettingRow
        title="Hide bad boxes"
        description="Suppress noisy Overfull & Underfull \hbox / \vbox warnings"
      >
        <OverleafSwitch
          checked={suppressBadBoxes}
          onCheckedChange={setSuppressBadBoxes}
          aria-label="Hide bad boxes toggle"
        />
      </SettingRow>

      {/* Hide Font Warnings */}
      <SettingRow
        title="Hide font warnings"
        description="Suppress missing font shapes and substitution warnings"
      >
        <OverleafSwitch
          checked={suppressFontWarnings}
          onCheckedChange={setSuppressFontWarnings}
          aria-label="Hide font warnings toggle"
        />
      </SettingRow>

      {/* Hide Package Warnings */}
      <SettingRow
        title="Hide package warnings"
        description="Suppress non-critical warnings emitted by packages and classes"
      >
        <OverleafSwitch
          checked={suppressPackageWarnings}
          onCheckedChange={setSuppressPackageWarnings}
          aria-label="Hide package warnings toggle"
        />
      </SettingRow>

      {/* Custom Warning Suppression Filter */}
      <SettingRow
        title="Custom warning filters"
        description="Filter out specific warning phrases or regexes from diagnostics"
      >
        <div className="flex flex-col gap-1.5 w-full max-w-xs">
          <div className="flex items-center gap-1.5">
            <Input
              value={newWarningPattern}
              onChange={(e) => setNewWarningPattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWarningPattern.trim()) {
                  e.preventDefault();
                  addSuppressedWarning(newWarningPattern);
                  setNewWarningPattern('');
                }
              }}
              placeholder="e.g. Underfull or /pattern/i"
              className="h-7 text-xs px-2 bg-background border-border"
              aria-label="New warning filter pattern"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (newWarningPattern.trim()) {
                  addSuppressedWarning(newWarningPattern);
                  setNewWarningPattern('');
                }
              }}
              disabled={!newWarningPattern.trim()}
              className="h-7 px-2 text-xs shrink-0 cursor-pointer"
            >
              Add
            </Button>
          </div>
          {customSuppressedWarnings.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {customSuppressedWarnings.map((pat) => (
                <span
                  key={pat}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded-sm bg-muted text-foreground border border-border"
                >
                  <span className="truncate max-w-[130px]">{pat}</span>
                  <button
                    type="button"
                    onClick={() => removeSuppressedWarning(pat)}
                    className="text-muted-foreground hover:text-foreground cursor-pointer font-semibold px-1 relative after:absolute after:-inset-1.5 after:content-['']"
                    aria-label={`Remove filter ${pat}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </SettingRow>

      {/* Clear Cached Files */}
      <SettingRow
        title="Clear cached files"
        description="Remove auxiliary build files (.aux, .bbl)"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={onClearCache}
          disabled={isClearingCache}
          className="h-8 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
        >
          {isClearingCache ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <Trash2 className="size-3.5 mr-1.5" />
          )}
          Clear cache
        </Button>
      </SettingRow>
    </section>
  );
}
