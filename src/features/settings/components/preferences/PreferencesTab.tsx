'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  BRAND_COLOR_PRESETS,
  type BrandPresetKey,
  type Theme,
  type UiScale,
  UI_SCALE_PRESETS,
  useTheme,
} from '@/shared/providers/theme-provider';
import { cn } from '@/shared/lib/utils';

export function PreferencesTab() {
  const { theme, setTheme, brandPreset, setBrandPreset, uiScale, setUiScale } = useTheme();

  return (
    <div className="w-full max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      <div className="space-y-1">
        <div className="pb-3 border-b border-border">
          <h3 className="text-14 font-semibold text-foreground tracking-tight">
            Interface & Appearance
          </h3>
          <p className="text-12 text-muted-foreground mt-1">
            Customize your interface theme, display density scale, and primary accent color.
          </p>
        </div>

        <div className="divide-y divide-border">
          {/* Theme */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">
                Interface Theme
              </span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Select light, dark, or sync with your system preference.
              </span>
            </div>
            <Select
              value={theme}
              onValueChange={(val) => setTheme(val as Theme)}
            >
              <SelectTrigger
                aria-label="Select Theme"
                className="w-[160px] h-8 text-12 bg-background border border-border rounded-md shrink-0 cursor-pointer"
              >
                <SelectValue placeholder="Select Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-primary shrink-0" />
                    <span>System</span>
                  </div>
                </SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Interface Scale */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">
                Interface Scale
              </span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Adjust root UI density across typography, spacing, and panels.
              </span>
            </div>
            <Select
              value={uiScale}
              onValueChange={(val) => setUiScale(val as UiScale)}
            >
              <SelectTrigger
                aria-label="Select Interface Scale"
                className="w-[160px] h-8 text-12 bg-background border border-border rounded-md shrink-0 cursor-pointer"
              >
                <SelectValue placeholder="Select Scale" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(UI_SCALE_PRESETS) as [UiScale, (typeof UI_SCALE_PRESETS)[UiScale]][]).map(
                  ([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      {preset.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Brand Accent Color */}
          <div className="flex items-center justify-between py-3.5 gap-4">
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-13 font-medium text-foreground">
                Brand Accent Color
              </span>
              <span className="text-12 text-muted-foreground mt-0.5">
                Choose your primary accent hue. Synchronizes actions, focus rings, and selection across the platform.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(
                Object.entries(BRAND_COLOR_PRESETS) as [
                  BrandPresetKey,
                  (typeof BRAND_COLOR_PRESETS)[BrandPresetKey],
                ][]
              ).map(([key, preset]) => {
                const isSelected = brandPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBrandPreset(key)}
                    title={`${preset.label} (${preset.hue}°)`}
                    aria-label={`${preset.label} theme accent color`}
                    aria-pressed={isSelected}
                    className={cn(
                      'size-6 rounded-full flex items-center justify-center transition-all motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 relative before:absolute before:-inset-2 md:before:hidden',
                      isSelected
                        ? 'ring-2 ring-foreground/60 ring-offset-2 scale-110 motion-reduce:scale-100'
                        : 'hover:scale-105 motion-reduce:hover:scale-100 opacity-80 hover:opacity-100',
                    )}
                    style={{ backgroundColor: preset.colorHex }}
                  >
                    {isSelected && (
                      <div className="size-1.5 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreferencesTab;
