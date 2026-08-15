import { z } from 'zod';
import { quicklinkSchema } from '../schemas/home.schema';

export type RecentItem = any;

export type DashboardConfig = any;
export type RecentItemView = any;
export interface Quicklink {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export type QuicklinkFormData = z.infer<typeof quicklinkSchema>;
