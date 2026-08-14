import { z } from 'zod';

export type RecentItem = any;

export type DashboardConfig = any;
export type RecentItemView = any;
export type Sticky = {
  _id: string;
  title?: string;
  content: string;
  color: string;
  position: { x: number; y: number };
  createdAt?: string;
};

export const STICKY_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  yellow: { bg: '#fef08a', text: '#713f12' },
  green: { bg: '#bbf7d0', text: '#14532d' },
  blue: { bg: '#bfdbfe', text: '#1e3a8a' },
  pink: { bg: '#fbcfe8', text: '#831843' },
  purple: { bg: '#e9d5ff', text: '#581c87' },
  orange: { bg: '#fed7aa', text: '#7c2d12' },
};

export const STICKY_COLOR_CYCLE = Object.keys(STICKY_COLOR_MAP);
export interface Quicklink {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export const quicklinkSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  title: z.string().optional(),
});

export type QuicklinkFormData = z.infer<typeof quicklinkSchema>;
