# Project Storage - User Stories

## Về tổng quan
Project Storage là không gian lưu trữ biệt lập (isolated) dành riêng cho một Dự án (Project) cụ thể. Tài nguyên ở đây được quản lý chặt chẽ hơn, độc lập hoàn toàn với Workspace Storage. Các tính năng và giao diện tuy tương tự Workspace Storage nhưng vòng đời dữ liệu, phân quyền và kiểm tra tính toàn vẹn (như trùng lặp tệp) chỉ giới hạn bên trong phạm vi của dự án này.

## Danh sách User Stories

### 1. Quản lý Tài liệu Dự án
- **US01:** Là một thành viên của Dự án, tôi muốn xem danh sách các tệp tin, tài liệu liên quan mật thiết đến tiến độ của dự án, nhằm cô lập thông tin khỏi mớ tài liệu khổng lồ của toàn bộ Workspace.
- **US02:** Là một thành viên của Dự án, tôi muốn tổ chức cây thư mục riêng biệt cho dự án của mình (ví dụ: `Design`, `Reports`, `Invoices`) mà không sợ bị trùng tên thư mục với các dự án khác.

### 2. Tải lên và Cô lập Dữ liệu (Data Isolation)
- **US03:** Là một thành viên của Dự án, tôi muốn tải lên tệp tin thiết kế vào Dự án A. Tôi kỳ vọng rằng tệp tin này chỉ nằm trong Dự án A và hoàn toàn tàng hình đối với những người chỉ có quyền xem Dự án B hoặc Workspace chung.
- **US04:** Là một thành viên của Dự án, khi tải lên một tệp, tôi muốn thuật toán kiểm tra trùng lặp (Duplicate Check) chỉ đối chiếu với các tệp đang tồn tại **bên trong Dự án hiện tại**. Nếu tệp `report.pdf` đã tồn tại ngoài Workspace, tôi vẫn có quyền upload một `report.pdf` khác vào Dự án của mình mà không bị cảnh báo trùng lặp.

### 3. Tổ chức và Bảo mật
- **US05:** Là một Quản lý Dự án, tôi muốn mọi thao tác di chuyển, đổi tên, tạo thư mục đều phải gắn chặt với mã định danh của dự án (`projectId`) để ngăn chặn việc hacker/tài khoản cố tình chọc API làm rò rỉ dữ liệu xuyên dự án (Cross-Project Data Leak).
