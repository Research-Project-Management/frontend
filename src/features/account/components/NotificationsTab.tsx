'use client';

import { useEffect } from 'react';
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
} from '@/shared/components/ui/form';
import { Switch } from '@/shared/components/ui/switch';

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

  useEffect(() => {
    const subscription = form.watch(() => form.handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [form.watch, form.handleSubmit]);

  const onSubmit = (values: z.infer<typeof notificationsSchema>) => {
    // Mock save, later connect to backend hook
    console.log('Saved notifications:', values);
    toast.success('Notification preferences updated');
    form.reset(values);
  };

  return (
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto'>
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-foreground'>Email notifications</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          Stay in the loop on Work items you are subscribed to. Enable this to get notified.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {/* Property changes */}
          <FormField
            control={form.control}
            name="propertyChanges"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Property changes</span>
                  <span className='text-sm text-muted-foreground'>
                    Notify me when work items' properties like assignees, priority, estimates or anything else changes.
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
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>State change</span>
                  <span className='text-sm text-muted-foreground'>
                    Notify me when the work items moves to a different state
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
              <FormItem className='flex items-center justify-between py-2 pl-4 border-l-2 border-border ml-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Work item completed</span>
                  <span className='text-sm text-muted-foreground'>
                    Notify me only when a work item is completed
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
              <FormItem className='flex items-center justify-between py-2 mt-4 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Comments</span>
                  <span className='text-sm text-muted-foreground'>
                    Notify me when someone leaves a comment on the work item
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
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Mentions</span>
                  <span className='text-sm text-muted-foreground'>
                    Notify me only when someone mentions me in the comments or description
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
        </form>
      </Form>
    </div>
  );
}
