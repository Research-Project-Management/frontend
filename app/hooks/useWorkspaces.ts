import { useQuery } from "@tanstack/react-query";
import { fetchWorkspaces } from "~/query/workspaces";

export const useWorkspaces = () => {
    const {data, isLoading, isError} = useQuery({
        queryKey: ['workspaces'],
        queryFn: fetchWorkspaces,
    });

    return {workspaces: data, isLoading, isError};
}

