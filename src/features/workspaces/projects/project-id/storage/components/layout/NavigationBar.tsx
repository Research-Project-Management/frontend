'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '@/shared/lib/utils';

export default function NavigationBar() {
  const { workspaceId, projectId } = useParams();
  const pathname = usePathname();
  const id = useId();

  const basePath = `/${workspaceId}/projects/${projectId}/storage`;

  // Navigation matching sidebar
  const navItems = [
    { label: 'Home', to: basePath },
    { label: 'My Drive', to: `${basePath}/my-files` },
    { label: 'Shared', to: `${basePath}/shared` },
    { label: 'Starred', to: `${basePath}/starred` },
    { label: 'Trash', to: `${basePath}/trash` },
  ];

  return (
    <div className="w-full border-b border-border/50 px-4 sm:px-6">
      <LayoutGroup id={`project-top-nav-${id}`}>
        <nav
          aria-label='Project Navigation'
          className='flex items-center gap-8 overflow-x-auto no-scrollbar'
        >
          {navItems.map((item) => {
            const isActive = pathname === item.to || (item.to !== basePath && pathname.startsWith(item.to));
            return (
              <Link
                href={item.to}
                key={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 items-center justify-center text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId={`project-top-nav-active-${id}`}
                    className='absolute bottom-0 left-0 right-0 h-[2px] bg-primary'
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}
