import { redirect } from 'next/navigation';

export default function StorageMyFilesPage() {
  redirect('/storage?view=my-files');
}
