import type { Metadata } from 'next';
import { StickyPage } from "@/features/workspaces/projects";

export const metadata: Metadata = { title: 'Notes - Flux' };

export default function ProjectStickiesPage() {
  return <StickyPage scope="project" />;
}
