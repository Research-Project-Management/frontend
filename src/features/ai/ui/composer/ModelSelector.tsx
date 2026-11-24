'use client';

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  useAiModelsQuery,
  useSelectedAiModel,
  type AiModelInfo,
} from '../../engine/queries';

const FALLBACK_MODELS: readonly AiModelInfo[] = [
  {
    id: 'auto',
    label: 'Auto',
    provider: 'Flux Gateway',
    tier: 'auto',
    description: '',
    is_default: true,
  },
];

const cleanLabel = (label: string) => label.replace(/\s*\([^)]*\)/g, '').trim();

export interface ModelSelectorProps {
  compact?: boolean;
  disabled?: boolean;
}

export function ModelSelector({
  compact = false,
  disabled = false,
}: ModelSelectorProps) {
  const { data } = useAiModelsQuery();
  const [selectedModelId, setSelectedModelId] = useSelectedAiModel();

  const models = data && data.length > 0 ? data : FALLBACK_MODELS;
  const active =
    models.find((m) => m.id === selectedModelId) ??
    models.find((m) => m.is_default) ??
    models[0];

  const triggerLabel = active ? cleanLabel(active.label) || 'Auto' : 'Auto';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Select AI model"
          className={cn(
            'inline-flex items-center gap-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai select-none max-w-[160px]',
            compact ? 'h-7 px-2 text-11' : 'h-8 px-2.5 text-12',
            disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          <span className="truncate font-medium">{triggerLabel}</span>
          <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-52 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5"
      >
        {models.map((item) => {
          const isSelected = active?.id === item.id;
          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => setSelectedModelId(item.id)}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
            >
              <span className="text-12 font-medium truncate">
                {cleanLabel(item.label)}
              </span>
              {isSelected && (
                <Check className="size-3.5 text-ai shrink-0" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
