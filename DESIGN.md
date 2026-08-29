# Design System — Flux (Research Management Platform)

<!-- impeccable:design-schema 1 -->

## 1. Triết lý Thiết kế (Design Philosophy)
* **Định vị**: Flat Precision & Academic Workbench (Giao diện phẳng kỹ thuật, tối ưu hóa cho công việc nghiên cứu chuyên sâu).
* **Mục tiêu**: Kế thừa 100% các quy chuẩn giao diện đã được kiểm chứng từ các nền tảng SaaS hàng đầu (Linear, Vercel, Midday, Supabase, Raycast) — không tạo ra sự phá cách gây bỡ ngỡ cho người dùng, tối ưu tối đa tốc độ thao tác và giảm tải nhận thức (low cognitive load).

---

## 2. Bảng 4 Màu Chủ đạo (The 4-Color Foundation)

Hệ màu của Flux được xây dựng nghiêm ngặt từ 4 sắc thái: **Đen, Trắng, Xám (Thang sắc độ Zinc), và Xanh (Electric SaaS Blue)**:

```
┌──────────────┬────────────────────────┬────────────────────────┬───────────────────────────────────────────┐
│ Nhóm Màu     │ Light Mode             │ Dark Mode              │ Vai trò & Ứng dụng                        │
├──────────────┼────────────────────────┼────────────────────────┼───────────────────────────────────────────┤
│ 1. ĐEN       │ `#09090b` (Foreground) │ `#09090b` (Background) │ Chữ chính ở Light Mode / Nền chính ở Dark │
│ 2. TRẮNG     │ `#ffffff` (Background) │ `#fafafa` (Foreground) │ Nền chính ở Light Mode / Chữ chính ở Dark │
│ 3. XÁM       │ Thang Zinc-100 -> 800  │ Thang Zinc-900 -> 300  │ Nền phụ, Card, Panel, Viền 1px, Subtext   │
│ 4. XANH      │ `#2563eb` (Blue-600)   │ `#3b82f6` (Blue-500)   │ Primary Button, Active Tab, Focus Ring,   │
│              │                        │                        │ Selected Row, Link tương tác              │
└──────────────┴────────────────────────┴────────────────────────┴───────────────────────────────────────────┘
```

### Semantic Token Mapping (CSS Variables)
* **Background Layer**:
  * Base App Canvas: `var(--background)` (`#ffffff` / `#09090b`)
  * Surface / Panel / Card: `var(--card)` (`#ffffff` / `#121215` với viền `1px solid var(--border)`)
  * Hover / Active Surface: `var(--muted)` (`#f4f4f5` / `#1c1c20`)
* **Text / Foreground Layer**:
  * Primary Text (Heading / Main label): `var(--foreground)` (`#09090b` / `#fafafa` - 100% opacity)
  * Secondary / Muted Text (Meta, Timestamps, Sub-labels): `var(--muted-foreground)` (`#71717a` / `#a1a1aa` - Tương phản 4.5:1 WCAG AA)
* **Accent & Actions**:
  * Primary Action: `var(--primary)` (`#2563eb` / `#3b82f6`)
  * Primary Text on Accent: `var(--primary-foreground)` (`#ffffff`)

---

## 3. Kiến trúc 6 Tầng Nền tảng SaaS (Top-to-Bottom Anatomy)

