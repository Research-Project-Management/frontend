import React from "react";
import { useAuth } from "~/hooks/useAuth";
import { useUserStore } from "~/stores/user";
import Loading from "../ui/Loading";
import { Outlet, Navigate } from "react-router";

export default function AuthGuard() {
  const { user, isLoading, isError } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  // Nếu có lỗi auth (401) thì redirect về login
  if (isError || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Outlet />
    </>
  );
}
