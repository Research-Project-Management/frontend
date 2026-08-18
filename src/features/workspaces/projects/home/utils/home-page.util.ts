export type SectionId = "quicklinks" | "recent" | "stickies";

export interface SectionConfig {
  id: SectionId;
  visible: boolean;
}

export const STORAGE_KEY = "flux-dashboard-sections-v2";

export const DEFAULT_SECTION_IDS: SectionId[] = ["quicklinks", "recent", "stickies"];

export const defaultSectionConfig = (): SectionConfig[] =>
  DEFAULT_SECTION_IDS.map((id) => ({ id, visible: true }));

export function loadSectionConfig(): SectionConfig[] {
  if (typeof window === 'undefined') return defaultSectionConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSectionConfig();
    const parsed: SectionConfig[] = JSON.parse(raw);
    const ids = parsed.map((c) => c.id);
    const merged = [...parsed];
    for (const defId of DEFAULT_SECTION_IDS) {
      if (!ids.includes(defId)) merged.push({ id: defId, visible: true });
    }
    return merged.filter((c) => DEFAULT_SECTION_IDS.includes(c.id));
  } catch {
    return defaultSectionConfig();
  }
}

export function saveSectionConfig(config: SectionConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore localstorage write failure
  }
}

/**
 * Calculates greeting message and icon based on current hour.
 */
export function getGreeting(hour: number = new Date().getHours()): { text: string; icon: string } {
  if (hour >= 5 && hour < 11) return { text: "Good morning", icon: "☀️" };
  if (hour >= 11 && hour < 13) return { text: "Good noon", icon: "☀️" };
  if (hour >= 13 && hour < 18) return { text: "Good afternoon", icon: "☀️" };
  if (hour >= 18 && hour < 22) return { text: "Good evening", icon: "🌙" };
  return { text: "Good night", icon: "🌙" };
}
