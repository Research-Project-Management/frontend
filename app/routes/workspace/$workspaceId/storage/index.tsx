import WorkspaceHomePage from "~/components/workspace/storage/pages/workspace/HomePage";

export function meta() {
  return [{ title: "Storage · Flux" }];
}

export default function index() {
  return <WorkspaceHomePage />;
}
