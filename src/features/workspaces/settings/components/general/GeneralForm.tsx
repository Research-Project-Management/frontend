'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import type { GeneralSettingsFormValues } from '../../types/settings.types';

const TEAM_SIZES = [
  { value: '1', label: 'Just me' },
  { value: '2-10', label: '2–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-500', label: '201–500' },
  { value: '500+', label: '500+' },
] as const;

interface GeneralFormProps {
  form: UseFormReturn<GeneralSettingsFormValues>;
  slug: string;
  isSubmitting: boolean;
  hasChanges: boolean;
  onSubmit: (values: GeneralSettingsFormValues) => void;
}

export function GeneralForm({
  form,
  slug,
  isSubmitting,
  hasChanges,
  onSubmit,
}: GeneralFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Workspace Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-foreground">
                  Workspace name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Workspace name"
                    className="h-9 w-full rounded-md"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Company / Team Size */}
          <FormField
            control={form.control}
            name="teamSize"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-foreground">
                  Company size
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-9 w-full rounded-md">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TEAM_SIZES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Workspace URL - Same width as other fields (1 column) */}
          <div className="space-y-1.5">
            <FormLabel className="text-sm font-medium text-foreground">
              Workspace URL
            </FormLabel>
            <Input
              readOnly
              value={slug}
              className="h-9 w-full rounded-md bg-muted/50 text-muted-foreground cursor-not-allowed font-medium"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!hasChanges || isSubmitting}
            className="cursor-pointer"
          >
            {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Update workspace'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default GeneralForm;
