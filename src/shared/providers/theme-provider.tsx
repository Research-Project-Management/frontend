'use client';

import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const BRAND_COLOR_PRESETS = {
  blue: { label: 'Precision Blue', hue: 265, colorHex: '#2563eb' },
  emerald: { label: 'Emerald Green', hue: 145, colorHex: '#059669' },
  violet: { label: 'Electric Violet', hue: 300, colorHex: '#7c3aed' },
  orange: { label: 'Tangerine Orange', hue: 45, colorHex: '#ea580c' },
  rose: { label: 'Coral Rose', hue: 15, colorHex: '#e11d48' },
  amber: { label: 'Warm Amber', hue: 75, colorHex: '#d97706' },
} as const;

export type BrandPresetKey = keyof typeof BRAND_COLOR_PRESETS;

export const DEFAULT_BRAND_HUE = 265;

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  brandHue: number;
  setBrandHue: (hue: number) => void;
  brandPreset: BrandPresetKey | 'custom';
  setBrandPreset: (preset: BrandPresetKey) => void;
}

const STORAGE_KEY = 'flux-theme';
const BRAND_HUE_KEY = 'flux-brand-hue';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolvePresetFromHue(hue: number): BrandPresetKey | 'custom' {
  for (const [key, preset] of Object.entries(BRAND_COLOR_PRESETS)) {
    if (preset.hue === hue) {
      return key as BrandPresetKey;
    }
  }
  return 'custom';
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultBrandHue = DEFAULT_BRAND_HUE,
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultBrandHue?: number;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ['system', 'light', 'dark'].includes(stored)) {
        return stored;
      }
    } catch {
      // localStorage may be unavailable
    }
    return defaultTheme;
  });

  const [brandHue, setBrandHueState] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultBrandHue;
    try {
      const stored = localStorage.getItem(BRAND_HUE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 360) {
          return parsed;
        }
      }
    } catch {
      // localStorage may be unavailable
    }
    return defaultBrandHue;
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [, startTransition] = useTransition();

  // Apply light / dark theme class
  useEffect(() => {
    const applyTheme = () => {
      const activeResolved: ResolvedTheme =
        theme === 'system' ? getSystemTheme() : theme;

      setResolvedTheme(activeResolved);

      const root = document.documentElement;
      if (activeResolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme();
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply --brand-hue dynamically to root document element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--brand-hue', `${brandHue}`);
  }, [brandHue]);

  const setTheme = (newTheme: Theme) => {
    startTransition(() => {
      setThemeState(newTheme);
    });
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage access error handling
    }
  };

  const setBrandHue = (hue: number) => {
    const validHue = Math.min(360, Math.max(0, Math.round(hue)));
    startTransition(() => {
      setBrandHueState(validHue);
    });
    try {
      localStorage.setItem(BRAND_HUE_KEY, `${validHue}`);
      if (typeof window !== 'undefined') {
        document.documentElement.style.setProperty('--brand-hue', `${validHue}`);
      }
    } catch {
      // Storage access error handling
    }
  };

  const setBrandPreset = (preset: BrandPresetKey) => {
    const targetPreset = BRAND_COLOR_PRESETS[preset];
    if (targetPreset) {
      setBrandHue(targetPreset.hue);
    }
  };

  const brandPreset = resolvePresetFromHue(brandHue);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        brandHue,
        setBrandHue,
        brandPreset,
        setBrandPreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
