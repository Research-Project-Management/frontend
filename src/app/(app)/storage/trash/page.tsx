import { redirect } from 'next/navigation';

export default function StorageTrashPage() {
  redirect('/storage?view=trash');
}
