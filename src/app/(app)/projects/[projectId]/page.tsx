import { redirect } from 'next/navigation';

interface ProjectRootPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectRootPage({ params }: ProjectRootPageProps) {
  const { projectId } = await params;
  redirect(`/projects/${encodeURIComponent(projectId)}/work-items`);
}

