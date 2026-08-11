# Workspace Storage - Test Cases

## Môi trường thử nghiệm
- Đăng nhập dưới quyền Workspace Member (không phải Viewer).
- Hoạt động trong không gian Workspace chung (không nằm trong ngữ cảnh của một Project nào).

## Danh sách Test Cases

### 1. Upload & Duplicate Handling
- **TC01 - Tải lên thành công:** Tải lên một tệp tin hợp lệ. 
  - *Kết quả mong đợi:* Progress bar hiện lên, tệp tin xuất hiện trong thư mục hiện tại sau khi upload xong 100%.
- **TC02 - Phát hiện trùng lặp:** Tải lên tệp `document.pdf` khi trong thư mục hiện tại đã có sẵn tệp `document.pdf`.
  - *Kết quả mong đợi:* UploadDialog tạm ngưng tiến trình, mở hộp thoại "Tệp đã tồn tại" yêu cầu người dùng xử lý.
- **TC03 - Ghi đè (Overwrite):** Tại hộp thoại trùng lặp, chọn "Ghi đè".
  - *Kết quả mong đợi:* Tệp tin cũ bị xóa bỏ, tệp tin mới được tải lên và thay thế vào đúng vị trí.
- **TC04 - Giữ cả hai (Keep Both):** Tại hộp thoại trùng lặp, chọn "Giữ cả hai".
  - *Kết quả mong đợi:* Tệp tin mới được tự động đổi tên thành `document (1).pdf` và tiếp tục tải lên. Tệp cũ không bị ảnh hưởng.
- **TC05 - Hủy bỏ (Cancel):** Tại hộp thoại trùng lặp, chọn "Hủy bỏ".
  - *Kết quả mong đợi:* Tệp tin đó bị đánh dấu là `skipped` trong hàng đợi, không tải lên server. Các tệp tin khác trong hàng đợi (nếu có) tiếp tục được xử lý.

### 2. Kéo Thả (Drag & Drop)
- **TC06 - Kéo thả vào vùng trống:** Kéo một tệp từ máy tính thả vào không gian trống của File Explorer.
  - *Kết quả mong đợi:* Tệp tin được đưa vào hàng đợi UploadDialog với `targetFolder` là thư mục hiện tại đang xem.
- **TC07 - Kéo thả vào thư mục con:** Kéo một tệp từ máy tính thả trực tiếp lên trên icon của thư mục `Design`.
  - *Kết quả mong đợi:* Tệp tin được đưa vào hàng đợi UploadDialog với `targetFolder` là ID của thư mục `Design`. Sau khi tải lên thành công, tệp tin nằm gọn trong thư mục `Design` chứ không phải ở thư mục hiện tại.

### 3. File Management
- **TC08 - Tạo thư mục mới:** Nhấn nút tạo thư mục, điền tên "New Folder".
  - *Kết quả mong đợi:* Gọi hàm `workspaceCreateFolder`, thư mục xuất hiện trên giao diện.
- **TC09 - Xóa thư mục/tệp:** Nhấn chuột phải vào một tệp, chọn "Xóa".
  - *Kết quả mong đợi:* Gọi hàm `workspaceDeleteFile` (hoặc chuyển vào trash), tệp biến mất khỏi giao diện hiện tại.
