import React from "react";
import { useParams } from "react-router";
import PagesManager from "~/components/workspace/projects/pages/PagesManager";

export function meta() {
  return [{ title: "Pages · Flux" }];
}

export default function ProjectPages() {
  const { projectId } = useParams();
  return <PagesManager projectId={projectId} />;
}
