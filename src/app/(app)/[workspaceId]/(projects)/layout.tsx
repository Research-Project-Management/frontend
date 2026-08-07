import ProjectsLayout from "@/features/projects/components/layout/ProjectsLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProjectsLayout>{children}</ProjectsLayout>;
}
