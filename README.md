# FleetPay – Hướng dẫn triển khai GitHub Pages

## Cấu trúc thư mục cần upload

```
fleetpay-pages/
├── index.html      ← Trang viewer (chỉ xem)
├── viewer.js       ← Logic JS cho viewer
├── style.css       ← Giao diện (copy từ project gốc)
└── README.md       ← File này
```

---

## BƯỚC 1 – Tạo GitHub repository

1. Vào **https://github.com** → đăng nhập (hoặc tạo tài khoản nếu chưa có)
2. Nhấn nút **"New"** (góc trên trái) để tạo repo mới
3. Đặt tên repo, ví dụ: `fleetpay`
4. Chọn **Public** (bắt buộc để GitHub Pages hoạt động miễn phí)
5. Nhấn **"Create repository"**

---

## BƯỚC 2 – Upload 4 file lên GitHub

Sau khi tạo repo xong, GitHub hiện trang trống. Chọn **"uploading an existing file"**:

1. Kéo thả 4 file (`index.html`, `viewer.js`, `style.css`, `README.md`) vào vùng upload
2. Kéo xuống → nhấn **"Commit changes"**

---

## BƯỚC 3 – Bật GitHub Pages

1. Trong repo vừa tạo → vào tab **Settings**
2. Kéo xuống mục **"Pages"** (menu bên trái)
3. Phần **"Branch"** → chọn **`main`** → chọn folder **`/ (root)`**
4. Nhấn **Save**
5. Chờ ~1 phút → GitHub hiện thông báo:
   > **"Your site is live at https://[username].github.io/fleetpay"**

---

## BƯỚC 4 – Gửi URL cho người xem

### Cách A – URL thông thường (người xem tự nhập GAS URL lần đầu)
```
https://[username].github.io/fleetpay
```
Lần đầu mở, trang sẽ hiện ô nhập Google Apps Script URL. Nhập URL GAS một lần, trình duyệt tự nhớ cho lần sau.

### Cách B – URL có sẵn GAS (khuyến nghị, không cần nhập tay)
```
https://[username].github.io/fleetpay?api=https://script.google.com/macros/s/ABC.../exec
```
Gửi link này cho người xem → mở là có data ngay, không cần cấu hình gì thêm.

> **Lưu ý bảo mật:** URL dạng Cách B chứa GAS URL. GAS URL không phải mật khẩu nhưng ai có link đều đọc được data. Nếu cần bảo mật hơn, dùng Cách A và gửi GAS URL riêng.

---

## Cập nhật data

- **Tự động:** Mỗi lần người xem mở trang hoặc nhấn **"Làm mới"**, dữ liệu được tải thẳng từ Google Sheets qua GAS → luôn mới nhất.
- **Không cần cập nhật file GitHub** khi data thay đổi.
- Chỉ cần upload lại lên GitHub nếu muốn sửa giao diện.

---

## Phân quyền

| Người dùng | Máy Admin (Chrome Extension) | Máy khác (GitHub Pages) |
|---|---|---|
| Thêm hóa đơn | ✅ | ❌ |
| Sửa / Xóa | ✅ | ❌ |
| Import CSV | ✅ | ❌ |
| Xem bảng | ✅ | ✅ |
| Lọc / Tìm kiếm | ✅ | ✅ |
| Xuất Excel | ✅ | ✅ |
