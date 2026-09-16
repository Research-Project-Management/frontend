'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconPicker, ProjectAvatar, Form, getRandomProjectEmoji } from "@/shared/components/ui";
import { toast } from 'sonner';
import {
  X,
  CalendarDays,
  Info,
  Check,
  Loader2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import { Calendar } from "@/shared/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/shared/components/ui";
import {
  NonePriorityBoxIcon,
  LowPriorityBoxIcon,
  MediumPriorityBoxIcon,
  HighPriorityBoxIcon,
  UrgentPriorityBoxIcon,
} from "@/shared/components/icons";
import { cn } from "@/shared/lib/utils";
import { useCreateProject, useUpdateProject } from '../../hooks/use-project';
import { CoverModal } from '@/features/projects/project-id/settings/components/general/CoverModal';
import { uploadGenericFile } from '@/features/storage/services/file.service';
import { createProjectFormSchema, type CreateProjectFormValues } from '../../schemas/project.schema';
import type { Project, ProjectState, ProjectPriority } from '../../types/project.types';

// ── Default Cover Photo ──────────────────────────────────────────────────────
const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80';

// ── Project Lifecycle States & Priority Catalogs ─────────────────────────────
export const PROJECT_STATE_OPTIONS: Array<{
  value: ProjectState;
  label: string;
  dotColor: string;
}> = [
  { value: 'planning', label: 'Planning', dotColor: 'bg-blue-500' },
  { value: 'draft', label: 'Draft', dotColor: 'bg-slate-400' },
  { value: 'execution', label: 'In Execution', dotColor: 'bg-amber-500' },
  { value: 'monitoring', label: 'Monitoring', dotColor: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', dotColor: 'bg-emerald-500' },
  { value: 'cancelled', label: 'Cancelled', dotColor: 'bg-rose-500' },
];

export const PROJECT_PRIORITY_OPTIONS: Array<{
  value: ProjectPriority;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'none', label: 'None', icon: NonePriorityBoxIcon },
  { value: 'low', label: 'Low', icon: LowPriorityBoxIcon },
  { value: 'medium', label: 'Medium', icon: MediumPriorityBoxIcon },
  { value: 'high', label: 'High', icon: HighPriorityBoxIcon },
  { value: 'urgent', label: 'Urgent', icon: UrgentPriorityBoxIcon },
];

function formatDateLabel(dateStr: string | null | undefined, fallback: string): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return fallback;
  }
}

// ── Project Modules Config (Matching Flux Settings) ──────────────────────────
export interface ProjectModuleOption {
  id: string;
  title: string;
  desc: string;
  defaultOn?: boolean;
}

const PROJECT_MODULE_OPTIONS: ProjectModuleOption[] = [
  {
    id: 'work-items',
    title: 'Enable work items',
    desc: 'Organize work into issues, sub-items, and track progress with Kanban, Table, and Calendar views.',
    defaultOn: true,
  },
  {
    id: 'cycles',
    title: 'Enable cycles',
    desc: 'Timebox work per project and adjust the time period as needed. One cycle can be 2 weeks, the next 1 week.',
    defaultOn: true,
  },
  {
    id: 'views',
    title: 'Enable views',
    desc: 'Customized filter perspectives, sorts, and layouts for work items.',
    defaultOn: true,
  },
  {
    id: 'pages',
    title: 'Enable pages',
    desc: 'Create and edit free-form content; notes, docs, anything.',
    defaultOn: true,
  },
];

