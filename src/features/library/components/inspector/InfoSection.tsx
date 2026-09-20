'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Item } from '@/features/library/types/library.types';
import { cleanDoi, extractArxivId, generateCitationKey } from '../../domain';
import {
  LIBRARY_ITEM_TYPES,
  getItemTypeDefinition,
  mapRegistryItemTypes,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from '../../types';
import { toast } from 'sonner';
import { copyToClipboard as copyText } from '@/shared/lib/utils';
import { useItemTypes, useConversion } from '../../data';
import {
  CreatorFields,
  GeneralFields,
  DynamicInspectorField,
  ExtraAuditFields,
  InlineField,
  InlineTextarea,
  type CreatorEntry,
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
} from './fields';

export type { CreatorEntry };
export { InlineField, InlineTextarea, parseCreators, areCreatorsEqual, toItemCreators };

export interface InfoSectionProps {
  paper: Item;
  onUpdatePaper?: (data: Partial<Item>) => void;
  canEdit?: boolean;
}

/** Fields backed by first-class Item columns. All other registry fields
 * are persisted through extraFields, which survives registry additions without
 * another frontend allow-list change. */
export const DIRECT_METADATA_FIELDS = new Set([
  'publisher', 'place', 'volume', 'issue', 'section', 'partNumber', 'partTitle',
  'pages', 'series', 'seriesTitle', 'seriesText', 'seriesNumber', 'issn', 'ISSN',
  'isbn', 'ISBN', 'url', 'type', 'language', 'shortTitle', 'archive', 'archiveLocation',
  'callNumber', 'publicationDate', 'date', 'libraryCatalog', 'journalAbbr',
  'journalAbbreviation', 'doi', 'DOI', 'pmid', 'PMID', 'pmcid', 'PMCID', 'arxivId',
  'archiveId', 'archiveID', 'citationCount', 'referenceCount', 'openAccessPdfUrl',
  'rights', 'license', 'citationKey', 'citeKey', 'abstract', 'abstractNote',
  'publicationTitle', 'journal', 'accessedAt', 'accessDate',
  'bookTitle', 'proceedingsTitle', 'conferenceName', 'eventPlace', 'websiteTitle',
  'websiteType', 'university', 'institution', 'repository', 'edition', 'numPages',
  'numberOfPages', 'numberOfVolumes', 'thesisType', 'reportType', 'reportNumber',
  'genre', 'blogTitle', 'issueDate', 'priorityDate', 'patentNumber', 'issuingAuthority',
  'assignee', 'programmingLanguage',
]);

/** Filter out empty, null, undefined, or junk placeholder string values */
export function isValidValue(val?: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val) && Number.isFinite(val);
  if (typeof val === 'boolean') return true;
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return false;
    const lower = str.toLowerCase();
    return (
      lower !== 'null' &&
      lower !== 'undefined' &&
      lower !== 'n/a' &&
      lower !== 'na' &&
      lower !== 'none' &&
      lower !== 'nil' &&
      lower !== '{}' &&
      lower !== '[]' &&
      lower !== '[object object]' &&
      lower !== '0000' &&
      lower !== 'unknown'
    );
  }
  return false;
}

/** Clean string value or return empty string */
export function cleanValue(val?: any): string {
  if (!isValidValue(val)) return '';
  return String(val).trim();
}

