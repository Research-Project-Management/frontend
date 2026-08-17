// ── settings/index.ts ─────────────────────────────────────────────────────────
// Settings feature public API.

// ── Modals ──
export { DeleteModal } from './components/modal/DeleteModal';
export { InviteModal, InviteDialog } from './components/modal/InviteModal';
export { ImportModal } from './components/modal/ImportModal';

// ── Layout ──
export { SideBar } from './components/layout/SideBar';
export { TopBar } from './components/layout/TopBar';

// ── Member Components ──
export { MemberItem } from './components/member/Item';
export { MemberFilter } from './components/member/Filter';
export { PendingInvites } from './components/member/Pending';
export { Sortable, SortableHeader } from './components/member/Sortable';

// ── General Components ──
export { AvatarSection } from './components/general/AvatarSection';
export { GeneralForm } from './components/general/GeneralForm';
export { DangerZone } from './components/general/DangerZone';

// ── Pages ──
export { default as GeneralPage } from './pages/GeneralPage';
export { default as MemberPage } from './pages/MemberPage';

// ── Hooks ──
export { useMember } from './hooks/use-member';
export { useGeneral } from './hooks/use-general';

// ── Services & Types ──
export * from './services/settings.service';
export * from './types/member.types';
export * from './types/settings.types';
