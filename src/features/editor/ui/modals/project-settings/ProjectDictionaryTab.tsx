'use client';

/**
 * ProjectDictionaryTab.tsx
 *
 * Personal Spelling Dictionary sub-view inside the Overleaf Menu Drawer.
 */

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { useSpellingDictionary } from '@/features/editor/ui/hooks/useSpelling';

export interface ProjectDictionaryTabProps {
  projectId?: string;
}

export function ProjectDictionaryTab({ projectId }: ProjectDictionaryTabProps = {}) {
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
    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Learned Words</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {scope === 'project' && projectId
              ? "Words added to this project's dictionary won't be flagged for any collaborator."
              : "Words added to your personal spellcheck dictionary won't be flagged across your projects."}
          </p>
        </div>
        {projectId && (
          <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-xs shrink-0">
            <button
              type="button"
              onClick={() => setScope('project')}
              className={`px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors cursor-pointer ${
                scope === 'project'
                  ? 'bg-background text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setScope('user')}
              className={`px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors cursor-pointer ${
                scope === 'user'
                  ? 'bg-background text-foreground font-semibold'
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
          aria-label="Add new word to dictionary"
          placeholder={scope === 'project' && projectId ? 'Add word to project dictionary...' : 'Add new word...'}
          className="h-8 text-xs bg-background"
        />
        <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0 cursor-pointer">
          <Plus className="size-3.5 mr-1" />
          Add
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 pt-2 max-h-[300px] overflow-y-auto">
        {activeWords && activeWords.length > 0 ? (
          activeWords.map((word) => (
            <Badge
              key={word}
              variant="secondary"
              className="flex items-center gap-1 text-xs py-1 px-2.5 font-normal"
            >
              <span>{word}</span>
              <button
                type="button"
                onClick={() => removeWord({ word, isProject: scope === 'project' && Boolean(projectId) })}
                aria-label={`Remove ${word}`}
                className="hover:text-destructive cursor-pointer ml-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            No learned words yet. Words you add from spellcheck suggestions will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
