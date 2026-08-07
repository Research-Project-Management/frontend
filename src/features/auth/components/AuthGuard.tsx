'use client';
import React, { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import Loading from "@/shared/components/ui/Loading";
import { useRouter } from "next/navigation";

export default function AuthGuard({ children }: { children?: React.ReactNode }) {
  const { user, isLoading, isError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      router.replace('/login');
    }
  }, [isLoading, isError, user, router]);

  if (isLoading || isError || !user) {
    return <Loading />;
  }

  return (
    <>
      {children}
    </>
  );
}