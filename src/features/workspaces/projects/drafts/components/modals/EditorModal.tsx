'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import {
  ChevronDown,
  Users,
  Tag,
  Calendar,
  Network,
  Folder,
} from 'lucide-react';
import { StatusIcon } from '@/features/workspaces/projects/project-id/work-items/components/StatusIcon';
import {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/features/workspaces/projects/project-id/work-items/components/modals/Popovers';
import type { WorkItemDraft, TaskPriority } from '../../types/draft.types';

export interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft?: WorkItemDraft | null;
  projects: Array<{
    id: string;
    name: string;
    identifier?: string;
    taskColumns?: Array<{ id: string; name: string; color?: string }>;
  }>;
  onSave: (data: {
    title: string;
    description: string;
    priority: TaskPriority;
    columnId?: string;
    projectId?: string;
    labels?: string[];
    startDate?: string;
    dueDate?: string;
  }) => Promise<void>;
  isSaving: boolean;
}

const PRIORITY_OPTIONS: Array<{ key: TaskPriority; label: string; icon: React.FC<{ className?: string }> }> = [
  { key: 'none', label: 'None', icon: NonePriorityBoxIcon },
  { key: 'low', label: 'Low', icon: LowPriorityBoxIcon },
  { key: 'medium', label: 'Medium', icon: MediumPriorityBoxIcon },
  { key: 'high', label: 'High', icon: HighPriorityBoxIcon },
  { key: 'urgent', label: 'Urgent', icon: UrgentPriorityBoxIcon },
];