/** Format ISO date into locale format (e.g. 8/20/2026, 3:53:43 PM) */
export function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export default function InfoSection({ paper, onUpdatePaper, canEdit = true }: InfoSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const currentItemType = paper.itemType || 'journalArticle';
  const scopeId = (paper as any).projectId || '';

  const { previewAsync, convertAsync } = useConversion(scopeId);
  const { types: registryItemTypes } = useItemTypes(scopeId || undefined);

  const itemTypeDefinitions = useMemo(() => {
    const serverDefinitions = mapRegistryItemTypes(registryItemTypes);
    return serverDefinitions.length > 0
      ? serverDefinitions
      : Object.values(LIBRARY_ITEM_TYPES);
  }, [registryItemTypes]);

  const selectableItemTypes = useMemo(
    () =>
      itemTypeDefinitions
        .filter(
          (t) =>
            t.isBibliographic !== false &&
            !t.isSpecial &&
            t.itemType !== 'attachment' &&
            t.itemType !== 'note' &&
            t.itemType !== 'annotation',
        )
        .map(({ itemType, label }) => ({ value: itemType, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [itemTypeDefinitions],
  );

  const typeDefinition: SchemaItemTypeDefinition = useMemo(
    () =>
      itemTypeDefinitions.find((type) => type.itemType === currentItemType) ||
      getItemTypeDefinition(currentItemType) ||
      getItemTypeDefinition('journalArticle')!,
    [currentItemType, itemTypeDefinitions],
  );

  const displayDoi = cleanDoi(paper.doi || (paper as any).DOI);

  const copyToClipboard = async (text: string, label: string) => {
    if (!text || !text.trim()) {
      toast.error('Nothing to copy', { id: 'library-clipboard' });
      return;
    }
    const ok = await copyText(text);
    if (ok) {
      toast.success(`Copied ${label}`, { id: 'library-clipboard' });
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 1500);
    } else {
      toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
    }
  };

  const handleFieldChange = (field: keyof Item | string, value: any) => {
    if (onUpdatePaper) {
      onUpdatePaper({ [field]: value });
    }
  };

  /** Helper to retrieve value for a field definition key from paper */
  const getFieldValue = useCallback(
    (fieldKey: string): string => {
      const p = paper as any;
      const keyLower = fieldKey.toLowerCase();
      const ef = (p.extraFields as Record<string, any>) || {};

      if (keyLower === 'date' || keyLower === 'publicationdate') {
        return cleanValue(
          p.publicationDate || (p.year ? String(p.year) : '') || p.date || ef.date || ef.publicationDate,
        );
      }
      if (keyLower === 'issuedate') {
        return cleanValue(p.issueDate || ef.issueDate);
      }
      if (keyLower === 'prioritydate') {
        return cleanValue(p.priorityDate || ef.priorityDate);
      }
      if (keyLower === 'publicationtitle' || keyLower === 'journal') {
        return cleanValue(
          p.publicationTitle || (p.itemType === 'journalArticle' ? p.journal : '') || ef.publicationTitle,
        );
      }
      if (keyLower === 'journalabbreviation' || keyLower === 'journalabbr') {
        return cleanValue(
          p.journalAbbr || p.journalAbbreviation || ef.journalAbbr || ef.journalAbbreviation,
        );
      }
      if (keyLower === 'accessdate' || keyLower === 'accessedat') {
        return cleanValue(p.accessDate || (p.accessedAt ? formatAuditDate(p.accessedAt) : '') || ef.accessDate);
      }
      if (keyLower === 'doi') {
        return cleanValue(displayDoi || p.doi || p.DOI || ef.doi);
      }
      if (keyLower === 'pmid') {
        return cleanValue(p.pmid || p.PMID || ef.pmid);
      }
      if (keyLower === 'pmcid') {
        return cleanValue(p.pmcid || p.PMCID || ef.pmcid);
      }
      if (keyLower === 'issn') {
        return cleanValue(p.issn || p.ISSN || ef.issn);
      }
      if (keyLower === 'isbn') {
        return cleanValue(p.isbn || p.ISBN || ef.isbn);
      }
      if (keyLower === 'archiveid' || keyLower === 'arxivid' || keyLower === 'arxiv') {
        const raw = cleanValue(
          p.archiveId ||
            p.archiveID ||
            p.arxivId ||
            ef.archiveId ||
            ef.archiveID ||
            ef.arxivId ||
            extractArxivId(p.url) ||
            extractArxivId(p.callNumber),
        );
        if (!raw) return '';
        const clean = raw
          .replace(/^arxiv:\s*/i, '')
          .replace(/\s*\[.*?\]\s*$/, '')
          .replace(/v\d+$/i, '')
          .trim();
        return p.itemType === 'preprint' && clean ? `arXiv:${clean}` : clean;
      }
      if (keyLower === 'citationkey' || keyLower === 'citekey') {
        return cleanValue(p.citationKey || generateCitationKey(p));
      }
      if (keyLower === 'series') {
        return cleanValue(p.series || ef.series);
      }
      if (keyLower === 'seriestitle') {
        return cleanValue(p.seriesTitle || ef.seriesTitle);
      }
      if (keyLower === 'seriesnumber') {
        return cleanValue(p.seriesNumber || ef.seriesNumber);
      }
      if (keyLower === 'seriestext') {
        return cleanValue(p.seriesText || ef.seriesText);
      }
      if (keyLower === 'rights' || keyLower === 'license') {
        return cleanValue(p.rights || p.license || ef.rights || ef.license);
      }
      if (keyLower === 'publisher') {
        return cleanValue(p.publisher || ef.publisher);
      }
      if (keyLower === 'place') {
        return cleanValue(p.place || ef.place);
      }
      if (keyLower === 'eventplace') {
        return cleanValue(p.eventPlace || ef.eventPlace);
      }
      if (keyLower === 'genre') {
        return cleanValue(p.genre || ef.genre);
      }
      if (keyLower === 'language') {
        return cleanValue(p.language || ef.language);
      }
      if (keyLower === 'programminglanguage') {
        return cleanValue(p.programmingLanguage || ef.programmingLanguage);
      }
      if (keyLower === 'callnumber') {
        return cleanValue(p.callNumber || ef.callNumber);
      }
      if (keyLower === 'archive') {
        return cleanValue(p.archive || ef.archive);
      }
      if (keyLower === 'archivelocation') {
        return cleanValue(p.archiveLocation || ef.archiveLocation);
      }
      if (keyLower === 'librarycatalog') {
        return cleanValue(p.libraryCatalog || ef.libraryCatalog);
      }
      if (keyLower === 'abstractnote' || keyLower === 'abstract') {
        return cleanValue(p.abstract || p.abstractNote || ef.abstractNote || ef.abstract);
      }
      if (keyLower === 'booktitle') {
        return cleanValue(p.bookTitle || p.publicationTitle || ef.bookTitle);
      }
      if (keyLower === 'proceedingstitle') {
        return cleanValue(p.proceedingsTitle || p.publicationTitle || ef.proceedingsTitle);
      }
      if (keyLower === 'conferencename') {
        return cleanValue(p.conferenceName || ef.conferenceName);
      }
      if (keyLower === 'eventplace') {
        return cleanValue(p.eventPlace || p.place || ef.eventPlace);
      }
      if (keyLower === 'university') {
        return cleanValue(p.university || p.publisher || ef.university);
      }
      if (keyLower === 'institution') {
        return cleanValue(p.institution || p.publisher || ef.institution);
      }
      if (keyLower === 'repository') {
        return cleanValue(p.repository || ef.repository || (p.itemType === 'preprint' ? p.publisher : ''));
      }
      if (
        keyLower === 'company' ||
        keyLower === 'distributor' ||
        keyLower === 'studio' ||
        keyLower === 'network' ||
        keyLower === 'label'
      ) {
        return cleanValue(p[fieldKey] || ef[fieldKey]);
      }
      if (keyLower === 'issuingauthority' || keyLower === 'authority') {
        return cleanValue(p.issuingAuthority || ef.issuingAuthority || p.authority);
      }
      if (keyLower === 'patentnumber') {
        return cleanValue(p.patentNumber || ef.patentNumber || (p as any).number);
      }
      if (keyLower === 'assignee') {
        return cleanValue(p.assignee || ef.assignee);
      }
      if (
        keyLower === 'websitetitle' ||
        keyLower === 'blogtitle' ||
        keyLower === 'dictionarytitle' ||
        keyLower === 'encyclopediatitle' ||
        keyLower === 'forumtitle' ||
        keyLower === 'sessiontitle' ||
        keyLower === 'programtitle'
      ) {
        return cleanValue(
          p[fieldKey] ||
            ef[fieldKey] ||
            (['websitetitle', 'blogtitle'].includes(keyLower) ? p.publicationTitle : ''),
        );
      }
      if (
        keyLower === 'websitetype' ||
        keyLower === 'thesistype' ||
        keyLower === 'reporttype' ||
        keyLower === 'posttype'
      ) {
        return cleanValue(p[fieldKey] || ef[fieldKey] || p.type || p.genre);
      }
      if (keyLower === 'reportnumber') {
        return cleanValue(p.reportNumber || (p as any).number || ef.reportNumber);
      }
      if (keyLower === 'country') {
        return cleanValue(p.country || ef.country);
      }
      if (keyLower === 'numpages' || keyLower === 'numberofpages') {
        return cleanValue(p.numPages || p.numberOfPages || ef.numPages || ef.numberOfPages);
      }
      if (keyLower === 'edition') {
        return cleanValue(p.edition || ef.edition);
      }
      if (keyLower === 'citationcount') {
        const currentCitationCount = p.citationCount ?? ef.citationCount;
        return cleanValue(currentCitationCount);
      }
      if (keyLower === 'referencecount') {
        const currentReferenceCount = p.referenceCount ?? ef.referenceCount;
        return cleanValue(currentReferenceCount);
      }

      return cleanValue(p[fieldKey] ?? ef[fieldKey] ?? p.customFields?.[fieldKey]);
    },
    [paper, displayDoi],
  );

  /**
   * Helper to save value for a dynamic field definition atomically.
   * Batches all multi-field mutations into a single onUpdatePaper call
   * to eliminate 409 Version Mismatch race conditions and preserve extraFields.
   */
  const saveFieldValue = (fieldDef: SchemaFieldDefinition, val: string) => {
    if (!onUpdatePaper) return;

    const key = fieldDef.field;
    const keyLower = key.toLowerCase();
    const currentExtraFields =
      (paper.extraFields as Record<string, unknown> | undefined) || {};

    let patch: Record<string, any> = {};

    if (keyLower === 'date' || keyLower === 'publicationdate') {
      const yearMatch = val.match(/(?:^|[^\d])(1[7-9]\d{2}|20\d{2})(?:[^\d]|$)/);
      const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(val, 10);
      const finalYear = !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999 ? parsedYear : undefined;
      patch = {
        year: finalYear,
        publicationDate: val || '',
        date: val || '',
      };
    } else if (keyLower === 'doi') {
      const cleaned = cleanDoi(val);
      patch = {
        doi: cleaned || '',
        DOI: cleaned || '',
      };
    } else if (keyLower === 'isbn') {
      patch = { isbn: val || '', ISBN: val || '' };
    } else if (keyLower === 'issn') {
      patch = { issn: val || '', ISSN: val || '' };
    } else if (keyLower === 'pmid') {
      patch = { pmid: val || '', PMID: val || '' };
    } else if (keyLower === 'pmcid') {
      patch = { pmcid: val || '', PMCID: val || '' };
    } else if (keyLower === 'archiveid' || keyLower === 'arxivid') {
      const cleanVal = val.replace(/\s*\[.*?\]\s*$/, '').trim();
      const rawArxiv = cleanVal.replace(/^arxiv:\s*/i, '');
      patch = {
        arxivId: rawArxiv || '',
        archiveId: cleanVal || '',
        archiveID: cleanVal || '',
      };
    } else if (keyLower === 'publicationtitle' || keyLower === 'journal') {
      patch = {
        publicationTitle: val || '',
        journal: val || '',
      };
    } else if (keyLower === 'journalabbreviation' || keyLower === 'journalabbr') {
      patch = {
        journalAbbr: val || '',
        journalAbbreviation: val || '',
      };
    } else if (keyLower === 'accessdate' || keyLower === 'accessedat') {
      patch = {
        accessedAt: val || '',
        accessDate: val || '',
      };
    } else if (keyLower === 'rights' || keyLower === 'license') {
      patch = {
        rights: val || '',
        license: val || '',
      };
    } else if (keyLower === 'citationkey' || keyLower === 'citekey') {
      patch = { citationKey: val || '' };
    } else if (keyLower === 'abstractnote' || keyLower === 'abstract') {
      patch = {
        abstract: val || '',
        abstractNote: val || '',
      };
    } else if (keyLower === 'citationcount') {
      const parsedCitationCount = parseInt(val.replace(/,/g, ''), 10);
      const validCitationCount = isNaN(parsedCitationCount) ? null : parsedCitationCount;
      patch = {
        citationCount: validCitationCount,
        extraFields: {
          ...currentExtraFields,
          citationCount: validCitationCount,
        },
      };
    } else if (keyLower === 'referencecount') {
      const parsedReferenceCount = parseInt(val.replace(/,/g, ''), 10);
      const validReferenceCount = isNaN(parsedReferenceCount) ? null : parsedReferenceCount;
      patch = {
        referenceCount: validReferenceCount,
        extraFields: {
          ...currentExtraFields,
          referenceCount: validReferenceCount,
        },
      };
    } else if (keyLower === 'numpages' || keyLower === 'numberofpages') {
      const parsed = parseInt(val, 10);
      const validNum = isNaN(parsed) ? val || null : parsed;
      patch = {
        numPages: validNum,
        numberOfPages: validNum,
      };
    } else if (keyLower === 'issuedate') {
      const yearMatch = val.match(/(?:^|[^\d])(1[7-9]\d{2}|20\d{2})(?:[^\d]|$)/);
      const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : parseInt(val, 10);
      const finalYear = !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999 ? parsedYear : undefined;
      patch = {
        issueDate: val || '',
        ...(finalYear ? { year: finalYear } : {}),
      };
    } else if (keyLower === 'issuingauthority' || keyLower === 'authority') {
      patch = {
        issuingAuthority: val || '',
        authority: val || '',
      };
    } else if (keyLower === 'proceedingstitle') {
      patch = {
        proceedingsTitle: val || '',
        publicationTitle: val || '',
      };
    } else if (keyLower === 'booktitle') {
      patch = {
        bookTitle: val || '',
        publicationTitle: val || '',
      };
    } else if (keyLower === 'websitetitle') {
      patch = {
        websiteTitle: val || '',
        publicationTitle: val || '',
      };
    } else if (keyLower === 'blogtitle') {
      patch = {
        blogTitle: val || '',
        publicationTitle: val || '',
      };
    } else if (keyLower === 'university') {
      patch = {
        university: val || '',
        publisher: val || '',
      };
    } else if (keyLower === 'institution') {
      patch = {
        institution: val || '',
        publisher: val || '',
      };
    } else if (keyLower === 'eventplace') {
      patch = {
        eventPlace: val || '',
        place: val || '',
      };
    } else if (keyLower === 'repository') {
      patch = {
        repository: val || '',
        ...(paper.itemType === 'preprint' ? {} : { publisher: val || '' }),
      };
    } else if (DIRECT_METADATA_FIELDS.has(key) || DIRECT_METADATA_FIELDS.has(keyLower)) {
      patch = { [key]: val || '' };
    } else {
      patch = {
        extraFields: {
          ...currentExtraFields,
          [key]: val || null,
        },
      };
    }

    onUpdatePaper(patch);
  };

  // Render all schema fields for the selected item type in registry order
  const dynamicFields = useMemo(() => {
    const raw = (typeDefinition?.fields || []).filter(
      (f: SchemaFieldDefinition) =>
        f.field !== 'title' &&
        f.field !== 'abstractNote' &&
        f.field !== 'abstract' &&
        f.field !== 'extra' &&
        f.field !== 'dateAdded' &&
        f.field !== 'dateModified',
    );
    const academicTypes = new Set([
      'journalArticle',
      'preprint',
      'conferencePaper',
      'thesis',
      'report',
      'dataset',
      'book',
      'bookSection',
    ]);
    if (
      academicTypes.has(currentItemType) &&
      !raw.some((f) => f.field.toLowerCase() === 'citationcount')
    ) {
      const doiIdx = raw.findIndex((f) => f.field.toLowerCase() === 'doi');
      const citationDef: SchemaFieldDefinition = {
        field: 'citationCount',
        label: 'Citations',
        type: 'number',
        category: 'identifiers',
        mono: true,
      };
      if (doiIdx >= 0) {
        raw.splice(doiIdx + 1, 0, citationDef);
      } else {
        raw.push(citationDef);
      }
    }
    if (
      academicTypes.has(currentItemType) &&
      !raw.some((f) => f.field.toLowerCase() === 'referencecount')
    ) {
      const citIdx = raw.findIndex((f) => f.field.toLowerCase() === 'citationcount');
      const refDef: SchemaFieldDefinition = {
        field: 'referenceCount',
        label: 'References',
        type: 'number',
        category: 'identifiers',
        mono: true,
      };
      if (citIdx >= 0) {
        raw.splice(citIdx + 1, 0, refDef);
      } else {
        raw.push(refDef);
      }
    }

    // Filter out duplicate/conflicting venue fields per Zotero Schema v42
    return raw.filter((f: SchemaFieldDefinition) => {
      const k = f.field.toLowerCase();
      if (currentItemType === 'preprint') {
        if (k === 'publicationtitle' || k === 'journal' || k === 'publisher') {
          return false;
        }
      }
      if (currentItemType === 'conferencePaper') {
        if (k === 'publicationtitle' || k === 'journal') {
          return false;
        }
      }
      if (currentItemType === 'bookSection') {
        if (k === 'publicationtitle' || k === 'journal') {
          return false;
        }
      }
      if (currentItemType === 'webpage' || currentItemType === 'blogPost') {
        if (k === 'publicationtitle' || k === 'journal') {
          return false;
        }
      }
      return true;
    });
  }, [typeDefinition, currentItemType]);

  return (
    <div className="space-y-0.5 select-text font-sans antialiased">
      {/* General Section: Warning, Item Type Selector, Title */}
      <GeneralFields
        paper={paper}
        currentItemType={currentItemType}
        selectableItemTypes={selectableItemTypes}
        typeDefinition={typeDefinition}
        canEdit={canEdit}
        onUpdatePaper={onUpdatePaper}
        previewAsync={previewAsync}
        convertAsync={convertAsync}
      />

      {/* Creators / Authors */}
      <CreatorFields
        paper={paper}
        typeDefinition={typeDefinition}
        canEdit={canEdit}
        onUpdatePaper={onUpdatePaper}
      />

      {/* Dynamic Schema Fields for Selected Item Type in Canonical Zotero Order */}
      {dynamicFields.map((fieldDef: SchemaFieldDefinition) => {
        const rawVal = getFieldValue(fieldDef.field);
        const isCitations = fieldDef.field.toLowerCase() === 'citationcount';
        const isCitationKey =
          fieldDef.field.toLowerCase() === 'citationkey' ||
          fieldDef.field.toLowerCase() === 'citekey';
        const isRights =
          fieldDef.field.toLowerCase() === 'rights' ||
          fieldDef.field.toLowerCase() === 'license';

        const val =
          isCitations && rawVal && !isNaN(Number(rawVal))
            ? new Intl.NumberFormat('en-US').format(Number(rawVal))
            : isCitationKey
            ? cleanValue(paper.citationKey || generateCitationKey(paper))
            : isRights
            ? cleanValue(
                paper.rights ??
                  paper.license ??
                  (paper.extraFields?.rights as string) ??
                  (paper.extraFields?.license as string),
              )
            : rawVal;

        const onSaveField = (newVal: string) => {
          if (isCitationKey) {
            handleFieldChange('citationKey', newVal || undefined);
          } else if (isRights) {
            handleFieldChange('rights', newVal || undefined);
          } else {
            saveFieldValue(fieldDef, newVal);
          }
        };

        return (
          <DynamicInspectorField
            key={fieldDef.field}
            fieldDef={fieldDef}
            paper={paper}
            val={val}
            displayDoi={displayDoi}
            copiedKey={copiedKey}
            canEdit={canEdit}
            onSave={onSaveField}
            onCopy={copyToClipboard}
          />
        );
      })}

      {/* Extra Field, Date Added, Modified */}
      <ExtraAuditFields
        paper={paper}
        canEdit={canEdit}
        onUpdatePaper={onUpdatePaper}
      />
    </div>
  );
}
