import type { Metadata } from 'next';
import { TaskPage } from '@/features/workspaces/projects/project-id/tasks';

export const metadata: Metadata = { title: 'Tasks · Flux' };

export default function TasksRoute() {
  return <TaskPage />;
}
