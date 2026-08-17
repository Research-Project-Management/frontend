'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import {
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui';
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} className="h-10" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="teamSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team size</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select team size" />
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

          <div className="space-y-1.5">
            <FormLabel className="text-sm font-medium text-foreground">URL</FormLabel>
            <Input
              readOnly
              value={slug}
              className="bg-muted/50 text-muted-foreground cursor-not-allowed h-10 font-medium"
            />
          </div>
        </div>

        <div>
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
