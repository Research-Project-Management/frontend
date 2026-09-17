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
            'size-7 flex items-center justify-center rounded-full transition-colors outline-none cursor-pointer select-none',
            settingsPanelOpen
              ? 'text-foreground bg-sidebar-accent shadow-2xs'
              : 'text-foreground/80 hover:text-foreground hover:bg-sidebar-hover',
          )}
        >
          <Settings className="size-3.5 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Settings</TooltipContent>
    </Tooltip>
  );
}
