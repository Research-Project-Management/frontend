'use client';

import React from 'react';
import { CornerDownRight } from 'lucide-react';
import { CompanionHero } from '@/features/ai/components/companion/CompanionHero';
import { QUICK_ACTIONS } from './ai-tab.helpers';

export interface AiSuggestionsHeroProps {
  onSelectSuggestion: (prompt: string) => void;
}

export function AiSuggestionsHero({ onSelectSuggestion }: AiSuggestionsHeroProps) {
  return (
    <div className="flex flex-col justify-center select-none py-1 gap-2.5 my-auto">
      {/* Central Luminous 3D AI Orb */}
      <CompanionHero />

      {/* Suggestions Section */}
      <div className="w-full pt-1 flex flex-col gap-0.5 text-left">
        <div className="px-2 mb-1">
          <span className="text-12 font-medium text-muted-foreground">
            Suggestions
          </span>
        </div>
        <div className="space-y-0.5">
          {QUICK_ACTIONS.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectSuggestion(act.prompt)}
              className="w-full flex items-start gap-2.5 py-2 px-2.5 text-left text-13 text-foreground hover:bg-muted/60 rounded-lg transition-colors cursor-pointer group"
            >
              <CornerDownRight className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="leading-snug text-13 font-normal text-foreground">
                  {act.label}
                </span>
                <span className="text-11 text-muted-foreground line-clamp-1">
                  {act.prompt}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
