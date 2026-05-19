import ProjectCollectionPage from "~/components/workspace/projects/$projectId/Collection/ProjectCollectionPage";

export function meta() {
  return [{ title: "Collection · Project · Flux" }];
}

export default function ProjectCollectionRoute() {
  return <ProjectCollectionPage />;
}
