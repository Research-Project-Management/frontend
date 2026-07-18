import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useNavigate, useLocation } from "react-router";
import { fetchUser } from "~/query/user";

export const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Không fetch user khi đang ở các trang auth
  const isAuthPage = location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/register") ||
    location.pathname.startsWith("/forgot-password") ||
    location.pathname.startsWith("/contact-sales");


  const { data, isLoading, isError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUser,
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 (actual auth failures)
      const status = error?.status ?? error?.response?.status;
      if (status === 401 || status === 403) return false;
      // Retry up to 2 times for network/transient errors
      return failureCount < 2;
    },
    enabled: !isAuthPage, // Chỉ fetch khi không ở trang auth
    staleTime: 5 * 60 * 1000, // Cache 5 phút để tránh refetch liên tục
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isError && !isAuthPage) {
      navigate("/login", { replace: true }); // replace: true để tránh tạo history entry
    }
  }, [isError, navigate, isAuthPage]);

  return { user: data, isLoading, isError };
};

export default useAuth;