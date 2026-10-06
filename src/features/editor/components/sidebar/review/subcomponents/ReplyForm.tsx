'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { createReplySchema, type CreateReplyInput } from '@/features/editor/schemas';
import { useAddReply } from '@/features/editor/hooks/use-comment';

interface ReplyFormProps {
  commentId: string;
  pageId: string;
  projectId?: string;
}

export const ReplyForm = React.memo(function ReplyForm({
  commentId,
  pageId,
  projectId,
}: ReplyFormProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CreateReplyInput>({
    resolver: zodResolver(createReplySchema),
    defaultValues: {
      content: '',
      projectId,
    },
    mode: 'onSubmit',
  });

  const addReplyMutation = useAddReply();

  const onSubmit = (data: CreateReplyInput) => {
    const trimmed = data.content?.trim();
    if (!trimmed) return;
    addReplyMutation.mutate(
      { pageId, commentId, content: trimmed, projectId },
      {
        onSuccess: () => {
          reset({ content: '', projectId });
        },
      },
    );
  };

  const isPending = isSubmitting || addReplyMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="relative mt-2.5">
      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <input
            {...field}
            type="text"
            placeholder="Reply..."
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(onSubmit)();
              }
            }}
            className="w-full h-8 px-2.5 pr-8 rounded border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50"
          />
        )}
      />
      <button
        type="submit"
        disabled={isPending}
        aria-label="Send reply"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-40 after:absolute after:-inset-1.5 after:content-['']"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Send className="size-3" />
        )}
      </button>
      {errors.content?.message && (
        <span className="block mt-1 text-11 text-destructive">
          {errors.content.message}
        </span>
      )}
    </form>
  );
});

export default ReplyForm;
