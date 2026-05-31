import type { Paper } from "~/types/library";

/**
 * Utility functions for generating and exporting BibTeX citations
 */

/**
 * Generates a clean, valid BibTeX citation key if not already defined in paper metadata.
 * Format: [FirstAuthorLastName][Year][FirstTitleWord] (e.g., smith2026deep)
 */
export function generateCitationKey(paper: Paper): string {
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, "");
  }

  // 1. Get first author last name
  let authorPart = "unknown";
  if (paper.authors && paper.authors.length > 0) {
    const firstAuthor = paper.authors[0].trim();
    // Split by spaces and take the last word as last name
    const parts = firstAuthor.split(/\s+/);
    if (parts.length > 0) {
      authorPart = parts[parts.length - 1].toLowerCase();
    }
  }
  // Sanitize last name (keep only alphanumeric)
  authorPart = authorPart.replace(/[^a-z0-9]/gi, "");

  // 2. Get year
  const yearPart = paper.year ? String(paper.year) : "";

  // 3. Get first alphanumeric word of the title
  let titlePart = "";
  if (paper.title) {
    const titleWords = paper.title.trim().split(/\s+/);
    for (const word of titleWords) {
      const cleanWord = word.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (cleanWord) {
        titlePart = cleanWord;
        break;
      }
    }
  }
  if (!titlePart) titlePart = "paper";

  return `${authorPart}${yearPart}${titlePart}`;
}

/**
 * Maps paper item type to a standard BibTeX entry type
 */
export function getBibTeXEntryType(paper: Paper): string {
  const itemType = (paper.itemType || paper.type || "").toLowerCase();

  if (itemType.includes("booksection") || itemType.includes("chapter")) {
    return "inbook";
  }
  if (itemType.includes("book")) {
    return "book";
  }
  if (itemType.includes("proceeding") || itemType.includes("conference") || itemType.includes("inproceedings")) {
    return "inproceedings";
  }
  if (itemType.includes("thesis") || itemType.includes("dissertation")) {
    return "phdthesis";
  }
  if (itemType.includes("report") || itemType.includes("techreport")) {
    return "techreport";
  }
  if (itemType.includes("webpage") || itemType.includes("web")) {
    return "misc";
  }

  // Default to article if journal is present, otherwise fallback to misc
  if (paper.journal || paper.publicationTitle) {
    return "article";
  }
  return "misc";
}

/**
 * Converts a Paper object to a standard BibTeX string
 */
export function convertToBibTeX(paper: Paper): string {
  const entryType = getBibTeXEntryType(paper);
  const citationKey = generateCitationKey(paper);

  const fields: Record<string, string | number | undefined> = {
    title: paper.title?.trim(),
    author: paper.authors && paper.authors.length > 0 
      ? paper.authors.map(a => a.trim()).join(" and ") 
      : undefined,
    journal: paper.journal?.trim() || paper.publicationTitle?.trim() || undefined,
    year: paper.year || undefined,
    volume: paper.volume?.trim() || undefined,
    number: paper.issue?.trim() || undefined,
    pages: paper.pages?.trim() || undefined,
    publisher: paper.publisher?.trim() || undefined,
    doi: paper.doi?.trim() || undefined,
    url: paper.url?.trim() || undefined,
    isbn: paper.isbn?.trim() || undefined,
    issn: paper.issn?.trim() || undefined,
    abstract: paper.abstract?.trim() || undefined,
    keywords: paper.keywords && paper.keywords.length > 0 
      ? paper.keywords.map(k => k.trim()).join(", ") 
      : undefined,
    note: paper.extra?.trim() || undefined,
  };

  let bib = `@${entryType}{${citationKey},\n`;
  const bibFields = Object.entries(fields)
    .filter(([_, val]) => val !== undefined && val !== "")
    .map(([key, val]) => `  ${key} = {${val}}`)
    .join(",\n");
  
  bib += bibFields;
  bib += "\n}";
  return bib;
}

/**
 * Copies the paper's BibTeX citation to the system clipboard
 */
export async function copyBibTeXToClipboard(paper: Paper): Promise<void> {
  const bibString = convertToBibTeX(paper);
  await navigator.clipboard.writeText(bibString);
}

/**
 * Triggers a client-side download of a .bib file containing the paper's BibTeX entry
 */
export function downloadBibTeXFile(paper: Paper): void {
  const bibString = convertToBibTeX(paper);
  const citationKey = generateCitationKey(paper);
  const blob = new Blob([bibString], { type: "text/plain;charset=utf-8" });
  
  const element = document.createElement("a");
  element.href = URL.createObjectURL(blob);
  element.download = `${citationKey}.bib`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
