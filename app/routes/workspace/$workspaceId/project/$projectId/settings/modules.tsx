import ModulesSettings from "~/components/workspace/projects/$projectId/settings/ModulesSettings";

export function meta() {
  return [{ title: "Project Modules · Flux" }];
}

export default function ProjectModulesRoute() {
  return <ModulesSettings />;
}
