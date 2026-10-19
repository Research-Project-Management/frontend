import { redirect } from 'next/navigation';

export default function StorageStarredPage() {
  redirect('/storage?view=starred');
}
