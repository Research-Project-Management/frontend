import GeneralSettings from "~/components/workspace/projects/$projectId/settings/GeneralSettings";

export function meta() {
  return [{ title: "Project Settings · Flux" }];
}

export default function ProjectSettingsIndexRoute() {
  return <GeneralSettings />;
}
