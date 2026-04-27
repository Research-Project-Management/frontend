import { useQuery } from "@tanstack/react-query";
import { fetchUser } from "~/query/user";
import type { TypeUser } from "~/types/user";

export function useUser() {
  const { data: user, isLoading, error } = useQuery<TypeUser>({
    queryKey: ["user"],
    queryFn: fetchUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user && !error,
  };
}
