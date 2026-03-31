import { Link, Outlet } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import Loading from "~/components/ui/Loading";
import { useAuth } from "~/hooks/useAuth";

export default function WorkspacesLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-7xl flex-col px-6 py-8">
      <WorkspacesTopBar />
      <main className="flex h-full w-full items-start justify-center pt-6">
        <Outlet />
      </main>
    </div>
  );
}

export function WorkspacesTopBar() {
  const { user } = useAuth();

  return (
    <nav className="mb-8 flex items-center justify-between gap-4">
      <Link to="/ws" className="shrink-0 cursor-pointer">
        <Flux className="size-14" />
      </Link>

      <div className="min-w-0 text-right">
        <div className="truncate text-sm font-medium text-primary">
          {user?.email || user?.name}
        </div>
      </div>
    </nav>
  );
}