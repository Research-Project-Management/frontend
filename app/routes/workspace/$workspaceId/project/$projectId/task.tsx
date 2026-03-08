import React from "react";
import Task from "~/components/workspace/projects/$projectId/Task/Task";

export function meta() {
  return [{ title: "Tasks · Flux" }];
}

export default function TaskPage() {
  return <Task />;
}
