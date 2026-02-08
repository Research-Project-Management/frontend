import { useMemo } from "react";

/**
 * Hook to filter members by search term
 */
export function useFilteredMembers<T extends { user: { name: string; email?: string } }>(
  members: T[],
  searchTerm: string
): T[] {
  return useMemo(
    () =>
      members.filter(
        (m) =>
          m.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [members, searchTerm]
  );
}
