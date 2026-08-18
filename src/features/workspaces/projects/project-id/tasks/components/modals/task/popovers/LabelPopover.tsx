'use client';

import React, { useState, type Dispatch, type SetStateAction } from 'react';
import { Tag, ChevronLeft, X, SquarePen } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui';
import { useParams } from 'next/navigation';
import { useLabels, AVAILABLE_LABEL_COLORS } from '../../../../hooks/use-task';
import { cn } from '@/shared/lib/utils';

export interface LabelPopoverProps {
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  actionBtnClass?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LabelPopover({
  labels,
  setLabels,
  actionBtnClass,
  open,
  onOpenChange,
}: LabelPopoverProps) {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

  const {
    filteredLabels,
    view,
    setView,
    labelSearch,
    setLabelSearch,
    editingName,
    setEditingName,
    selectedColor,
    setSelectedColor,
    handleCreateNew,
    handleEdit,
    handleSave,
    handleDelete,
  } = useLabels(workspaceId, 'task', projectId);

  const toggleLabel = (labelId: string) => {
    setLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            isOpen
              ? 'h-10 rounded-sm border border-border bg-muted px-4 text-[15px] font-medium text-foreground shadow-none'
              : actionBtnClass
          }
        >
          <Tag className="mr-2 h-4 w-4 text-foreground" />
          <span>Labels</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-14}
        className="w-80 p-0 rounded-sm shadow-xl border-border/50 overflow-hidden flex flex-col z-100 bg-popover"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          {view !== 'list' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-foreground"
              onClick={() => setView('list')}
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
          <span className="text-sm font-semibold text-center flex-1 text-foreground">
            {view === 'list' ? 'Labels' : 'Edit label'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground"
            onClick={() => setIsOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        {view === 'list' ? (
          <div className="p-3 space-y-3">
            <Input
              placeholder="Search labels..."
              value={labelSearch}
              onChange={(e) => setLabelSearch(e.target.value)}
              className="h-9"
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {filteredLabels.map((l) => {
                const isSelected = labels.includes(l.id);
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleLabel(l.id)} />
                    <button
                      onClick={() => toggleLabel(l.id)}
                      className="flex-1 flex items-center px-3 py-1.5 rounded-sm text-xs font-semibold text-white truncate cursor-pointer"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() =>
                        handleEdit({
                          id: l.id,
                          name: l.name,
                          color: l.color || '#3B82F6',
                        })
                      }
                    >
                      <SquarePen className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full h-8 text-xs" onClick={handleCreateNew}>
              Create a new label
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Color</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_LABEL_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.color)}
                    className={cn(
                      'h-8 rounded-sm transition-all cursor-pointer',
                      selectedColor === c.color && 'ring-2 ring-primary ring-offset-1',
                    )}
                    style={{ backgroundColor: c.color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" onClick={() => handleSave()} className="px-5">
                Save
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete()}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default LabelPopover;
