import ProjectOverview from "~/components/workspace/projects/$projectId/Overview";

export function meta() {
  return [{ title: "Overview · Flux" }];
}

export default function OverviewPage() {
  return <ProjectOverview />;
}
