import type { Note } from "../types/note.type";

const now = Date.now();
        const d = (days: number) => 1000 * 60 * 60 * 24 * days;
const h = (hours: number) => 1000 * 60 * 60 * hours;
const m = (mins: number) => 1000 * 60 * mins;

const dStr = (ms: number) => new Date(now - ms).toISOString();
const pushTime = (baseMs: number, extraMs: number) => new Date(now - baseMs + extraMs).toISOString();

export const NOTE_MOCKS: any[] = [
  {
    _id: "n-101",
    id: "n-101",
    color: "yellow-1",
    title: "This Week's Goals",
    content:
      "<p><strong>This Week's Goals</strong></p><ul><li>Finalize research questions (R1–R2)</li><li>Read 6 foundational papers + record citations</li><li>Run baseline (v0) and save logs</li></ul><p><em>Deadline</em>: Friday 17:00</p>",
    createdAt: dStr(d(9)),
    updatedAt: dStr(d(8)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-102",
    id: "n-102",
    color: "pink-1",
    title: "Research question (draft)",
    content:
      "<p><strong>Research question (draft)</strong></p><p>\u201CDoes model X improve prediction accuracy of Y on dataset Z when controlling for confounders A/B?\u201D</p><p>Primary metric: AUC \u2022 Secondary metric: F1, calibration</p>",
    createdAt: dStr(d(8)),
    updatedAt: dStr(d(6)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-103",
    id: "n-103",
    color: "cyan-1",
    title: "Hypothesis",
    content: `
      <p><strong>Hypothesis</strong></p>
      <p>H1: Feature set (A + B) improves AUC by \u2265 0.03 over baseline.</p>
      <p>H2: Regularization (\u03BB) reduces overfit (train-test gap &lt; 5%).</p>
      <p><em>Assumption</em>: data does not drift significantly over time.</p>
    `.trim(),
    createdAt: dStr(d(7)),
    updatedAt: pushTime(d(7), h(3)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-104",
    id: "n-104",
    color: "mint-1",
    title: "Dataset notes",
    content:
      "<p><strong>Dataset notes</strong></p><ul><li>N = 18,420 samples \u2022 missing rate ~2.1%</li><li>Outliers: column <code>signal_strength</code> &gt; 99th percentile</li><li>Time-based split: train (Jan\u2013Sep), test (Oct\u2013Dec)</li></ul><p>Note: check for leakage from feature <code>post_event_score</code>.</p>",
    createdAt: dStr(d(6)),
    updatedAt: dStr(d(5)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-105",
    id: "n-105",
    color: "lavender-1",
    title: "Protocol (v0)",
    content: `
      <p><strong>Protocol (v0)</strong></p>
      <ol>
        <li>Clean: remove duplicates, impute missing (median/most_frequent)</li>
        <li>Standardize numeric, one-hot categorical</li>
        <li>Train baseline: Logistic Regression + class_weight</li>
        <li>Eval: AUC/F1 + calibration curve</li>
        <li>Log: seed, config, hash dataset snapshot</li>
      </ol>
      <p><em>Repro</em>: fix seed = 42, record commit SHA</p>
    `.trim(),
    createdAt: dStr(d(5)),
    updatedAt: pushTime(d(4), h(2)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-106",
    id: "n-106",
    color: "purple-1",
    title: "Meeting notes (PI sync)",
    content: `
      <p><strong>Meeting notes (PI sync)</strong></p>
      <p>Decision: prioritize interpretability first (SHAP / coefficients), then try complex models.</p>
      <ul>
        <li>Add subgroup analysis (age, site)</li>
        <li>Report with CI (bootstrap 1,000)</li>
        <li>Prepare 2 figures: ROC + calibration</li>
      </ul>
    `.trim(),
    createdAt: dStr(d(4)),
    updatedAt: pushTime(d(4), h(1)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-107",
    id: "n-107",
    color: "cyan-1",
    title: "Analysis log",
    content: `
      <p><strong>Analysis log</strong></p>
      <p>Baseline v0 (LR):</p>
      <ul>
        <li>AUC: 0.781</li>
        <li>F1: 0.612</li>
        <li>Calibration (ECE): 0.041</li>
      </ul>
      <p>Observation: recall is low at threshold 0.5 \u2192 need to tune threshold via PR curve.</p>
    `.trim(),
    createdAt: dStr(d(3)),
    updatedAt: pushTime(d(2), h(6)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-108",
    id: "n-108",
    color: "yellow-1",
    title: "Citations to read",
    content: `
      <p><strong>Citations to read</strong></p>
      <ul>
        <li><a href="https://doi.org/10.1038/s41586-020-2649-2" target="_blank" rel="noreferrer">Paper A \u2014 methodology</a></li>
        <li><a href="https://doi.org/10.1145/3290605.3300233" target="_blank" rel="noreferrer">Paper B \u2014 evaluation pitfalls</a></li>
        <li><a href="https://doi.org/10.48550/arXiv.1706.03762" target="_blank" rel="noreferrer">Paper C \u2014 attention baseline</a></li>
      </ul>
      <p>Focus on: \u201Cthreats to validity\u201D + \u201Cdata leakage\u201D sections.</p>
    `.trim(),
    createdAt: dStr(d(2)),
    updatedAt: pushTime(d(2), h(4)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
  {
    _id: "n-109",
    id: "n-109",
    color: "pink-1",
    title: "Ethics / compliance",
    content:
      "<p><strong>Ethics / compliance</strong></p><ul><li>Data contains sensitive information \u2192 must anonymize (remove direct identifiers)</li><li>Only store aggregate metrics when sharing internally</li><li>If exporting: check k-anonymity (k\u22655) for subgroups</li></ul><p><em>Action</em>: write the Data Handling section in the report.</p>",
    createdAt: dStr(d(1)),
    updatedAt: pushTime(d(0), m(45)),
    tags: [],
    author: { _id: "u1", name: "Mock User", email: "mock@example.com" },
    workspace: "w1",
  },
];