'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/components/ui';

export function TopbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get('q') || '';
  const [value, setValue] = useState(currentSearch);

  useEffect(() => {
    setValue(currentSearch);
  }, [currentSearch]);

  // Debounced URL sync
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === currentSearch) return;

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, currentSearch, pathname, router, searchParams]);

  return (
    <div className="relative w-52 sm:w-64">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm kiếm tài liệu..."
        className="h-8 pl-8 pr-7 text-xs bg-background shadow-2xs border-border/70"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
