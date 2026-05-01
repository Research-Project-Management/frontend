import StickyLayout from "~/components/workspace/projects/stickies/layout/StickyLayout";

export function meta() {
  return [{ title: "Notes - Flux" }];
}

export default function ProjectStickiesPage() {
  return <StickyLayout scope="project" />;
}