const STATE_OPTIONS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const EditorModal: React.FC<EditorModalProps> = ({
  isOpen,
  onClose,
  draft,
  projects,
  onSave,
  isSaving,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [columnName, setColumnName] = useState('Backlog');
  const [columnId, setColumnId] = useState<string | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [labels, setLabels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createMore, setCreateMore] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Label input helper in popover
  const [newLabelText, setNewLabelText] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (draft) {
        setTitle(draft.title || '');
        setDescription(draft.description || draft.content || '');
        setPriority(draft.priority || 'none');
        setColumnName(
          draft.columnId
            ? draft.columnId.charAt(0).toUpperCase() + draft.columnId.slice(1).replace(/_/g, ' ')
            : 'Backlog'
        );
        setColumnId(draft.columnId || undefined);
        setSelectedProjectId(draft.projectId || projects[0]?.id || '');
        setLabels(draft.labels || []);
        setStartDate(draft.startDate ? draft.startDate.split('T')[0] : '');
        setDueDate(draft.dueDate ? draft.dueDate.split('T')[0] : '');
        setIsEditingDesc(Boolean(draft.description || draft.content));
      } else {
        setTitle('');
        setDescription('');
        setPriority('none');
        setColumnName('Backlog');
        setColumnId(undefined);
        setSelectedProjectId(projects[0]?.id || '');
        setLabels([]);
        setStartDate('');
        setDueDate('');
        setIsEditingDesc(false);
      }
    }
  }, [isOpen, draft, projects]);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const handleSave = async () => {
    const finalTitle = title.trim();
    if (!finalTitle) return;

    await onSave({
      title: finalTitle,
      description: description.trim(),
      priority,
      columnId: columnId || 'backlog',
      projectId: selectedProjectId || undefined,
      labels,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
    });

    if (createMore) {
      setTitle('');
      setDescription('');
      setIsEditingDesc(false);
    } else {
      onClose();
    }
  };

  const handleAddLabel = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newLabelText.trim()) {
      e.preventDefault();
      if (!labels.includes(newLabelText.trim())) {
        setLabels([...labels, newLabelText.trim()]);
      }
      setNewLabelText('');
    }
  };

  const handleRemoveLabel = (lbl: string) => {
    setLabels(labels.filter((l) => l !== lbl));
  };

  const CurrentPriorityIcon =
    PRIORITY_OPTIONS.find((p) => p.key === priority)?.icon || NonePriorityBoxIcon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-background border border-border rounded-lg shadow-raised-200">
        <div className="p-5">
          {/* Header */}
          <DialogHeader className="p-0 space-y-0 text-left">
            <DialogTitle className="text-14 font-semibold tracking-tight text-foreground">
              {draft ? 'Edit draft' : 'Create a draft'}
            </DialogTitle>
          </DialogHeader>

          {/* Project Picker Pill */}
          <div className="mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <Folder className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-44">{currentProject?.name || 'Select project'}</span>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background border border-border">
                {projects.map((proj) => (
                  <DropdownMenuItem
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className="flex items-center gap-2 cursor-pointer text-12"
                  >
                    <Folder className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{proj.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title Input */}
          <div className="mt-3.5">
            <input
              type="text"
              autoFocus
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 px-3 text-14 font-medium rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-shadow"
            />
          </div>

          {/* Description Box */}
          <div className="mt-3">
            <div
              onClick={() => setIsEditingDesc(true)}
              className="min-h-36 p-3 rounded-md border border-border bg-background text-13 text-foreground transition-colors cursor-text focus-within:ring-1 focus-within:ring-ring"
            >
              {isEditingDesc || description ? (
                <Textarea
                  placeholder="Click to add description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-32 p-0 border-0 shadow-none focus-visible:ring-0 resize-none text-13 text-foreground placeholder:text-muted-foreground leading-relaxed"
                  autoFocus={isEditingDesc}
                />
              ) : (
                <span className="text-muted-foreground text-13 select-none">
                  Click to add description
                </span>
              )}
            </div>
          </div>

          {/* Property Pills Row */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {/* Column / State Pill */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <StatusIcon title={columnName} id={columnId} className="size-3.5 shrink-0" />
                  <span>{columnName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-background border border-border">
                {STATE_OPTIONS.map((col) => (
                  <DropdownMenuItem
                    key={col.key}
                    onClick={() => {
                      setColumnName(col.label);
                      setColumnId(col.key);
                    }}
                    className="flex items-center gap-2 text-12 cursor-pointer"
                  >
                    <StatusIcon title={col.label} id={col.key} className="size-3.5 shrink-0" />
                    <span>{col.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Pill with PriorityBoxIcon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <CurrentPriorityIcon className="size-3.5 shrink-0" />
                  <span className="capitalize">{priority}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36 bg-background border border-border">
                {PRIORITY_OPTIONS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <DropdownMenuItem
                      key={p.key}
                      onClick={() => setPriority(p.key)}
                      className="flex items-center gap-2 text-12 capitalize cursor-pointer"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span>{p.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assignees Pill */}
            <button
              type="button"
              className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <Users className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Assignees</span>
            </button>

            {/* Labels Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{labels.length > 0 ? labels.join(', ') : 'Labels'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-2.5 bg-background border border-border">
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Add label & press enter..."
                    value={newLabelText}
                    onChange={(e) => setNewLabelText(e.target.value)}
                    onKeyDown={handleAddLabel}
                    className="h-7 text-12"
                  />
                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-muted text-foreground text-11"
                        >
                          {lbl}
                          <button
                            type="button"
                            onClick={() => handleRemoveLabel(lbl)}
                            className="hover:text-destructive text-11 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Start Date Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{startDate || 'Start date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2 bg-background border border-border">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-12 bg-background border border-border rounded-sm p-1 text-foreground"
                />
              </PopoverContent>
            </Popover>

            {/* Due Date Pill */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{dueDate || 'Due date'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2 bg-background border border-border">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-12 bg-background border border-border rounded-sm p-1 text-foreground"
                />
              </PopoverContent>
            </Popover>

            {/* Add Parent Pill */}
            <button
              type="button"
              className="h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <Network className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Add parent</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-background">
          {/* Create More Toggle */}
          <div className="flex items-center gap-2 select-none">
            <Switch
              size="sm"
              checked={createMore}
              onCheckedChange={setCreateMore}
              id="create-more-toggle"
            />
            <label
              htmlFor="create-more-toggle"
              className="text-12 text-foreground font-medium cursor-pointer"
            >
              Create more
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="h-8 px-3.5 text-12 font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-none cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save to Drafts'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditorModal;
