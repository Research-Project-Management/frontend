'use client';

/**
 * DictionaryTab.tsx
 *
 * Spellcheck dictionary tab inside SettingsModal.
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useSpellingDictionary } from '@/features/editor/subsystems/settings/ui/hooks/useSpelling';
import { usePageStore } from '@/features/editor/core/store/editor.store';

export interface DictionaryTabProps {
  projectId?: string;
}

export function DictionaryTab({ projectId: propProjectId }: DictionaryTabProps = {}) {
  const storeSpaceId = usePageStore((s) => s.projectId || s.spaceId || '');
  const projectId = propProjectId || storeSpaceId || undefined;
  const { userWords, projectWords, addWord, removeWord } = useSpellingDictionary(projectId, true);
  const [newDictionaryWord, setNewDictionaryWord] = useState('');
  const [scope, setScope] = useState<'project' | 'user'>(projectId ? 'project' : 'user');

  const activeWords = scope === 'project' && projectId ? projectWords : userWords;

  const handleAddDictionaryWord = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDictionaryWord.trim().toLowerCase();
    if (!trimmed) return;
    addWord({ word: trimmed, isProject: scope === 'project' && Boolean(projectId) });
    setNewDictionaryWord('');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-scroll p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-foreground">Dictionary</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scope === 'project' && projectId
              ? 'Ignored words for this project'
              : 'Ignored words across all your projects'}
          </p>
        </div>
        {projectId && (
          <div className="flex items-center rounded-md bg-muted p-0.5 border border-border shrink-0">
            <button
              type="button"
              onClick={() => setScope('project')}
              className={`px-2.5 py-1 rounded-sm text-xs transition-colors cursor-pointer ${
                scope === 'project'
                  ? 'bg-background text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setScope('user')}
              className={`px-2.5 py-1 rounded-sm text-xs transition-colors cursor-pointer ${
                scope === 'user'
                  ? 'bg-background text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Personal
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleAddDictionaryWord} className="flex gap-2">
        <Input
          value={newDictionaryWord}
          onChange={(e) => setNewDictionaryWord(e.target.value)}
          aria-label="Add word to dictionary"
          placeholder="Add word..."
          className="h-8 text-xs bg-background"
        />
        <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0 cursor-pointer">
          <Plus className="size-3.5 mr-1" />
          Add
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {activeWords && activeWords.length > 0 ? (
          activeWords.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-md bg-muted text-foreground"
            >
              <span>{word}</span>
              <button
                type="button"
                onClick={() =>
                  removeWord({ word, isProject: scope === 'project' && Boolean(projectId) })
                }
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
