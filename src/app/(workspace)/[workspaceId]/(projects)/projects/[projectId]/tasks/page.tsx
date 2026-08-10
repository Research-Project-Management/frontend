import type { Metadata } from 'next';
import { Task } from '@/features/workspaces/projects/project-id/tasks';

export const metadata: Metadata = { title: 'Tasks · Flux' };

export default function TaskPage() {
  return <Task />;
}
