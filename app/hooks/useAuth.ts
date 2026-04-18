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
    location.pathname.startsWith("/forgot-password");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUser,
    retry: false,
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