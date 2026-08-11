import { apiGet } from "@/shared/lib/api";

export type CrossrefWork = {
    title: string;
    authors: string[];
    editors?: string[];
    doi: string;
    journal: string;
    publicationTitle?: string;
    publicationDate?: string;
    publisher: string;
    place?: string;
    issn: string;
    isbn: string;
    volume: string;
    issue: string;
    section?: string;
    partNumber?: string;
    partTitle?: string;
    pages: string;
    series?: string;
    seriesTitle?: string;
    seriesText?: string;
    year: number | string;
    type: string;
    itemType?: string;
    abstract: string;
    url: string;
    score: number;
    language?: string;
    journalAbbr?: string;
    shortTitle?: string;
    rights?: string;
    license?: string;
    libraryCatalog?: string;
    keywords?: string[];
    pmid?: string;
    pmcid?: string;
    extra?: string;
};

export const searchCrossref = (query: string, rows = 5) =>
    apiGet<{ works: CrossrefWork[]; totalResults: number }>(
        `/api/files/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`,
    );

export const lookupDoi = (doi: string) =>
    apiGet<{ work: CrossrefWork }>(`/api/files/crossref/doi/${encodeURIComponent(doi)}`);
