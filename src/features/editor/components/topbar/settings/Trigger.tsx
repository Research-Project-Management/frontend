'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from '@/features/editor/store';

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
            'p-1.5 rounded-md transition-colors outline-none cursor-pointer',
            settingsPanelOpen
              ? 'text-primary bg-primary/15'
              : 'text-foreground hover:bg-sidebar-hover',
          )}
        >
          <Settings className="size-4 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Settings</TooltipContent>
    </Tooltip>
  );
}
