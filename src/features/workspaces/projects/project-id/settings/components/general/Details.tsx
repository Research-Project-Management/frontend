'use client';

import React from 'react';
import {
  Globe,
  Lock,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";

interface GeneralDetailsProps {
  name: string;
  identifier: string;
  description: string;
  isPrivate: boolean;
  createdAt?: string;
  isSaving: boolean;
  hasChanges: boolean;
  errors?: Record<string, { message?: string } | undefined>;
  onNameChange: (val: string) => void;
  onIdentifierChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onPrivateChange: (val: boolean) => void;
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

export function GeneralDetails({
  name,
  identifier,
  description,
  isPrivate,
  createdAt,
  isSaving,
  hasChanges,
  errors,
  onNameChange,
  onIdentifierChange,
  onDescriptionChange,
  onPrivateChange,
  onSubmit,
}: GeneralDetailsProps) {
  const formattedDate = formatCreatedDate(createdAt);

  const handleIdentifierInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    onIdentifierChange(clean);
  };

  return (
    <div className="space-y-5">
      {/* ── Project Name ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">Project name</Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter project name"
          className={`h-10 text-xs rounded-md border-border bg-background focus:ring-0 focus:outline-none px-3 ${
            errors?.name ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
        {errors?.name && (
          <p className="text-xs text-destructive font-medium px-1">{errors.name.message}</p>
        )}
      </div>

      {/* ── Description ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Enter project description"
          className="text-xs min-h-[110px] rounded-md border-border bg-background focus:ring-0 focus:outline-none resize-none p-3 leading-relaxed"
        />
      </div>

      {/* ── 2-Col Grid: Project ID & Network ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Project ID */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">Project ID</Label>
          <div className="relative">
            <Input
              value={identifier}
              onChange={handleIdentifierInput}
              placeholder="e.g. XINCHAO23"
              className={`h-10 text-xs font-mono font-medium rounded-md border-border bg-background focus:ring-0 focus:outline-none px-3 pr-9 ${
                errors?.identifier ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
            />
            {errors?.identifier && (
              <p className="text-xs text-destructive font-medium px-1 mt-1">{errors.identifier.message}</p>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label="Project ID info"
                  >
                    <Info className="size-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-xs">
                  Project ID is used as prefix for all work items (e.g. {identifier || 'PRJ'}-1).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Network */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">Network</Label>
          <Select
            value={isPrivate ? 'private' : 'public'}
            onValueChange={(val) => onPrivateChange(val === 'private')}
          >
            <SelectTrigger className="h-10 text-xs rounded-md border-border bg-background focus:ring-0 focus:outline-none px-3">
              <div className="flex items-center gap-2">
                {isPrivate ? (
                  <>
                    <Lock className="size-3.5 text-muted-foreground shrink-0" />
                    <span>Private</span>
                  </>
                ) : (
                  <>
                    <Globe className="size-3.5 text-muted-foreground shrink-0" />
                    <span>Public</span>
                  </>
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="public">
                <div className="flex items-center gap-2">
                  <Globe className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Public</span>
                </div>
              </SelectItem>
              <SelectItem value="private">
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Private</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Action Row: Update Project & Created Date ── */}
      <div className="flex items-center justify-between pt-3 gap-4 flex-wrap">
        <Button
          onClick={onSubmit}
          disabled={!hasChanges || isSaving || !name.trim()}
          className="h-9 px-4 text-xs font-medium bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer rounded-md shadow-none shrink-0"
        >
          {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin shrink-0" />}
          Update project
        </Button>

        <span className="text-xs text-muted-foreground italic">
          Created on {formattedDate}
        </span>
      </div>
    </div>
  );
}
