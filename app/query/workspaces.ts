import { apiGet } from "~/lib/api";

export const fetchWorkspaces = async () => {
  const data = await apiGet<{ workspaces: any[] }>("/api/workspace");
  return data.workspaces;
};