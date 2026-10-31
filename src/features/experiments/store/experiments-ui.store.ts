import { create } from 'zustand';
import {
  MOCK_EXPERIMENT_RUNS,
  MOCK_DATASETS,
  MOCK_CHECKPOINTS,
  MOCK_EXPERIMENT_GROUPS,
  MOCK_PROTOCOLS,
  MOCK_SWEEP,
  MOCK_REPRO_CAPSULE,
  type ExperimentRun,
  type DatasetArtifact,
  type CheckpointArtifact,
  type ExperimentGroup,
  type ResearchProtocol,
  type HyperparameterSweep,
  type ReproCapsule,
} from '../data/mock-experiments.data';

export type ExperimentsViewId =
  | 'all-runs'
  | 'compare-runs'
  | 'sweeps'
  | 'protocols'
  | 'reproducibility'
  | 'raw-corpus'
  | 'checkpoints'
  | 'notebooks'
  | 'exp-01'
  | 'exp-02'
  | 'exp-03'
  | 'exp-04'
  | 'trash';

export type ExperimentsSubMode = 'table' | 'charts';

export type ExperimentsInspectorTab =
  | 'overview'
  | 'params'
  | 'metrics'
  | 'lineage'
  | 'artifacts'
  | 'logs'
  | 'notes';

export interface ExperimentsDisplayOptions {
  columns: {
    status: boolean;
    experiment: boolean;
    model: boolean;
    dataset: boolean;
    f1: boolean;
    bleu: boolean;
    loss: boolean;
    duration: boolean;
    updatedAt: boolean;
  };
  orderBy: 'id' | 'f1' | 'bleu' | 'loss' | 'updatedAt';
  orderDirection: 'asc' | 'desc';
}

export const DEFAULT_EXPERIMENTS_DISPLAY_OPTIONS: ExperimentsDisplayOptions = {
  columns: {
    status: true,
    experiment: true,
    model: true,
    dataset: true,
    f1: true,
    bleu: true,
    loss: true,
    duration: true,
    updatedAt: true,
  },
  orderBy: 'id',
  orderDirection: 'desc',
};

interface ExperimentsUIState {
  activeView: ExperimentsViewId;
  setActiveView: (view: ExperimentsViewId) => void;

  subMode: ExperimentsSubMode;
  setSubMode: (mode: ExperimentsSubMode) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  isInspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  inspectorWidth: number;
  setInspectorWidth: (width: number) => void;
  activeInspectorTab: ExperimentsInspectorTab;
  setActiveInspectorTab: (tab: ExperimentsInspectorTab) => void;

  sidebarSearchQuery: string;
  setSidebarSearchQuery: (q: string) => void;

  topbarSearchQuery: string;
  setTopbarSearchQuery: (q: string) => void;

  statusFilter: string | null;
  setStatusFilter: (status: string | null) => void;
  deviceFilter: string | null;
  setDeviceFilter: (device: string | null) => void;

  displayOptions: ExperimentsDisplayOptions;
  setDisplayOptions: (options: ExperimentsDisplayOptions) => void;

  selectedRunId: string;
  setSelectedRunId: (id: string) => void;
  checkedRunIds: string[];
  toggleCheckRun: (id: string) => void;
  selectAllRuns: (ids: string[]) => void;
  clearCheckedRuns: () => void;

  previewArtifactName: string | null;
  setPreviewArtifactName: (name: string | null) => void;
  isLogRunModalOpen: boolean;
  setLogRunModalOpen: (open: boolean) => void;
  isLatexModalOpen: boolean;
  setLatexModalOpen: (open: boolean) => void;

  runs: ExperimentRun[];
  datasets: DatasetArtifact[];
  checkpoints: CheckpointArtifact[];
  groups: ExperimentGroup[];
  protocols: ResearchProtocol[];
  sweep: HyperparameterSweep;
  capsule: ReproCapsule;

  toggleStarRun: (id: string) => void;
  addRun: (run: ExperimentRun) => void;
  addExperimentGroup: (group: ExperimentGroup) => void;
  updateRunNotes: (id: string, notes: string) => void;
  deleteRun: (id: string) => void;
  restoreRun: (id: string) => void;
  emptyTrash: () => void;
  toggleProtocolStep: (protocolId: string, stepNumber: number) => void;
}

