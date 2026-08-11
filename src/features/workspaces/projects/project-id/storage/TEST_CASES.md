# Project Storage - Test Cases

## Môi trường thử nghiệm
- Đăng nhập dưới quyền Thành viên của Dự án (Project Member).
- Đang điều hướng bên trong màn hình `projects/[project-id]/storage/`.
- Mọi API call đều phải mang theo tham số `projectId`.

## Danh sách Test Cases

### 1. Phân tách Dữ liệu (Data Isolation)
- **TC01 - Cảnh báo trùng lặp độc lập:** 
  - *Tiền điều kiện:* Có sẵn tệp `plan.docx` ngoài Workspace Storage.
  - *Hành động:* Upload tệp `plan.docx` vào bên trong Project Storage.
  - *Kết quả mong đợi:* Tệp được tải lên thành công 100% mà KHÔNG hiện cảnh báo trùng lặp (vì chúng nằm ở 2 phạm vi khác nhau).
- **TC02 - Upload bắt buộc có Project ID:** 
  - *Hành động:* Bắt chặn (intercept) request mạng `POST /api/files/upload`.
  - *Kết quả mong đợi:* Request payload (hoặc Query Params) phải có `projectId` bằng với ID của dự án hiện tại. Nếu thiếu hoặc truyền sai `projectId`, Backend phải từ chối (400 Bad Request hoặc 403 Forbidden).

### 2. Upload & Duplicate Handling (Trong phạm vi Project)
- **TC03 - Bắt trùng lặp nội bộ:** Tải lên tệp `budget.xlsx` khi trong Project hiện tại đã có sẵn tệp `budget.xlsx`.
  - *Kết quả mong đợi:* Hệ thống `use-project-storage` gọi API check duplicate của Project và hiển thị Hộp thoại cảnh báo ghi đè/giữ cả hai.
- **TC04 - Ghi đè tệp Project:** Chọn "Ghi đè" tại hộp thoại trên.
  - *Kết quả mong đợi:* Tệp cũ của Project bị xóa đi (`projectDeleteFile`), tệp mới được đưa vào đúng thư mục hiện tại của Project.
- **TC05 - Đổi tên tệp (Keep Both):** Chọn "Giữ cả hai" tại hộp thoại trên.
  - *Kết quả mong đợi:* Tệp được đổi tên thành `budget (1).xlsx` và tải lên thành công. Không ảnh hưởng đến các dự án khác.

### 3. Folder & File Operations (Trong phạm vi Project)
- **TC06 - Tạo thư mục Project:** Nhấn nút New Folder, nhập tên "Assets".
  - *Kết quả mong đợi:* API `projectCreateFolder` được gọi. Thư mục mới xuất hiện và hoàn toàn không hiển thị ở giao diện Workspace Home.
- **TC07 - Di chuyển tệp tin (Move):** Chọn một tệp tin, nhấn nút Di chuyển (Move) và chuyển nó vào thư mục "Assets".
  - *Kết quả mong đợi:* API `projectMoveFile` được gọi. Cây thư mục (Breadcrumbs) của Project phản hồi chính xác vị trí mới của tệp.
