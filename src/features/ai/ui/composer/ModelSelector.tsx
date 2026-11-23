'use client';

import React from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
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
    label: 'Auto (Tối ưu)',
    provider: 'Flux Gateway',
    tier: 'auto',
    description: 'Tự động chọn model tối ưu theo từng bước',
    is_default: true,
  },
];

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

  const triggerLabel = active?.id === 'auto' ? 'Auto' : (active?.label ?? 'Auto');

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
          <Sparkles className="size-3.5 shrink-0 text-ai" aria-hidden="true" />
          <span className="truncate font-medium">{triggerLabel}</span>
          <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-72 p-1 rounded-lg shadow-lg border border-border bg-popover text-foreground select-none space-y-0.5"
      >
        {models.map((item) => {
          const isSelected = active?.id === item.id;
          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => setSelectedModelId(item.id)}
              className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-md cursor-pointer hover:bg-muted focus:bg-muted text-foreground"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-12 font-medium truncate">{item.label}</span>
                  <span className="text-10 text-muted-foreground px-1 py-0.2 rounded bg-muted">
                    {item.provider}
                  </span>
                </div>
                <p className="text-11 text-muted-foreground line-clamp-1">
                  {item.description}
                </p>
              </div>
              {isSelected && (
                <Check className="size-3.5 text-ai shrink-0 mt-0.5" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
