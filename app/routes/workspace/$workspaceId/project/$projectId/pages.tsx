import { useParams } from "react-router";
import PagesManager from "~/components/workspace/projects/pages/PagesManager";

export function meta() {
  return [{ title: "Pages · Project · Flux" }];
}

export default function ProjectPagesPage() {
  const { projectId } = useParams();
  return <PagesManager projectId={projectId} />;
}
