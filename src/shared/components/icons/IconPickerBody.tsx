'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Check,
  X,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { EMOJI_CATEGORIES, SKIN_TONES, type EmojiItem } from './emoji-data';
import { ICONS, ICON_PALETTE, ICON_MAP, type IconItem } from './icon-data';

export interface IconPickerBodyProps {
  currentValue?: string | null;
  onSelect: (value: string) => void;
  open: boolean;
}

export default function IconPickerBody({
  currentValue,
  onSelect,
  open,
}: IconPickerBodyProps) {
  const [tab, setTab] = useState<'emoji' | 'icon'>(() =>
    currentValue?.startsWith('icon:') ? 'icon' : 'emoji'
  );
  const [search, setSearch] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<string>(() => {
    if (currentValue?.startsWith('icon:')) {
      const parts = currentValue.split(':');
      if (parts[1]) return parts[1];
    }
    return ICONS[0].id;
  });
  const [selectedColor, setSelectedColor] = useState<string>(() => {
    if (currentValue?.startsWith('icon:')) {
      const parts = currentValue.split(':');
      if (parts[2]) return parts[2];
    }
    return ICON_PALETTE[0].hex;
  });
  const [currentSkinToneIndex, setCurrentSkinToneIndex] = useState(0);
  const [showSkinToneMenu, setShowSkinToneMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeSkinTone = SKIN_TONES[currentSkinToneIndex];

  useEffect(() => {
    if (currentValue?.startsWith('icon:')) {
      const parts = currentValue.split(':');
      if (parts[1]) setSelectedIconId(parts[1]);
      if (parts[2]) setSelectedColor(parts[2]);
    }
  }, [currentValue]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
      setShowSkinToneMenu(false);
    }
  }, [open]);

  const applySkinTone = (emojiItem: EmojiItem): string => {
    if (!emojiItem.supportsSkinTone || !activeSkinTone.modifier) {
      return emojiItem.emoji;
    }
    return `${emojiItem.emoji}${activeSkinTone.modifier}`;
  };

  const searchLower = search.trim().toLowerCase();
  const isSearching = Boolean(searchLower);

  const searchFilteredEmojis = useMemo(() => {
    if (!isSearching) return [];
    const results: { emojiItem: EmojiItem; categoryName: string }[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        const matchesName = item.name.toLowerCase().includes(searchLower);
        const matchesKeyword = item.keywords.some((kw) => kw.includes(searchLower));
        if (matchesName || matchesKeyword) {
          results.push({ emojiItem: item, categoryName: cat.name });
        }
      }
    }
    return results;
  }, [isSearching, searchLower]);

  const filteredIcons = useMemo(() => {
    if (!isSearching) return ICONS;
    return ICONS.filter(
      (icon) =>
        icon.name.toLowerCase().includes(searchLower) ||
        icon.id.includes(searchLower) ||
        icon.keywords.some((kw) => kw.includes(searchLower))
    );
  }, [isSearching, searchLower]);

  const handleEmojiClick = (emojiItem: EmojiItem) => {
    const finalEmoji = applySkinTone(emojiItem);
    onSelect(finalEmoji);
  };

  const handleIconClick = (icon: IconItem) => {
    setSelectedIconId(icon.id);
    onSelect(`icon:${icon.id}:${selectedColor}`);
  };

  const handleColorSelect = (colorHex: string) => {
    setSelectedColor(colorHex);
    onSelect(`icon:${selectedIconId}:${colorHex}`);
  };

  return (
    <>
      {/* ── Top Tabs Segmented Control ───────────────────────── */}
      <div className="grid grid-cols-2 p-0.5 rounded-md bg-muted border border-border/50 gap-0.5">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={cn(
            'h-7 text-xs rounded-md transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5',
            tab === 'emoji'
              ? 'bg-background text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          Emoji
        </button>
        <button
          type="button"
          onClick={() => setTab('icon')}
          className={cn(
            'h-7 text-xs rounded-md transition-colors duration-150 cursor-pointer flex items-center justify-center gap-1.5',
            tab === 'icon'
              ? 'bg-background text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground font-medium'
          )}
        >
          Icon
        </button>
      </div>

      {/* ── Search Input Row ─────────────────────────────────── */}
      <div className="relative mt-2 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Input
            ref={searchInputRef}
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8.5 text-xs rounded-md border-border pl-2.5 pr-7 bg-background text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
              title="Clear search"
            >
              <X className="size-3 shrink-0" />
            </button>
          )}
        </div>

        {/* Right Action: Skin tone selector (Emoji tab) OR Selected Icon Preview (Icon tab) */}
        {tab === 'emoji' ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowSkinToneMenu(!showSkinToneMenu)}
              className="size-8 rounded-md hover:bg-muted flex items-center justify-center text-lg border border-border/60 transition-transform active:scale-95 cursor-pointer"
              title={`Skin tone: ${activeSkinTone.label}`}
              aria-label="Select skin tone"
            >
              {activeSkinTone.symbol}
            </button>

            {showSkinToneMenu && (
              <div className="absolute right-0 top-9.5 z-50 p-1 bg-popover border border-border rounded-md flex items-center gap-1 animate-in fade-in zoom-in-95">
                {SKIN_TONES.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setCurrentSkinToneIndex(idx);
                      setShowSkinToneMenu(false);
                    }}
                    className={cn(
                      'size-7 rounded-md text-base flex items-center justify-center hover:bg-muted transition-transform cursor-pointer',
                      currentSkinToneIndex === idx && 'bg-muted ring-1 ring-primary'
                    )}
                    title={st.label}
                  >
                    {st.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative shrink-0">
            <div
              className="size-8 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center transition-colors"
              title="Selected icon preview"
            >
              {(() => {
                const CurrentIconComp = ICON_MAP[selectedIconId] || ICONS[0].icon;
                return (
                  <CurrentIconComp
                    className="size-4.5 transition-colors"
                    style={{ color: selectedColor }}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── TAB 1: EMOJI CONTENT ─────────────────────────────── */}
      {tab === 'emoji' && (
        <div className="mt-1.5">
          {isSearching ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground pt-1 pb-1 px-0.5">
                Search results ({searchFilteredEmojis.length})
              </div>
              {searchFilteredEmojis.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No emojis found for &quot;{search}&quot;
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto custom-scrollbar grid grid-cols-9 gap-1 place-items-center">
                  {searchFilteredEmojis.map(({ emojiItem }, idx) => {
                    const renderedEmoji = applySkinTone(emojiItem);
                    return (
                      <button
                        key={`${emojiItem.name}-${idx}`}
                        type="button"
                        onClick={() => handleEmojiClick(emojiItem)}
                        className="w-full h-8 flex items-center justify-center rounded-md text-lg hover:bg-muted active:scale-95 transition-transform cursor-pointer select-none"
                        title={emojiItem.name}
                      >
                        {renderedEmoji}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2.5 pr-0.5">
              {EMOJI_CATEGORIES.map((category) => (
                <div key={category.id}>
                  <div className="text-xs font-medium text-muted-foreground pb-0.5 px-0.5 sticky top-0 bg-popover/95 backdrop-blur-xs z-10">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-9 gap-1 place-items-center">
                    {category.emojis.map((emojiItem, idx) => {
                      const renderedEmoji = applySkinTone(emojiItem);
                      return (
                        <button
                          key={`${emojiItem.name}-${idx}`}
                          type="button"
                          onClick={() => handleEmojiClick(emojiItem)}
                          className="w-full h-8 flex items-center justify-center rounded-md text-lg hover:bg-muted active:scale-95 transition-transform cursor-pointer select-none"
                          title={emojiItem.name}
                        >
                          {renderedEmoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ICON CONTENT ──────────────────────────────── */}
      {tab === 'icon' && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            {ICON_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleColorSelect(c.hex)}
                className={cn(
                  'size-5.5 rounded-full transition-transform cursor-pointer relative flex items-center justify-center',
                  selectedColor === c.hex && 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background'
                )}
                style={{ backgroundColor: c.hex }}
                aria-label={c.label}
                title={c.label}
              >
                {selectedColor === c.hex && (
                  <Check className="size-3 text-white shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="pt-1.5 border-t border-border">
            {filteredIcons.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No icons found for &quot;{search}&quot;
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto custom-scrollbar grid grid-cols-8 gap-1 place-items-center">
                {filteredIcons.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleIconClick(item)}
                      className="w-full h-8 flex items-center justify-center rounded-md hover:bg-muted active:scale-95 transition-transform cursor-pointer"
                      title={item.name}
                    >
                      <IconComp
                        className="size-4.5 transition-colors"
                        style={{ color: selectedColor }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
