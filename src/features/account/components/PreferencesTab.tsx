'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { preferencesSchema } from '../schemas/preferences.schema';
import * as z from 'zod';
import { toast } from 'sonner';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';

export default function PreferencesTab() {
  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: 'system',
      smoothCursor: false,
      submitShortcut: 'enter',
      timezone: 'utc',
      language: 'en',
      firstDayOfWeek: 'sunday',
      weekendDays: 'sat_sun',
    },
  });

  useEffect(() => {
    const subscription = form.watch(() => form.handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [form.watch, form.handleSubmit]);

  const onSubmit = (values: z.infer<typeof preferencesSchema>) => {
    // Mock save, later connect to backend hook
    console.log('Saved preferences:', values);
    toast.success('Preferences updated successfully');
    form.reset(values); // Reset to new values to clear isDirty state
  };

  return (
    <div className='p-6 md:px-8 w-full max-w-4xl mx-auto'>
      <div className='mb-8'>
        <h2 className='text-xl font-semibold text-foreground'>Preferences</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          Customize your app experience the way you work
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

          {/* Theme */}
          <FormField
            control={form.control}
            name="theme"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Theme</span>
                  <span className='text-sm text-muted-foreground'>
                    Select or customize your interface color scheme.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[180px] bg-background'>
                      <SelectValue placeholder='Select Theme' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='system'>
                        <div className='flex items-center gap-2'>
                          <div className='size-2 rounded-full bg-blue-500' />
                          <span>System Preference</span>
                        </div>
                      </SelectItem>
                      <SelectItem value='light'>Light</SelectItem>
                      <SelectItem value='dark'>Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Smooth Cursor */}
          <FormField
            control={form.control}
            name="smoothCursor"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Smooth Cursor</span>
                  <span className='text-sm text-muted-foreground'>
                    Select the cursor motion style that feels right for you.
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

          {/* Comment submit shortcut */}
          <FormField
            control={form.control}
            name="submitShortcut"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>
                    Comment submit shortcut
                  </span>
                  <span className='text-sm text-muted-foreground'>
                    Choose the keyboard shortcut to submit comments.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[140px] bg-background'>
                      <SelectValue placeholder='Select Shortcut' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='enter'>Enter</SelectItem>
                      <SelectItem value='cmd_enter'>Cmd + Enter</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='pt-6 pb-2 border-b border-border/50'>
            <h3 className='text-base font-semibold text-foreground'>
              Language & Time
            </h3>
          </div>

          {/* Timezone */}
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Timezone</span>
                  <span className='text-sm text-muted-foreground'>
                    Current timezone setting.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[140px] bg-background'>
                      <SelectValue placeholder='Select Timezone' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='utc'>UTC</SelectItem>
                      <SelectItem value='gmt'>GMT</SelectItem>
                      <SelectItem value='pst'>PST</SelectItem>
                      <SelectItem value='est'>EST</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Language */}
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Language</span>
                  <span className='text-sm text-muted-foreground'>
                    Choose the language used in the user interface.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[140px] bg-background'>
                      <SelectValue placeholder='Select Language' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='en'>English</SelectItem>
                      <SelectItem value='vi'>Tiếng Việt</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* First day of the week */}
          <FormField
            control={form.control}
            name="firstDayOfWeek"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>
                    First day of the week
                  </span>
                  <span className='text-sm text-muted-foreground'>
                    Choose which day your week starts on.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[140px] bg-background'>
                      <SelectValue placeholder='Select Day' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='sunday'>Sunday</SelectItem>
                      <SelectItem value='monday'>Monday</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Weekend days */}
          <FormField
            control={form.control}
            name="weekendDays"
            render={({ field }) => (
              <FormItem className='flex items-center justify-between py-2 space-y-0'>
                <div className='flex flex-col gap-1 pr-4'>
                  <span className='text-sm font-medium text-foreground'>Weekend days</span>
                  <span className='text-sm text-muted-foreground'>
                    Sets which days are treated as non-working time.
                  </span>
                </div>
                <FormControl>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger className='w-[180px] bg-background'>
                      <SelectValue placeholder='Select Weekend' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='sat_sun'>Saturday, Sunday</SelectItem>
                      <SelectItem value='fri_sat'>Friday, Saturday</SelectItem>
                    </SelectContent>
                  </Select>
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