// ── Helper: Derive Short Project Identifier ─────────────────────────────────
function generateIdentifier(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const trimmed = normalized.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  let raw = '';
  if (words.length === 1) {
    raw = words[0].slice(0, 4).toUpperCase();
  } else {
    raw = words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
  return raw.replace(/[^A-Z0-9_-]/g, '').slice(0, 10);
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface CreateProjectModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: (project?: any) => void;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectModalProps) {
  const router = useRouter();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  // Internal dialog state (supports both controlled & uncontrolled)
  const [internalOpen, setInternalOpen] = useState(true);
  const isModalOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  // Step state: 1 = Create Project, 2 = Projects and work items
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form Setup using React Hook Form & Zod
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectFormSchema) as any,
    defaultValues: {
      name: '',
      identifier: '',
      description: '',
      avatar: getRandomProjectEmoji(),
      cover: DEFAULT_COVER,
      state: 'planning',
      priority: 'none',
      startDate: null,
      targetDate: null,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = form;

  const name = useWatch({ control, name: 'name' });
  const identifier = useWatch({ control, name: 'identifier' });
  const avatar = useWatch({ control, name: 'avatar' });
  const cover = useWatch({ control, name: 'cover' });
  const description = useWatch({ control, name: 'description' });
  const state = useWatch({ control, name: 'state' }) || 'planning';
  const priority = useWatch({ control, name: 'priority' }) || 'none';
  const startDate = useWatch({ control, name: 'startDate' });
  const targetDate = useWatch({ control, name: 'targetDate' });

  const setCover = (val: string) => setValue('cover', val, { shouldDirty: true });
  const setAvatar = (val: string) => setValue('avatar', val, { shouldDirty: true });
  const setDescription = (val: string) => setValue('description', val, { shouldDirty: true });
  const setState = (val: ProjectState) => setValue('state', val, { shouldDirty: true });
  const setPriority = (val: ProjectPriority) => setValue('priority', val, { shouldDirty: true });
  const setStartDate = (val: string | null) => setValue('startDate', val, { shouldDirty: true });
  const setTargetDate = (val: string | null) => setValue('targetDate', val, { shouldDirty: true });

  const [openStatePopover, setOpenStatePopover] = useState(false);
  const [openPriorityPopover, setOpenPriorityPopover] = useState(false);
  const [openStartDatePopover, setOpenStartDatePopover] = useState(false);
  const [openTargetDatePopover, setOpenTargetDatePopover] = useState(false);

  const activeStateOption = useMemo(
    () => PROJECT_STATE_OPTIONS.find((s) => s.value === state) || PROJECT_STATE_OPTIONS[0],
    [state]
  );
  const activePriorityOption = useMemo(
    () => PROJECT_PRIORITY_OPTIONS.find((p) => p.value === priority) || PROJECT_PRIORITY_OPTIONS[0],
    [priority]
  );
  const ActivePriorityIcon = activePriorityOption.icon;

  const [hasManuallyEditedIdentifier, setHasManuallyEditedIdentifier] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Step 2 State
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [activeModules, setActiveModules] = useState<string[]>(() =>
    PROJECT_MODULE_OPTIONS.filter((m) => m.defaultOn).map((m) => m.id)
  );

  const nameInputRef = useRef<HTMLInputElement>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue('name', val, { shouldValidate: true });
    if (!hasManuallyEditedIdentifier) {
      setValue('identifier', generateIdentifier(val), { shouldValidate: true });
    }
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasManuallyEditedIdentifier(true);
    const sanitized = e.target.value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9-_]/g, '')
      .slice(0, 10);
    setValue('identifier', sanitized, { shouldValidate: true });
  };

  const handleUploadCustomCover = async (file: File) => {
    try {
      setIsUploadingCover(true);
      const url = await uploadGenericFile(file);
      setValue('cover', url, { shouldDirty: true });
      toast.success('Cover uploaded');
    } catch {
      const localUrl = URL.createObjectURL(file);
      setValue('cover', localUrl, { shouldDirty: true });
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Refresh default avatar to a new random emoji whenever modal opens with clean form
  useEffect(() => {
    if (isModalOpen && !form.formState.isDirty && !name) {
      setValue('avatar', getRandomProjectEmoji());
    }
  }, [isModalOpen]);

  const handleClose = () => {
    handleOpenChange(false);
    setTimeout(() => {
      setStep(1);
      reset({
        name: '',
        identifier: '',
        description: '',
        avatar: getRandomProjectEmoji(),
        cover: DEFAULT_COVER,
        state: 'planning',
        priority: 'none',
        startDate: null,
        targetDate: null,
      });
      setHasManuallyEditedIdentifier(false);
      setCreatedProject(null);
      setActiveModules(PROJECT_MODULE_OPTIONS.filter((m) => m.defaultOn).map((m) => m.id));
    }, 200);
  };

  const onInvalidStep1 = (formErrors: any) => {
    if (formErrors.name) {
      nameInputRef.current?.focus();
    } else if (formErrors.identifier) {
      identifierInputRef.current?.focus();
    }
  };

  const onSubmitStep1 = (values: CreateProjectFormValues) => {
    if (createMutation.isPending) return;

    const initialModules = [...activeModules];

    createMutation.mutate(
      {
        name: values.name.trim(),
        identifier: values.identifier.trim() || undefined,
        avatar: values.avatar,
        cover: values.cover,
        description: values.description.trim() || undefined,
        state: values.state,
        priority: values.priority,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        targetDate: values.targetDate ? new Date(values.targetDate).toISOString() : undefined,
        modules: initialModules,
      },
      {
        onSuccess: (res: any) => {
          const proj: Project = res?.project || res?.data || res;
          setCreatedProject(proj);
          if (proj?.modules && Array.isArray(proj.modules)) {
            setActiveModules(proj.modules);
          }
          setStep(2);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to create project');
        },
      }
    );
  };

  const handleToggleModule = (modId: string) => {
    const nextModules = activeModules.includes(modId)
      ? activeModules.filter((m) => m !== modId)
      : [...activeModules, modId];

    setActiveModules(nextModules);

    if (createdProject?.id) {
      updateMutation.mutate({
        projectId: createdProject.id,
        modules: [...nextModules],
      });
    }
  };

  const handleOpenProject = () => {
    const targetProjId = createdProject?.id;
    handleClose();
    onSuccess?.(createdProject);
    if (targetProjId) {
      router.push(`/projects/${targetProjId}`);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:max-w-[780px] md:max-w-[820px] p-0 overflow-hidden rounded-lg border border-border bg-background gap-0 z-50 duration-150"
      >
        <DialogTitle className="sr-only">
          {step === 1 ? 'Create Project' : 'Projects and work items'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {step === 1
            ? 'Enter details to create a new project'
            : 'Configure feature modules for this project'}
        </DialogDescription>

        {step === 1 ? (
          /* ── STEP 1: CREATE PROJECT ─────────────────────────────────────── */
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmitStep1, onInvalidStep1)} className="flex flex-col">
            {/* Cover Banner Section (Symmetric margins to modal edge) */}
            <div className="relative mx-3 mt-3 sm:mx-4 sm:mt-3.5">
              {/* Inset Banner Image Container with rounded corners & overflow-hidden */}
              <div className="relative h-44 sm:h-52 w-full rounded-lg overflow-hidden bg-muted border border-border/40">
                <img
                  src={cover}
                  alt="Project Cover"
                  className="w-full h-full object-cover select-none"
                />

                {/* Close 'X' Button on Cover */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute top-3 right-3 size-7 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer z-10"
                  aria-label="Close dialog"
                >
                  <X className="size-4 shrink-0" />
                </button>

                {/* Change Cover Button */}
                <div className="absolute bottom-3 right-3 z-10">
                  <CoverModal
                    currentCover={cover}
                    onSelectCover={(url) => setCover(url)}
                    onUploadCustomCover={handleUploadCustomCover}
                    isUploading={isUploadingCover}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-11 font-medium bg-background text-foreground hover:bg-background/95 shadow-xs border border-border/40 rounded-md cursor-pointer"
                    >
                      Change cover
                    </Button>
                  </CoverModal>
                </div>
              </div>

              {/* Hanging Emoji & Icon Picker Avatar Button */}
              {/* Placed outside overflow-hidden so it is NEVER clipped; left-2 aligns directly with px-5 / sm:px-6 inputs below */}
              <div className="absolute -bottom-6 left-2 z-20">
                <IconPicker currentValue={avatar} onSelect={(val) => setAvatar(val)} align="start" side="bottom" sideOffset={8}>
                  <button
                    type="button"
                    title="Change project icon or emoji"
                    className="size-12 rounded-lg border border-border bg-background hover:bg-muted shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <ProjectAvatar avatar={avatar} name={name} size="xl" className="size-full" />
                  </button>
                </IconPicker>
              </div>
            </div>

            {/* Form Fields Body (Indented symmetrically so left edge aligns perfectly with hanging avatar button) */}
            <div className="px-5 sm:px-6 pt-8 sm:pt-9 pb-4 space-y-3.5">
              {/* Row 1: Project Name (Left) + Project ID (Right) */}
              <div className="flex items-start gap-3.5">
                <div className="flex-1 space-y-1">
                  <Input
                    ref={(e) => {
                      register('name').ref(e);
                      nameInputRef.current = e;
                    }}
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Project name"
                    autoFocus
                    className={cn(
                      'h-10 text-13 font-normal rounded-md border border-border bg-background focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground',
                      errors.name && 'border-destructive focus-visible:ring-destructive/30'
                    )}
                  />
                  {errors.name && (
                    <p className="text-11 text-destructive pl-0.5">{errors.name.message}</p>
                  )}
                </div>

                <div className="w-44 sm:w-52 shrink-0 space-y-1">
                  <div className="relative">
                    <Input
                      ref={(e) => {
                        register('identifier').ref(e);
                        identifierInputRef.current = e;
                      }}
                      value={identifier}
                      onChange={handleIdentifierChange}
                      placeholder="Project ID"
                      maxLength={10}
                      className={cn(
                        'h-10 pr-9 text-13 font-normal rounded-md border border-border bg-background focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground',
                        errors.identifier && 'border-destructive focus-visible:ring-destructive/30'
                      )}
                    />
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-help p-0.5 outline-none"
                          >
                            <Info className="size-4 shrink-0" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="end"
                          className="bg-popover text-foreground border border-border rounded-md text-11 px-3 py-1.5 max-w-[280px] font-normal leading-relaxed"
                        >
                          Helps you identify work items in the project uniquely. Max 10 characters.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {errors.identifier && (
                    <p className="text-11 text-destructive pl-0.5">{errors.identifier.message}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Description */}
              <div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="resize-none min-h-[110px] text-13 rounded-md border border-border bg-background p-3 focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground leading-relaxed"
                />
              </div>

                {/* Row 3: Domain Pills (State, Priority, Start Date, Target Date) */}
                <div className="flex items-center flex-wrap gap-2 pt-1">
                  {/* 1. Project State Popover */}
                  <Popover open={openStatePopover} onOpenChange={setOpenStatePopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <span className={cn('size-2 rounded-full shrink-0', activeStateOption.dotColor)} />
                        <span>{activeStateOption.label}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-52 p-1 rounded-md border border-border bg-popover z-100 space-y-0.5 shadow-md"
                    >
                      {PROJECT_STATE_OPTIONS.map((opt) => {
                        const isSelected = state === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setState(opt.value);
                              setOpenStatePopover(false);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-12 transition-colors cursor-pointer text-left',
                              isSelected
                                ? 'bg-muted font-medium text-foreground'
                                : 'hover:bg-muted text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('size-2 rounded-full shrink-0', opt.dotColor)} />
                              <span>{opt.label}</span>
                            </div>
                            {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>

                  {/* 2. Priority Popover */}
                  <Popover open={openPriorityPopover} onOpenChange={setOpenPriorityPopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <ActivePriorityIcon className="size-3.5 shrink-0" />
                        <span>{activePriorityOption.label}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-44 p-1 rounded-md border border-border bg-popover z-100 space-y-0.5 shadow-md"
                    >
                      {PROJECT_PRIORITY_OPTIONS.map((opt) => {
                        const isSelected = priority === opt.value;
                        const IconComp = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setPriority(opt.value);
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

                  {/* 3. Start Date Popover */}
                  <Popover open={openStartDatePopover} onOpenChange={setOpenStartDatePopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                          startDate && 'font-medium'
                        )}
                      >
                        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{formatDateLabel(startDate, 'Start date')}</span>
                        {startDate && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setStartDate(null);
                            }}
                            className="size-3.5 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center -mr-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-2.5" />
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto p-0 rounded-md border border-border bg-popover z-100 shadow-md"
                    >
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate) : undefined}
                        onSelect={(date) => {
                          setStartDate(date ? date.toISOString().split('T')[0] : null);
                          setOpenStartDatePopover(false);
                        }}
                        className="p-3 text-xs"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* 4. Target Date Popover */}
                  <Popover open={openTargetDatePopover} onOpenChange={setOpenTargetDatePopover}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-12 font-normal text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                          targetDate && 'font-medium'
                        )}
                      >
                        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{formatDateLabel(targetDate, 'Target date')}</span>
                        {targetDate && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetDate(null);
                            }}
                            className="size-3.5 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center -mr-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-2.5" />
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto p-0 rounded-md border border-border bg-popover z-100 shadow-md"
                    >
                      <Calendar
                        mode="single"
                        selected={targetDate ? new Date(targetDate) : undefined}
                        onSelect={(date) => {
                          setTargetDate(date ? date.toISOString().split('T')[0] : null);
                          setOpenTargetDatePopover(false);
                        }}
                        className="p-3 text-xs"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

              </div>

            {/* Footer */}
            <div className="border-t border-border px-5 sm:px-6 py-3 bg-background flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="h-8.5 px-3.5 text-13 font-medium rounded-md cursor-pointer border border-border hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </Button>
              {/* Default active color (not dimmed/darkened), validates on click */}
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending}
                className="h-8.5 px-4 text-13 font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none cursor-pointer transition-colors"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 size-3.5 animate-spin shrink-0" />
                )}
                Create project
              </Button>
            </div>
          </form>
        </Form>
        ) : (
          /* ── STEP 2: PROJECTS AND WORK ITEMS ────────────────────────────── */
          <div className="flex flex-col">
            {/* Header */}
            <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3">
              <h2 className="text-18 sm:text-20 font-semibold text-foreground tracking-tight">
                Projects and work items
              </h2>
              <p className="text-13 text-muted-foreground mt-0.5">
                Toggle these on or off this project.
              </p>
            </div>

            {/* Module Cards List */}
            <div className="px-5 sm:px-6 pb-4 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
              {PROJECT_MODULE_OPTIONS.map((mod) => {
                const isActive = activeModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    className="rounded-md border border-border p-3 sm:p-3.5 bg-background flex items-center justify-between gap-3.5 transition-colors hover:border-border/80"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-13 sm:text-14 font-medium text-foreground leading-tight">
                        {mod.title}
                      </h3>
                      <p className="text-12 sm:text-13 text-muted-foreground leading-relaxed mt-0.5">
                        {mod.desc}
                      </p>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => handleToggleModule(mod.id)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Step 2 Footer */}
            <div className="border-t border-border px-5 sm:px-6 py-3 bg-background flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-13 text-foreground font-medium truncate min-w-0">
                <span className="text-muted-foreground">Congrats!</span>
                <ProjectAvatar avatar={avatar} name={name} size="sm" />
                <span className="font-semibold truncate text-foreground">
                  {createdProject?.name || name}
                </span>
                <span className="text-muted-foreground">created.</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="h-8.5 px-3.5 text-13 font-medium rounded-md cursor-pointer border border-border hover:bg-muted text-foreground transition-colors"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenProject}
                  className="h-8.5 px-4 text-13 font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none cursor-pointer transition-colors"
                >
                  Open project
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectModal;
