import YourWorks from "~/components/workspace/projects/works/YourWorks";

export function meta() {
  return [{ title: "My Work · Flux" }];
}

export default function YourWorksRoute() {
  return <YourWorks />;
}
