'use client';

/**
 * ProjectAppearanceTab.tsx
 *
 * Visual theme, typography and editor appearance settings.
 * Location: `features/editor/ui/modals/project-settings/ProjectAppearanceTab.tsx`
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useSettingsStore, type EditorTheme } from '@/features/editor/store';
import { EDITOR_THEMES } from '@/features/editor/engines';
import { useTheme } from '@/shared/providers';
import {
  SettingRow,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
} from './settings-common';

export function ProjectAppearanceTab() {
  const { theme, setTheme } = useTheme();
  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const setEditorTheme = useSettingsStore((s) => s.setEditorTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);

  return (
    <div className="space-y-1">
      <SettingRow
        title="Editor theme"
        description="Syntax highlighting color theme for the Code editor"
      >
        <Select
          value={editorTheme}
          onValueChange={(val) => setEditorTheme(val as EditorTheme)}
        >
          <SelectTrigger
            aria-label="Editor theme"
            className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger
            aria-label="Interface theme"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
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
          value={String(fontSize || 15)}
          onValueChange={(val) => setFontSize(Number(val))}
        >
          <SelectTrigger
            aria-label="Font size"
            className="w-28 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_SIZES.map((size) => (
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
        <Select value={fontFamily || 'default'} onValueChange={setFontFamily}>
          <SelectTrigger
            aria-label="Font family"
            className="w-48 h-8 text-xs font-medium cursor-pointer border-border bg-background"
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
    </div>
  );
}
