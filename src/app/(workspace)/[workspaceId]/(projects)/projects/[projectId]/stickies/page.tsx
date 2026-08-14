import type { Metadata } from 'next';
import StickyPage from "@/features/workspaces/projects/project-id/stickies/pages/StickyPage";

export const metadata: Metadata = { title: 'Stickies - Flux' };

export default function ProjectStickiesPageRoute() {
  return <StickyPage />;
}
