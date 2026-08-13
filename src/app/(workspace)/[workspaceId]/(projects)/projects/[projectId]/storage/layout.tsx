'use client';

import React from 'react';
import NavigationBar from '@/features/workspaces/projects/project-id/storage/components/layout/NavigationBar';
import Topbar from '@/features/workspaces/projects/project-id/storage/components/layout/Topbar';
import { Cloud } from 'lucide-react';
import Preview from '@/features/workspaces/projects/project-id/storage/components/preview/Preview';


import { useParams } from 'next/navigation';

export default function ProjectStorageLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = params?.projectId as string;
  
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Topbar title="Storage" icon={Cloud} projectId={projectId} />
      <NavigationBar />
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
        <Preview />
      </div>
    </div>
  );
}
