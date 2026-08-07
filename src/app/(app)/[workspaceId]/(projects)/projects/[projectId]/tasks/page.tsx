import type { Metadata } from 'next';
import { Task } from '@/features/tasks';

export const metadata: Metadata = { title: 'Tasks · Flux' };

export default function TaskPage() {
  return <Task />;
}
