'use client';

import React, { useState, useMemo } from 'react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import {
  Link2,
  Plus,
  X,
  ShieldAlert,
  Search,
  Check,
} from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import type { TaskRelation, TaskRelationType, Task } from '../../types/types';
import { RELATION_TYPE_CONFIG } from '../../types/types';

export interface TaskRelationsProps {
  relations?: TaskRelation[];
  currentTaskId?: string;
  availableTasks?: Task[];
  onAddRelation: (relation: TaskRelation) => void;
  onRemoveRelation: (relationId: string, targetTaskId?: string) => void;
  isReadOnly?: boolean;
}

export const TaskRelations: React.FC<TaskRelationsProps> = ({
  relations = [],
  currentTaskId,
  availableTasks = [],
  onAddRelation,
  onRemoveRelation,
  isReadOnly = false,
}) => {
  const [openAddPopover, setOpenAddPopover] = useState(false);
  const [selectedType, setSelectedType] = useState<TaskRelationType>('blocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetTask, setSelectedTargetTask] = useState<Task | null>(null);

  const blockedByRelations = relations.filter((relation) => relation.type === 'blocked_by');
  const isBlocked = blockedByRelations.length > 0;

  const selectableTasks = useMemo(() => {
    const existingTargetIds = new Set(relations.map((r) => r.targetTaskId));
    return availableTasks.filter((t) => {
      if (t.id === currentTaskId) return false;
      if (existingTargetIds.has(t.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.identifier && t.identifier.toLowerCase().includes(q))
      );
    });
  }, [availableTasks, currentTaskId, relations, searchQuery]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetTask) return;

    const newRelation: TaskRelation = {
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: selectedType,
      targetTaskId: selectedTargetTask.id,
      targetTitle: selectedTargetTask.title,
      targetIdentifier: selectedTargetTask.identifier || undefined,
    };

    onAddRelation(newRelation);
    setSelectedTargetTask(null);
    setSearchQuery('');
    setOpenAddPopover(false);
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <label className="text-11 font-semibold text-muted-foreground tracking-normal flex items-center gap-1.5">
          <Link2 className="size-3.5 shrink-0" />
          <span>Dependencies & Relations ({relations.length})</span>
        </label>

        {!isReadOnly && (
          <Popover open={openAddPopover} onOpenChange={(open) => {
            setOpenAddPopover(open);
            if (!open) {
              setSelectedTargetTask(null);
              setSearchQuery('');
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 rounded-md"
              >
                <Plus className="size-3 shrink-0" />
                <span>Add</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-88 p-3 rounded-md border border-border bg-popover z-100 space-y-3"
            >
              <div className="text-xs font-semibold text-foreground border-b border-border pb-2">
                Add Issue Relation
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-11 font-medium text-muted-foreground">Relation Type</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(RELATION_TYPE_CONFIG) as TaskRelationType[]).map((type) => {
                      const cfg = RELATION_TYPE_CONFIG[type];
                      const isSelected = selectedType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedType(type)}
                          className={cn(
                            'px-2 py-1.5 rounded-md text-11 font-medium text-left border transition-all cursor-pointer',
                            isSelected
                              ? 'bg-muted border-primary text-primary font-semibold'
                              : 'border-border hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-11 font-medium text-muted-foreground">Target Work Item</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by title or ID..."
                      className="h-8 pl-8 text-xs rounded-md border-border"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y divide-border rounded-md border border-border mt-1 bg-background">
                    {selectableTasks.length === 0 ? (
                      <div className="p-2.5 text-center text-11 text-muted-foreground italic">
                        No matching work items available
                      </div>
                    ) : (
                      selectableTasks.slice(0, 20).map((t) => {
                        const isChosen = selectedTargetTask?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTargetTask(t)}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer hover:bg-muted',
                              isChosen && 'bg-primary/10 text-primary font-medium'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {t.identifier && (
                                <span className="font-mono text-11 text-muted-foreground shrink-0">
                                  {t.identifier}
                                </span>
                              )}
                              <span className="truncate text-foreground text-xs">{t.title}</span>
                            </div>
                            {isChosen && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-md"
                    onClick={() => setOpenAddPopover(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-7 text-xs rounded-md shadow-none"
                    disabled={!selectedTargetTask}
                  >
                    Add Relation
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isBlocked && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            This issue is <strong>blocked</strong> by {blockedByRelations.length} pending work item(s).
          </span>
        </div>
      )}

      {relations.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2 italic">
          No issue relations or blockers defined.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border bg-background overflow-hidden">
          {relations.map((rel) => {
            const config = RELATION_TYPE_CONFIG[rel.type] || RELATION_TYPE_CONFIG.relates_to;
            return (
              <div
                key={rel.id}
                className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-sm text-10 font-semibold tracking-normal border',
                      config.badgeColor
                    )}
                  >
                    {config.label}
                  </span>
                  {rel.targetIdentifier && (
                    <span className="font-mono font-semibold text-muted-foreground text-11">
                      {rel.targetIdentifier}
                    </span>
                  )}
                  <span className="font-medium text-foreground truncate">{rel.targetTitle || 'Related Issue'}</span>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveRelation(rel.id, rel.targetTaskId)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 text-muted-foreground cursor-pointer transition-opacity"
                    title="Remove relation"
                  >
                    <X className="size-3.5 shrink-0" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
