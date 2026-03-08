import React from "react";
import PagesManager from "~/components/workspace/projects/pages/PagesManager";

export function meta() {
  return [{ title: "Pages · Flux" }];
}

export default function Pages() {
  return <PagesManager />;
}
