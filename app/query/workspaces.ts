import { apiGet } from "~/lib/api";

export const fetchWorkspaces = async (signal?: AbortSignal) => {
  const data = await apiGet<{ workspaces: any[] }>("/api/workspace", {
    signal,
  });
  return data;
};
