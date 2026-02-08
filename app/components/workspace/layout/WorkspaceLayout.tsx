import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import Wrapper from "./Wrapper";
import { useWorkspaces } from "~/query/workspace";
import Loading from "~/components/ui/Loading";
import { useWorkspace } from "~/hooks/useWorkspace";

export default function WorkspaceLayout() {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { workspace, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading || workspaceLoading) return;

    if (workspaces && workspaces.length > 0 && !workspace) {
      navigate(`/${workspaces[0].url}`, { replace: true });
    }
  }, [workspaces, workspace, isLoading, workspaceLoading, navigate]);

  if (isLoading || workspaceLoading) {
    return <Loading />;
  }

  return (
    <Wrapper>
      <Outlet />
    </Wrapper>
  );
}
