'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Sparkles,
  GitBranch,
  CheckCircle2,
  FileText,
  Loader2,
  Wand2,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface TaskAiActionsProps {
  taskTitle: string;
  taskDescription: string;
  onAppendSubtasks: (newSubtasks: Array<{ title: string; completed: boolean }>) => void;
  onAppendAcceptanceCriteria: (criteriaItems: string[]) => void;
  onEnhanceDescription: (enhanced: string) => void;
  isReadOnly?: boolean;
}

export const TaskAiActions: React.FC<TaskAiActionsProps> = ({
  taskTitle,
  taskDescription,
  onAppendSubtasks,
  onAppendAcceptanceCriteria,
  onEnhanceDescription,
  isReadOnly = false,
}) => {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleBreakdown = async () => {
    if (!taskTitle) {
      toast.error('Please enter a task title first');
      return;
    }
    setIsGenerating(true);
    setActiveAction('breakdown');
    try {
      // Simulate intelligent breakdown based on title
      await new Promise((res) => setTimeout(res, 800));

      const titleLower = taskTitle.toLowerCase();
      let generatedSubtasks: Array<{ title: string; completed: boolean }> = [];

      if (titleLower.includes('auth') || titleLower.includes('login')) {
        generatedSubtasks = [
          { title: 'Design login & register UI layout', completed: false },
          { title: 'Implement form validation and error states', completed: false },
          { title: 'Connect authentication API & token storage', completed: false },
          { title: 'Write unit tests for auth flow', completed: false },
        ];
      } else if (titleLower.includes('api') || titleLower.includes('backend') || titleLower.includes('service')) {
        generatedSubtasks = [
          { title: 'Define DTO & request validation schemas', completed: false },
          { title: 'Implement business logic & database queries', completed: false },
          { title: 'Add error handling & logging interceptors', completed: false },
          { title: 'Write integration test cases', completed: false },
        ];
      } else if (titleLower.includes('ui') || titleLower.includes('design') || titleLower.includes('page')) {
        generatedSubtasks = [
          { title: 'Build responsive layout and typography', completed: false },
          { title: 'Add interactive hover/click animations', completed: false },
          { title: 'Handle empty states and error boundaries', completed: false },
          { title: 'Test across mobile & desktop viewports', completed: false },
        ];
      } else {
        generatedSubtasks = [
          { title: `Research requirements for "${taskTitle}"`, completed: false },
          { title: `Implement core logic for ${taskTitle}`, completed: false },
          { title: 'Perform peer review and manual testing', completed: false },
          { title: 'Deploy changes to staging environment', completed: false },
        ];
      }

      onAppendSubtasks(generatedSubtasks);
      toast.success(`Generated ${generatedSubtasks.length} subtasks with AI`);
      setOpen(false);
    } finally {
      setIsGenerating(false);
      setActiveAction(null);
    }
  };

  const handleAcceptanceCriteria = async () => {
    if (!taskTitle) {
      toast.error('Please enter a task title first');
      return;
    }
    setIsGenerating(true);
    setActiveAction('criteria');
    try {
      await new Promise((res) => setTimeout(res, 800));

      const criteria = [
        `Given the user navigates to the feature, when viewing ${taskTitle}, all fields render properly.`,
        'All asynchronous actions display appropriate loading indicators.',
        'Invalid inputs show inline validation errors without submitting.',
        'Success notifications trigger and persist according to system guidelines.',
      ];

      onAppendAcceptanceCriteria(criteria);
      toast.success('Generated Acceptance Criteria checklist with AI');
      setOpen(false);
    } finally {
      setIsGenerating(false);
      setActiveAction(null);
    }
  };

  const handleEnhance = async () => {
    if (!taskTitle) {
      toast.error('Please enter a task title first');
      return;
    }
    setIsGenerating(true);
    setActiveAction('enhance');
    try {
      await new Promise((res) => setTimeout(res, 800));

      const enhanced = `### Overview
${taskDescription || `Implementation plan and details for ${taskTitle}.`}

### Objectives
- Implement comprehensive solution for ${taskTitle} meeting quality standards.
- Ensure high performance, clean error boundaries, and seamless user interaction.

### Implementation Notes
- Follow workspace design system tokens and component guidelines.
- Verify cross-browser and responsive compatibility.`;

      onEnhanceDescription(enhanced);
      toast.success('Enhanced description format with AI');
      setOpen(false);
    } finally {
      setIsGenerating(false);
      setActiveAction(null);
    }
  };

  if (isReadOnly) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6.5 px-2 text-11 font-medium rounded-md border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1 cursor-pointer transition-all shadow-none"
        >
          <Sparkles className="size-3 text-purple-500" />
          <span>AI Copilot</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-1.5 rounded-sm border-purple-500/20 shadow-2xl bg-popover z-100 space-y-1"
      >
        <div className="px-2.5 py-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 border-b border-border/60">
          <Wand2 className="size-3.5" />
          <span>Work-Item AI Assistant</span>
        </div>

        <div className="space-y-0.5 pt-1">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleBreakdown}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs font-medium hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            {isGenerating && activeAction === 'breakdown' ? (
              <Loader2 className="size-4 animate-spin text-purple-500" />
            ) : (
              <GitBranch className="size-4 text-purple-500 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-foreground">Auto-Breakdown Subtasks</div>
              <div className="text-11 text-muted-foreground">Generate 3-5 subtasks from issue title</div>
            </div>
          </button>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleAcceptanceCriteria}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs font-medium hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            {isGenerating && activeAction === 'criteria' ? (
              <Loader2 className="size-4 animate-spin text-purple-500" />
            ) : (
              <CheckCircle2 className="size-4 text-purple-500 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-foreground">Acceptance Criteria</div>
              <div className="text-11 text-muted-foreground">Generate checklist for testing/QA</div>
            </div>
          </button>

          <button
            type="button"
            disabled={isGenerating}
            onClick={handleEnhance}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-xs font-medium hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            {isGenerating && activeAction === 'enhance' ? (
              <Loader2 className="size-4 animate-spin text-purple-500" />
            ) : (
              <FileText className="size-4 text-purple-500 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-foreground">Enhance Description</div>
              <div className="text-11 text-muted-foreground">Format with clear sections & notes</div>
            </div>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
