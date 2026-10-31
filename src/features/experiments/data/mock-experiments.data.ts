export type RunStatus = 'completed' | 'running' | 'failed';

export interface ExperimentArtifactItem {
  id: string;
  name: string;
  size: string;
  type: 'hdf5' | 'csv' | 'ipynb' | 'json' | 'log';
}

export interface ExperimentRun {
  id: string;
  name: string;
  experimentId: 'exp-01' | 'exp-02' | 'exp-03' | 'exp-04' | string;
  experimentName: string;
  status: RunStatus;
  model: string;
  dataset: string;
  datasetSha: string;
  gitBranch: string;
  gitCommit: string;
  protocolId: string;
  capsuleId: string;
  device: string;
  f1: number | null;
  f1Delta?: string;
  bleu: number | null;
  loss: number | null;
  duration: string;
  updatedAt: string;
  author: string;
  isStarred?: boolean;
  isBaseline?: boolean;
  isSota?: boolean;
  isDeleted?: boolean;
  notes: string;
  hyperparameters: {
    backbone: string;
    learningRate: string;
    batchSize: string;
    optimizer: string;
    warmupRatio: string;
    maxSeqLen: string;
    seed: number;
    dropout: string;
  };
  lossCurve: number[];
  valF1Curve: number[];
  stdoutLogs: string[];
  artifacts: ExperimentArtifactItem[];
}

export interface DatasetArtifact {
  id: string;
  name: string;
  version: string;
  format: 'CSV' | 'Parquet' | 'JSONL' | 'HDF5';
  rows: string;
  size: string;
  sha256: string;
  linkedRunsCount: number;
  updatedAt: string;
  description: string;
}

export interface CheckpointArtifact {
  id: string;
  name: string;
  runId: string;
  experimentId: string;
  architecture: string;
  format: 'Safetensors' | 'HDF5' | 'ONNX' | 'PyTorch';
  size: string;
  f1Score: number;
  stage: 'Production' | 'Staging' | 'Archived';
  updatedAt: string;
}

export interface ExperimentGroup {
  id: string;
  code: string;
  name: string;
  hypothesis: string;
  paperRef?: string;
  protocolRef?: string;
  runsCount: number;
}

export interface ProtocolStep {
  stepNumber: number;
  title: string;
  duration: string;
  commandOrAction: string;
  expectedOutput: string;
  isVerified: boolean;
}

export interface ResearchProtocol {
  id: string;
  code: string;
  title: string;
  version: string;
  doi: string;
  author: string;
  linkedExperimentId: string;
  updatedAt: string;
  abstract: string;
  steps: ProtocolStep[];
}

export interface SweepTrial {
  trialId: string;
  runId: string;
  learningRate: string;
  loraRank: number;
  warmupRatio: number;
  batchSize: number;
  dropout: number;
  valF1: number;
  evalLoss: number;
  status: 'completed' | 'early_stopped' | 'running';
}

export interface HyperparameterSweep {
  id: string;
  name: string;
  method: 'Bayesian Optimization' | 'Hyperband Early-Stop' | 'Grid Search';
  objective: 'Maximize Test F1';
  totalTrials: number;
  bestRunId: string;
  bestF1: number;
  parameterImportance: Array<{
    param: string;
    correlation: number;
    impact: 'positive' | 'negative';
  }>;
  trials: SweepTrial[];
}

export interface ReproCapsule {
  id: string;
  name: string;
  linkedRunId: string;
  dockerDigest: string;
  baseImage: string;
  cudaVersion: string;
  pythonVersion: string;
  dvcStages: Array<{
    stage: string;
    cmd: string;
    deps: string[];
    outs: string[];
    md5: string;
  }>;
  packages: string[];
  reproCommand: string;
}

export const MOCK_EXPERIMENT_GROUPS: ExperimentGroup[] = [
  {
    id: 'exp-01',
    code: 'EXP-01',
    name: 'EXP-01: Baseline Transformers',
    hypothesis:
      'Cross-attention with syntactic dependency masks improves low-resource F1 by >2.0% over vanilla PhoBERT-large.',
    paperRef: 'Table 2',
    protocolRef: 'SOP-01',
    runsCount: 6,
  },
  {
    id: 'exp-02',
    code: 'EXP-02',
    name: 'EXP-02: Contrastive Reranker',
    hypothesis:
      'Hard-negative mining with BM25 and dense bi-encoder reduces false positives on multi-hop Vietnamese QA.',
    paperRef: 'Section 4.1',
    protocolRef: 'SOP-02',
    runsCount: 2,
  },
  {
    id: 'exp-03',
    code: 'EXP-03',
    name: 'EXP-03: Low-Resource Finetune',
    hypothesis:
      'LoRA rank 16 with NEFTune noise alpha 5 prevents overfitting on 5k clinical annotated samples.',
    paperRef: 'Section 4.2',
    protocolRef: 'SOP-03',
    runsCount: 2,
  },
  {
    id: 'exp-04',
    code: 'EXP-04',
    name: 'EXP-04: Positional Scaling Ablation',
    hypothesis:
      'Removing positional rotary scaling degrades long-context citation extraction accuracy.',
    paperRef: 'Table 4',
    protocolRef: 'SOP-01',
    runsCount: 2,
  },
];

