import type { ProjectMemberItem } from '../types/member.types';

export type ProjectMemberSortField = 'name' | 'displayName' | 'email' | 'role' | 'date';

/**
 * Normalizes raw project members into typed ProjectMemberItem array.
 */
export function normalizeProjectMembers(rawMembers: any[], fallbackCreatedAt?: string): ProjectMemberItem[] {
  if (!Array.isArray(rawMembers)) return [];
  return rawMembers.map((m) => {
    const u = m.user || {};
    const uId = u.id || m.userId || '';
    return {
      id: m.id || uId,
      userId: uId,
      user: {
        id: uId,
        name: u.name || 'Unknown User',
        email: u.email || '',
        avatar: u.avatar || '',
      },
      role: m.role || 'contributor',
      joinedAt: m.joinedAt || fallbackCreatedAt || new Date().toISOString(),
    };
  });
}

/**
 * Filters and sorts project members according to search, role filter, and sort options.
 */
export function filterAndSortProjectMembers(
  members: ProjectMemberItem[],
  options: {
    search?: string;
    roleFilter?: string | null;
    sortField?: ProjectMemberSortField;
    sortAsc?: boolean;
  }
): ProjectMemberItem[] {
  const q = (options.search || '').toLowerCase().trim();
  const roleFilter = options.roleFilter?.toLowerCase() || null;
  const sortField = options.sortField || 'name';
  const sortAsc = options.sortAsc ?? true;

  const list = members.filter((m) => {
    const matchSearch =
      !q ||
      m.user.name.toLowerCase().includes(q) ||
      (m.user.email || '').toLowerCase().includes(q);

    const matchRole = !roleFilter || m.role.toLowerCase() === roleFilter;

    return matchSearch && matchRole;
  });

  return [...list].sort((a, b) => {
    let valA = '';
    let valB = '';
    if (sortField === 'name') {
      valA = a.user.name.toLowerCase();
      valB = b.user.name.toLowerCase();
    } else if (sortField === 'displayName') {
      valA = (a.user.email?.split('@')[0] || a.user.name).toLowerCase();
      valB = (b.user.email?.split('@')[0] || b.user.name).toLowerCase();
    } else if (sortField === 'email') {
      valA = (a.user.email || '').toLowerCase();
      valB = (b.user.email || '').toLowerCase();
    } else if (sortField === 'role') {
      valA = a.role.toLowerCase();
      valB = b.role.toLowerCase();
    } else if (sortField === 'date') {
      valA = a.joinedAt || '';
      valB = b.joinedAt || '';
    }
    const cmp = valA.localeCompare(valB);
    return sortAsc ? cmp : -cmp;
  });
}
