import { API_URL } from "~/lib/api";

export const fetchWorkspaces = async () => {
  const response = await fetch(API_URL+"/api/workspace", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const data = await response.json();
  return data.workspaces;
}