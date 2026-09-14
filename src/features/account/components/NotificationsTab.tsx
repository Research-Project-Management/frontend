'use client';

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notificationsSchema } from '../schemas/notifications.schema';
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

export default function NotificationsTab() {
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
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto space-y-6'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='rounded-md border border-border bg-card overflow-hidden'>
            <div className='px-4 py-3 border-b border-border bg-muted/25'>
              <h3 className='text-13 font-medium text-foreground'>Email & Activity Notifications</h3>
              <p className='text-12 text-muted-foreground mt-0.5'>
                Stay in the loop on work items you are subscribed to. Choose when you receive email alerts.
              </p>
            </div>

            <div className='divide-y divide-border'>
              {/* Property changes */}
              <FormField
                control={form.control}
                name="propertyChanges"
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                    <div className='flex flex-col gap-0.5 pr-2'>
                      <span className='text-13 font-medium text-foreground'>Property changes</span>
                      <span className='text-12 text-muted-foreground'>
                        Notify me when work item properties like assignees, priority, or estimates change.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* State change */}
              <FormField
                control={form.control}
                name="stateChange"
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                    <div className='flex flex-col gap-0.5 pr-2'>
                      <span className='text-13 font-medium text-foreground'>State change</span>
                      <span className='text-12 text-muted-foreground'>
                        Notify me when a work item moves to a different state in the workflow.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Work item completed (Nested) */}
              <FormField
                control={form.control}
                name="workItemCompleted"
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between pl-8 pr-4 py-3.5 bg-muted/15 space-y-0 gap-4'>
                    <div className='flex flex-col gap-0.5 pr-2'>
                      <div className='flex items-center gap-2'>
                        <span className='size-1.5 rounded-full bg-muted-foreground/50 shrink-0' />
                        <span className='text-13 font-medium text-foreground'>Only when completed</span>
                      </div>
                      <span className='text-12 text-muted-foreground pl-3.5'>
                        Limit state notifications to when a work item is marked completed or cancelled.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Comments */}
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                    <div className='flex flex-col gap-0.5 pr-2'>
                      <span className='text-13 font-medium text-foreground'>Comments</span>
                      <span className='text-12 text-muted-foreground'>
                        Notify me when someone leaves a comment or updates an existing comment on a work item.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mentions */}
              <FormField
                control={form.control}
                name="mentions"
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                    <div className='flex flex-col gap-0.5 pr-2'>
                      <span className='text-13 font-medium text-foreground'>Mentions</span>
                      <span className='text-12 text-muted-foreground'>
                        Notify me specifically when someone @mentions me in a description or comment.
                      </span>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
