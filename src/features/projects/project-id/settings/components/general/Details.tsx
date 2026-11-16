'use client';

import React, { useState, useMemo } from 'react';
import {
  Info,
  Loader2,
  CalendarDays,
  X,
  Check,
  CalendarClock,
  UserCheck,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar } from '@/shared/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { PROJECT_PRIORITY_OPTIONS } from '@/features/projects/shell/components/project/CreateProjectModal';
import { useProjectStatesSettings } from '../../hooks/use-project-states-settings';
import type { ProjectPriority } from '@/features/projects/shell/types/project.types';

interface GeneralDetailsProps {
  projectId?: string;
  name: string;
  identifier: string;
  description: string;
  researchField?: string;
  createdAt?: string;
  // Timeline & Priority
  priority?: ProjectPriority;
  startDate?: string | null;
  targetDate?: string | null;
  lead?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null;
  // Form state & actions
  isSaving: boolean;
  hasChanges: boolean;
  errors?: Record<string, { message?: string } | undefined>;
  onNameChange: (val: string) => void;
  onIdentifierChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onResearchFieldChange?: (val: string) => void;
  onPriorityChange?: (val: ProjectPriority) => void;
  onStartDateChange?: (val: string | null) => void;
  onTargetDateChange?: (val: string | null) => void;
  onSubmit: () => void;
}

function formatCreatedDate(dateStr?: string): string {
  if (!dateStr) return 'Aug 15, 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Aug 15, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Aug 15, 2026';
  }
}

function formatDateLabel(dateStr: string | null | undefined, fallback: string): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  } catch {
    return fallback;
  }
}

