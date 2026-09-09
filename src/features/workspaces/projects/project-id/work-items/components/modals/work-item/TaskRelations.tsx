'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Link2,
  Plus,
  X,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { TaskRelation, TaskRelationType } from '../../../types/work-item.types';
import { RELATION_TYPE_CONFIG } from '../../../types/work-item.types';

export interface TaskRelationsProps {
  relations?: TaskRelation[];
  currentTaskId?: string;
  onAddRelation: (relation: TaskRelation) => void;
  onRemoveRelation: (relationId: string) => void;
  isReadOnly?: boolean;
}

export const TaskRelations: React.FC<TaskRelationsProps> = ({
  relations = [],
  currentTaskId,
  onAddRelation,
  onRemoveRelation,
  isReadOnly = false,
}) => {
  const [openAddPopover, setOpenAddPopover] = useState(false);
  const [selectedType, setSelectedType] = useState<TaskRelationType>('blocked_by');
  const [targetTitle, setTargetTitle] = useState('');
  const [targetIdentifier, setTargetIdentifier] = useState('');

  const blockedByRelations = relations.filter((r) => r.type === 'blocked_by');
  const isBlocked = blockedByRelations.length > 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTitle.trim()) return;

    const newRelation: TaskRelation = {
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: selectedType,
      targetTaskId: `target-${Date.now()}`,
      targetTitle: targetTitle.trim(),
      targetIdentifier: targetIdentifier.trim() || undefined,
    };

    onAddRelation(newRelation);
    setTargetTitle('');
    setTargetIdentifier('');
    setOpenAddPopover(false);
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <label className="text-11 font-bold text-muted-foreground tracking-normal flex items-center gap-1.5">
          <Link2 className="size-3.5" />
          <span>Dependencies & Relations ({relations.length})</span>
        </label>

        {!isReadOnly && (
          <Popover open={openAddPopover} onOpenChange={setOpenAddPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 p-3 rounded-sm border-border shadow-xl bg-popover z-100 space-y-3"
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
                            'px-2 py-1.5 rounded-sm text-11 font-medium text-left border transition-all cursor-pointer',
                            isSelected
                              ? 'bg-primary/10 border-primary text-primary font-semibold'
                              : 'border-border/60 hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-11 font-medium text-muted-foreground">Issue Title or Subject</label>
                  <Input
                    value={targetTitle}
                    onChange={(e) => setTargetTitle(e.target.value)}
                    placeholder="e.g. Design authentication screen"
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-11 font-medium text-muted-foreground">Issue ID (Optional)</label>
                  <Input
                    value={targetIdentifier}
                    onChange={(e) => setTargetIdentifier(e.target.value)}
                    placeholder="e.g. PRJ-42"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setOpenAddPopover(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-7 text-xs" disabled={!targetTitle.trim()}>
                    Add
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isBlocked && (
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            This issue is <strong>blocked</strong> by {blockedByRelations.length} pending work item(s).
          </span>
        </div>
      )}

      {relations.length === 0 ? (
        <div className="text-xs text-muted-foreground/70 py-2 italic">
          No issue relations or blockers defined.
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-sm border border-border/80 bg-background overflow-hidden">
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
                    onClick={() => onRemoveRelation(rel.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 text-muted-foreground cursor-pointer transition-opacity"
                    title="Remove relation"
                  >
                    <X className="size-3.5" />
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
