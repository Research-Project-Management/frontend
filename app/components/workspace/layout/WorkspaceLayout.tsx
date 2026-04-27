import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import Wrapper from "./Wrapper";
import { useWorkspaces } from "~/query/workspace";
import { useWorkspace } from "~/hooks/useWorkspace";
import { Skeleton } from "~/components/ui/skeleton";
import { useUser } from "~/hooks/useUser";
import { useSocket } from "~/contexts/SocketProvider";

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
  const socket = useSocket();
  const { user } = useUser();
  const { workspaces, isLoading } = useWorkspaces();
  const { workspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("join:user", user._id);
    return () => {
      socket.emit("leave:user", user._id);
    };
  }, [socket, user?._id]);

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
