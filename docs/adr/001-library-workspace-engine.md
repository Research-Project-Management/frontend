# ADR-0001: Nâng Cấp Kiến Trúc `features/library` Thành Workspace Engine & Autonomous Zones

**Date**: 2026-09-19  
**Status**: accepted  
**Deciders**: Flux Core Team  

## Context

Module `features/library` ban đầu được xây dựng theo mô hình Feature-based CRUD thông thường (phẳng theo loại file kỹ thuật: `components/`, `hooks/`, `services/`, `pages/`, `store/`, `utils/`). Khi quy mô tính năng mở rộng thành một **Academic Research Workbench** (quản lý cây thư mục phân cấp, tài liệu, trích dẫn đa kiểu, phát hiện trùng lặp, thanh tác vụ hàng loạt, tải ngầm file PDF):

1. **God Files**: `LibraryPage.tsx` phình to hơn 1.600 dòng code và `use-library.ts` phình to hơn 1.050 dòng code do phải ôm toàn bộ state điều phối.
2. **Spaghetti Dependencies**: Các module bên ngoài (`features/reader`, `features/projects`) chọc thẳng vào hơn 15 files nội bộ của `library` do thiếu ranh giới Public API (`index.ts`).
3. **Folder Inception & Prop Drilling**: Nỗ lực chia nhỏ component rơi vào bẫy lồng thư mục sâu hoặc phải truyền hàng chục props từ Page xuống các con.

## Decision

Áp dụng mô hình **Workspace Engine + Autonomous Zones** (đúc kết từ các sản phẩm mã nguồn mở tiêu biểu: Plane.so, Twenty CRM, Supabase Studio, Midday.ai):

1. **Thiết lập Public API (`index.ts`)**: Cửa khẩu xuất nhập khẩu duy nhất của feature. Cấm mọi import trực tiếp vào đường dẫn nội bộ.
2. **Tách State Engine (`store/`)**: Sử dụng Zustand (`library-view.store.ts` cho selection/view mode, `library-modal.store.ts` cho hộp thoại) làm bộ não điều phối. UI components trở thành "Dumb Views" tự subscribe qua selector.
3. **Chuẩn hóa tầng Data (`data/`)**: Gom toàn bộ logic mạng và cache vào TanStack Query (`query-keys.ts`, `items.queries.ts`, `collections.queries.ts`).
4. **Phẳng hóa giao diện (Max Depth = 1)**: Chia `ui/` thành 5 Zone tự trị (`sidebar/`, `topbar/`, `content/`, `inspector/`, `modals/`). Bên trong mỗi Zone tuyệt đối không lồng thêm folder con.
5. **Layout Shell Siêu Mỏng**: `LibraryPage.tsx` thu gọn từ 1.600 dòng xuống còn ~50 dòng, chỉ làm nhiệm vụ kết nối CSS Grid/Flexbox của 5 Zone.

## Alternatives Considered

### Alternative 1: Microfrontends
- **Pros**: Phân tách vật lý hoàn toàn độc lập.
- **Cons**: Chi phí build, toolchain CI/CD quá cồng kềnh, gây overhead lớn cho 1 team nhỏ.
- **Why not**: Bị từ chối vì không cần thiết cho quy mô một ứng dụng đơn lẻ.

### Alternative 2: Full Feature-Sliced Design (FSD) cho toàn bộ App
- **Pros**: Rất chặt chẽ về mặt lý thuyết phân tầng (Shared, Entities, Features, Widgets, Pages).
- **Cons**: Quá nặng nề và tạo ra quá nhiều boilerplate cho các feature CRUD đơn giản như `auth`, `settings`.
- **Why not**: Bị từ chối vì cần sự thực dụng (Pragmatic), chỉ áp dụng cho module Workbench phức tạp.

## Consequences

### Positive
- **Giải phóng UI**: `LibraryPage.tsx` chỉ còn ~50 dòng, không còn bất kỳ God File nào.
- **Triệt tiêu nợ kỹ thuật**: Đã xóa sổ vĩnh viễn 2.650 dòng code cồng kềnh cũ (`LibraryPage.tsx` 1.593 dòng và `use-library.ts` 1.057 dòng). Toàn bộ các view phụ (`RecentlyReadPage`, `UnfiledPage`, `TrashPage`, `DuplicatesPage`) đã chuyển sang dùng các hook chuyên biệt và store mới.
- **Hiệu năng cao**: Thao tác chọn item hoặc đổi folder không kích hoạt re-render toàn bộ trang.
- **Mở rộng dễ dàng**: Khi thêm tính năng mới (Zotero sync, AI assistant), chỉ cần tạo file phẳng trong Zone tương ứng và dispatch action vào Store.
- **Bảo vệ ranh giới tự động**: ESLint `no-restricted-imports` tự động ngăn chặn mọi hành vi import chọc sâu vào tệp nội bộ của `library`.

### Negative / Trade-offs
- Các lập trình viên mới cần làm quen với việc state được điều phối qua Zustand Store và URL params thay vì truyền props thông thường qua component cha.
