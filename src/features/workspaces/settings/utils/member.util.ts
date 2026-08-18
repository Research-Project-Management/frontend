import type { WorkspaceMemberItem, WorkspaceRole } from '../types/member.types';

export type SortField = 'name' | 'displayName' | 'email' | 'role' | 'auth' | 'date';
export type SortDirection = 'asc' | 'desc';

/**
 * Normalizes raw server member records into typed WorkspaceMemberItem objects.
 */
export function normalizeWorkspaceMembers(raw: any[]): WorkspaceMemberItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: any) => {
    const u = m.user || {};
    const auth = u.authProvider || u.provider || (u.email?.endsWith('@gmail.com') ? 'Google' : 'Email');
    return {
      id: m.id || u.id || '',
      userId: u.id || m.userId || '',
      role: (m.role || 'member').toLowerCase() as WorkspaceRole,
      createdAt: m.createdAt || m.joinedAt || new Date().toISOString(),
      authProvider: auth,
      user: {
        id: u.id || '',
        name: u.name || u.fullName || u.email?.split('@')[0] || 'Unknown User',
        email: u.email || '',
        avatar: u.avatar || null,
        displayName: u.displayName || u.name?.toLowerCase().replace(/\s+/g, '') || u.email?.split('@')[0] || '',
        authProvider: auth,
      },
    };
  });
}

/**
 * Filters and sorts members by search query, role filter, and sort criteria.
 */
export function filterAndSortMembers(
  members: WorkspaceMemberItem[],
  options: {
    search?: string;
    roleFilter?: string[];
    sortField?: SortField;
    sortDirection?: SortDirection;
  }
): WorkspaceMemberItem[] {
  const q = (options.search || '').toLowerCase().trim();
  const roleFilter = options.roleFilter || [];
  const sortField = options.sortField || 'date';
  const sortDirection = options.sortDirection || 'desc';

  const filtered = members.filter((m) => {
    const matchesSearch =
      !q ||
      m.user.name.toLowerCase().includes(q) ||
      (m.user.displayName || '').toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q);

    const matchesRole = roleFilter.length === 0 || roleFilter.includes(m.role);

    return matchesSearch && matchesRole;
  });

  return [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.user.name.localeCompare(b.user.name);
        break;
      case 'displayName':
        cmp = (a.user.displayName || '').localeCompare(b.user.displayName || '');
        break;
      case 'email':
        cmp = a.user.email.localeCompare(b.user.email);
        break;
      case 'role':
        cmp = a.role.localeCompare(b.role);
        break;
      case 'auth':
        cmp = (a.authProvider || '').localeCompare(b.authProvider || '');
        break;
      default:
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });
}
