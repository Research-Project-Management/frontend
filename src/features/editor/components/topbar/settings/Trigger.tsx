'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/store/settings.store';

export default function Trigger() {
  const { settingsPanelOpen, toggleSettingsPanel } = useSettingsStore();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleSettingsPanel}
          title="Editor settings"
          aria-label="Toggle editor settings"
          className={cn(
            'p-1.5 rounded transition-colors outline-none',
            settingsPanelOpen
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Settings className="size-4 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Settings</TooltipContent>
    </Tooltip>
  );
}
