import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { fetchProjectsByWorkspaceId, fetchWorkspaceById } from "~/query/workspace";

export const useWorkspace = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: [workspaceId, workspaceId],
        queryFn: () => fetchWorkspaceById(workspaceId!),
        enabled: !!workspaceId,
    });

    return { workspace: data, isLoading, isError };
}

export const useProjects = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['projects', workspaceId],
        queryFn: () => fetchProjectsByWorkspaceId(workspaceId!),
        enabled: !!workspaceId,
    });

    return { projects: data?.projects, isLoading, isError };
}
