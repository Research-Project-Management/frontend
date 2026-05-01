import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import Wrapper from "./Wrapper";
import { useWorkspaces } from "~/query/workspace";
import { useWorkspace } from "~/hooks/useWorkspace";
import { Skeleton } from "~/components/ui/skeleton";
import { useUser } from "~/hooks/useUser";
import { useSocket } from "~/contexts/SocketProvider";
import { useQueryClient } from "@tanstack/react-query";

function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="w-60 border-r border-border p-4 space-y-4 shrink-0">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
        <div className="space-y-2 pt-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { user } = useUser();
  const { workspaces, isLoading } = useWorkspaces();
  const { workspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    if (!socket || !user?._id) return;
    const handleWorkspacesChanged = () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    };

    socket.emit("join:user", user._id);
    socket.on("user:workspaces-changed", handleWorkspacesChanged);
    return () => {
      socket.off("user:workspaces-changed", handleWorkspacesChanged);
      socket.emit("leave:user", user._id);
    };
  }, [queryClient, socket, user?._id]);

  useEffect(() => {
    if (workspaceLoading) return;

    if (workspaces && workspaces.length > 0 && !workspace) {
      navigate(`/${(workspaces[0] as any).url}`, { replace: true });
    }
  }, [workspaces, workspace, isLoading, workspaceLoading, navigate]);

  if (workspaceLoading) {
    return <WorkspaceSkeleton />;
  }

  return (
    <Wrapper>
      <Outlet />
    </Wrapper>
  );
}