Mọi màn hình trong Flux được sắp xếp theo đúng 6 tầng chuẩn mực mà người dùng SaaS toàn cầu quen thuộc:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: APP HEADER CHROME (h-12 / 48px)                                                │
│ [Workspace Selector ▾]  [Breadcrumb: Projects / AI Core]  [⌘K Search Bar]  [🔔] [Avatar]│
├───────────────────┬────────────────────────────────────────────────────────────────────┤
│ TẦNG 2: SIDEBAR   │ TẦNG 3: PAGE HEADER & ACTION BAR                                   │
│ (240px Collapsed) │ [Page Title 18px] [Metadata] ──────── [Filter] [View Tabs] [+ New] │
│                   ├────────────────────────────────────────────────────────────────────┤
│ • 📚 Library      │ TẦNG 4: DATA SURFACE & WORKSPACE (Bento Grid / Table / Editor)     │
│ • 📊 Projects     │ ┌────────────────────────────────────────────────────────────────┐ │
│ • ⚡ Tasks        │ │ Dense Table (13px) / Kanban Columns / Split-pane PDF & LaTeX   │ │
│ • 🤖 AI Assistant │ └────────────────────────────────────────────────────────────────┘ │
│                   ├────────────────────────────────────────────────────────────────────┤
│ ──────────────    │ TẦNG 5: OVERLAYS & FEEDBACK (Slide-over Drawer / Sonner Toasts)   │
│ • ⚙️ Settings     │ [Quick Inspector Drawer 480px] [Toast: "Changes saved" ⏱️ Undo]    │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
```

### Chi tiết 6 Tầng:
1. **Tầng 1: App Header (Slim Chrome)**:
   - Chiều cao `48px` (`h-12`), cố định (Sticky top), viền đáy `1px border-border/50`.
   - Chứa: Bộ chuyển Workspace, Breadcrumb phân cấp, Thanh phím tắt tìm kiếm toàn cầu `⌘K`, Thông báo & Avatar.
2. **Tầng 2: Sidebar (Điều hướng & Cây thư mục)**:
   - Chiều rộng `240px` (có thể thu gọn về `56px` dạng icon).
   - Mục đang chọn (Active) có nền xám nhẹ `bg-muted` và chữ `font-medium text-foreground`, không dùng màu sặc sỡ để tránh gây phân tâm.
3. **Tầng 3: Page Header & Action Bar**:
   - Tiêu đề trang `18px font-semibold text-foreground`.
   - Thanh công cụ hành động: Ô tìm kiếm tức thì (debounce), Bộ lọc Dropdown, Bộ chuyển chế độ xem (Table / Board / List), Nút hành động chính (Primary Blue `+ New Paper` / `+ New Task`).
4. **Tầng 4: Data Surfaces (Vùng làm việc trọng tâm)**:
   - **Data Table**: Header xám nhạt (`12px`), Dòng dữ liệu phẳng (`13px`), Checkbox chọn hàng loạt, Monospace cho số liệu & DOI/BibTeX, Hover nổi bật tức thì.
   - **Kanban Board**: Thẻ công việc phẳng, viền `1px border-border/50`, tag phân loại micro `11px`.
   - **Split-pane Workspace**: Thanh kéo chia đôi màn hình giữa PDF Reader và LaTeX/Markdown Editor.
5. **Tầng 5: Overlays & Contextual Trays (Ngăn kéo chi tiết)**:
   - **Slide-over Sheet (480px - 640px)** trượt ra từ bên phải khi click vào 1 bài báo/công việc: Giúp người dùng xem chi tiết mà không phải rời trang hiện tại.
   - **Command Menu (`cmdk`)**: Hộp thoại tìm kiếm mờ nền trung tâm màn hình.
   - **Sonner Toast**: Thông báo góc dưới bên phải kèm nút `Undo` tức thì.
6. **Tầng 6: 05 Trạng thái Tương tác Chuẩn (Component States)**:
   - `Default`: Phẳng, viền `1px`, độ tương phản cao.
   - `Hover`: Nền `bg-muted/40`, đổi con trỏ pointer trong `150ms`.
   - `Focus`: Viền xanh `ring-1 ring-primary outline-none`.
   - `Loading`: Skeleton Shimmer xám nhạt thay vì spinner giật màn hình.
   - `Empty`: Icon tối giản, thông điệp 1 câu, nút bấm hành động tạo mới ngay lập tức.

---

## 4. Typography Scale & Density Matrix

* **Font UI chính**: `Geist Sans` (với `font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum"`).
* **Font Số liệu / Code**: `Geist Mono` (với `tabular-nums`).

| Cấp bậc | Kích thước | Tracking | Font Weight | Áp dụng trong Flux |
| :--- | :--- | :--- | :--- | :--- |
| **Micro / Tag** | `11px` | `+0.025em` | `500` Medium | Status Badge, Priority Pill, Keyboard `⌘K` |
| **Caption / Meta** | `12px` | `0` | `400` / `500` | Timestamps, DOI info, Input helper text |
| **Dense / Table** | `13px` | `-0.005em` | `400` / `500` | Dòng bảng bài báo, Danh sách task, Sidebar links |
| **Base / Body** | `14px` | `-0.011em` | `400` Regular | Đoạn văn, Form input, Dialog content |
| **Sub / Button** | `15px` | `-0.015em` | `500` / `600` | Button chuẩn, Tiêu đề Card nhỏ |
| **Heading 3** | `18px` | `-0.02em` | `600` SemiBold | Header của các Bento Panel / Section |
| **Heading 2** | `24px` | `-0.025em` | `600` SemiBold | Tiêu đề trang (Page Titles) |
| **Metric / KPI** | `32px` | `-0.03em` | `600` SemiBold | Tổng số bài báo, Dung lượng lưu trữ, Tiến độ |

---

## 5. Quy tắc Bất di bất dịch (Guiding Rules)
1. **Không dùng Drop Shadow 3D cồng kềnh**: Phân tầng không gian hoàn toàn bằng **viền 1px mờ** (`border-border/50`) và **độ sáng màu nền** (`bg-background` -> `bg-card` -> `bg-muted`).
2. **Số liệu luôn thẳng hàng (`tabular-nums font-mono`)**: Mọi con số thống kê, dung lượng byte, ngày giờ, số trang tài liệu đều phải cùng kích thước ngang.
3. **Màu xanh Primary chỉ dành cho Action & Focus**: Không lạm dụng màu xanh ở các vị trí tĩnh để giữ cho giao diện tĩnh lặng, sạch sẽ và tập trung tối đa cho người nghiên cứu.
