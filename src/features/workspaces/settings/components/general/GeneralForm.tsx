'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui";
import type { GeneralSettingsFormValues } from '../../types/settings.types';

const RESEARCH_SCALES = [
  { value: '1', label: 'Individual Researcher (Cá nhân)' },
  { value: '2-10', label: 'Small Lab / Team (2–10 thành viên)' },
  { value: '11-50', label: 'Research Group / Department (11–50 thành viên)' },
  { value: '51-200', label: 'Institute / Faculty (51–200 thành viên)' },
  { value: '201-500', label: 'Research Center (201–500 thành viên)' },
  { value: '500+', label: 'Large Consortium (500+ thành viên)' },
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
                  Research Lab / Workspace Name
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g. AI & Data Science Lab"
                    className="h-9 w-full rounded-md"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  The display name of your personal research laboratory or workbench.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Research Group / Lab Scale */}
          <FormField
            control={form.control}
            name="teamSize"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm font-medium text-foreground">
                  Research Group Scale
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-9 w-full rounded-md">
                      <SelectValue placeholder="Select group scale" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESEARCH_SCALES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Estimated scale of your research collaboration network.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Workspace URL */}
          <div className="space-y-1.5 md:col-span-2">
            <FormLabel className="text-sm font-medium text-foreground">
              Personal Workspace URL (Slug)
            </FormLabel>
            <Input
              readOnly
              value={slug}
              className="h-9 w-full rounded-md bg-muted text-muted-foreground cursor-not-allowed font-medium font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Fixed unique routing path identifying your personal research space.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!hasChanges || isSubmitting}
            className="cursor-pointer"
          >
            {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin shrink-0" />}
            {isSubmitting ? 'Saving changes…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default GeneralForm;
