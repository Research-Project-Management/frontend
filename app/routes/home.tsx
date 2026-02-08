import LandingPage from "~/components/landing-page/LandingPage";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Flux - Keep Research Moving Forward" },
    {
      name: "description",
      content:
        "The all-in-one workspace for research teams. Collaborate seamlessly, manage projects efficiently, and accelerate your research workflow with AI-powered tools.",
    },
    {
      name: "keywords",
      content:
        "research management, project management, team collaboration, AI assistant, documentation, task tracking, file storage",
    },
    { property: "og:title", content: "Flux - Keep Research Moving Forward" },
    {
      property: "og:description",
      content:
        "The all-in-one workspace for research teams to collaborate and deliver results faster.",
    },
    { property: "og:type", content: "website" },
  ];
}

export default function Home() {
  return <LandingPage />;
}
