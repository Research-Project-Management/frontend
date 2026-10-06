'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useSettingsStore } from '@/features/editor/store';

export const SourceVisualSwitcher = React.memo(function SourceVisualSwitcher() {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  return (
    <Tabs
      value={editorMode}
      onValueChange={(val) => setEditorMode(val as 'code' | 'visual')}
      className="inline-flex select-none shrink-0"
    >
      <TabsList className="h-7 p-0.5 bg-muted/80 border border-border/50 rounded-md">
        <TabsTrigger
          value="code"
          className="h-6 px-2.5 text-12 font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all cursor-pointer rounded-xs"
          title="Source mode (LaTeX code) (Ctrl+Shift+V)"
          aria-label="Source mode"
        >
          Source
        </TabsTrigger>
        <TabsTrigger
          value="visual"
          className="h-6 px-2.5 text-12 font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all cursor-pointer rounded-xs"
          title="Visual mode (Ctrl+Shift+V)"
          aria-label="Visual mode"
        >
          Visual
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
});
