'use client';

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { fetchProjectsByWorkspaceId, fetchWorkspaceById } from "@/features/workspaces/services/workspace.services";

export const useWorkspace = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['workspace', workspaceId],
        queryFn: ({ signal }) => fetchWorkspaceById(workspaceId!, signal),
        enabled: !!workspaceId,
    });

    return { workspace: data, isLoading, isError };
}

export const useProjects = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['projects', workspaceId],
        queryFn: ({ signal }) => fetchProjectsByWorkspaceId(workspaceId!, signal),
        enabled: !!workspaceId,
    });
    
    console.log("useProjects fetched data:", data);

    const pData = data as any;
    return { projects: pData?.projects ?? (Array.isArray(pData) ? pData : []), isLoading, isError };
}

