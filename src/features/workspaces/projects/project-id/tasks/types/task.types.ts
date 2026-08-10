import { z } from "zod";
import {
  TaskLabelSchema,
  TaskPrioritySchema,
  TaskRecurrenceSchema,
  TaskReminderSchema,
  ChecklistItemSchema,
  ChecklistSchema,
  ChecklistItemInputSchema,
  ChecklistInputSchema,
  TaskSchema,
  TaskMutationInputSchema,
} from "../schemas/task.schema";

export type TaskLabel = z.infer<typeof TaskLabelSchema>;
export type Priority = z.infer<typeof TaskPrioritySchema>;
export type TaskRecurrence = z.infer<typeof TaskRecurrenceSchema>;
export type TaskReminder = z.infer<typeof TaskReminderSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type Checklist = z.infer<typeof ChecklistSchema>;
export type ChecklistItemInput = z.infer<typeof ChecklistItemInputSchema>;
export type ChecklistInput = z.infer<typeof ChecklistInputSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TaskMutationInput = z.infer<typeof TaskMutationInputSchema>;

// Helpers kept here to avoid random helper files as requested
export type Column = {
  id: string;
  _id?: string;
  title: string;
  accentColor?: string;
};

export function resolveTaskColumnId(column?: Pick<Column, "id" | "_id"> | null) {
  return column?.id ?? column?._id ?? "";
}

export const PRIORITY_CONFIG = { urgent: { label: 'Urgent', color: 'red' }, high: { label: 'High', color: 'orange' }, medium: { label: 'Medium', color: 'blue' }, low: { label: 'Low', color: 'gray' }, none: { label: 'None', color: 'transparent' } };
export const DEFAULT_TASK_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
};

export function resolveTaskColumnColor(columnId: string, accentColor?: string) {
  return DEFAULT_TASK_COLUMN_COLORS[columnId] || accentColor || "#6B7280";
}

export type Cycle = any;
export type CycleMilestone = any;
