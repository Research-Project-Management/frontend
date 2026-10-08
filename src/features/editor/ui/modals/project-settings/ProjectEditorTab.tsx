'use client';

/**
 * ProjectEditorTab.tsx
 *
 * Code editor settings (autocomplete, keybindings, font, line numbers, word wrap, and personal spell check dictionary).
 * Location: `features/editor/ui/modals/project-settings/ProjectEditorTab.tsx`
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { learnedWordSchema, type LearnedWordFormValues } from '@/features/editor/domain/types';
import { useSettingsStore, type KeybindingMode } from '@/features/editor/store';
import { useSpellingDictionary } from '@/features/editor/ui/hooks/use-spelling';
import {
  SettingRow,
  OverleafSwitch,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './settings-common';

export interface ProjectEditorTabProps {
  active: boolean;
}

export function ProjectEditorTab({ active }: ProjectEditorTabProps) {
  // Settings store
  const autoComplete = useSettingsStore((s) => s.autoComplete);
  const setAutoComplete = useSettingsStore((s) => s.setAutoComplete);
  const autoCloseBrackets = useSettingsStore((s) => s.autoCloseBrackets);
  const setAutoCloseBrackets = useSettingsStore((s) => s.setAutoCloseBrackets);
  const nonBlinkingCursor = useSettingsStore((s) => s.nonBlinkingCursor);
  const setNonBlinkingCursor = useSettingsStore((s) => s.setNonBlinkingCursor);
  const linterEnabled = useSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useSettingsStore((s) => s.setLinterEnabled);
  const showEditorTabs = useSettingsStore((s) => s.showEditorTabs);
  const setShowEditorTabs = useSettingsStore((s) => s.setShowEditorTabs);
  const previewEditorTabs = useSettingsStore((s) => s.previewEditorTabs);
  const setPreviewEditorTabs = useSettingsStore((s) => s.setPreviewEditorTabs);
  const keybinding = useSettingsStore((s) => s.keybinding);
  const setKeybinding = useSettingsStore((s) => s.setKeybinding);
  const pdfViewer = useSettingsStore((s) => s.pdfViewer);
  const setPdfViewer = useSettingsStore((s) => s.setPdfViewer);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const setWordWrap = useSettingsStore((s) => s.setWordWrap);
  const lineNumbers = useSettingsStore((s) => s.lineNumbers);
  const setLineNumbers = useSettingsStore((s) => s.setLineNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const spellCheck = useSettingsStore((s) => s.spellCheck);
  const setSpellCheck = useSettingsStore((s) => s.setSpellCheck);
  const spellCheckLanguage = useSettingsStore((s) => s.spellCheckLanguage);
  const setSpellCheckLanguage = useSettingsStore((s) => s.setSpellCheckLanguage);

  // Spelling dictionary
  const { userWords, addWord, removeWord } = useSpellingDictionary(undefined, active);

  const {
    register: registerWord,
    handleSubmit: handleSubmitWord,
    reset: resetWord,
    formState: { errors: wordErrors },
  } = useForm<LearnedWordFormValues>({
    resolver: zodResolver(learnedWordSchema),
    defaultValues: { word: '' },
  });

  const handleAddWord = (data: LearnedWordFormValues) => {
    addWord({ word: data.word.toLowerCase(), isProject: false });
    resetWord();
  };

  const handleRemoveWord = (word: string) => {
    removeWord({ word, isProject: false });
  };

  return (
    <div className="space-y-1">
      <SettingRow
        title="Auto-complete"
        description="Suggests code completions while typing"
      >
        <OverleafSwitch
          checked={autoComplete}
          onCheckedChange={setAutoComplete}
          aria-label="Auto-complete"
        />
      </SettingRow>

      <SettingRow
        title="Auto-close brackets"
        description="Automatically insert closing brackets and parentheses"
      >
        <OverleafSwitch
          checked={autoCloseBrackets}
          onCheckedChange={setAutoCloseBrackets}
          aria-label="Auto-close brackets"
        />
      </SettingRow>

      <SettingRow
        title="Non-blinking cursor"
        description="Reduces visual distraction by keeping the cursor solid"
      >
        <OverleafSwitch
          checked={nonBlinkingCursor}
          onCheckedChange={setNonBlinkingCursor}
          aria-label="Non-blinking cursor"
        />
      </SettingRow>

      <SettingRow
        title="Code check"
        description="Enables real-time syntax checking in the editor"
      >
        <OverleafSwitch
          checked={linterEnabled}
          onCheckedChange={setLinterEnabled}
          aria-label="Code check"
        />
      </SettingRow>

      <SettingRow
        title="Open files in tabs"
        description="Open each file in its own tab"
      >
        <OverleafSwitch
          checked={showEditorTabs}
          onCheckedChange={setShowEditorTabs}
          aria-label="Open files in tabs"
        />
      </SettingRow>

      <SettingRow
        title="Preview editor tabs"
        description="Tabs open in preview mode until you interact with them"
      >
        <OverleafSwitch
          checked={previewEditorTabs}
          onCheckedChange={setPreviewEditorTabs}
          aria-label="Preview editor tabs"
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
          <SelectTrigger
            aria-label="Keybindings"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Keybindings" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger
            aria-label="PDF Viewer"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="PDF Viewer" />
          </SelectTrigger>
          <SelectContent>
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
          aria-label="Word wrap"
        />
      </SettingRow>

      <SettingRow
        title="Line numbers"
        description="Show or hide line numbers in the editor gutter"
      >
        <OverleafSwitch
          checked={lineNumbers}
          onCheckedChange={setLineNumbers}
          aria-label="Line numbers"
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
          <SelectTrigger
            aria-label="Font size"
            className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Font size" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_SIZES.map((sz) => (
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
          <SelectTrigger
            aria-label="Font family"
            className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Font family" />
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

      <SettingRow
        title="Line height"
        description="Spacing between lines of text in the editor"
      >
        <Select
          value={String(lineHeight || 1.6)}
          onValueChange={(val) => setLineHeight(Number(val))}
        >
          <SelectTrigger
            aria-label="Line height"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Line height" />
          </SelectTrigger>
          <SelectContent>
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

      {/* ── Spell Check (Overleaf Parity: Single dropdown with Off & Languages) ── */}
      <SettingRow
        title="Spell check"
        description="Choose spell check language or turn off"
      >
        <Select
          value={!spellCheck ? 'off' : (spellCheckLanguage || 'en_US')}
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
            aria-label="Spell check"
            className="w-52 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Spell check" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off" className="cursor-pointer text-xs">
              Off
            </SelectItem>
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

      {/* ── Learned Words (Personal Dictionary) ── */}
      {spellCheck && (
        <div className="pt-4 mt-3 border-t border-border/50">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Learned words
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Words added to your personal dictionary will not be flagged as spelling errors.
          </p>

          {/* Add word input form */}
          <form onSubmit={handleSubmitWord(handleAddWord)} className="flex flex-col gap-1 mb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a custom word..."
                aria-label="Add a custom word to dictionary"
                {...registerWord('word')}
                className="flex-1 h-8 px-2.5 text-xs rounded-md border border-border bg-background outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
              <button
                type="submit"
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1 hover:bg-primary-hover cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <Plus className="size-3.5 shrink-0" />
                <span>Add word</span>
              </button>
            </div>
            {wordErrors.word && (
              <p className="text-10 text-destructive">{wordErrors.word.message}</p>
            )}
          </form>

          {/* Word Badges */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-border/40 rounded-md bg-muted/20">
            {userWords.length === 0 ? (
              <span className="text-xs text-muted-foreground/80 italic p-1">
                No learned words in your personal dictionary yet.
              </span>
            ) : (
              userWords.map((word) => (
                <span
                  key={`user-${word}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-background border border-border text-foreground group"
                >
                  <span>{word}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveWord(word)}
                    title={`Remove "${word}" from dictionary`}
                    aria-label={`Remove "${word}" from dictionary`}
                    className="size-3.5 relative rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-destructive after:absolute after:-inset-1.5"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
