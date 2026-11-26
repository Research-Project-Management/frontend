'use client';

/**
 * subsystems/spelling/ui/DictionaryTab.tsx
 *
 * Project spellcheck dictionary tab inside SettingsModal.
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useDictionary } from '../hooks/useDictionary';

export interface DictionaryTabProps {
  projectId?: string;
}

export function DictionaryTab({ projectId: propProjectId }: DictionaryTabProps = {}) {
  const storeProjectId = usePageStore((s) => s.projectId || s.spaceId || '');
  const projectId = propProjectId || storeProjectId || undefined;
  const { words, isError, addWord, removeWord, isAddingWord } = useDictionary(projectId, true);
  const [draftWord, setDraftWord] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draftWord.trim();
    if (!trimmed) return;
    addWord(trimmed, {
      onSuccess: () => setDraftWord(''),
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-scroll p-5 space-y-4">
      <div>
        <h3 className="text-[13px] font-medium text-foreground">Dictionary</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ignored words for this project
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={draftWord}
          onChange={(e) => setDraftWord(e.target.value)}
          aria-label="Add word to dictionary"
          placeholder="Add word..."
          className="h-8 text-xs bg-background"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isAddingWord}
          className="h-8 px-3 text-xs shrink-0 cursor-pointer"
        >
          <Plus className="size-3.5 mr-1" />
          Add
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {isError ? (
          <p className="text-xs text-destructive py-2">Failed to load project dictionary.</p>
        ) : words.length > 0 ? (
          words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-md bg-muted text-foreground"
            >
              <span>{word}</span>
              <button
                type="button"
                onClick={() => removeWord(word)}
                aria-label={`Remove ${word}`}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-xs text-muted-foreground py-2">No words added yet.</p>
        )}
      </div>
    </div>
  );
}
