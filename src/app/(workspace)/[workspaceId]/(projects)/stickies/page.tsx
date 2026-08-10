import type { Metadata } from 'next';
import { StickyPage } from "@/features/workspaces/projects";

export const metadata: Metadata = { title: 'Stickies · Flux' };

export default function StickiesPage() {
  return <StickyPage />;
}
