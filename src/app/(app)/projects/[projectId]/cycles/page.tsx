import type { Metadata } from 'next';
import { CyclePage } from "@/features/projects/project-id/cycles/pages/CyclePage";

export const metadata: Metadata = { title: 'Research Cycles · Flux' };

export default function CyclesPage() {
  return <CyclePage />;
}
