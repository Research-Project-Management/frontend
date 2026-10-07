'use client';

import React from 'react';
import {
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";

interface GeneralDetailsProps {
  name: string;
  identifier: string;
  description: string;
  isPrivate?: boolean;
  createdAt?: string;
  isSaving: boolean;
  hasChanges: boolean;
  errors?: Record<string, { message?: string } | undefined>;
  onNameChange: (val: string) => void;
  onIdentifierChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onPrivateChange?: (val: boolean) => void;
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
        <Label className="text-12 font-medium text-foreground">Project name</Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter project name"
          className={`h-8 text-13 rounded-md border-border bg-background px-2.5 focus-visible:ring-1 focus-visible:ring-ring ${
            errors?.name ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
        {errors?.name && (
          <p className="text-11 text-destructive font-medium px-0.5">{errors.name.message}</p>
        )}
      </div>

      {/* ── Description ── */}
      <div className="space-y-1.5">
        <Label className="text-12 font-medium text-foreground">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Enter project description"
          className="text-13 min-h-[110px] rounded-md border-border bg-background focus-visible:ring-1 focus-visible:ring-ring resize-none p-2.5 leading-relaxed"
        />
      </div>

      {/* ── Project ID ── */}
      <div className="space-y-1.5 max-w-md">
        <Label className="text-12 font-medium text-foreground">Project ID</Label>
        <div className="relative">
          <Input
            value={identifier}
            onChange={handleIdentifierInput}
            placeholder="e.g. XINCHAO23"
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
                The project ID is used as the prefix for all work items in this project (e.g. {identifier || 'PRJ'}-1).
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Action Row: Update Project & Created Date ── */}
      <div className="flex items-center justify-between pt-3 gap-4 flex-wrap">
        <Button
          onClick={onSubmit}
          disabled={!hasChanges || isSaving || !name.trim()}
          className="relative h-8 px-3.5 text-13 font-medium bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer rounded-md shadow-none shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
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
