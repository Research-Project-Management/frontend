'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

export function TableHorizontalScrollbar({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    canScroll: false,
  });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const can = el.scrollWidth > el.clientWidth + 2;
    setScrollState({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      canScroll: can,
    });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();

    const handleScroll = () => {
      updateScrollState();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollState);
      ro.disconnect();
    };
  }, [scrollRef, updateScrollState]);

  if (!scrollState.canScroll) return null;

  const maxScroll = Math.max(1, scrollState.scrollWidth - scrollState.clientWidth);
  const scrollRatio = Math.min(1, Math.max(0, scrollState.scrollLeft / maxScroll));
  const thumbWidthPercent = Math.max(
    15,
    Math.min(35, (scrollState.clientWidth / scrollState.scrollWidth) * 100)
  );
  const maxThumbLeft = 100 - thumbWidthPercent;
  const thumbLeftPercent = scrollRatio * maxThumbLeft;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    el.scrollTo({
      left: ratio * maxScroll,
      behavior: 'smooth',
    });
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    const trackRect = track.getBoundingClientRect();
    const thumbWidthPx = (thumbWidthPercent / 100) * trackRect.width;
    const availableTravel = Math.max(1, trackRect.width - thumbWidthPx);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const scrollDelta = (deltaX / availableTravel) * maxScroll;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + scrollDelta));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="h-3.5 w-full border-t border-border bg-background flex items-center justify-center shrink-0 select-none py-1">
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative w-64 sm:w-80 h-1.5 rounded-full bg-muted/60 hover:bg-muted/80 cursor-pointer transition-colors"
      >
        <div
          onMouseDown={handleThumbMouseDown}
          className="absolute top-0 bottom-0 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 active:bg-muted-foreground/80 transition-colors cursor-grab active:cursor-grabbing"
          style={{
            width: `${thumbWidthPercent}%`,
            left: `${thumbLeftPercent}%`,
          }}
        />
      </div>
    </div>
  );
}
