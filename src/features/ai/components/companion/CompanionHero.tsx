'use client';

import React from 'react';

export function CompanionHero() {
  return (
    <div className='flex flex-col items-center justify-center py-4 select-none pointer-events-none'>
      {/* Central Luminous 3D AI Orb */}
      <div className='relative flex items-center justify-center size-24 sm:size-26 pointer-events-none'>
        {/* Soft, vibrant colored bloom hugging the sphere (Tight optical caustics) */}
        <div
          className='absolute inset-1 rounded-full blur-xl opacity-40 dark:opacity-30 pointer-events-none'
          style={{
            background:
              'radial-gradient(circle at 45% 45%, rgba(51, 112, 255, 0.5) 0%, rgba(249, 120, 2, 0.35) 55%, transparent 75%)',
          }}
          aria-hidden='true'
        />

        {/* Main AI Orb Logo */}
        <img
          src='/Chat.svg'
          alt='Flux AI'
          className='relative size-full object-contain select-none rounded-full drop-shadow-[0_14px_32px_rgba(51,112,255,0.22)] dark:drop-shadow-[0_16px_36px_rgba(0,0,0,0.5)] z-10'
          draggable={false}
        />

        {/* 3D Glass Specular Highlight (Physical crystal sphere luster) */}
        <div
          className='absolute inset-0 rounded-full pointer-events-none z-20'
          style={{
            background:
              'radial-gradient(circle at 34% 24%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.2) 35%, transparent 62%)',
            mixBlendMode: 'overlay',
          }}
          aria-hidden='true'
        />

        {/* Natural Floor Contact Shadow */}
        <div
          className='absolute -bottom-2 w-16 h-2 rounded-[100%] bg-foreground/10 dark:bg-black/35 blur-xs pointer-events-none'
          aria-hidden='true'
        />
      </div>
    </div>
  );
}

export default CompanionHero;
