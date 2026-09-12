'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconPicker, ProjectAvatar } from "@/shared/components/ui";
import { toast } from 'sonner';
import {
  X,
  Globe,
  Lock,
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
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/components/ui";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/components/ui";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/shared/components/ui";
import { useClickOutside } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCreateProject, useUpdateProject } from '../../hooks/use-project';
import { CoverModal } from '@/features/workspaces/projects/project-id/settings/components/general/CoverModal';
import { uploadGenericFile } from '@/features/workspaces/storage/services/file.service';
import type { Project } from '../../types/project.types';

// ── Default Cover Photo ──────────────────────────────────────────────────────
const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80';

// ── Project Modules Config (Matching Flux Settings) ──────────────────────────
export interface ProjectModuleOption {
  id: string;
  title: string;
  desc: string;
  defaultOn?: boolean;
}

const PROJECT_MODULE_OPTIONS: ProjectModuleOption[] = [
  {
    id: 'cycles',
    title: 'Enable cycles',
    desc: 'Timebox work per project and adjust the time period as needed. One cycle can be 2 weeks, the next 1 week.',
    defaultOn: true,
  },
  {
    id: 'tasks',
    title: 'Enable work items',
    desc: 'Organize work into issues, subtasks, and track progress with Kanban, Table, and Calendar views.',
    defaultOn: true,
  },
  {
    id: 'pages',
    title: 'Enable pages',
    desc: 'Create and edit free-form content; notes, docs, anything.',
    defaultOn: true,
  },
  {
    id: 'storage',
    title: 'Enable storage',
    desc: 'Manage project files, research documents, and attachments.',
    defaultOn: true,
  },
  {
    id: 'stickies',
    title: 'Enable stickies',
    desc: 'Quick sticky notes and brainstorming canvas for project ideas.',
    defaultOn: true,
  },
];

// ── Helper: Derive Short Project Identifier ─────────────────────────────────
function generateIdentifier(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4);
  }
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('');
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
  const { workspaceId } = useParams() as { workspaceId: string };
  const router = useRouter();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  // Internal dialog state (supports both controlled & uncontrolled)
  const [internalOpen, setInternalOpen] = useState(true);
  const isModalOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  // Step state: 1 = Create Project, 2 = Projects and work items
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form States
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [hasManuallyEditedIdentifier, setHasManuallyEditedIdentifier] = useState(false);
  const [avatar, setAvatar] = useState('👌');
  const [cover, setCover] = useState(DEFAULT_COVER);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const { user } = useAuth();
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Step 2 State
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [activeModules, setActiveModules] = useState<string[]>(() =>
    PROJECT_MODULE_OPTIONS.filter((m) => m.defaultOn).map((m) => m.id)
  );

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (nameError) setNameError('');
    if (!hasManuallyEditedIdentifier) {
      setIdentifier(generateIdentifier(val));
    }
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasManuallyEditedIdentifier(true);
    setIdentifier(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 10));
  };

  const handleUploadCustomCover = async (file: File) => {
    try {
      setIsUploadingCover(true);
      const url = await uploadGenericFile(file, workspaceId);
      setCover(url);
      toast.success('Cover uploaded');
    } catch {
      const localUrl = URL.createObjectURL(file);
      setCover(localUrl);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setName('');
      setNameError('');
      setIdentifier('');
      setHasManuallyEditedIdentifier(false);
      setAvatar('👌');
      setCover(DEFAULT_COVER);
      setDescription('');
      setIsPrivate(false);
      setCreatedProject(null);
      setActiveModules(PROJECT_MODULE_OPTIONS.filter((m) => m.defaultOn).map((m) => m.id));
    }, 200);
  };

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Project name is required');
      nameInputRef.current?.focus();
      return;
    }
    setNameError('');
    if (createMutation.isPending) return;

    const initialModules = ['overview', ...activeModules];

    createMutation.mutate(
      {
        workspaceId: workspaceId || undefined,
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        avatar,
        cover,
        description: description.trim() || undefined,
        isPrivate,
        leadId: user?.id,
        modules: initialModules,
      },
      {
        onSuccess: (res: any) => {
          const proj: Project = res?.project || res?.data || res;
          setCreatedProject(proj);
          if (proj?.modules && Array.isArray(proj.modules)) {
            setActiveModules(proj.modules.filter((m: string) => m !== 'overview'));
          }
          setStep(2);
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
        modules: ['overview', ...nextModules],
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
          <form onSubmit={handleSubmitStep1} className="flex flex-col">
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
                    ref={nameInputRef}
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Project name"
                    autoFocus
                    className={cn(
                      'h-10 text-13 font-normal rounded-md border border-border bg-background focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground',
                      nameError && 'border-destructive focus-visible:ring-destructive/30'
                    )}
                  />
                  {nameError && (
                    <p className="text-11 text-destructive pl-0.5">{nameError}</p>
                  )}
                </div>

                <div className="relative w-44 sm:w-52 shrink-0">
                  <Input
                    value={identifier}
                    onChange={handleIdentifierChange}
                    placeholder="Project ID"
                    maxLength={10}
                    className="h-10 pr-9 text-13 font-normal rounded-md border border-border bg-background focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground"
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

                {/* Row 3: Pills (Public / Private + Lead) */}
                <div className="flex items-center gap-2 pt-1">
                  {/* Public / Private Pill */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-13 font-normal text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        {isPrivate ? (
                          <>
                            <Lock className="size-4 shrink-0 text-muted-foreground" />
                            <span>Private</span>
                          </>
                        ) : (
                          <>
                            <Globe className="size-4 shrink-0 text-muted-foreground" />
                            <span>Public</span>
                          </>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-56 p-1 rounded-md border border-border bg-popover z-100 space-y-0.5 "
                    >
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-13 transition-colors cursor-pointer text-left',
                          !isPrivate
                            ? 'bg-muted font-medium text-foreground'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="size-4 shrink-0" />
                          <div>
                            <div>Public</div>
                            <div className="text-11 text-muted-foreground font-normal">
                              Visible to everyone
                            </div>
                          </div>
                        </div>
                        {!isPrivate && <Check className="size-4 shrink-0 text-primary" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-13 transition-colors cursor-pointer text-left',
                          isPrivate
                            ? 'bg-muted font-medium text-foreground'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="size-4 shrink-0" />
                          <div>
                            <div>Private</div>
                            <div className="text-11 text-muted-foreground font-normal">
                              Only invited members
                            </div>
                          </div>
                        </div>
                        {isPrivate && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    </PopoverContent>
                  </Popover>

                  {/* Lead Indicator (Creator is Project PI / Owner) */}
                  <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-muted/50 text-13 font-normal text-foreground select-none">
                    <Avatar className="size-4.5 shrink-0">
                      {user?.avatar && (
                        <AvatarImage src={user.avatar} />
                      )}
                      <AvatarFallback className="text-10 font-semibold">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[140px]">
                      {user?.name || 'Lead (PI)'}
                    </span>
                  </div>
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
