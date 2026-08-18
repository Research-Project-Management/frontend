import type { Project } from '../types/project.types';

export const BANNER_GRADIENTS = [
  'from-blue-600/90 via-sky-600/80 to-slate-800',
  'from-teal-600/90 via-emerald-600/80 to-slate-800',
  'from-amber-600/90 via-stone-600/80 to-zinc-900',
  'from-slate-700 via-zinc-800 to-neutral-900',
  'from-sky-700 via-blue-700/80 to-slate-900',
  'from-slate-800 via-stone-800 to-neutral-950',
  'from-blue-700/90 via-slate-700/80 to-zinc-900',
  'from-zinc-700 via-neutral-800 to-slate-900',
] as const;

export type ProjectVisibilityFilter = 'all' | 'public' | 'private';
export type ProjectSortOption = 'updated' | 'name' | 'created';

/**
 * Generates an uppercase project key/identifier fallback from project name.
 */
export function getProjectKey(name?: string): string {
  if (!name || !name.trim()) return 'PROJ';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0].substring(0, 3) + words[1].substring(0, 2)).toUpperCase();
  }
  return name.substring(0, 5).toUpperCase();
}

/**
 * Calculates a deterministic gradient banner class for a project.
 */
export function getBannerGradient(id?: string): string {
  if (!id) return BANNER_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BANNER_GRADIENTS.length;
  return BANNER_GRADIENTS[index];
}

/**
 * Checks if a project is private.
 */
export function isProjectPrivate(project: Partial<Project>): boolean {
  return Boolean((project as any).isPrivate ?? (project as any).settings?.isPrivate ?? false);
}

/**
 * Filters only active (non-archived) projects.
 */
export function filterActiveProjects(projects: Project[]): Project[] {
  if (!Array.isArray(projects)) return [];
  return projects.filter((p) => !p.isArchived);
}

/**
 * Filters projects by visibility (all, public, private).
 */
export function filterProjectsByVisibility(
  projects: Project[],
  filter: ProjectVisibilityFilter
): Project[] {
  if (!Array.isArray(projects)) return [];
  if (filter === 'public') {
    return projects.filter((p) => !isProjectPrivate(p));
  }
  if (filter === 'private') {
    return projects.filter((p) => isProjectPrivate(p));
  }
  return projects;
}

/**
 * Searches projects by keyword across name, description, identifier, or key.
 */
export function searchProjects(projects: Project[], query: string): Project[] {
  if (!Array.isArray(projects)) return [];
  if (!query || !query.trim()) return projects;

  const q = query.trim().toLowerCase();
  return projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      ((p as any).identifier && (p as any).identifier.toLowerCase().includes(q)) ||
      ((p as any).key && (p as any).key.toLowerCase().includes(q))
  );
}

/**
 * Sorts projects according to the chosen sort strategy.
 */
export function sortProjects(
  projects: Project[],
  sortBy: ProjectSortOption = 'updated'
): Project[] {
  if (!Array.isArray(projects)) return [];
  const copy = [...projects];

  copy.sort((a, b) => {
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (sortBy === 'created') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    }
    // Default: updated (falls back to createdAt)
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return copy;
}

/**
 * Computes filter count statistics for active projects.
 */
export function calculateProjectFilterCounts(projects: Project[]): {
  all: number;
  public: number;
  private: number;
} {
  let pub = 0;
  let priv = 0;

  if (Array.isArray(projects)) {
    projects.forEach((p) => {
      if (isProjectPrivate(p)) {
        priv++;
      } else {
        pub++;
      }
    });
  }

  return {
    all: projects?.length || 0,
    public: pub,
    private: priv,
  };
}

export type ProjectFilterCriteria = {
  myProjects?: boolean;
  access?: ('private' | 'public')[];
  leads?: string[];
  members?: string[];
  createdDate?: 'all' | 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom';
  customDateRange?: {
    from?: string;
    to?: string;
  };
};

/**
 * Counts total number of active criteria in filter state.
 */
export function countActiveCriteria(filter: ProjectFilterCriteria): number {
  let count = 0;
  if (filter.myProjects) count++;
  if (filter.access && filter.access.length > 0) count += filter.access.length;
  if (filter.leads && filter.leads.length > 0) count += filter.leads.length;
  if (filter.members && filter.members.length > 0) count += filter.members.length;
  if (filter.createdDate && filter.createdDate !== 'all') count++;
  return count;
}

/**
 * Filters projects based on multi-faceted criteria (My projects, Access, Leads, Members, Created date).
 */
export function filterProjectsByCriteria(
  projects: Project[],
  criteria: ProjectFilterCriteria,
  currentUserId?: string
): Project[] {
  if (!Array.isArray(projects)) return [];

  return projects.filter((p) => {
    // 1. My projects filter
    if (criteria.myProjects && currentUserId) {
      const isOwner =
        p.createdBy?.id === currentUserId ||
        (p as any).owner === currentUserId;
      const isMember = p.members?.some(
        (m: any) =>
          m.user?.id === currentUserId ||
          m.userId === currentUserId ||
          m.user === currentUserId
      );
      if (!isOwner && !isMember) return false;
    }

    // 2. Access filter (Private / Public)
    if (criteria.access && criteria.access.length > 0) {
      const isPriv = isProjectPrivate(p);
      const isPub = !isPriv;
      const matchesAccess =
        (criteria.access.includes('private') && isPriv) ||
        (criteria.access.includes('public') && isPub);
      if (!matchesAccess) return false;
    }

    // 3. Lead filter
    if (criteria.leads && criteria.leads.length > 0) {
      const leadMember = p.members?.find(
        (m: any) =>
          m.role === 'manager' ||
          m.role === 'lead' ||
          m.role === 'owner' ||
          m.role === 'admin'
      );
      const leadId =
        leadMember?.user?.id ||
        leadMember?.userId ||
        p.createdBy?.id ||
        (p as any).owner;
      if (!leadId || !criteria.leads.includes(String(leadId))) return false;
    }

    // 4. Members filter
    if (criteria.members && criteria.members.length > 0) {
      const projectMemberIds = (p.members || []).map(
        (m: any) =>
          m.user?.id ||
          m.userId ||
          (typeof m.user === 'string' ? m.user : '')
      );
      if (p.createdBy?.id) {
        projectMemberIds.push(p.createdBy.id);
      }
      const hasMember = criteria.members.some((id) => projectMemberIds.includes(id));
      if (!hasMember) return false;
    }

    // 5. Created date filter
    if (criteria.createdDate && criteria.createdDate !== 'all') {
      const created = p.createdAt ? new Date(p.createdAt) : null;
      if (!created || isNaN(created.getTime())) return false;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (criteria.createdDate === 'today') {
        if (created < todayStart) return false;
      } else if (criteria.createdDate === 'yesterday') {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        if (created < yesterdayStart || created >= todayStart) return false;
      } else if (criteria.createdDate === 'last-7-days') {
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (created < sevenDaysAgo) return false;
      } else if (criteria.createdDate === 'last-30-days') {
        const thirtyDaysAgo = new Date(todayStart);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (created < thirtyDaysAgo) return false;
      } else if (criteria.createdDate === 'custom' && criteria.customDateRange) {
        if (criteria.customDateRange.from) {
          const fromDate = new Date(criteria.customDateRange.from);
          if (created < fromDate) return false;
        }
        if (criteria.customDateRange.to) {
          const toDate = new Date(criteria.customDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (created > toDate) return false;
        }
      }
    }

    return true;
  });
}
