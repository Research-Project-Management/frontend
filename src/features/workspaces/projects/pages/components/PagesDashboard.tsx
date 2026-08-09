'use client';

import { FileText } from 'lucide-react';

interface PagesDashboardProps {
  projectId?: string;
}

export default function PagesDashboard({ projectId }: PagesDashboardProps) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 text-center'>
      <div className='flex size-14 items-center justify-center rounded-xl bg-muted'>
        <FileText className='size-7 text-muted-foreground/60' />
      </div>
      <div className='space-y-1'>
        <p className='text-sm font-medium'>
          {projectId ? 'Project Pages' : 'Pages'}
        </p>
        <p className='text-xs text-muted-foreground'>
          {projectId
            ? 'Collaborative docs for this project'
            : 'All pages across your workspace'}
        </p>
      </div>
    </div>
  );
}
