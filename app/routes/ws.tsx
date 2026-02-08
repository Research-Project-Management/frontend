// redirect to workspaceId if logged in and has workspace

import { useEffect } from "react";
import { useNavigate } from "react-router";
import Loading from "~/components/ui/Loading";

import { useWorkspaces } from "~/query/workspace";

export default function Ws() {
  const navigate = useNavigate();

  const { workspaces, isLoading } = useWorkspaces();

  useEffect(() => {
    if (isLoading) return;

    if (workspaces && workspaces.length > 0) {
      navigate(`/${workspaces[0].url}`, { replace: true });
    } else {
      navigate(`/create`, { replace: true });
    }
  }, [workspaces, isLoading, navigate]);

  return <Loading />;
}
