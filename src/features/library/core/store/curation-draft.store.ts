export {
  type DuplicateGroupMergeDraft,
  groupMergeDraftCache,
  getGroupMergeDraft,
  setGroupMergeDraft,
  clearGroupMergeDraft,
  computeDuplicateSetKey,
  getOrInitDraft,
  updateGroupDraft,
  subscribeToDrafts,
  notifyDraftListeners,
} from '@/features/library/domain/curation-draft.domain';
