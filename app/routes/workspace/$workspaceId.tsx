import React from "react";
import { useParams } from "react-router";
import HomeDashboard from "~/components/workspace/projects/Home/HomeDashboard";

export function meta() {
  return [{ title: "Home · Flux" }];
}

export default function $workspaceId() {
  return <HomeDashboard />;
}
