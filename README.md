# RibbitTalk Backend

Tài liệu hướng dẫn cài đặt và chạy Backend (NestJS + MySQL + Docker) cho dự án RibbitTalk. Mọi thao tác đều được đóng gói sẵn trong Docker để đảm bảo tính đồng nhất.

---

## 1. Chuẩn bị ban đầu (Setup)

**Bước 1: Copy file cấu hình môi trường (.env)**
```bash
cp .env.example .env
```
*(Bạn có thể mở file `.env` lên để xem hoặc sửa thông tin kết nối Database, JWT secret nếu cần).*

**Bước 2: Cài đặt thư viện trên máy gốc (tùy chọn nhưng nên làm)**
Lệnh này giúp trình soạn thảo (VS Code, WebStorm...) của bạn nhận diện code, không bị báo lỗi đỏ (ví dụ báo thiếu thư viện `helmet`, `class-validator`).
```bash
npm install
```

---

## 2. Môi trường Phát triển (Development / Hot-reload)

Khi code tính năng mới, bạn dùng chế độ này. Code sửa xong lưu lại sẽ tự động compile và cập nhật ngay.

**Khởi động Backend (chạy ngầm):**
```bash
docker compose up -d
```
*(Nếu là lần đầu chạy, Docker sẽ tự động pull MySQL và build image NestJS).*

**Xem log (để biết code có lỗi hay chạy thành công không):**
```bash
docker compose logs -f ribbittalk_dev
```

**Tắt Backend:**
```bash
docker compose down
```

---

## 3. Quản lý Database & Migrations

Dự án dùng Raw SQL Migration. Khi bạn khởi động Backend bằng `docker compose up -d`, container `ribbittalk_migrate` sẽ tự động chạy các file `.sql` chưa được chạy vào Database.

Tuy nhiên, nếu bạn tạo file `.sql` mới và muốn ép nó chạy ngay lập tức mà không cần khởi động lại toàn bộ docker:
```bash
docker exec -it ribbittalk_dev npm run db:migrate
```

---

## 4. Môi trường Thực tế (Production)

Khi chuẩn bị đưa dự án lên server chạy thật, hoặc bạn muốn kiểm tra bản build cuối cùng.

**Bước 1: Build Docker Image và Chạy**
```bash
docker compose --profile prod up -d --build
```
*(Lệnh `--build` bắt buộc Docker phải đóng gói code mới nhất của bạn vào Image thay vì dùng lại cache cũ).*

**Bước 2: Xem log Production**
```bash
docker compose logs -f ribbittalk_prod
```

**Bước 3: Tắt Production**
```bash
docker compose --profile prod down
```
