import { z } from 'zod';
import { quicklinkSchema, sectionConfigSchema } from '../schemas/home.schema';

export interface RecentItemUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  image?: string | null;
}

export interface RecentItemProject {
  id: string;
  name?: string | null;
}

export interface RecentItem {
  id: string;
  type: 'project' | 'page' | 'file' | 'task' | 'paper' | string;
  title?: string;
  name?: string;
  updatedAt?: string | Date;
  project?: RecentItemProject | null;
  users?: RecentItemUser[];
  updatedBy?: RecentItemUser | null;
}

export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export type DashboardConfig = SectionConfig[];

export interface Quicklink {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export type QuicklinkFormData = z.infer<typeof quicklinkSchema>;
