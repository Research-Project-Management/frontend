'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export function TableInlineAddRow({
  targetColumnId,
  titleWidth = 360,
  onAddCard,
  isReadOnly = false,
}: {
  targetColumnId: string;
  titleWidth?: number;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  isReadOnly?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  if (isReadOnly) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCard(targetColumnId, trimmed);
    setTitle('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsAdding(false);
      setTitle('');
    }
  };

  if (!isAdding) {
    return (
      <div
        role="row"
        onClick={() => setIsAdding(true)}
        className="flex items-center h-9 border-b border-border bg-background hover:bg-muted/40 transition-colors duration-0 w-full cursor-pointer select-none group/table-add-bottom shrink-0"
      >
        <div
          className="sticky left-0 flex items-center h-full px-3 transition-colors"
          style={{ minWidth: `${titleWidth}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 h-full text-13 text-muted-foreground hover:text-foreground font-normal transition-colors cursor-pointer text-left outline-none focus-visible:outline-none"
          >
            <Plus className="size-3.5 shrink-0 text-muted-foreground group-hover/table-add-bottom:text-foreground transition-colors" />
            <span>New work item</span>
          </button>
        </div>
        <div className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <form
      role="row"
      onSubmit={handleSubmit}
      className="flex items-center h-9 border-b border-border bg-background transition-colors duration-0 w-full shrink-0"
    >
      <div
        className="sticky left-0 flex items-center gap-2 h-full px-2.5 bg-background z-10 border-r border-border"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px` }}
      >
        <Plus className="size-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          aria-label="New work item title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New work item"
          className="flex-1 bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none font-normal px-1"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim()}
            className="h-6 px-2.5 text-xs font-medium rounded-md focus-visible:ring-1 focus-visible:ring-ring"
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setTitle('');
            }}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md"
          >
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex-1 h-full bg-background" />
    </form>
  );
}

export function TableBottomAddBar({
  defaultColId,
  onAddCard,
}: {
  defaultColId: string;
  onAddCard: (columnId: string, title: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCard(defaultColId, trimmed);
    setTitle('');
    setIsAdding(false);
  };

  return (
    <div className="h-9 flex items-center bg-background select-none shrink-0 px-2.5">
      {!isAdding ? (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-13 text-foreground hover:text-foreground cursor-pointer font-normal"
        >
          <Plus className="size-3.5 shrink-0 text-foreground" />
          <span>Add work item</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setTitle('');
              }
            }}
            placeholder="New work item"
            className="flex-1 bg-transparent text-13 outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setTitle('');
            }}
            className="text-11 px-2 py-0.5 rounded text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="text-11 px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
