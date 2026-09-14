'use client';

import { useEffect, useCallback } from 'react';
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
} from "@/shared/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import { Switch } from "@/shared/components/ui";
import { useTheme } from "@/shared/providers";

export default function PreferencesTab() {
  const { theme, setTheme } = useTheme();

  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: theme || 'system',
      smoothCursor: false,
      submitShortcut: 'enter',
      timezone: 'utc',
      language: 'en',
      firstDayOfWeek: 'sunday',
      weekendDays: 'sat_sun',
    },
  });

  useEffect(() => {
    if (form.getValues('theme') !== theme) {
      form.setValue('theme', theme);
    }
  }, [theme, form]);

  const onSubmit = useCallback((values: z.infer<typeof preferencesSchema>) => {
    setTheme(values.theme);
    toast.success('Preferences updated successfully');
    form.reset(values); // Reset to new values to clear isDirty state
  }, [form, setTheme]);

  useEffect(() => {
    const subscription = form.watch(() => form.handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [form, onSubmit]);

  return (
    <div className='w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6'>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          {/* ── Group 1: Appearance & Interface ── */}
          <div className='rounded-md border border-border bg-card overflow-hidden divide-y divide-border'>
            <div className='px-4 py-3 bg-muted/25'>
              <h3 className='text-13 font-semibold text-foreground tracking-tight'>Interface & Appearance</h3>
              <p className='text-12 text-muted-foreground mt-0.5'>
                Customize your color scheme, motion styles, and interaction shortcuts.
              </p>
            </div>

            {/* Theme */}
            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Interface Theme</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Select light, dark, or sync with your system preference.
                    </span>
                  </div>
                  <FormControl>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        setTheme(val as 'system' | 'light' | 'dark');
                      }}
                      value={field.value}
                    >
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Theme' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='system'>
                          <div className='flex items-center gap-2'>
                            <div className='size-2 rounded-full bg-primary shrink-0' />
                            <span>System</span>
                          </div>
                        </SelectItem>
                        <SelectItem value='light'>Light</SelectItem>
                        <SelectItem value='dark'>Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            {/* Smooth Cursor */}
            <FormField
              control={form.control}
              name="smoothCursor"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Smooth Cursor Motion</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Enable fluid spring physics animation for your active editor cursor.
                    </span>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className='shrink-0'
                    />
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            {/* Comment submit shortcut */}
            <FormField
              control={form.control}
              name="submitShortcut"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Comment Shortcut</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Primary keystroke combination to post review comments and work item replies.
                    </span>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Shortcut' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='enter'>Enter</SelectItem>
                        <SelectItem value='cmd_enter'>⌘ + Enter</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />
          </div>

          {/* ── Group 2: Regional & Calendar Settings ── */}
          <div className='rounded-md border border-border bg-card overflow-hidden divide-y divide-border'>
            <div className='px-4 py-3 bg-muted/25'>
              <h3 className='text-13 font-semibold text-foreground tracking-tight'>Regional & Localization</h3>
              <p className='text-12 text-muted-foreground mt-0.5'>
                Manage your working timezone, primary language, and research calendar defaults.
              </p>
            </div>

            {/* Timezone */}
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Working Timezone</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Used for cycle iterations, milestone deadlines, and activity logs.
                    </span>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Timezone' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='utc'>UTC (Default)</SelectItem>
                        <SelectItem value='gmt'>GMT (London)</SelectItem>
                        <SelectItem value='pst'>PST (US Pacific)</SelectItem>
                        <SelectItem value='est'>EST (US Eastern)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            {/* Language */}
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Interface Language</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Select the primary language displayed in menus and system messages.
                    </span>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Language' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='en'>English</SelectItem>
                        <SelectItem value='vi'>Tiếng Việt</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            {/* First day of the week */}
            <FormField
              control={form.control}
              name="firstDayOfWeek"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>First Day of Week</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Defines the starting column on timeline and calendar views.
                    </span>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Day' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='sunday'>Sunday</SelectItem>
                        <SelectItem value='monday'>Monday</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />

            {/* Weekend days */}
            <FormField
              control={form.control}
              name="weekendDays"
              render={({ field }) => (
                <FormItem className='flex items-center justify-between p-4 space-y-0 gap-4'>
                  <div className='flex flex-col min-w-0 pr-2'>
                    <span className='text-13 font-medium text-foreground'>Weekend Days</span>
                    <span className='text-12 text-muted-foreground mt-0.5'>
                      Days highlighted as non-working time across sprint cycles.
                    </span>
                  </div>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className='w-[160px] h-8 text-12 bg-background border border-border rounded-md shadow-2xs shrink-0 cursor-pointer'>
                        <SelectValue placeholder='Select Weekend' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='sat_sun'>Saturday, Sunday</SelectItem>
                        <SelectItem value='fri_sat'>Friday, Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className='text-11' />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  );
}
