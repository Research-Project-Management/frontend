import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  MERGEABLE_FIELDS, scoreFieldCandidate, selectBestMasterItemId, inspectItemDifferences, mergeItemExtraFields, buildMergedItemPayload, aggregateItemAssets, resolveItemFieldValue, normalizeCompareValue, } from '@/features/library/domain/diff';
import { useDuplicateMergeState } from '@/features/library/core/coordinator/curation.coordinator';
import { getLibraryPermissions } from '@/features/library/domain/library-permissions.policy';
import { QualityService } from '@/features/library/sdk/library.client';
import * as api from '@/shared/lib/api';
import type { Item } from '@/features/library/domain/types/library.types';

function makeItem(overrides: Partial<Item> & { id: string; title: string }): Item {
  return {
    itemType: 'journalArticle',
    authors: [],
    tags: [],
    collections: [],
    notes: [],
    attachments: [],
    ...overrides,
  };
}

describe('Zotero Wave 6: Comprehensive Duplicate Detection & Merge Case Studies (Personal & Project Contexts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Case Study 1: Preprint vs. Published Journal Article Diff & Smart Master Selection
  // ===========================================================================
  describe('Case Study 1: Preprint vs. Published Journal Article Diff & Smart Master Selection', () => {
    it('automatically selects the published journalArticle over the older preprint and produces a clean merged payload', () => {
      const preprintItem = makeItem({
        id: 'item-arxiv-2023',
        title: 'FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
        itemType: 'preprint',
        year: 2023,
        doi: '10.48550/arXiv.2307.08691',
        publicationTitle: 'arXiv:2307.08691 [cs.LG]',
        abstractNote:
          'Scaling Transformer models to longer sequences is bottlenecked by the quadratic time and memory complexity of the attention layer. We propose FlashAttention-2 with improved work partitioning across GPU warps and thread blocks, achieving 2x speedup over FlashAttention-1 and reaching up to 73% of theoretical peak FLOPs/s on A100 GPUs.',
        authors: [{ firstName: 'Tri', lastName: 'Dao' }],
        tags: ['preprint', 'to-read', 'gpu-kernels'],
        collections: ['col-attention'],
      });

      const publishedItem = makeItem({
        id: 'item-iclr-2024',
        title: 'FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
        itemType: 'journalArticle',
        year: 2024,
        doi: '10.1000/iclr.2024.8691',
        publicationTitle: 'International Conference on Learning Representations (ICLR)',
        volume: '12',
        issue: '4',
        pages: '1120-1135',
        abstractNote: 'Short camera-ready summary of FlashAttention-2.',
        authors: [{ firstName: 'Tri', lastName: 'Dao' }],
        tags: ['published', 'iclr-2024', 'gpu-kernels'],
        collections: ['col-published'],
      });

      // Even though preprintItem is first in the array (older import), selectBestMasterItemId picks the richer published journalArticle
      const duplicatePair = [preprintItem, publishedItem];
      const bestMasterId = selectBestMasterItemId(duplicatePair);
      expect(bestMasterId).toBe('item-iclr-2024');

      // Inspect differences with the selected master
      const inspection = inspectItemDifferences(duplicatePair, bestMasterId);
      expect(inspection.masterItemId).toBe('item-iclr-2024');
      expect(inspection.conflictCount).toBeGreaterThanOrEqual(4); // year, doi, publicationTitle, abstract

      // Abstract recommendation should prefer the longer, more detailed abstract from the arXiv preprint
      const abstractField = inspection.fields.find((f) => f.key === 'abstract');
      expect(abstractField).toBeDefined();
      expect(abstractField?.hasConflict).toBe(true);
      expect(abstractField?.recommendedItemId).toBe('item-arxiv-2023');

      // Volume, issue, and pages should be populated only on the published item (no conflict since only 1 non-empty value, or recommended from publishedItem)
      const volumeField = inspection.fields.find((f) => f.key === 'volume');
      expect(volumeField?.recommendedItemId).toBe('item-iclr-2024');

      // User accepts the longer abstract override from the preprint while keeping published journal metadata
      const mergedPayload = buildMergedItemPayload(duplicatePair, bestMasterId, {
        abstract: preprintItem.abstractNote,
      });

      expect(mergedPayload.masterId).toBe('item-iclr-2024');
      expect(mergedPayload.duplicateIds).toEqual(['item-arxiv-2023']);
      expect(mergedPayload.resolvedFields.itemType).toBe('journalArticle');
      expect(mergedPayload.resolvedFields.year).toBe(2024);
      expect(mergedPayload.resolvedFields.doi).toBe('10.1000/iclr.2024.8691');
      expect(mergedPayload.resolvedFields.volume).toBe('12');
      expect(mergedPayload.resolvedFields.issue).toBe('4');
      expect(mergedPayload.resolvedFields.pages).toBe('1120-1135');
      expect(mergedPayload.resolvedFields.abstract).toBe(preprintItem.abstractNote);
      // Tags and collections are unioned seamlessly
      expect(mergedPayload.resolvedFields.tags).toEqual([
        'published',
        'iclr-2024',
        'gpu-kernels',
        'preprint',
        'to-read',
      ]);
      expect(mergedPayload.resolvedFields.collections).toEqual([
        'col-published',
        'col-attention',
      ]);
    });
  });

  // ===========================================================================
  // Case Study 2: Non-Destructive Zotero `Extra` Field & Citation Key Alias Merging
  // ===========================================================================
  describe('Case Study 2: Non-Destructive Zotero Extra Field & Citation Key Alias Merging', () => {
    it('merges key:value pairs and combines BetterBibTeX citation keys into tex.ids without losing any identifiers', () => {
      const itemA = makeItem({
        id: 'dup-pubmed',
        title: 'CRISPR-Cas9 Gene Editing in Clinical Hematology',
        citationKey: 'doudna2023crispr',
        extra: 'PMID: 12345678\nCitation Key: doudna2023crispr\nNIHMSID: NIHMS998877',
      });

      const itemB = makeItem({
        id: 'dup-pmc',
        title: 'CRISPR-Cas9 Gene Editing in Clinical Hematology',
        citationKey: 'doudna2023a',
        extra: 'PMID: 12345678\nPMCID: PMC8765432\nCitation Key: doudna2023a',
      });

      const itemC = makeItem({
        id: 'dup-crossref',
        title: 'CRISPR-Cas9 Gene Editing in Clinical Hematology',
        extra: 'Original Date: 2022\ntex.ids: doudna2022preprint\nReviewed scientifically by Lab Alpha',
      });

      const mergedExtra = mergeItemExtraFields([itemA, itemB, itemC], 'dup-pubmed');

      // Master Citation Key is preserved
      expect(mergedExtra).toContain('Citation Key: doudna2023crispr');
      // Secondary citation keys are folded into tex.ids so existing LaTeX \cite{doudna2023a} and \cite{doudna2022preprint} never break
      expect(mergedExtra).toContain('tex.ids: doudna2023a, doudna2022preprint');
      // Unique key-value lines from all duplicates are preserved without duplicating PMID
      expect(mergedExtra).toContain('PMID: 12345678');
      expect(mergedExtra.match(/PMID:\s*12345678/g)?.length).toBe(1);
      expect(mergedExtra).toContain('PMCID: PMC8765432');
      expect(mergedExtra).toContain('NIHMSID: NIHMS998877');
      expect(mergedExtra).toContain('Original Date: 2022');
      expect(mergedExtra).toContain('Reviewed scientifically by Lab Alpha');

      // Verify buildMergedItemPayload includes the non-destructively merged extra field automatically
      const payload = buildMergedItemPayload([itemA, itemB, itemC], 'dup-pubmed');
      expect(payload.resolvedFields.extra).toBe(mergedExtra);
    });
  });

  // ===========================================================================
  // Case Study 3: Asset Aggregation with Identical PDF Hash Deduplication & Multi-Copy Annotations
  // ===========================================================================
  describe('Case Study 3: Asset Aggregation with Identical PDF Hash Deduplication & Multi-Copy Annotations', () => {
    it('flags byte-identical PDFs via fileHash while preserving distinct supplements and counting all annotations, notes, tags, and collections', () => {
      const sharedPdfHash = 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

      const copy1 = makeItem({
        id: 'copy-1',
        title: 'Attention Is All You Need',
        tags: ['transformers', 'deep-learning'],
        collections: ['col-nlp', 'col-foundations'],
        notes: [
          { id: 'n1', content: 'Summary of multi-head self-attention scaling equations.' },
          { id: 'n2', content: 'Positional encoding sinusoidal formulation notes.' },
        ],
        attachments: [
          {
            id: 'att-main-1',
            name: 'Vaswani_et_al_2017.pdf',
            fileHash: sharedPdfHash,
            size: 2_450_000,
            annotations: [
              { id: 'ann-1', type: 'highlight', color: '#ffd400', page: 3 },
              { id: 'ann-2', type: 'highlight', color: '#5fb236', page: 4 },
              { id: 'ann-3', type: 'note', color: '#2ea8e5', page: 5 },
            ],
          } as Item['attachments'][number],
        ],
      });

      const copy2 = makeItem({
        id: 'copy-2',
        title: 'Attention Is All You Need',
        tags: ['Transformers', 'neurips-2017'],
        collections: ['col-nlp', 'col-reading-club'],
        notes: [{ id: 'n3', content: 'Follow-up comparison with RNN/CNN baselines.' }],
        attachments: [
          {
            id: 'att-main-2',
            name: 'Attention_Is_All_You_Need_Copy.pdf',
            fileHash: sharedPdfHash,
            size: 2_450_000,
            annotations: [
              { id: 'ann-4', type: 'highlight', color: '#ff6666', page: 7 },
              { id: 'ann-5', type: 'area', color: '#a28ae5', page: 8 },
            ],
          } as Item['attachments'][number],
          {
            id: 'att-supp-1',
            name: 'Supplementary_Hyperparameters.pdf',
            fileHash: 'sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
            size: 640_000,
            annotations: [],
          } as Item['attachments'][number],
        ],
      });

      const assets = aggregateItemAssets([copy1, copy2]);

      // Unique attachments = 2 (2 identical main PDFs deduplicated to 1 + 1 distinct supplementary PDF)
      expect(assets.attachmentCount).toBe(2);
      expect(assets.uniqueAttachmentCount).toBe(2);
      expect(assets.duplicateAttachmentCount).toBe(1);

      // Verify deduplicated attachments list preserves the first main PDF and the supplementary PDF
      const firstPdf = (assets.attachments as Array<{ id?: string }>).find((a) => a.id === 'att-main-1');
      const duplicatePdf = (assets.attachments as Array<{ id?: string }>).find((a) => a.id === 'att-main-2');
      const supplementPdf = (assets.attachments as Array<{ id?: string }>).find((a) => a.id === 'att-supp-1');

      expect(firstPdf).toBeDefined();
      expect(duplicatePdf).toBeUndefined();
      expect(supplementPdf).toBeDefined();

      // All 5 annotations across both copies of the PDF are counted so the merge service can migrate them to the surviving PDF
      expect(assets.totalAnnotationCount).toBe(5);
      // All 3 notes are preserved
      expect(assets.noteCount).toBe(3);
      // Case-insensitive tag deduplication ('transformers' + 'deep-learning' + 'neurips-2017')
      expect(assets.tags).toEqual(['transformers', 'deep-learning', 'neurips-2017']);
      // Collections deduplicated ('col-nlp', 'col-foundations', 'col-reading-club')
      expect(assets.collectionCount).toBe(3);
      expect(assets.collections).toEqual(['col-nlp', 'col-foundations', 'col-reading-club']);
    });
  });

  // ===========================================================================
  // Case Study 4: Alias-Aware Field Selection & Master Switching in Diff/Merge State
  // ===========================================================================
  describe('Case Study 4: Alias-Aware Field Selection & Master Switching', () => {
    it('resolves aliased fields (creators/authors, journal/publicationTitle, extraFields) accurately without redundant overrides when re-selecting master values', () => {
      // Master item stores authors in `creators`, journal in `journal`, and publisher in `extraFields.publisher`
      const masterWithAliases = makeItem({
        id: 'master-aliased',
        title: 'Distributed Consensus at Scale',
        authors: [],
        creators: [
          { firstName: 'Leslie', lastName: 'Lamport', creatorType: 'author' },
          { firstName: 'Barbara', lastName: 'Liskov', creatorType: 'author' },
        ],
        journal: 'ACM Transactions on Computer Systems',
        extraFields: {
          publisher: 'Association for Computing Machinery',
          volume: '39',
        },
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const secondaryItem = makeItem({
        id: 'secondary-canonical',
        title: 'Distributed Consensus at Scale',
        authors: [{ firstName: 'L.', lastName: 'Lamport' }],
        publicationTitle: 'TOCS',
        publisher: 'ACM Press',
        volume: '39',
      });

      const inspection = inspectItemDifferences(
        [masterWithAliases, secondaryItem],
        'master-aliased',
      );

      // Verify resolveItemFieldValue & inspection.fields properly surface the aliased master values
      const authorsField = inspection.fields.find((f) => f.key === 'authors');
      const pubTitleField = inspection.fields.find((f) => f.key === 'publicationTitle');
      const publisherField = inspection.fields.find((f) => f.key === 'publisher');
      const volumeField = inspection.fields.find((f) => f.key === 'volume');

      expect(authorsField?.masterValue?.displayValue).toBe('Leslie Lamport, Barbara Liskov');
      expect(pubTitleField?.masterValue?.displayValue).toBe('ACM Transactions on Computer Systems');
      expect(publisherField?.masterValue?.displayValue).toBe('Association for Computing Machinery');
      // Volume is '39' in master extraFields and '39' in secondary top-level field -> no conflict!
      expect(volumeField?.hasConflict).toBe(false);

      // Simulate selecting secondary's publicationTitle ('TOCS'), then switching back to master's option
      // Using the exact alias-aware resolution logic from useDuplicateMergeState.handleSelectFieldValue:
      const applyFieldSelection = (
        prevOverrides: Record<string, unknown>,
        fieldKey: string,
        selectedOptionItemId: string,
      ) => {
        const field = inspection.fields.find((f) => f.key === fieldKey);
        const option = field?.options.find((o) => o.itemId === selectedOptionItemId);
        if (!field || !option) return prevOverrides;

        const masterVal = field.masterValue
          ? field.masterValue.rawValue
          : resolveItemFieldValue(masterWithAliases as Record<string, unknown>, fieldKey);
        const isSameAsMaster =
          option.rawValue === masterVal ||
          normalizeCompareValue(option.rawValue) === normalizeCompareValue(masterVal);

        if (isSameAsMaster) {
          const copy = { ...prevOverrides };
          delete copy[fieldKey];
          return copy;
        }
        return {
          ...prevOverrides,
          [fieldKey]: option.rawValue,
        };
      };

      // 1. User clicks secondary item's option for `publicationTitle`, `authors`, and `publisher`
      let overrides: Record<string, unknown> = {};
      overrides = applyFieldSelection(overrides, 'publicationTitle', 'secondary-canonical');
      overrides = applyFieldSelection(overrides, 'authors', 'secondary-canonical');
      overrides = applyFieldSelection(overrides, 'publisher', 'secondary-canonical');

      expect(overrides.publicationTitle).toBe('TOCS');
      expect(overrides.publisher).toBe('ACM Press');
      expect(Object.keys(overrides)).toHaveLength(3);

      // 2. User clicks back onto the master item's option for `publicationTitle`, `authors`, and `publisher`
      // Even though masterPaper.publicationTitle is undefined (stored in masterPaper.journal) and masterPaper.authors is [] (stored in masterPaper.creators),
      // the alias-aware comparison recognizes it matches masterField.masterValue and removes the override!
      overrides = applyFieldSelection(overrides, 'publicationTitle', 'master-aliased');
      overrides = applyFieldSelection(overrides, 'authors', 'master-aliased');
      overrides = applyFieldSelection(overrides, 'publisher', 'master-aliased');

      expect(overrides).toEqual({});
    });
  });

  // ===========================================================================
  // Case Study 5: Project Library 4-Role Merge Governance (Personal vs Project Roles)
  // ===========================================================================
  describe('Case Study 5: Project Library 4-Role Merge Governance (Owner, Coordinator, Contributor, Reviewer)', () => {
    it('enforces exact RBAC merge and purge permissions across Personal and Project Library scopes', () => {
      // 1. Personal Library ('user'): Sovereign owner has full edit + delete (merge + permanent purge)
      const personalPerms = getLibraryPermissions({ type: 'user', id: 'user-lib-1' });
      expect(personalPerms.canEditItem).toBe(true);
      expect(personalPerms.canDeleteItem).toBe(true);

      // 2. Project Library - Owner: Can merge (canEditItem) AND permanently purge duplicates (canDeleteItem)
      const ownerPerms = getLibraryPermissions({
        type: 'project',
        id: 'proj-101',
        projectId: 'proj-101',
        role: 'owner',
      });
      expect(ownerPerms.canEditItem).toBe(true);
      expect(ownerPerms.canDeleteItem).toBe(true);

      // 3. Project Library - Coordinator: Can merge (canEditItem) AND permanently purge duplicates (canDeleteItem)
      const coordinatorPerms = getLibraryPermissions({
        type: 'project',
        id: 'proj-101',
        projectId: 'proj-101',
        role: 'coordinator',
      });
      expect(coordinatorPerms.canEditItem).toBe(true);
      expect(coordinatorPerms.canDeleteItem).toBe(true);

      // 4. Project Library - Contributor: Can merge metadata & soft-retire duplicates (canEditItem: true),
      //    but CANNOT permanently purge project records from trash (canDeleteItem: false)
      const contributorPerms = getLibraryPermissions({
        type: 'project',
        id: 'proj-101',
        projectId: 'proj-101',
        role: 'contributor',
      });
      expect(contributorPerms.canEditItem).toBe(true);
      expect(contributorPerms.canDeleteItem).toBe(false);

      // 5. Project Library - Reviewer: Read-only diff inspection; cannot execute merge or delete
      const reviewerPerms = getLibraryPermissions({
        type: 'project',
        id: 'proj-101',
        projectId: 'proj-101',
        role: 'reviewer',
      });
      expect(reviewerPerms.canRead).toBe(true);
      expect(reviewerPerms.canEditItem).toBe(false);
      expect(reviewerPerms.canDeleteItem).toBe(false);
    });
  });

  // ===========================================================================
  // Case Study 6: QualityService.getDuplicates Schema Normalization Preserving itemType
  // ===========================================================================
  describe('Case Study 6: QualityService.getDuplicates Schema Normalization Preserving itemType', () => {
    it('preserves heterogeneous itemType values (conferencePaper vs journalArticle) so DuplicateMergeInspector detects type mismatches', async () => {
      vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        clusters: [
          {
            clusterId: 'cluster-gnn-1',
            matchReason: 'EXACT_DOI',
            confidence: 1,
            items: [
              {
                id: 'item-conf-1',
                title: 'Distributed Graph Neural Networks on Billion-Edge Graphs',
                itemType: 'conferencePaper',
                year: 2023,
                doi: '10.1145/3581783.3612859',
                authors: ['Alice Chen', 'Bob Smith'],
              },
              {
                id: 'item-journal-1',
                title: 'Distributed Graph Neural Networks on Billion-Edge Graphs (Extended Journal Version)',
                itemType: 'journalArticle',
                year: 2024,
                doi: '10.1145/3581783.3612859',
                authors: ['Alice Chen', 'Bob Smith'],
              },
            ],
          },
        ],
      });

      const res = await QualityService.getDuplicates('proj-gnn');

      expect(res.duplicateGroups).toHaveLength(1);
      expect(res.duplicateGroups[0].items).toHaveLength(2);
      expect(res.duplicateGroups[0].items[0].itemType).toBe('conferencePaper');
      expect(res.duplicateGroups[0].items[1].itemType).toBe('journalArticle');

      // Verify that downstream type-mismatch detection in DuplicateMergeInspector / useDuplicateMergeState works accurately
      const distinctTypes = Array.from(
        new Set(res.duplicateGroups[0].items.map((i) => i.itemType).filter(Boolean)),
      );
      const hasTypeMismatch = distinctTypes.length > 1;
      expect(hasTypeMismatch).toBe(true);
      expect(distinctTypes).toEqual(['conferencePaper', 'journalArticle']);
    });
  });

  // ===========================================================================
  // Case Study 7: Cross-Type Merge Resolution (preprint + journalArticle Unification Without Blocking)
  // ===========================================================================
  describe('Case Study 7: Cross-Type Merge Resolution (preprint + journalArticle Unification Without Blocking)', () => {
    it('places itemType first in MERGEABLE_FIELDS, recommends journalArticle over preprint, and supplies itemType in fieldSelections without blocking merge', () => {
      // 1. itemType is the very first field in MERGEABLE_FIELDS
      expect(MERGEABLE_FIELDS[0]?.key).toBe('itemType');
      expect(scoreFieldCandidate('itemType', 'journalArticle')).toBeGreaterThan(
        scoreFieldCandidate('itemType', 'preprint'),
      );
      expect(scoreFieldCandidate('itemType', 'conferencePaper')).toBeGreaterThan(
        scoreFieldCandidate('itemType', 'document'),
      );

      const arxivPreprint = makeItem({
        id: 'preprint-llama',
        title: 'LLaMA: Open and Efficient Foundation Language Models',
        itemType: 'preprint',
        year: 2023,
        arxivId: '2302.13971',
        doi: '10.48550/arXiv.2302.13971',
        extra: 'arXiv: 2302.13971 [cs.CL]',
      });

      const publishedJournal = makeItem({
        id: 'journal-llama',
        title: 'LLaMA: Open and Efficient Foundation Language Models',
        itemType: 'journalArticle',
        year: 2024,
        doi: '10.1145/3650000.3650111',
        publicationTitle: 'Journal of Machine Learning Research',
        volume: '25',
        pages: '1-42',
        extra: 'PMID: 38991122',
      });

      // Even if user selected the preprint as master initially, inspectItemDifferences flags itemType conflict and recommends journalArticle
      const diffFromPreprintMaster = inspectItemDifferences(
        [arxivPreprint, publishedJournal],
        'preprint-llama',
      );
      const itemTypeField = diffFromPreprintMaster.fields.find((f) => f.key === 'itemType');
      expect(itemTypeField).toBeDefined();
      expect(itemTypeField?.hasConflict).toBe(true);
      expect(itemTypeField?.recommendedItemId).toBe('journal-llama');
      expect(itemTypeField?.recommendedValue).toBe('journalArticle');

      // Interactive hook pre-selects publishedJournal as master AND supplies itemType + merged extra in getEffectiveMergeSelections()
      const { result } = renderHook(() =>
        useDuplicateMergeState([arxivPreprint, publishedJournal]),
      );
      expect(result.current.selectedMasterId).toBe('journal-llama');
      expect(result.current.hasTypeMismatch).toBe(true);
      expect(result.current.effectiveItemType).toBe('journalArticle');

      const effectiveSelections = result.current.getEffectiveMergeSelections();
      expect(effectiveSelections.itemType).toBe('journalArticle');
      expect(String(effectiveSelections.extra)).toContain('PMID: 38991122');
      expect(String(effectiveSelections.extra)).toContain('arXiv: 2302.13971 [cs.CL]');

      // If user switches master to preprint-llama and clicks "Recommend Best", itemType is overridden to 'journalArticle'
      act(() => {
        result.current.handleSelectMaster('preprint-llama');
      });
      expect(result.current.selectedMasterId).toBe('preprint-llama');
      act(() => {
        result.current.handleAutoRecommend();
      });
      expect(result.current.fieldOverrides.itemType).toBe('journalArticle');
      expect(result.current.effectiveItemType).toBe('journalArticle');
      expect(result.current.getEffectiveMergeSelections().itemType).toBe('journalArticle');
    });
  });

  // ===========================================================================
  // Case Study 8: "Not Duplicates" End-to-End Dismissal via QualityService.dismissDuplicates
  // ===========================================================================
  describe('Case Study 8: "Not Duplicates" End-to-End Dismissal via QualityService.dismissDuplicates', () => {
    it('posts to the canonical Personal and Project curation/duplicates/dismiss endpoints with itemIds', async () => {
      const postSpy = vi
        .spyOn(api, 'apiPost')
        .mockResolvedValue({ dismissed: true, itemIds: ['part-1', 'part-2'] });

      // 1. Personal Library scope ('user')
      const personalRes = await QualityService.dismissDuplicates('user', ['part-1', 'part-2']);
      expect(personalRes).toEqual({ dismissed: true, itemIds: ['part-1', 'part-2'] });
      expect(postSpy).toHaveBeenNthCalledWith(
        1,
        '/api/v1/library/curation/duplicates/dismiss',
        { itemIds: ['part-1', 'part-2'] },
      );

      // 2. Project Library scope ('proj-systematic-review')
      const projectRes = await QualityService.dismissDuplicates('proj-systematic-review', [
        'part-1',
        'part-2',
      ]);
      expect(projectRes).toEqual({ dismissed: true, itemIds: ['part-1', 'part-2'] });
      expect(postSpy).toHaveBeenNthCalledWith(
        2,
        '/api/v1/projects/proj-systematic-review/library/curation/duplicates/dismiss',
        { itemIds: ['part-1', 'part-2'] },
      );
    });
  });

  // ===========================================================================
  // Case Study 9: Multi-Database Systematic Review Cluster (PubMed + Scopus + Embase + arXiv 4-Way Diff & Recommend Best)
  // ===========================================================================
  describe('Case Study 9: Multi-Database Systematic Review Cluster (PubMed + Scopus + Embase + arXiv 4-Way Diff)', () => {
    it('synthesizes the richest metadata and assets across 4 database imports (Bramer/Deduklick systematic review benchmark)', () => {
      const pubmedRecord = makeItem({
        id: 'sr-pubmed',
        title: 'Deep Learning for Early Sepsis Prediction in Intensive Care Units',
        itemType: 'journalArticle',
        authors: [
          { firstName: 'Sarah', lastName: 'Conner' },
          { firstName: 'David', lastName: 'Kim' },
        ],
        year: 2024,
        publicationTitle: 'Lancet Digital Health',
        pmid: '38445566',
        citationKey: 'conner2024pubmed',
        extra: 'PMID: 38445566\nPMCID: PMC10998877',
        tags: ['mesh:sepsis', 'mesh:intensive-care'],
        collections: ['col-pubmed-import'],
      });

      const scopusRecord = makeItem({
        id: 'sr-scopus',
        title: 'Deep Learning for Early Sepsis Prediction in Intensive Care Units: A Multicenter Study',
        itemType: 'journalArticle',
        authors: [
          { firstName: 'Sarah', lastName: 'Conner' },
          { firstName: 'David', lastName: 'Kim' },
          { firstName: 'Elena', lastName: 'Rostova' },
          { firstName: 'Marcus', lastName: 'Vance' },
        ],
        year: 2024,
        publicationTitle: 'The Lancet Digital Health',
        doi: '10.1016/S2589-7500(24)00042-9',
        abstractNote:
          'Background: Sepsis remains a leading cause of mortality in intensive care units worldwide. Methods: We trained and externally validated a temporal transformer across 148,000 ICU admissions in 12 hospitals. Findings: The model achieved an AUROC of 0.91 four hours prior to clinical onset.',
        citationKey: 'conner2024scopus',
        tags: ['scopus-export', 'multicenter-cohort'],
        collections: ['col-scopus-import'],
      });

      const embaseRecord = makeItem({
        id: 'sr-embase',
        title: 'Deep Learning for Early Sepsis Prediction in Intensive Care Units',
        itemType: 'journalArticle',
        authors: [
          { firstName: 'S.', lastName: 'Conner' },
          { firstName: 'D.', lastName: 'Kim' },
        ],
        year: 2024,
        publicationTitle: 'Lancet Digit. Health',
        volume: '6',
        issue: '5',
        pages: 'e312-e324',
        publisher: 'Elsevier Ltd',
        issn: '2589-7500',
        extra: 'Embase Accession: 2029384756',
        tags: ['emtree:sepsis', 'clinical-trial'],
        collections: ['col-embase-import'],
      });

      const arxivRecord = makeItem({
        id: 'sr-arxiv',
        title: 'Deep Learning for Early Sepsis Prediction in Intensive Care Units',
        itemType: 'preprint',
        authors: [
          { firstName: 'Sarah', lastName: 'Conner' },
          { firstName: 'David', lastName: 'Kim' },
          { firstName: 'Elena', lastName: 'Rostova' },
        ],
        year: 2023,
        arxivId: '2311.09988',
        doi: '10.48550/arXiv.2311.09988',
        citationKey: 'conner2023arxiv',
        tags: ['preprint'],
        notes: [{ id: 'note-sr-1', content: 'Includes appendix with hyperparameter sensitivity grid.' }],
        attachments: [
          {
            id: 'att-sr-1',
            name: 'Sepsis_Transformer_Preprint.pdf',
            fileHash: 'sha256:abcd1234',
            annotations: [{ id: 'ann-sr-1', type: 'highlight', color: '#ffd400', page: 2 }],
          } as Item['attachments'][number],
        ],
      });

      const cluster = [pubmedRecord, scopusRecord, embaseRecord, arxivRecord];
      const { result } = renderHook(() => useDuplicateMergeState(cluster));

      // Auto-recommend picks the richest values from each of the 4 databases
      act(() => {
        result.current.handleAutoRecommend();
      });

      const payload = buildMergedItemPayload(
        cluster,
        result.current.selectedMasterId,
        result.current.getEffectiveMergeSelections(),
      );

      // Richer title & 4-author list & structured abstract & canonical DOI from Scopus
      expect(payload.resolvedFields.title).toBe(scopusRecord.title);
      expect((payload.resolvedFields.authors as unknown[]).length).toBe(4);
      expect(payload.resolvedFields.doi).toBe('10.1016/S2589-7500(24)00042-9');
      expect(payload.resolvedFields.abstract).toContain('148,000 ICU admissions');
      // Volume, issue, pages, publisher, issn from Embase
      expect(payload.resolvedFields.volume).toBe('6');
      expect(payload.resolvedFields.issue).toBe('5');
      expect(payload.resolvedFields.pages).toBe('e312-e324');
      expect(payload.resolvedFields.publisher).toBe('Elsevier Ltd');
      expect(payload.resolvedFields.issn).toBe('2589-7500');
      // PMID from PubMed & arXiv ID from arXiv
      expect(payload.resolvedFields.pmid).toBe('38445566');
      expect(payload.resolvedFields.arxivId).toBe('2311.09988');
      // Non-destructively merged Extra field contains PMID, PMCID, Embase Accession, and tex.ids aliases
      const extraStr = String(payload.resolvedFields.extra);
      expect(extraStr).toContain('PMID: 38445566');
      expect(extraStr).toContain('PMCID: PMC10998877');
      expect(extraStr).toContain('Embase Accession: 2029384756');
      expect(extraStr).toContain('tex.ids:');
      // All 7 unique tags across the 4 databases + 3 collections + 1 PDF + 1 annotation preserved
      expect(payload.tags).toHaveLength(7);
      expect(payload.collectionIds).toHaveLength(3);
      expect(payload.uniqueAttachmentCount).toBe(1);
      expect(payload.totalAnnotationCount).toBe(1);
    });
  });

  // ===========================================================================
  // Case Study 10: Zoplicate Master Selection Strategies (Smart Published vs Oldest createdAt vs Newest createdAt)
  // ===========================================================================
  describe('Case Study 10: Zoplicate Master Selection Strategies (Smart vs Oldest vs Newest)', () => {
    it('supports smart completeness/publication scoring as well as Zoplicate oldest and newest createdAt strategies', () => {
      const oldestPreprint = makeItem({
        id: 'item-2022-oldest',
        title: 'Scaling Laws for Neural Language Models',
        itemType: 'preprint',
        year: 2020,
        arxivId: '2001.08361',
        createdAt: '2022-01-10T08:00:00.000Z',
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const middlePublishedRichest = makeItem({
        id: 'item-2023-published',
        title: 'Scaling Laws for Neural Language Models',
        itemType: 'journalArticle',
        year: 2021,
        doi: '10.1000/jmlr.2021.08361',
        publicationTitle: 'Journal of Machine Learning Research',
        volume: '22',
        issue: '1',
        pages: '1-30',
        abstractNote: 'Comprehensive empirical study of power-law scaling of Transformer cross-entropy loss.',
        createdAt: '2023-06-15T12:00:00.000Z',
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const newestSparseImport = makeItem({
        id: 'item-2025-newest',
        title: 'Scaling Laws for Neural Language Models',
        itemType: 'journalArticle',
        year: 2021,
        createdAt: '2025-02-20T19:30:00.000Z',
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const candidates = [oldestPreprint, middlePublishedRichest, newestSparseImport];

      // 1. Default 'smart' strategy selects the richest peer-reviewed published record
      expect(selectBestMasterItemId(candidates, 'smart')).toBe('item-2023-published');
      expect(selectBestMasterItemId(candidates)).toBe('item-2023-published');

      // 2. Zoplicate 'oldest' strategy selects the earliest createdAt record (preserving earliest item URI/citation links)
      expect(selectBestMasterItemId(candidates, 'oldest')).toBe('item-2022-oldest');

      // 3. Zoplicate 'newest' strategy selects the most recently imported record
      expect(selectBestMasterItemId(candidates, 'newest')).toBe('item-2025-newest');

      // 4. Tie-breaker in 'smart' mode: when two items have identical completeness scores, prefers the older createdAt record
      const equalOlder = makeItem({
        id: 'tie-older',
        title: 'Identical Completeness Paper',
        itemType: 'journalArticle',
        doi: '10.1000/tie.1',
        createdAt: '2023-01-01T00:00:00.000Z',
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const equalNewer = makeItem({
        id: 'tie-newer',
        title: 'Identical Completeness Paper',
        itemType: 'journalArticle',
        doi: '10.1000/tie.1',
        createdAt: '2024-01-01T00:00:00.000Z',
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      expect(selectBestMasterItemId([equalNewer, equalOlder], 'smart')).toBe('tie-older');
    });
  });

  // ===========================================================================
  // Case Study 11: Retracted Duplicate Penalty & Cross-Edition Chapter/Conference Distinction
  // ===========================================================================
  describe('Case Study 11: Retracted Duplicate Penalty & Non-Destructive Extra Override', () => {
    it('never selects a retracted record as master over a valid record and respects explicit user extra overrides', () => {
      const retractedCopy = makeItem({
        id: 'retracted-copy',
        title: ' High-Temperature Superconductivity in Hydrides',
        itemType: 'journalArticle',
        year: 2020,
        doi: '10.1038/s41586-020-2801-z',
        publicationTitle: 'Nature',
        volume: '586',
        pages: '373-377',
        abstractNote: 'Detailed abstract on carbonaceous sulfur hydride.',
        isRetracted: true,
      } as Partial<Item> & { id: string; title: string } & Record<string, unknown>);

      const validReplacement = makeItem({
        id: 'valid-copy',
        title: 'High-Temperature Superconductivity in Hydrides (Corrected Analysis)',
        itemType: 'journalArticle',
        year: 2024,
        doi: '10.1038/s41586-024-0001-z',
        publicationTitle: 'Nature',
      });

      // Even though retractedCopy has more fields populated (volume, pages, abstract), smart master selection heavily penalizes retracted items
      expect(selectBestMasterItemId([retractedCopy, validReplacement])).toBe('valid-copy');

      // And if user explicitly overrides `extra`, buildMergedItemPayload respects the user's explicit override
      const customPayload = buildMergedItemPayload(
        [retractedCopy, validReplacement],
        'valid-copy',
        { extra: 'Custom Curated Note: Verified 2024 reanalysis' },
      );
      expect(customPayload.resolvedFields.extra).toBe(
        'Custom Curated Note: Verified 2024 reanalysis',
      );
    });
  });
});


