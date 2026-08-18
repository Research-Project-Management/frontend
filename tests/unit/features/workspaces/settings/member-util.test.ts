import { describe, it, expect } from 'vitest';
import {
  normalizeWorkspaceMembers,
  filterAndSortMembers,
} from '@/features/workspaces/settings/utils/member.util';

describe('Workspace Member Domain Utilities (member.util.ts)', () => {
  it('normalizes raw server member list safely', () => {
    expect(normalizeWorkspaceMembers(null as any)).toEqual([]);

    const raw = [
      {
        id: 'm1',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00Z',
        user: {
          id: 'u1',
          name: 'Jane Doe',
          email: 'jane@gmail.com',
        },
      },
    ];

    const normalized = normalizeWorkspaceMembers(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]!.role).toBe('admin');
    expect(normalized[0]!.user.name).toBe('Jane Doe');
    expect(normalized[0]!.authProvider).toBe('Google');
  });

  it('filters and sorts members by name and role', () => {
    const members = normalizeWorkspaceMembers([
      { id: '1', role: 'member', createdAt: '2026-01-01', user: { name: 'Bob', email: 'bob@corp.com' } },
      { id: '2', role: 'admin', createdAt: '2026-02-01', user: { name: 'Alice', email: 'alice@corp.com' } },
      { id: '3', role: 'viewer', createdAt: '2026-03-01', user: { name: 'Charlie', email: 'charlie@corp.com' } },
    ]);

    // Role filter
    const admins = filterAndSortMembers(members, { roleFilter: ['admin'] });
    expect(admins).toHaveLength(1);
    expect(admins[0]!.user.name).toBe('Alice');

    // Search filter
    const searched = filterAndSortMembers(members, { search: 'charlie' });
    expect(searched).toHaveLength(1);
    expect(searched[0]!.user.name).toBe('Charlie');

    // Sort by name ASC
    const sortedByName = filterAndSortMembers(members, { sortField: 'name', sortDirection: 'asc' });
    expect(sortedByName.map((m) => m.user.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});
