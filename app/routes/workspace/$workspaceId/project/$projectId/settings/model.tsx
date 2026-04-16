import ModelSettings from "~/components/workspace/projects/$projectId/settings/ModelSettings";

export function meta() {
  return [{ title: "Model Settings · Flux" }];
}

export default function ProjectModelSettingsRoute() {
  return <ModelSettings />;
}
