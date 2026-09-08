import type { Project } from '../types/project.types';
import { searchProjects } from './projects-page.util';

export const ARCHIVE_BANNER_GRADIENTS = [
  'from-slate-700 via-zinc-800 to-neutral-900',
  'from-stone-700 via-zinc-800 to-slate-900',
  'from-neutral-700 via-stone-800 to-zinc-900',
] as const;

/**
 * Calculates a deterministic gradient banner class for an archived project.
 */
export function getArchiveBannerGradient(id?: string): string {
  if (!id) return ARCHIVE_BANNER_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % ARCHIVE_BANNER_GRADIENTS.length;
  return ARCHIVE_BANNER_GRADIENTS[index];
}

/**
 * Filters only archived projects from a list.
 */
export function filterArchivedProjects(projects: Project[]): Project[] {
  if (!Array.isArray(projects)) return [];
  return projects.filter((p) => Boolean(p.isArchived));
}

/**
 * Searches archived projects by keyword.
 */
export function searchArchivedProjects(projects: Project[], query: string): Project[] {
  return searchProjects(projects, query);
}
