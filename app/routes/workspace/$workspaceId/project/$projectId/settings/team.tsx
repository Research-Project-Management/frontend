import TeamSettings from "~/components/workspace/projects/$projectId/settings/TeamSettings";

export function meta() {
  return [{ title: "Project Team · Flux" }];
}

export default function ProjectTeamRoute() {
  return <TeamSettings />;
}
