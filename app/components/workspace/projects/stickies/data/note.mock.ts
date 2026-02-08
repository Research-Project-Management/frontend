import type { Note } from "../types/note.type";

const now = Date.now();
const d = (days: number) => 1000 * 60 * 60 * 24 * days;
const h = (hours: number) => 1000 * 60 * 60 * hours;
const m = (mins: number) => 1000 * 60 * mins;

export const NOTE_MOCKS: Note[] = [
  {
    id: "n-101",
    color: "yellow-1",
    content:
      "<p><strong>Mục tiêu tuần này</strong></p><ul><li>Chốt câu hỏi nghiên cứu (R1–R2)</li><li>Đọc 6 paper nền + ghi citation</li><li>Chạy baseline (v0) và lưu log</li></ul><p><em>Deadline</em>: Thứ Sáu 17:00</p>",
    createdAt: now - d(9),
    updatedAt: now - d(8),
  },
  {
    id: "n-102",
    color: "pink-1",
    content:
      "<p><strong>Research question (draft)</strong></p><p>“Mô hình X có cải thiện độ chính xác dự đoán Y trên tập dữ liệu Z khi kiểm soát confounders A/B không?”</p><p>Metric chính: AUC • Metric phụ: F1, calibration</p>",
    createdAt: now - d(8),
    updatedAt: now - d(6),
  },
  {
    id: "n-103",
    color: "cyan-1",
    content: `
      <p><strong>Hypothesis</strong></p>
      <p>H1: Feature set (A + B) giúp tăng AUC ≥ 0.03 so với baseline.</p>
      <p>H2: Regularization (λ) giảm overfit (gap train-test &lt; 5%).</p>
      <p><em>Assumption</em>: dữ liệu không drift mạnh theo thời gian.</p>
    `.trim(),
    createdAt: now - d(7),
    updatedAt: now - d(7) + h(3),
  },
  {
    id: "n-104",
    color: "mint-1",
    content:
      "<p><strong>Dataset notes</strong></p><ul><li>N = 18,420 mẫu • missing rate ~2.1%</li><li>Outliers: cột <code>signal_strength</code> &gt; 99th percentile</li><li>Split theo thời gian: train (Jan–Sep), test (Oct–Dec)</li></ul><p>Lưu ý: cần kiểm tra leakage từ feature <code>post_event_score</code>.</p>",
    createdAt: now - d(6),
    updatedAt: now - d(5),
  },
  {
    id: "n-105",
    color: "lavender-1",
    content: `
      <p><strong>Protocol (v0)</strong></p>
      <ol>
        <li>Clean: remove duplicates, impute missing (median/most_frequent)</li>
        <li>Standardize numeric, one-hot categorical</li>
        <li>Train baseline: Logistic Regression + class_weight</li>
        <li>Eval: AUC/F1 + calibration curve</li>
        <li>Log: seed, config, hash dataset snapshot</li>
      </ol>
      <p><em>Repro</em>: cố định seed = 42, ghi lại commit SHA</p>
    `.trim(),
    createdAt: now - d(5),
    updatedAt: now - d(4) + h(2),
  },
  {
    id: "n-106",
    color: "purple-1",
    content: `
      <p><strong>Meeting notes (PI sync)</strong></p>
      <p>Chốt hướng: ưu tiên interpretability trước (SHAP / coefficients), sau đó mới thử model phức tạp.</p>
      <ul>
        <li>Thêm analysis theo subgroup (age, site)</li>
        <li>Báo cáo kèm CI (bootstrap 1,000)</li>
        <li>Chuẩn bị 2 figure: ROC + calibration</li>
      </ul>
    `.trim(),
    createdAt: now - d(4),
    updatedAt: now - d(4) + h(1),
  },
  {
    id: "n-107",
    color: "cyan-1",
    content: `
      <p><strong>Analysis log</strong></p>
      <p>Baseline v0 (LR):</p>
      <ul>
        <li>AUC: 0.781</li>
        <li>F1: 0.612</li>
        <li>Calibration (ECE): 0.041</li>
      </ul>
      <p>Nhận xét: recall thấp ở threshold 0.5 → cần tune threshold theo PR curve.</p>
    `.trim(),
    createdAt: now - d(3),
    updatedAt: now - d(2) + h(6),
  },
  {
    id: "n-108",
    color: "yellow-1",
    content: `
      <p><strong>Citations cần đọc</strong></p>
      <ul>
        <li><a href="https://doi.org/10.1038/s41586-020-2649-2" target="_blank" rel="noreferrer">Paper A — methodology</a></li>
        <li><a href="https://doi.org/10.1145/3290605.3300233" target="_blank" rel="noreferrer">Paper B — evaluation pitfalls</a></li>
        <li><a href="https://doi.org/10.48550/arXiv.1706.03762" target="_blank" rel="noreferrer">Paper C — attention baseline</a></li>
      </ul>
      <p>Ghi chú: tập trung phần “threats to validity” + “data leakage”.</p>
    `.trim(),
    createdAt: now - d(2),
    updatedAt: now - d(2) + h(4),
  },
  {
    id: "n-109",
    color: "pink-1",
    content:
      "<p><strong>Ethics / compliance</strong></p><ul><li>Dữ liệu có thông tin nhạy cảm → cần ẩn danh (remove direct identifiers)</li><li>Chỉ lưu aggregate metrics khi share nội bộ</li><li>Nếu export: kiểm tra k-anonymity (k≥5) cho subgroup</li></ul><p><em>Action</em>: viết đoạn Data Handling trong báo cáo.</p>",
    createdAt: now - d(1),
    updatedAt: now - m(45),
  },
];