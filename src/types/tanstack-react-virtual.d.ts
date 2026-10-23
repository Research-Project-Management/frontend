declare module '@tanstack/react-virtual' {
  export interface VirtualItem {
    key: string | number;
    index: number;
    start: number;
    end: number;
    size: number;
    lane: number;
  }

  export interface Virtualizer<TScrollElement, TItemElement> {
    getVirtualItems(): VirtualItem[];
    getTotalSize(): number;
    scrollToIndex(
      index: number,
      options?: {
        align?: 'start' | 'center' | 'end' | 'auto';
        behavior?: 'auto' | 'smooth';
      },
    ): void;
    scrollToOffset(
      offset: number,
      options?: {
        align?: 'start' | 'center' | 'end' | 'auto';
        behavior?: 'auto' | 'smooth';
      },
    ): void;
    measureElement(element: TItemElement | null): void;
  }

  export function useVirtualizer<
    TScrollElement extends Element = Element,
    TItemElement extends Element = Element,
  >(options: {
    count: number;
    getScrollElement: () => TScrollElement | null;
    estimateSize: (index: number) => number;
    overscan?: number;
    horizontal?: boolean;
    enabled?: boolean;
    paddingStart?: number;
    paddingEnd?: number;
    getItemKey?: (index: number) => string | number;
  }): Virtualizer<TScrollElement, TItemElement>;
}
