import { Link, Outlet, useNavigate } from "react-router";
import Flux from "~/assets/Flux.svg?react";
import Loading from "~/components/ui/Loading";
import { useAuth } from "~/hooks/useAuth";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { API_URL } from "~/lib/api";

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
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    navigate("/login", { replace: true });
  };

  return (
    <nav className="flex items-center  justify-between mb-8">
      <Link to="/ws" className="cursor-pointer">
        <Flux className="size-14" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="font-medium text-sm text-primary hover:underline cursor-pointer outline-none">
            {user?.email || user?.name}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut className="size-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
