
export const fetchWorkspaces = async () => {
  const response = await fetch(import.meta.env.VITE_API_URL+"/api/workspace", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const data = await response.json();
  return data.workspaces;
}