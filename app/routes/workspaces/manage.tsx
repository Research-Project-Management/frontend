import ManageWorkspaces from "~/components/workspaces/Manage";

export function meta() {
  return [{ title: "Manage Workspaces · Flux" }];
}

export default function ManageWorkspacesRoute() {
  return <ManageWorkspaces />;
}
