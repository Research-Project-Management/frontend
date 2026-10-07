'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, X, Loader2 } from 'lucide-react';
import { createCommentSchema, type CreateCommentInput } from '@/features/editor/schemas';
import { useCreateComment } from '@/features/editor/hooks/use-comment';
import type { MentionMember } from '@/features/editor/utils/mention.util';
import { MentionTextarea } from './MentionTextarea';

interface NewCommentFormProps {
  pageId: string;
  projectId?: string;
  pendingQuote?: string | null;
  initialLine?: number | null;
  initialLineEnd?: number | null;
  members: MentionMember[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function NewCommentForm({
  pageId,
  projectId,
  pendingQuote,
  initialLine,
  initialLineEnd,
  members,
  onClose,
  onSuccess,
}: NewCommentFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: {
      content: '',
      line: initialLine ?? null,
      lineEnd: initialLineEnd ?? null,
      projectId,
      pageId,
    },
    mode: 'onSubmit',
  });

  const content = watch('content') || '';
  const line = watch('line');
  const createMutation = useCreateComment();

  const handlePost = (data: CreateCommentInput) => {
    const trimmed = data.content?.trim();
    if (!trimmed || !pageId) return;

    createMutation.mutate(
      {
        pageId,
        content: trimmed,
        line: data.line ?? undefined,
        lineEnd: data.lineEnd ?? undefined,
        projectId: projectId || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  const isPending = isSubmitting || createMutation.isPending;

  return (
    <div className="border-b border-border bg-card p-3.5">
      <form onSubmit={handleSubmit(handlePost)} className="flex flex-col gap-2">
        {/* Form Header */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">New Comment</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
            aria-label="Close comment form"
          >
            <X className="size-3.5 shrink-0" />
          </button>
        </div>

        {/* Selected Quote Preview */}
        {pendingQuote && (
          <div className="text-xs bg-muted/60 border border-border/70 px-2.5 py-1.5 italic text-muted-foreground truncate rounded-md">
            &ldquo;{pendingQuote}&rdquo;
          </div>
        )}

        {/* Textarea with Mention autocomplete & Keyboard shortcuts */}
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <MentionTextarea
              value={field.value || ''}
              onChange={field.onChange}
              members={members}
              placeholder="Leave a comment... Type @ to mention a collaborator (Ctrl+Enter to post)"
              rows={3}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(handlePost)();
                }
              }}
              className="bg-background text-foreground border border-input focus:border-primary text-xs"
            />
          )}
        />

        {/* Validation error message */}
        {errors.content?.message && (
          <span className="text-11 text-destructive">
            {errors.content.message}
          </span>
        )}

        {/* Form Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-2">
            <span className="text-11 font-mono text-muted-foreground">
              {line ? `Line ${line}` : 'Whole document'}
            </span>
            {content.length > 0 && (
              <span className="text-10 font-mono text-muted-foreground/80">
                {content.length}/5000
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !content.trim()}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
            ) : (
              <Send className="size-3" />
            )}
            Post
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewCommentForm;
