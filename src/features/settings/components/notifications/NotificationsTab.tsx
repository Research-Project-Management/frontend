'use client';

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notificationsSchema } from '../../types/notifications.schema';
import * as z from 'zod';
import { toast } from 'sonner';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from "@/features/editor/ui/hooks/use-notification-bundler";

export function NotificationsTab() {
  const { data: bundlingSettings } = useNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const form = useForm<z.infer<typeof notificationsSchema>>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      propertyChanges: true,
      stateChange: true,
      workItemCompleted: true,
      comments: true,
      mentions: true,
    },
  });

  const onSubmit = useCallback((values: z.infer<typeof notificationsSchema>) => {
    toast.success('Notification preferences updated');
    form.reset(values);
  }, [form]);

  useEffect(() => {
    const subscription = form.watch(() => form.handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [form, onSubmit]);

  return (
    <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Section 1: Email & Activity Notifications ── */}
          <div className="space-y-1">
            <div className="pb-3 border-b border-border">
              <h2 className="text-14 font-semibold text-foreground tracking-tight">Email & Activity Notifications</h2>
              <p className="text-12 text-muted-foreground mt-1 leading-relaxed max-w-[65ch]">
                Stay in the loop on work items you are subscribed to. Choose when you receive email alerts.
              </p>
            </div>

            <div className="divide-y divide-border">
              {/* Property changes */}
              <FormField
                control={form.control}
                name="propertyChanges"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-3.5 space-y-0 gap-4">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <span className="text-13 font-medium text-foreground">Property changes</span>
                      <span className="text-12 text-muted-foreground leading-normal">
                        Notify me when work item properties like assignees, priority, or estimates change.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle property changes notifications"
                      />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />

              {/* State change */}
              <FormField
                control={form.control}
                name="stateChange"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-3.5 space-y-0 gap-4">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <span className="text-13 font-medium text-foreground">State change</span>
                      <span className="text-12 text-muted-foreground leading-normal">
                        Notify me when a work item moves to a different state in the workflow.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle state change notifications"
                      />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />

              {/* Work item completed (Nested) */}
              <FormField
                control={form.control}
                name="workItemCompleted"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between pl-6 pr-0 py-3 space-y-0 gap-4">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                        <span className="text-13 font-medium text-foreground">Only when completed</span>
                      </div>
                      <span className="text-12 text-muted-foreground leading-normal pl-3.5">
                        Limit state notifications to when a work item is marked completed or cancelled.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle notifications only when completed"
                      />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />

              {/* Comments */}
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-3.5 space-y-0 gap-4">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <span className="text-13 font-medium text-foreground">Comments</span>
                      <span className="text-12 text-muted-foreground leading-normal">
                        Notify me when someone leaves a comment or updates an existing comment on a work item.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle comment notifications"
                      />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />

              {/* Mentions */}
              <FormField
                control={form.control}
                name="mentions"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between py-3.5 space-y-0 gap-4">
                    <div className="flex flex-col gap-0.5 pr-2">
                      <span className="text-13 font-medium text-foreground">Mentions</span>
                      <span className="text-12 text-muted-foreground leading-normal">
                        Notify me specifically when someone @mentions me in a description or comment.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Toggle mention notifications"
                      />
                    </FormControl>
                    <FormMessage className="text-11" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* ── Section 2: Overleaf Review Digest & Notification Bundling ── */}
          <div className="space-y-1 pt-6">
            <div className="pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h2 className="text-14 font-semibold text-foreground tracking-tight">
                  Overleaf Review Digest & Notification Bundling
                </h2>
                <span className="px-2 py-0.5 rounded-md text-11 font-medium bg-warning/10 text-warning border border-warning/20">
                  Overleaf Parity
                </span>
              </div>
              <p className="text-12 text-muted-foreground mt-1 leading-relaxed max-w-[65ch]">
                Buffer rapid successive review comments, @mentions, and track-changes edits into a consolidated 10-minute digest instead of sending constant notifications.
              </p>
            </div>

            <div className="divide-y divide-border">
              {/* Enable Bundling */}
              <div className="flex items-center justify-between py-3.5 gap-4">
                <div className="flex flex-col gap-0.5 pr-2">
                  <span className="text-13 font-medium text-foreground">Enable Review Notification Bundling</span>
                  <span className="text-12 text-muted-foreground leading-normal">
                    Collect collaborator review actions into sliding time-window digests.
                  </span>
                </div>
                <Switch
                  checked={bundlingSettings?.enabled ?? true}
                  onCheckedChange={(val) => updateSettings.mutate({ enabled: val })}
                  aria-label="Toggle review notification bundling"
                />
              </div>

              {/* Buffering Window Duration */}
              <div className="flex items-center justify-between py-3.5 gap-4">
                <div className="flex flex-col gap-0.5 pr-2">
                  <span className="text-13 font-medium text-foreground">Buffering Window</span>
                  <span className="text-12 text-muted-foreground leading-normal">
                    Standard Overleaf window is 10 minutes. Shorter windows notify faster; longer windows group more edits together.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {[5, 10, 15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={!(bundlingSettings?.enabled ?? true)}
                      onClick={() => updateSettings.mutate({ windowMinutes: mins })}
                      aria-label={`${mins} minutes buffering window`}
                      aria-pressed={(bundlingSettings?.windowMinutes ?? 10) === mins}
                      className={cn(
                        'px-2.5 py-1 rounded text-12 font-medium border transition-colors cursor-pointer disabled:opacity-40 select-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        (bundlingSettings?.windowMinutes ?? 10) === mins
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default NotificationsTab;
