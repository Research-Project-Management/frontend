import dynamic from 'next/dynamic';

const WorkspaceTopbar = dynamic(
  () => import('@/features/workspaces/shell').then((mod) => mod.WorkspaceTopbar),
  { ssr: true, loading: () => null }
);

const WorkspaceSidebar = dynamic(
  () => import('@/features/workspaces/shell').then((mod) => mod.WorkspaceSidebar),
  { ssr: true, loading: () => null }
);

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='h-dvh flex flex-col overflow-hidden bg-[oklch(0.9543_0.001_230.67)] dark:bg-[oklch(0.1932_0.002_230.81)]'>
      <WorkspaceTopbar />
      <div className='flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row md:pl-0'>
        <WorkspaceSidebar />
        <div className='order-1 flex-1 min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background shadow-2xs md:order-2'>
          {children}
        </div>
      </div>
    </div>
  );
}