export const MOCK_EXPERIMENT_RUNS: ExperimentRun[] = [
  {
    id: 'run-042',
    name: 'phobert-large-cross-attn-v2',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'completed',
    model: 'PhoBERT-large + CrossAttn',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'main',
    gitCommit: '8f3a9d1',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '2x A100 80GB',
    f1: 89.42,
    f1Delta: '+2.32%',
    bleu: 44.18,
    loss: 0.1842,
    duration: '1h 18m',
    updatedAt: '12 mins ago',
    author: 'Khoa Nguyen',
    isStarred: true,
    isSota: true,
    notes:
      'Best checkpoint for Table 2. Converged at epoch 12 after enabling syntactic dependency mask.',
    hyperparameters: {
      backbone: 'vinai/phobert-large',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.06',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.42, 0.96, 0.68, 0.49, 0.36, 0.27, 0.22, 0.184],
    valF1Curve: [71.4, 78.2, 82.9, 85.6, 87.3, 88.5, 89.1, 89.42],
    stdoutLogs: [
      '[2026-10-31 08:12:04] INFO | Initialized distributed process group world_size=2',
      '[2026-10-31 08:12:09] INFO | Verified dataset vi-academic-corpus-v2.csv sha256:9f84c2a1b0e7',
      '[2026-10-31 08:12:15] INFO | Loaded backbone vinai/phobert-large with syntactic_mask=True',
      '[2026-10-31 08:28:40] EVAL | Epoch 04/12 | train_loss=0.4910 | val_loss=0.3102 | val_f1=85.60%',
      '[2026-10-31 08:54:12] EVAL | Epoch 08/12 | train_loss=0.2714 | val_loss=0.2140 | val_f1=88.50%',
      '[2026-10-31 09:30:19] EVAL | Epoch 12/12 | train_loss=0.1842 | val_loss=0.1842 | val_f1=89.42%',
      '[2026-10-31 09:30:22] SAVE | Saved checkpoint best_checkpoint_ep12.h5',
    ],
    artifacts: [
      {
        id: 'art-1',
        name: 'best_checkpoint_ep12.h5',
        size: '1.42 GB',
        type: 'hdf5',
      },
      {
        id: 'art-2',
        name: 'eval_predictions_test.csv',
        size: '4.8 MB',
        type: 'csv',
      },
      {
        id: 'art-3',
        name: 'ablation_attention_viz.ipynb',
        size: '842 KB',
        type: 'ipynb',
      },
      {
        id: 'art-4',
        name: 'training_metrics_step.json',
        size: '128 KB',
        type: 'json',
      },
    ],
  },
  {
    id: 'run-041',
    name: 'xlmr-base-reranker-warmup',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'running',
    model: 'XLM-RoBERTa-base',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'feat/xlmr-rerank',
    gitCommit: '3c7e11b',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '2x A100 80GB',
    f1: 87.91,
    f1Delta: '+0.81%',
    bleu: 42.05,
    loss: 0.231,
    duration: '46m',
    updatedAt: 'Just now',
    author: 'Khoa Nguyen',
    isStarred: false,
    notes:
      'Running epoch 9 of 15. Validation F1 tracks above standard XLM-R baseline.',
    hyperparameters: {
      backbone: 'FacebookAI/xlm-roberta-base',
      learningRate: '3e-5',
      batchSize: '64',
      optimizer: 'AdamW',
      warmupRatio: '0.10',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.65, 1.12, 0.81, 0.59, 0.42, 0.34, 0.28, 0.231],
    valF1Curve: [68.0, 74.5, 79.8, 83.1, 85.0, 86.4, 87.2, 87.91],
    stdoutLogs: [
      '[2026-10-31 09:35:00] INFO | Starting run-041 on FacebookAI/xlm-roberta-base',
      '[2026-10-31 09:58:14] EVAL | Epoch 06/15 | train_loss=0.3412 | val_f1=86.40%',
      '[2026-10-31 10:21:05] EVAL | Epoch 09/15 | train_loss=0.2310 | val_f1=87.91%',
    ],
    artifacts: [
      {
        id: 'art-5',
        name: 'checkpoint_latest_ep9.h5',
        size: '1.10 GB',
        type: 'hdf5',
      },
      {
        id: 'art-6',
        name: 'live_validation_log.csv',
        size: '1.9 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-039',
    name: 'phobert-base-vanilla-seed42',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'completed',
    model: 'PhoBERT-base',
    dataset: 'vi-academic-corpus-v1.csv',
    datasetSha: 'sha256:4a11e8b3c201',
    gitBranch: 'main',
    gitCommit: '1a9c04e',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '1x A100 80GB',
    f1: 87.1,
    f1Delta: '0.00%',
    bleu: 41.62,
    loss: 0.2604,
    duration: '52m',
    updatedAt: '3 hours ago',
    author: 'Khoa Nguyen',
    isStarred: true,
    isBaseline: true,
    notes:
      'Reference baseline model used across all ablation tables in Section 4.',
    hyperparameters: {
      backbone: 'vinai/phobert-base-v2',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.05',
      maxSeqLen: '256',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.58, 1.09, 0.79, 0.56, 0.43, 0.34, 0.29, 0.26],
    valF1Curve: [69.2, 75.8, 80.4, 83.2, 85.1, 86.2, 86.8, 87.1],
    stdoutLogs: [
      '[2026-10-31 06:10:11] INFO | Baseline reproduction run-039 initialized with seed=42',
      '[2026-10-31 07:02:44] DONE | Final Test F1=87.10% | BLEU=41.62 | Loss=0.2604',
    ],
    artifacts: [
      {
        id: 'art-7',
        name: 'baseline_phobert_base.h5',
        size: '540 MB',
        type: 'hdf5',
      },
      {
        id: 'art-8',
        name: 'baseline_eval_report.csv',
        size: '3.2 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-036',
    name: 'bge-m3-dense-contrastive-temp02',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'completed',
    model: 'BGE-M3 + LoRA',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'feat/bge-lora',
    gitCommit: '6d2e89a',
    protocolId: 'prot-02',
    capsuleId: 'cap-02',
    device: '2x A100 80GB',
    f1: 88.64,
    f1Delta: '+1.54%',
    bleu: 43.1,
    loss: 0.2015,
    duration: '1h 04m',
    updatedAt: 'Yesterday',
    author: 'Minh Tran',
    isStarred: false,
    notes:
      'High retrieval recall@10 at 94.2%, slightly lower exact span F1 than PhoBERT-large CrossAttn.',
    hyperparameters: {
      backbone: 'BAAI/bge-m3',
      learningRate: '1e-4',
      batchSize: '64',
      optimizer: 'AdamW 8-bit',
      warmupRatio: '0.05',
      maxSeqLen: '1024',
      seed: 100,
      dropout: '0.05',
    },
    lossCurve: [1.48, 0.99, 0.71, 0.52, 0.39, 0.29, 0.23, 0.201],
    valF1Curve: [70.5, 77.4, 82.0, 85.1, 86.9, 87.8, 88.3, 88.64],
    stdoutLogs: [
      '[2026-10-30 14:20:00] INFO | Attached LoRA adapter r=16 alpha=32 to BAAI/bge-m3',
      '[2026-10-30 15:24:12] DONE | Final Test F1=88.64% | Recall@10=94.20%',
    ],
    artifacts: [
      {
        id: 'art-9',
        name: 'bge_m3_lora_adapter.h5',
        size: '168 MB',
        type: 'hdf5',
      },
      {
        id: 'art-10',
        name: 'retrieval_rankings.csv',
        size: '6.1 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-033',
    name: 'mt5-large-seq2seq-fp16-oom',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'failed',
    model: 'mT5-large',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'exp/mt5-seq2seq',
    gitCommit: '0b4f12c',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '1x RTX 4090',
    f1: null,
    bleu: null,
    loss: 1.842,
    duration: '14m',
    updatedAt: '2 days ago',
    author: 'Minh Tran',
    isStarred: false,
    notes:
      'CUDA OutOfMemoryError at step 1,420 when decoding long citation contexts without gradient checkpointing.',
    hyperparameters: {
      backbone: 'google/mt5-large',
      learningRate: '5e-5',
      batchSize: '16',
      optimizer: 'Adafactor',
      warmupRatio: '0.0',
      maxSeqLen: '1024',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [2.85, 2.41, 2.09, 1.842],
    valF1Curve: [42.1, 51.0, 56.4, 58.2],
    stdoutLogs: [
      '[2026-10-29 11:02:10] WARN | High VRAM allocation detected: 23.4 / 24.0 GB on RTX 4090',
      '[2026-10-29 11:16:04] ERROR | torch.cuda.OutOfMemoryError: CUDA out of memory at step 1420',
    ],
    artifacts: [
      {
        id: 'art-11',
        name: 'crash_traceback_cuda.csv',
        size: '42 KB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-031',
    name: 'phobert-large-no-syntactic-mask',
    experimentId: 'exp-01',
    experimentName: 'EXP-01: Baseline Transformers',
    status: 'completed',
    model: 'PhoBERT-large No-Mask',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'main',
    gitCommit: '5e19a7c',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '2x A100 80GB',
    f1: 87.85,
    f1Delta: '+0.75%',
    bleu: 42.4,
    loss: 0.2289,
    duration: '1h 11m',
    updatedAt: '3 days ago',
    author: 'Khoa Nguyen',
    isStarred: false,
    notes:
      'Control run showing syntactic mask contributes +1.57% F1 improvement over unmasked attention.',
    hyperparameters: {
      backbone: 'vinai/phobert-large',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.06',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.51, 1.04, 0.74, 0.54, 0.41, 0.31, 0.26, 0.228],
    valF1Curve: [70.1, 76.9, 81.2, 84.0, 85.8, 86.9, 87.5, 87.85],
    stdoutLogs: [
      '[2026-10-28 16:40:00] INFO | Control run without dependency syntactic mask',
      '[2026-10-28 17:51:12] DONE | Final Test F1=87.85%',
    ],
    artifacts: [
      {
        id: 'art-12',
        name: 'phobert_large_nomask.h5',
        size: '1.38 GB',
        type: 'hdf5',
      },
      {
        id: 'art-13',
        name: 'nomask_predictions.csv',
        size: '4.7 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-029',
    name: 'contriever-msmarco-hn-mining',
    experimentId: 'exp-02',
    experimentName: 'EXP-02: Contrastive Reranker',
    status: 'completed',
    model: 'mContriever + CrossEncoder',
    dataset: 'scifact-multilingual-test.csv',
    datasetSha: 'sha256:7c22d190a3f4',
    gitBranch: 'feat/reranker',
    gitCommit: '9c01b8f',
    protocolId: 'prot-02',
    capsuleId: 'cap-02',
    device: '2x A100 80GB',
    f1: 88.95,
    f1Delta: '+1.85%',
    bleu: 43.52,
    loss: 0.195,
    duration: '1h 32m',
    updatedAt: '4 days ago',
    author: 'Khoa Nguyen',
    isStarred: true,
    notes:
      'Hard negative mining with top-50 BM25 candidates improved claim verification precision.',
    hyperparameters: {
      backbone: 'facebook/mcontriever-msmarco',
      learningRate: '1.5e-5',
      batchSize: '64',
      optimizer: 'AdamW',
      warmupRatio: '0.08',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.46, 0.98, 0.69, 0.5, 0.37, 0.28, 0.22, 0.195],
    valF1Curve: [72.0, 78.5, 83.1, 85.9, 87.2, 88.1, 88.6, 88.95],
    stdoutLogs: [
      '[2026-10-27 10:15:00] INFO | Loaded 50 hard negatives per query via Pyserini BM25',
      '[2026-10-27 11:47:20] DONE | Claim Verification Macro-F1=88.95%',
    ],
    artifacts: [
      {
        id: 'art-14',
        name: 'mcontriever_reranker_ep10.h5',
        size: '1.15 GB',
        type: 'hdf5',
      },
      {
        id: 'art-15',
        name: 'hard_negatives_confusion.ipynb',
        size: '612 KB',
        type: 'ipynb',
      },
    ],
  },
  {
    id: 'run-027',
    name: 'bm25-lexical-hybrid-alpha03',
    experimentId: 'exp-02',
    experimentName: 'EXP-02: Contrastive Reranker',
    status: 'completed',
    model: 'BM25 + PhoBERT Hybrid',
    dataset: 'scifact-multilingual-test.csv',
    datasetSha: 'sha256:7c22d190a3f4',
    gitBranch: 'feat/reranker',
    gitCommit: '4e82a10',
    protocolId: 'prot-02',
    capsuleId: 'cap-02',
    device: '1x A100 80GB',
    f1: 86.4,
    f1Delta: '-0.70%',
    bleu: 40.88,
    loss: 0.281,
    duration: '38m',
    updatedAt: '5 days ago',
    author: 'Minh Tran',
    isStarred: false,
    notes:
      'Linear interpolation alpha=0.3 between sparse BM25 and dense cosine similarity.',
    hyperparameters: {
      backbone: 'Pyserini BM25 + PhoBERT',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.05',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.62, 1.15, 0.84, 0.61, 0.45, 0.36, 0.31, 0.281],
    valF1Curve: [67.4, 73.9, 78.2, 81.5, 83.7, 85.0, 85.9, 86.4],
    stdoutLogs: [
      '[2026-10-26 13:00:00] INFO | Evaluating hybrid interpolation alpha=0.3',
    ],
    artifacts: [
      {
        id: 'art-16',
        name: 'hybrid_scores_test.csv',
        size: '2.9 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-024',
    name: 'qlora-neftune-alpha5-clinical',
    experimentId: 'exp-03',
    experimentName: 'EXP-03: Low-Resource Finetune',
    status: 'completed',
    model: 'ViMistral-7B QLoRA',
    dataset: 'clinical-ner-lowres-5k.csv',
    datasetSha: 'sha256:2e91f004b8d2',
    gitBranch: 'feat/qlora-lowres',
    gitCommit: '7a55d3e',
    protocolId: 'prot-03',
    capsuleId: 'cap-03',
    device: '1x A100 80GB',
    f1: 88.12,
    f1Delta: '+1.02%',
    bleu: 43.9,
    loss: 0.2104,
    duration: '2h 14m',
    updatedAt: '6 days ago',
    author: 'Khoa Nguyen',
    isStarred: true,
    notes:
      'NEFTune uniform noise alpha=5 prevented early memorization on the 5,000 clinical NER dataset.',
    hyperparameters: {
      backbone: 'Viet-Mistral/Vistral-7B-Chat',
      learningRate: '1e-4',
      batchSize: '16',
      optimizer: 'paged_adamw_8bit',
      warmupRatio: '0.03',
      maxSeqLen: '2048',
      seed: 42,
      dropout: '0.05',
    },
    lossCurve: [1.74, 1.18, 0.82, 0.57, 0.41, 0.3, 0.24, 0.21],
    valF1Curve: [66.8, 74.2, 80.1, 83.9, 86.0, 87.1, 87.8, 88.12],
    stdoutLogs: [
      '[2026-10-25 09:00:00] INFO | Activated NEFTune noise_alpha=5.0 on embedding layer',
      '[2026-10-25 11:14:00] DONE | Clinical Entity F1=88.12%',
    ],
    artifacts: [
      {
        id: 'art-17',
        name: 'vistral_7b_qlora_r16.h5',
        size: '312 MB',
        type: 'hdf5',
      },
      {
        id: 'art-18',
        name: 'clinical_ner_predictions.csv',
        size: '1.8 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-021',
    name: 'qlora-no-neftune-overfit',
    experimentId: 'exp-03',
    experimentName: 'EXP-03: Low-Resource Finetune',
    status: 'completed',
    model: 'ViMistral-7B No-Noise',
    dataset: 'clinical-ner-lowres-5k.csv',
    datasetSha: 'sha256:2e91f004b8d2',
    gitBranch: 'feat/qlora-lowres',
    gitCommit: '2b19c8a',
    protocolId: 'prot-03',
    capsuleId: 'cap-03',
    device: '1x A100 80GB',
    f1: 85.74,
    f1Delta: '-1.36%',
    bleu: 41.15,
    loss: 0.312,
    duration: '2h 08m',
    updatedAt: '1 week ago',
    author: 'Khoa Nguyen',
    isStarred: false,
    notes:
      'Validation loss diverged after epoch 4 without NEFTune embedding regularization.',
    hyperparameters: {
      backbone: 'Viet-Mistral/Vistral-7B-Chat',
      learningRate: '1e-4',
      batchSize: '16',
      optimizer: 'paged_adamw_8bit',
      warmupRatio: '0.03',
      maxSeqLen: '2048',
      seed: 42,
      dropout: '0.05',
    },
    lossCurve: [1.72, 1.14, 0.78, 0.49, 0.38, 0.35, 0.33, 0.312],
    valF1Curve: [66.5, 74.0, 79.8, 84.1, 85.9, 85.8, 85.7, 85.74],
    stdoutLogs: [
      '[2026-10-24 14:12:00] WARN | Validation loss increased from 0.289 to 0.312',
    ],
    artifacts: [
      {
        id: 'art-19',
        name: 'overfit_loss_curve_analysis.ipynb',
        size: '520 KB',
        type: 'ipynb',
      },
    ],
  },
  {
    id: 'run-018',
    name: 'ablation-no-rope-scaling-ctx2k',
    experimentId: 'exp-04',
    experimentName: 'EXP-04: Positional Scaling Ablation',
    status: 'completed',
    model: 'PhoBERT-large No-RoPE',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'ablation/sec-4-3',
    gitCommit: 'c410e2b',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '2x A100 80GB',
    f1: 86.18,
    f1Delta: '-3.24%',
    bleu: 39.95,
    loss: 0.294,
    duration: '1h 15m',
    updatedAt: '1 week ago',
    author: 'Minh Tran',
    isStarred: false,
    notes:
      'Removing dynamic NTK RoPE scaling drops F1 by 3.24% on documents over 1,500 words.',
    hyperparameters: {
      backbone: 'vinai/phobert-large',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.06',
      maxSeqLen: '2048',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.68, 1.19, 0.88, 0.64, 0.48, 0.37, 0.32, 0.294],
    valF1Curve: [65.2, 72.1, 77.4, 81.0, 83.5, 84.9, 85.7, 86.18],
    stdoutLogs: [
      '[2026-10-22 10:00:00] INFO | Disabled dynamic NTK RoPE scaling',
    ],
    artifacts: [
      {
        id: 'art-20',
        name: 'ablation_table4_export.csv',
        size: '1.1 MB',
        type: 'csv',
      },
    ],
  },
  {
    id: 'run-015',
    name: 'ablation-freeze-bottom-6-layers',
    experimentId: 'exp-04',
    experimentName: 'EXP-04: Positional Scaling Ablation',
    status: 'completed',
    model: 'PhoBERT-large Frozen-L6',
    dataset: 'vi-academic-corpus-v2.csv',
    datasetSha: 'sha256:9f84c2a1b0e7',
    gitBranch: 'ablation/sec-4-3',
    gitCommit: '9a02f1d',
    protocolId: 'prot-01',
    capsuleId: 'cap-01',
    device: '2x A100 80GB',
    f1: 88.05,
    f1Delta: '-1.37%',
    bleu: 42.7,
    loss: 0.221,
    duration: '49m',
    updatedAt: '2 weeks ago',
    author: 'Khoa Nguyen',
    isStarred: false,
    notes:
      'Freezing bottom 6 encoder layers reduces training time by 37% with a 1.37% F1 trade-off.',
    hyperparameters: {
      backbone: 'vinai/phobert-large',
      learningRate: '2e-5',
      batchSize: '32',
      optimizer: 'AdamW',
      warmupRatio: '0.06',
      maxSeqLen: '512',
      seed: 42,
      dropout: '0.1',
    },
    lossCurve: [1.54, 1.05, 0.75, 0.54, 0.4, 0.3, 0.25, 0.221],
    valF1Curve: [69.8, 76.5, 81.4, 84.5, 86.2, 87.2, 87.7, 88.05],
    stdoutLogs: [
      '[2026-10-18 15:20:00] INFO | Frozen encoder.layer.0 through encoder.layer.5',
    ],
    artifacts: [
      {
        id: 'art-21',
        name: 'frozen_layers_speedup.ipynb',
        size: '410 KB',
        type: 'ipynb',
      },
    ],
  },
];

export const MOCK_DATASETS: DatasetArtifact[] = [
  {
    id: 'ds-01',
    name: 'vi-academic-corpus-v2.csv',
    version: 'v2.1.0',
    format: 'CSV',
    rows: '42,500',
    size: '184.2 MB',
    sha256: 'sha256:9f84c2a1b0e7',
    linkedRunsCount: 7,
    updatedAt: '2 days ago',
    description:
      'Cleaned Vietnamese peer-reviewed scientific abstracts and citation graphs with syntactic dependency trees.',
  },
  {
    id: 'ds-02',
    name: 'vi-academic-corpus-v1.csv',
    version: 'v1.0.0',
    format: 'CSV',
    rows: '28,120',
    size: '118.5 MB',
    sha256: 'sha256:4a11e8b3c201',
    linkedRunsCount: 1,
    updatedAt: '2 weeks ago',
    description:
      'Initial baseline release used for PhoBERT-base reference benchmarks.',
  },
  {
    id: 'ds-03',
    name: 'scifact-multilingual-test.csv',
    version: 'v1.4.2',
    format: 'CSV',
    rows: '12,400',
    size: '54.8 MB',
    sha256: 'sha256:7c22d190a3f4',
    linkedRunsCount: 2,
    updatedAt: '5 days ago',
    description:
      'Cross-lingual scientific claim verification benchmark with aligned English and Vietnamese pairs.',
  },
  {
    id: 'ds-04',
    name: 'clinical-ner-lowres-5k.csv',
    version: 'v1.1.0',
    format: 'CSV',
    rows: '5,000',
    size: '22.4 MB',
    sha256: 'sha256:2e91f004b8d2',
    linkedRunsCount: 2,
    updatedAt: '1 week ago',
    description:
      'Annotated clinical entities and adverse drug events for low-resource QLoRA experiments.',
  },
];

export const MOCK_CHECKPOINTS: CheckpointArtifact[] = [
  {
    id: 'ckpt-01',
    name: 'best_checkpoint_ep12.h5',
    runId: 'run-042',
    experimentId: 'EXP-01',
    architecture: 'PhoBERT-large + CrossAttn',
    format: 'HDF5',
    size: '1.42 GB',
    f1Score: 89.42,
    stage: 'Production',
    updatedAt: '12 mins ago',
  },
  {
    id: 'ckpt-02',
    name: 'mcontriever_reranker_ep10.h5',
    runId: 'run-029',
    experimentId: 'EXP-02',
    architecture: 'mContriever + CrossEncoder',
    format: 'HDF5',
    size: '1.15 GB',
    f1Score: 88.95,
    stage: 'Staging',
    updatedAt: '4 days ago',
  },
  {
    id: 'ckpt-03',
    name: 'bge_m3_lora_adapter.h5',
    runId: 'run-036',
    experimentId: 'EXP-01',
    architecture: 'BGE-M3 + LoRA',
    format: 'HDF5',
    size: '168 MB',
    f1Score: 88.64,
    stage: 'Staging',
    updatedAt: 'Yesterday',
  },
  {
    id: 'ckpt-04',
    name: 'vistral_7b_qlora_r16.h5',
    runId: 'run-024',
    experimentId: 'EXP-03',
    architecture: 'ViMistral-7B QLoRA',
    format: 'HDF5',
    size: '312 MB',
    f1Score: 88.12,
    stage: 'Staging',
    updatedAt: '6 days ago',
  },
  {
    id: 'ckpt-05',
    name: 'baseline_phobert_base.h5',
    runId: 'run-039',
    experimentId: 'EXP-01',
    architecture: 'PhoBERT-base',
    format: 'HDF5',
    size: '540 MB',
    f1Score: 87.1,
    stage: 'Archived',
    updatedAt: '3 hours ago',
  },
];

export const MOCK_PROTOCOLS: ResearchProtocol[] = [
  {
    id: 'prot-01',
    code: 'SOP-01',
    title: 'Syntactic Dependency Mask Pre-computation & Cross-Attention Finetuning',
    version: 'v2.1',
    doi: '10.17504/protocols.io.vnckh2026',
    author: 'Khoa Nguyen',
    linkedExperimentId: 'EXP-01',
    updatedAt: '2 days ago',
    abstract:
      'Pipeline for segmenting Vietnamese compound words, constructing adjacency dependency matrices, and training PhoBERT-large with deterministic CUDA seeds.',
    steps: [
      {
        stepNumber: 1,
        title: 'Word Segmentation & Dependency Parsing',
        duration: '12 mins',
        commandOrAction:
          'python scripts/preprocess_vncorenlp.py --input data/raw.csv --output data/vi-academic-corpus-v2.csv',
        expectedOutput:
          '42,500 segmented records with CoNLL-U dependency arcs · sha256:9f84c2a1b0e7',
        isVerified: true,
      },
      {
        stepNumber: 2,
        title: 'Syntactic Adjacency Tensor Generation',
        duration: '8 mins',
        commandOrAction:
          'python scripts/build_dep_masks.py --max-seq-len 512 --hop-distance 2',
        expectedOutput:
          'Sparse boolean mask tensors saved to cache/dep_masks_512.pt',
        isVerified: true,
      },
      {
        stepNumber: 3,
        title: 'Multi-GPU Distributed Finetuning',
        duration: '1h 18m',
        commandOrAction:
          'torchrun --nproc_per_node=2 train.py --config configs/phobert_large_cross_attn.yaml --seed 42',
        expectedOutput:
          'Validation F1 >= 89.0%, checkpoint saved to checkpoints/best_checkpoint_ep12.h5',
        isVerified: true,
      },
      {
        stepNumber: 4,
        title: 'Paired Bootstrap Significance Test',
        duration: '4 mins',
        commandOrAction:
          'python scripts/paired_bootstrap.py --pred-a run-042/preds.csv --pred-b run-039/preds.csv --samples 10000',
        expectedOutput: 'p = 0.0014, confirming statistically significant gain.',
        isVerified: true,
      },
    ],
  },
  {
    id: 'prot-02',
    code: 'SOP-02',
    title: 'Hard-Negative Mining with BM25 & Cross-Encoder Reranking',
    version: 'v1.4',
    doi: '10.17504/protocols.io.rerank2026',
    author: 'Minh Tran',
    linkedExperimentId: 'EXP-02',
    updatedAt: '5 days ago',
    abstract:
      'Two-stage retrieval protocol mining top-50 lexical false positives via Pyserini BM25 for contrastive cross-encoder training.',
    steps: [
      {
        stepNumber: 1,
        title: 'Build Lucene Inverted Index on Scientific Abstracts',
        duration: '5 mins',
        commandOrAction:
          'python -m pyserini.index.lucene --collection JsonCollection --input data/corpus_jsonl --index indexes/bm25',
        expectedOutput: 'Lucene index with k1=0.9, b=0.4',
        isVerified: true,
      },
      {
        stepNumber: 2,
        title: 'Mine Top-50 Hard Negatives per Claim',
        duration: '18 mins',
        commandOrAction:
          'python scripts/mine_hard_negatives.py --index indexes/bm25 --topk 50 --exclude-gold',
        expectedOutput: 'Triplets JSONL with query, positive doc, and 50 hard negatives',
        isVerified: true,
      },
    ],
  },
];

export const MOCK_SWEEP: HyperparameterSweep = {
  id: 'sweep-01',
  name: 'SWEEP-01: Bayesian Search — Learning Rate × LoRA Rank × Warmup',
  method: 'Bayesian Optimization',
  objective: 'Maximize Test F1',
  totalTrials: 8,
  bestRunId: 'run-042',
  bestF1: 89.42,
  parameterImportance: [
    { param: 'learning_rate', correlation: 0.78, impact: 'negative' },
    { param: 'syntactic_mask', correlation: 0.64, impact: 'positive' },
    { param: 'warmup_ratio', correlation: 0.41, impact: 'positive' },
    { param: 'lora_rank', correlation: 0.29, impact: 'positive' },
    { param: 'dropout', correlation: 0.14, impact: 'negative' },
  ],
  trials: [
    {
      trialId: 'trial-08',
      runId: 'run-042',
      learningRate: '2e-5',
      loraRank: 32,
      warmupRatio: 0.06,
      batchSize: 32,
      dropout: 0.1,
      valF1: 89.42,
      evalLoss: 0.1842,
      status: 'completed',
    },
    {
      trialId: 'trial-07',
      runId: 'run-029',
      learningRate: '1.5e-5',
      loraRank: 32,
      warmupRatio: 0.08,
      batchSize: 64,
      dropout: 0.1,
      valF1: 88.95,
      evalLoss: 0.195,
      status: 'completed',
    },
    {
      trialId: 'trial-06',
      runId: 'run-036',
      learningRate: '1e-4',
      loraRank: 16,
      warmupRatio: 0.05,
      batchSize: 64,
      dropout: 0.05,
      valF1: 88.64,
      evalLoss: 0.2015,
      status: 'completed',
    },
    {
      trialId: 'trial-05',
      runId: 'run-024',
      learningRate: '1e-4',
      loraRank: 16,
      warmupRatio: 0.03,
      batchSize: 16,
      dropout: 0.05,
      valF1: 88.12,
      evalLoss: 0.2104,
      status: 'completed',
    },
    {
      trialId: 'trial-04',
      runId: 'run-041',
      learningRate: '3e-5',
      loraRank: 16,
      warmupRatio: 0.1,
      batchSize: 64,
      dropout: 0.1,
      valF1: 87.91,
      evalLoss: 0.231,
      status: 'running',
    },
    {
      trialId: 'trial-03',
      runId: 'run-031',
      learningRate: '2e-5',
      loraRank: 8,
      warmupRatio: 0.06,
      batchSize: 32,
      dropout: 0.1,
      valF1: 87.85,
      evalLoss: 0.2289,
      status: 'completed',
    },
    {
      trialId: 'trial-02',
      runId: 'run-039',
      learningRate: '2e-5',
      loraRank: 8,
      warmupRatio: 0.05,
      batchSize: 32,
      dropout: 0.1,
      valF1: 87.1,
      evalLoss: 0.2604,
      status: 'completed',
    },
    {
      trialId: 'trial-01',
      runId: 'run-033',
      learningRate: '5e-4',
      loraRank: 64,
      warmupRatio: 0.0,
      batchSize: 16,
      dropout: 0.2,
      valF1: 58.2,
      evalLoss: 1.842,
      status: 'early_stopped',
    },
  ],
};

export const MOCK_REPRO_CAPSULE: ReproCapsule = {
  id: 'cap-01',
  name: 'Capsule-01: Vietnamese Academic NLP Environment',
  linkedRunId: 'run-042',
  dockerDigest:
    'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  baseImage: 'nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04',
  cudaVersion: 'CUDA 12.1 · cuDNN 8.9',
  pythonVersion: 'Python 3.11.8',
  reproCommand:
    'git checkout 8f3a9d1 && dvc pull && dvc repro train_eval_pipeline',
  packages: [
    'torch==2.4.0+cu121',
    'transformers==4.44.2',
    'peft==0.12.0',
    'datasets==2.21.0',
    'accelerate==0.33.0',
    'vncorenlp==1.0.3',
    'scikit-learn==1.5.1',
    'dvc[s3]==3.54.0',
  ],
  dvcStages: [
    {
      stage: 'preprocess_corpus',
      cmd: 'python scripts/preprocess_vncorenlp.py --in data/raw --out data/vi-academic-corpus-v2.csv',
      deps: ['data/raw', 'scripts/preprocess_vncorenlp.py'],
      outs: ['data/vi-academic-corpus-v2.csv'],
      md5: '9f84c2a1b0e7',
    },
    {
      stage: 'build_syntactic_masks',
      cmd: 'python scripts/build_dep_masks.py --corpus data/vi-academic-corpus-v2.csv',
      deps: ['data/vi-academic-corpus-v2.csv', 'scripts/build_dep_masks.py'],
      outs: ['cache/dep_masks_512.pt'],
      md5: '4d21b90e3f1a',
    },
    {
      stage: 'train_cross_attention',
      cmd: 'torchrun --nproc_per_node=2 train.py --config configs/phobert_large.yaml --seed 42',
      deps: ['cache/dep_masks_512.pt', 'train.py', 'configs/phobert_large.yaml'],
      outs: ['checkpoints/best_checkpoint_ep12.h5'],
      md5: '7a09e41c8b2d',
    },
    {
      stage: 'evaluate_and_export_latex',
      cmd: 'python evaluate.py --ckpt checkpoints/best_checkpoint_ep12.h5 --out eval_predictions_test.csv',
      deps: ['checkpoints/best_checkpoint_ep12.h5', 'evaluate.py'],
      outs: ['eval_predictions_test.csv', 'tables/manuscript_table2.tex'],
      md5: '1c88f32a90e4',
    },
  ],
};

export const MOCK_ARTIFACT_PREVIEW_CONTENT: Record<string, string> = {
  'eval_predictions_test.csv': `sample_id,claim_text,gold_label,pred_label,confidence,syntactic_hops,correct
001,"PhoBERT-large kết hợp mặt nạ cú pháp giúp tăng độ chính xác trích xuất thực thể y sinh.",SUPPORTS,SUPPORTS,0.9842,2,true
002,"Mô hình mT5-large hội tụ nhanh hơn PhoBERT-base trên tập dữ liệu dưới 5,000 mẫu.",REFUTES,REFUTES,0.9615,3,true
003,"Không sử dụng chuẩn hóa RoPE làm giảm 3.24% F1 trên văn bản học thuật dài trên 1,500 từ.",SUPPORTS,SUPPORTS,0.9480,2,true
004,"NEFTune noise alpha=5 làm giảm chất lượng biểu diễn từ vựng tiếng Việt.",REFUTES,REFUTES,0.9120,1,true
005,"Kết hợp BM25 và mContriever đạt 88.95% Macro-F1 trên tập kiểm thử đa ngữ SciFact.",SUPPORTS,SUPPORTS,0.9731,2,true
006,"Đóng băng 6 tầng encoder đầu tiên làm giảm thời gian huấn luyện 37%.",SUPPORTS,SUPPORTS,0.8954,2,true
007,"Batch size 128 không cần warmup đạt kết quả tốt nhất trên A100.",REFUTES,SUPPORTS,0.5410,4,false`,
  'ablation_attention_viz.ipynb': JSON.stringify({
    cells: [
      {
        cell_type: 'markdown',
        source: [
          '### Syntactic Dependency Mask vs Self-Attention · run-042\n',
          'Attention entropy across heads 1–16 in layer 18 of `vinai/phobert-large` on `vi-academic-corpus-v2.csv`.',
        ],
      },
      {
        cell_type: 'code',
        execution_count: 1,
        source: [
          'import torch\n',
          'import pandas as pd\n',
          'from scipy.stats import ttest_rel\n\n',
          'df_ours = pd.read_csv("run-042/eval_predictions_test.csv")\n',
          'df_base = pd.read_csv("run-031/nomask_predictions.csv")\n',
          'stat, p_val = ttest_rel(df_ours["f1_item"], df_base["f1_item"])\n',
          'print(f"Paired t-test statistic: {stat:.4f}, p-value: {p_val:.6f}")',
        ],
        outputs: [
          {
            text: ['Paired t-test statistic: 4.8219, p-value: 0.000142\n'],
          },
        ],
      },
      {
        cell_type: 'code',
        execution_count: 2,
        source: [
          'summary = pd.DataFrame({\n',
          '    "Model": ["PhoBERT-base", "PhoBERT-large No-Mask", "PhoBERT-large + CrossAttn"],\n',
          '    "Test_F1": [87.10, 87.85, 89.42],\n',
          '    "BLEU": [41.62, 42.40, 44.18]\n',
          '})\n',
          'print(summary.to_markdown(index=False))',
        ],
        outputs: [
          {
            text: [
              '| Model                     |   Test_F1 |   BLEU |\n',
              '|:--------------------------|----------:|-------:|\n',
              '| PhoBERT-base              |     87.10 |  41.62 |\n',
              '| PhoBERT-large No-Mask     |     87.85 |  42.40 |\n',
              '| PhoBERT-large + CrossAttn |     89.42 |  44.18 |\n',
            ],
          },
        ],
      },
    ],
  }),
};
