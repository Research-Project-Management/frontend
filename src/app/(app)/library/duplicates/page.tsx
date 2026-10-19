import { redirect } from 'next/navigation';

export default function LibraryDuplicatesPage() {
  redirect('/library?filter=duplicates');
}

