import type { Metadata } from 'next';
import { CyclePage } from "@/features/workspaces/projects/project-id/cycles";

export const metadata: Metadata = { title: 'Research Cycles · Flux' };

export default function CyclesPage() {
  return <CyclePage />;
}