export const useExperimentsUIStore = create<ExperimentsUIState>((set) => ({
  activeView: 'exp-01',
  setActiveView: (view) => set({ activeView: view }),

  subMode: 'table',
  setSubMode: (mode) => set({ subMode: mode }),

  isSidebarOpen: true,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  sidebarWidth: 240,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(400, Math.max(200, width)) }),

  isInspectorOpen: true,
  setInspectorOpen: (open) => set({ isInspectorOpen: open }),
  toggleInspector: () => set((s) => ({ isInspectorOpen: !s.isInspectorOpen })),
  inspectorWidth: 320,
  setInspectorWidth: (width) => set({ inspectorWidth: Math.min(560, Math.max(260, width)) }),
  activeInspectorTab: 'overview',
  setActiveInspectorTab: (tab) => set({ activeInspectorTab: tab }),

  sidebarSearchQuery: '',
  setSidebarSearchQuery: (q) => set({ sidebarSearchQuery: q }),

  topbarSearchQuery: '',
  setTopbarSearchQuery: (q) => set({ topbarSearchQuery: q }),

  statusFilter: null,
  setStatusFilter: (status) => set({ statusFilter: status }),
  deviceFilter: null,
  setDeviceFilter: (device) => set({ deviceFilter: device }),

  displayOptions: DEFAULT_EXPERIMENTS_DISPLAY_OPTIONS,
  setDisplayOptions: (options) => set({ displayOptions: options }),

  selectedRunId: 'run-042',
  setSelectedRunId: (id) => set({ selectedRunId: id }),
  checkedRunIds: ['run-042', 'run-039', 'run-031'],
  toggleCheckRun: (id) =>
    set((s) => ({
      checkedRunIds: s.checkedRunIds.includes(id)
        ? s.checkedRunIds.filter((item) => item !== id)
        : [...s.checkedRunIds, id],
    })),
  selectAllRuns: (ids) => set({ checkedRunIds: ids }),
  clearCheckedRuns: () => set({ checkedRunIds: [] }),

  previewArtifactName: null,
  setPreviewArtifactName: (name) => set({ previewArtifactName: name }),
  isLogRunModalOpen: false,
  setLogRunModalOpen: (open) => set({ isLogRunModalOpen: open }),
  isLatexModalOpen: false,
  setLatexModalOpen: (open) => set({ isLatexModalOpen: open }),

  runs: MOCK_EXPERIMENT_RUNS,
  datasets: MOCK_DATASETS,
  checkpoints: MOCK_CHECKPOINTS,
  groups: MOCK_EXPERIMENT_GROUPS,
  protocols: MOCK_PROTOCOLS,
  sweep: MOCK_SWEEP,
  capsule: MOCK_REPRO_CAPSULE,

  toggleStarRun: (id) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === id ? { ...r, isStarred: !r.isStarred } : r)),
    })),
  addRun: (run) =>
    set((s) => ({
      runs: [run, ...s.runs],
      selectedRunId: run.id,
    })),
  addExperimentGroup: (group) =>
    set((s) => ({
      groups: [...s.groups, group],
    })),
  updateRunNotes: (id, notes) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === id ? { ...r, notes } : r)),
    })),
  deleteRun: (id) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === id ? { ...r, isDeleted: true } : r)),
    })),
  restoreRun: (id) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === id ? { ...r, isDeleted: false } : r)),
    })),
  emptyTrash: () =>
    set((s) => ({
      runs: s.runs.filter((r) => !r.isDeleted),
      checkedRunIds: [],
    })),
  toggleProtocolStep: (protocolId, stepNumber) =>
    set((s) => ({
      protocols: s.protocols.map((p) =>
        p.id !== protocolId
          ? p
          : {
              ...p,
              steps: p.steps.map((st) =>
                st.stepNumber === stepNumber
                  ? { ...st, isVerified: !st.isVerified }
                  : st,
              ),
            },
      ),
    })),
}));
