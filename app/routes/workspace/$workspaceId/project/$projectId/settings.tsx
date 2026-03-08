import ProjectSettings from "~/components/workspace/projects/$projectId/Settings";

export function meta() {
  return [{ title: "Project Settings · Flux" }];
}

export default function ProjectSettingsPage() {
  return <ProjectSettings />;
}
