'use client';

import React from 'react';
import { Columns2, PanelLeft, PanelRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  useSettingsStore,
  type LayoutMode,
} from '@/features/editor/store/settings.store';

const LAYOUT_OPTIONS: {
  value: LayoutMode;
  icon: React.ElementType;
  label: string;
}[] = [
  { value: 'editor-only', icon: PanelLeft, label: 'Editor only' },
  { value: 'split', icon: Columns2, label: 'Editor & PDF' },
  { value: 'viewer-only', icon: PanelRight, label: 'PDF only' },
];

export default function LayoutSwitcher() {
  const { layout, setLayout } = useSettingsStore();

  const LayoutIcon =
    LAYOUT_OPTIONS.find((o) => o.value === layout)?.icon ?? Columns2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Change layout"
          aria-label="Change editor layout"
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors outline-none"
        >
          <LayoutIcon strokeWidth={1.5} className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 z-[9999]">
        {LAYOUT_OPTIONS.map(({ value, icon: Icon, label }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setLayout(value)}
            className={cn(layout === value && 'font-semibold text-primary')}
          >
            <Icon className="size-4 mr-2" strokeWidth={1.5} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
