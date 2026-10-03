'use client';

import React from 'react';

export function CompanionHero() {
  return (
    <div className='flex-1 flex flex-col items-center justify-center text-center px-4 py-8 select-none relative overflow-hidden pointer-events-none'>
      {/* 3D Orbital Stage around stationary central logo (View only, no interaction) */}
      <div
        style={{
          perspective: 800,
          transformStyle: 'preserve-3d',
        }}
        className='relative flex items-center justify-center size-44 mb-4 pointer-events-none'
      >
        {/* Ambient Radial Aura Glow (Multi-color background glow matching Chat.svg palette) */}
        <div
          className='absolute -inset-6 rounded-full blur-2xl dark:blur-3xl animate-orb-aura'
          style={{
            background:
              'radial-gradient(circle, rgba(51, 112, 255, 0.32) 0%, rgba(249, 120, 2, 0.22) 42%, rgba(255, 203, 44, 0.14) 68%, transparent 80%)',
          }}
          aria-hidden='true'
        />

        {/* 3D Orbit 1: Clockwise tilted gyroscopic ring with glowing blue satellite node */}
        <div
          style={{ transformStyle: 'preserve-3d' }}
          className='absolute size-38 rounded-full border border-border/80 dark:border-border/60 animate-orbit-1 pointer-events-none'
          aria-hidden='true'
        >
          <div className='absolute -top-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-[#3370FF] shadow-[0_0_8px_rgba(51,112,255,0.9)]' />
        </div>

        {/* 3D Orbit 2: Counter-clockwise tilted gyroscopic ring with glowing amber satellite node */}
        <div
          style={{ transformStyle: 'preserve-3d' }}
          className='absolute size-32 rounded-full border border-border/70 dark:border-border/50 animate-orbit-2 pointer-events-none'
          aria-hidden='true'
        >
          <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-[#F97802] shadow-[0_0_8px_rgba(249,120,2,0.9)]' />
        </div>

        {/* 3D Orbit 3: Outer equatorial hairline ring */}
        <div
          style={{ transformStyle: 'preserve-3d' }}
          className='absolute size-42 rounded-full border border-primary/15 dark:border-primary/20 border-dashed animate-orbit-3 pointer-events-none'
          aria-hidden='true'
        />

        {/* Central Logo (Stationary anchor - NOT moving up and down) */}
        <div className='relative size-22 sm:size-24 rounded-full z-20 pointer-events-none'>
          {/* Main AI Orb Logo */}
          <img
            src='/Chat.svg'
            alt='Flux AI'
            className='size-full object-contain select-none rounded-full drop-shadow-[0_8px_20px_rgba(51,112,255,0.25)]'
            draggable={false}
          />

          {/* 3D Glass Specular Highlight Overlay */}
          <div
            className='absolute inset-0 rounded-full pointer-events-none'
            style={{
              background:
                'radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.15) 36%, transparent 65%)',
              mixBlendMode: 'overlay',
            }}
            aria-hidden='true'
          />

          {/* Subtle Outer Edge Glow Ring */}
          <div
            className='absolute inset-0 rounded-full border border-white/25 dark:border-white/15 pointer-events-none'
            aria-hidden='true'
          />
        </div>

        {/* Stable Floor Shadow */}
        <div
          className='absolute -bottom-1 w-18 h-2.5 rounded-[100%] bg-foreground/10 dark:bg-black/40 blur-xs pointer-events-none'
          aria-hidden='true'
        />
      </div>

      {/* Hero Typography (Strictly adhering to DESIGN.md tokens: Inter, 16px/12px, weight <= 600) */}
      <div className='relative z-20 flex flex-col items-center pointer-events-auto'>
        <h2 className='text-16 font-semibold text-foreground tracking-tight'>
          Flux AI
        </h2>
        <p className='text-12 font-normal text-muted-foreground mt-1 max-w-[260px] leading-relaxed'>
          Ready to assist with your research, literature synthesis, and analysis
        </p>
      </div>
    </div>
  );
}

export default CompanionHero;
