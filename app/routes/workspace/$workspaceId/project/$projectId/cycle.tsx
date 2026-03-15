import CyclePage from "~/components/workspace/projects/$projectId/Cycle/CyclePage";

export function meta() {
  return [{ title: "Research Cycles · Flux" }];
}

export default function CycleRoute() {
  return <CyclePage />;
}