export function GeneralDetails({
  projectId,
  name,
  identifier,
  description,
  researchField = '',
  createdAt,
  priority = 'none',
  startDate,
  targetDate,
  lead,
  isSaving,
  hasChanges,
  errors,
  onNameChange,
  onIdentifierChange,
  onDescriptionChange,
  onResearchFieldChange,
  onPriorityChange,
  onStartDateChange,
  onTargetDateChange,
  onSubmit,
}: GeneralDetailsProps) {
  const formattedDate = formatCreatedDate(createdAt);

  const {
    states: projectStates = [],
    currentState,
    transitionState,
    isMutating: isStateMutating,
  } = useProjectStatesSettings(projectId || '');

  const [openStatePopover, setOpenStatePopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openStartDatePopover, setOpenStartDatePopover] = useState(false);
  const [openTargetDatePopover, setOpenTargetDatePopover] = useState(false);

  const activePriorityOption = useMemo(
    () => PROJECT_PRIORITY_OPTIONS.find((p) => p.value === priority) || PROJECT_PRIORITY_OPTIONS[0],
    [priority]
  );
  const ActivePriorityIcon = activePriorityOption.icon;

  const handleIdentifierInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 10);
    onIdentifierChange(clean);
  };

  const leadInitials = useMemo(() => {
    if (!lead?.name) return 'PI';
    return lead.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }, [lead?.name]);

  return (
    <div className="space-y-6">
      {/* ── Section 1: Basic Identity & Research Focus ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Project Name */}
          <div className="flex-1 w-full space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-foreground">Project name</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Deep Learning for Genome Analysis"
              className={`h-8 text-13 rounded-md border-border bg-background px-2.5 focus-visible:ring-1 focus-visible:ring-ring ${
                errors?.name ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            />
            {errors?.name && (
              <p className="text-11 text-destructive font-medium px-0.5">{errors.name.message}</p>
            )}
          </div>

          {/* Project ID */}
          <div className="w-full sm:w-44 md:w-48 shrink-0 space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-foreground">Project ID</Label>
            <div className="relative">
              <Input
                value={identifier}
                onChange={handleIdentifierInput}
                placeholder="e.g. DLGA"
                className={`h-8 text-13 font-mono font-medium rounded-md border-border bg-background px-2.5 pr-8 focus-visible:ring-1 focus-visible:ring-ring ${
                  errors?.identifier ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {errors?.identifier && (
                <p className="text-11 text-destructive font-medium px-0.5 mt-1">{errors.identifier.message}</p>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded transition-colors before:absolute before:-inset-2 md:before:hidden"
                      aria-label="Project ID info"
                    >
                      <Info className="size-3.5 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-12 max-w-xs shadow-overlay">
                    Used as the prefix for all work items in this project (e.g. {identifier || 'PRJ'}-1).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Research Field / Topic (Optional) */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-muted-foreground" />
            <Label className="text-12 font-medium text-foreground">Research field / Topic</Label>
            <span className="text-11 text-muted-foreground">(optional)</span>
          </div>
          <Input
            value={researchField}
            onChange={(e) => onResearchFieldChange?.(e.target.value)}
            placeholder="e.g. Machine Learning, Natural Language Processing, Computer Vision"
            className="h-8 text-13 rounded-md border-border bg-background px-2.5 focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Description / Abstract */}
        <div className="space-y-1.5">
          <Label className="text-12 font-medium text-foreground">Research abstract / Description</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Outline research questions, methodology, or project objectives..."
            className="text-13 min-h-[90px] rounded-md border-border bg-background focus-visible:ring-1 focus-visible:ring-ring resize-none p-2.5 leading-relaxed"
          />
        </div>
      </div>

      {/* ── Section 2: Timeline & Strategic Governance ── */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div className="flex items-center gap-2 text-foreground font-medium text-13">
          <CalendarClock className="size-4 text-primary shrink-0" />
          <span>Timeline & Priority</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 items-end">
          {/* 1. Project Stage / State */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-muted-foreground">Project stage</Label>
            <Popover open={openStatePopover} onOpenChange={setOpenStatePopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isStateMutating || projectStates.length === 0}
                  className="w-full flex items-center justify-between h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: currentState?.color || '#0284c7' }}
                    />
                    <span className="truncate">{currentState?.name || 'Ideation'}</span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-48 p-1 rounded-md border border-border bg-popover z-100 space-y-0.5 shadow-overlay"
              >
                {projectStates.map((s) => {
                  const isSelected = s.id === currentState?.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={async () => {
                        if (transitionState) {
                          await transitionState(s.id);
                        }
                        setOpenStatePopover(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-muted font-medium text-foreground'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color || '#0284c7' }}
                        />
                        <span className="truncate">{s.name}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* 2. Priority */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-muted-foreground">Priority</Label>
            <Popover open={openPriorityPopover} onOpenChange={setOpenPriorityPopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2">
                    <ActivePriorityIcon className="size-3.5 shrink-0" />
                    <span>{activePriorityOption.label}</span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-44 p-1 rounded-md border border-border bg-popover z-100 space-y-0.5 shadow-overlay"
              >
                {PROJECT_PRIORITY_OPTIONS.map((opt) => {
                  const isSelected = priority === opt.value;
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (onPriorityChange) {
                          onPriorityChange(opt.value);
                        }
                        setOpenPriorityPopover(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-muted font-medium text-foreground'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className="size-3.5 shrink-0" />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* 3. Start Date */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-muted-foreground">Start date</Label>
            <Popover open={openStartDatePopover} onOpenChange={setOpenStartDatePopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    startDate ? 'font-medium' : 'text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{formatDateLabel(startDate, 'Set start date')}</span>
                  </div>
                  {startDate && onStartDateChange && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartDateChange(null);
                      }}
                      className="size-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 rounded-md border border-border bg-popover z-100 shadow-overlay"
              >
                <Calendar
                  mode="single"
                  selected={startDate ? new Date(startDate) : undefined}
                  onSelect={(date) => {
                    if (onStartDateChange) {
                      onStartDateChange(date ? date.toISOString().split('T')[0] : null);
                    }
                    setOpenStartDatePopover(false);
                  }}
                  className="p-3 text-xs"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 4. Target Date */}
          <div className="space-y-1.5 min-w-0">
            <Label className="text-12 font-medium text-muted-foreground">Target date</Label>
            <Popover open={openTargetDatePopover} onOpenChange={setOpenTargetDatePopover}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    targetDate ? 'font-medium' : 'text-muted-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{formatDateLabel(targetDate, 'Set target date')}</span>
                  </div>
                  {targetDate && onTargetDateChange && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTargetDateChange(null);
                      }}
                      className="size-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-0 rounded-md border border-border bg-popover z-100 shadow-overlay"
              >
                <Calendar
                  mode="single"
                  selected={targetDate ? new Date(targetDate) : undefined}
                  onSelect={(date) => {
                    if (onTargetDateChange) {
                      onTargetDateChange(date ? date.toISOString().split('T')[0] : null);
                    }
                    setOpenTargetDatePopover(false);
                  }}
                  className="p-3 text-xs"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Lead / Principal Investigator Card */}
        {lead && (
          <div className="flex items-center justify-between p-3 rounded-md border border-border/80 bg-muted/30">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="size-8">
                {lead.avatar ? (
                  <AvatarImage src={lead.avatar} alt={lead.name || 'PI'} />
                ) : null}
                <AvatarFallback className="text-11 font-medium bg-primary/10 text-primary">
                  {leadInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-12 font-medium text-foreground truncate">
                  {lead.name || 'Project Lead'}
                </p>
                <p className="text-11 text-muted-foreground truncate">
                  {lead.email || 'Lead Investigator'}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-11 font-medium bg-primary/10 text-primary shrink-0">
              <UserCheck className="size-3" />
              <span>Project Lead / PI</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Action Row & Creation Timestamp ── */}
      <div className="flex items-center justify-between pt-4 border-t border-border/60 gap-4 flex-wrap">
        <Button
          onClick={onSubmit}
          disabled={!hasChanges || isSaving || !name.trim()}
          className="relative h-8 px-4 text-13 font-medium bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer rounded-md shadow-none shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
        >
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin motion-reduce:animate-none shrink-0" />}
          Update project
        </Button>

        <span className="text-12 text-muted-foreground">
          Created on {formattedDate}
        </span>
      </div>
    </div>
  );
}
