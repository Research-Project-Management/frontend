import { describe, it, expect } from 'vitest';
import {
  normalizeProjectMembers,
  filterAndSortProjectMembers,
} from '@/features/workspaces/projects/project-id/settings/utils/member.util';

describe('Project Settings Member Domain Utilities (member.util.ts)', () => {
  it('normalizes project members safely', () => {
    expect(normalizeProjectMembers(null as any)).toEqual([]);

    const raw = [
      {
        id: 'pm1',
        role: 'lead',
        joinedAt: '2026-03-01T00:00:00Z',
        user: { id: 'u1', name: 'Alice Smith', email: 'alice@flux.dev' },
      },
    ];

    const result = normalizeProjectMembers(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.user.name).toBe('Alice Smith');
    expect(result[0]!.role).toBe('lead');
  });

  it('filters and sorts project members correctly', () => {
    const list = normalizeProjectMembers([
      { id: '1', role: 'contributor', user: { name: 'Bob', email: 'bob@flux.dev' } },
      { id: '2', role: 'lead', user: { name: 'Alice', email: 'alice@flux.dev' } },
      { id: '3', role: 'viewer', user: { name: 'Charlie', email: 'charlie@flux.dev' } },
    ]);

    // Role filter
    const leads = filterAndSortProjectMembers(list, { roleFilter: 'lead' });
    expect(leads).toHaveLength(1);
    expect(leads[0]!.user.name).toBe('Alice');

    // Search filter
    const searchRes = filterAndSortProjectMembers(list, { search: 'charlie' });
    expect(searchRes).toHaveLength(1);
    expect(searchRes[0]!.user.name).toBe('Charlie');

    // Sort by name ASC
    const sorted = filterAndSortProjectMembers(list, { sortField: 'name', sortAsc: true });
    expect(sorted.map((m) => m.user.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});
