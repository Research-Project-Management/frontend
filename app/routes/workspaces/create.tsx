import React from "react";
import Create from "~/components/workspaces/Create";

export function meta() {
  return [{ title: "Create Workspace · Flux" }];
}

export default function create() {
  return <Create />;
}
