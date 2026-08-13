import type { Metadata } from 'next';
import StickyPage from "@/features/workspaces/projects/stickies/pages/StickyPage";

export const metadata: Metadata = { title: 'Stickies · Flux' };

export default function StickiesPage() {
  return <StickyPage />;
}
