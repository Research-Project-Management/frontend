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
    <div className="mx-auto container flex flex-col h-screen py-8">
      <WorkspacesTopBar />
      <main className=" h-full items-center flex w-full  ">
        <Outlet />
      </main>
    </div>
  );
}

export function WorkspacesTopBar() {
  const { user } = useAuth();
  return (
    <nav className="flex items-center  justify-between mb-8">
      <Link to="/ws" className="cursor-pointer">
        <Flux className="size-14" />
      </Link>
      <div>
        <span className="font-medium text-sm text-primary">
          {user?.email || user?.name}
        </span>
      </div>
    </nav>
  );
}
