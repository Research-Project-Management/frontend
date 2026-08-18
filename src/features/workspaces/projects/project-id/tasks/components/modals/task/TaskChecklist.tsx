'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import type { Checklist } from '../../../types/task.types';

export type TaskChecklistProps = {
  checklists: Checklist[];
  onDeleteChecklist: (checklistId: string) => void;
  onToggleItem: (checklistId: string, itemId: string) => void;
  onDeleteItem: (checklistId: string, itemId: string) => void;
  onUpdateItem: (checklistId: string, itemId: string, title: string) => void;
  onAddItem: (checklistId: string, title: string) => void;
  isReadOnly?: boolean;
};

export function TaskChecklist({
  checklists,
  onDeleteChecklist,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  onAddItem,
  isReadOnly = false,
}: TaskChecklistProps) {
  if (checklists.length === 0) return null;

  return (
    <div className="mt-10 space-y-4">
      {checklists.map((list) => {
        const safeItems = Array.isArray(list.items) ? list.items : [];
        const completedCount = safeItems.filter((item) => item.completed).length;
        const progress = safeItems.length
          ? Math.round((completedCount / safeItems.length) * 100)
          : 0;

        return (
          <ChecklistBlock
            key={list.id}
            checklist={{ ...list, items: safeItems }}
            progress={progress}
            onDelete={() => onDeleteChecklist(list.id)}
            onToggleItem={(itemId) => onToggleItem(list.id, itemId)}
            onDeleteItem={(itemId) => onDeleteItem(list.id, itemId)}
            onUpdateItem={(itemId, title) => onUpdateItem(list.id, itemId, title)}
            onAddItem={(title) => onAddItem(list.id, title)}
            isReadOnly={isReadOnly}
          />
        );
      })}
    </div>
  );
}

type ChecklistBlockProps = {
  checklist: Checklist;
  progress: number;
  onDelete: () => void;
  onToggleItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, title: string) => void;
  onAddItem: (title: string) => void;
  isReadOnly?: boolean;
};

export function ChecklistBlock({
  checklist,
  progress,
  onDelete,
  onToggleItem,
  onDeleteItem,
  onUpdateItem,
  onAddItem,
  isReadOnly = false,
}: ChecklistBlockProps) {
  const [newItemTitle, setNewItemTitle] = useState('');
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteConfirmTimeoutRef = useRef<number | null>(null);

  const handleAddItem = () => {
    const trimmedTitle = newItemTitle.trim();
    if (!trimmedTitle) return;

    onAddItem(trimmedTitle);
    setNewItemTitle('');
    setShowNewItemInput(false);
  };

  const handleStartEditItem = (itemId: string, title: string) => {
    setEditingItemId(itemId);
    setEditingItemTitle(title);
    setShowNewItemInput(false);
  };

  const handleSaveEditItem = () => {
    const trimmedTitle = editingItemTitle.trim();
    if (!editingItemId || !trimmedTitle) return;

    onUpdateItem(editingItemId, trimmedTitle);
    setEditingItemId(null);
    setEditingItemTitle('');
  };

  const handleConfirmDelete = () => {
    if (isDeleteConfirming) return;
    setIsDeleteConfirming(true);

    deleteConfirmTimeoutRef.current = window.setTimeout(() => {
      onDelete();
      setShowDeleteConfirm(false);
      setIsDeleteConfirming(false);
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (deleteConfirmTimeoutRef.current) {
        window.clearTimeout(deleteConfirmTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-white space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-5 text-foreground" />
          <h4 className="text-[15px] font-bold leading-tight text-foreground">
            {checklist.title}
          </h4>
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-md bg-muted px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/80"
          >
            Delete
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-muted-foreground min-w-8">{progress}%</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {(checklist.items || []).length > 0 ? (
          (checklist.items || []).map((item) =>
            editingItemId === item.id ? (
              <div key={item.id} className="flex items-start gap-3 text-[14px] text-foreground">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={isReadOnly}
                  onChange={() => {
                    if (isReadOnly) return;
                    onToggleItem(item.id);
                  }}
                  className={`mt-2 size-4 rounded-sm border-border text-foreground focus:ring-0 ${
                    isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                />
                <div className="flex-1 space-y-2">
                  <input
                    value={editingItemTitle}
                    onChange={(e) => setEditingItemTitle(e.target.value)}
                    className="h-9 w-full rounded-sm border border-transparent px-3 text-[14px] shadow-none outline-none focus:border-primary"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="h-9 bg-primary px-4 text-primary-foreground hover:bg-primary/90 shadow-none"
                      onClick={handleSaveEditItem}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        setEditingItemId(null);
                        setEditingItemTitle('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  aria-label={`Delete item ${item.title}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div key={item.id} className="group flex items-center gap-3 text-[14px] text-foreground">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={isReadOnly}
                  onChange={() => {
                    if (isReadOnly) return;
                    onToggleItem(item.id);
                  }}
                  className={`size-4 rounded-sm border-border text-foreground focus:ring-0 ${
                    isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                />
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => !isReadOnly && handleStartEditItem(item.id, item.title)}
                  className={
                    item.completed
                      ? 'line-through text-muted-foreground flex-1 text-left'
                      : 'text-foreground flex-1 text-left'
                  }
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  onClick={() => !isReadOnly && onDeleteItem(item.id)}
                  className={`inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive ${
                    isReadOnly ? 'hidden' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label={`Delete item ${item.title}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ),
          )
        ) : (
          <p className="text-[13px] text-muted-foreground">No items yet.</p>
        )}
      </div>

      {showNewItemInput ? (
        <div className="space-y-2 pt-1">
          <input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Add an item..."
            className="h-9 w-full rounded-sm border border-transparent px-3 text-[14px] shadow-none hover:bg-muted"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none"
              onClick={handleAddItem}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 text-muted-foreground hover:bg-muted"
              onClick={() => {
                setNewItemTitle('');
                setShowNewItemInput(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : !isReadOnly ? (
        <button
          type="button"
          onClick={() => setShowNewItemInput(true)}
          className="rounded-md bg-muted px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/80"
        >
          Add an item
        </button>
      ) : null}

      {showDeleteConfirm && (
        <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 space-y-2">
          <p className="text-xs text-destructive font-medium">
            Are you sure you want to delete this checklist?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskChecklist;
