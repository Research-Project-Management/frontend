import React from "react";
import Page from "~/components/workspace/$pageId/Page";

export function meta() {
  return [{ title: "Page · Flux" }];
}

export default function $pageId() {
  return <Page />;
}
