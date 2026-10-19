import { redirect } from 'next/navigation';

export default function StorageSharedPage() {
  redirect('/storage?view=shared');
}
