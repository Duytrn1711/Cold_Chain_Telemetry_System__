# Cold Chain Telemetry System

Ứng dụng quản lý và theo dõi dữ liệu chuỗi lạnh, gồm kho hàng, xe vận chuyển,
thiết bị IoT, telemetry nhiệt độ/độ ẩm và cảnh báo. Repository hiện cung cấp
backend Express, frontend HTML/CSS/JavaScript và dữ liệu PostgreSQL phục vụ
demo, học tập và kiểm thử.

> Đây là prototype/demo, không phải hệ thống đã được chứng nhận cho vận hành
> chuỗi cung ứng hoặc tuân thủ quy định. Không sử dụng dữ liệu, tài khoản hay
> cấu hình mẫu cho môi trường production.

## Chức năng

- Dashboard tổng quan về kho, xe, thiết bị, telemetry, cảnh báo và tuân thủ
  nhiệt độ.
- Tra cứu và quản lý kho, xe vận chuyển, thiết bị cảm biến.
- Xem dữ liệu telemetry, lịch sử theo thiết bị và báo cáo theo kho/xe.
- Tạo telemetry qua API; khi nhiệt độ dưới `2°C` hoặc trên `8°C`, backend tự
  tạo cảnh báo.
- Đăng nhập bằng JWT và giới hạn thao tác theo vai trò.
- Giao diện có trang đăng nhập, dashboard, dữ liệu telemetry, cảnh báo và báo
  cáo.

## Công nghệ

- **Backend:** Node.js, Express 5, PostgreSQL (`pg`), `jsonwebtoken`,
  `bcryptjs`, `cors`, `dotenv`.
- **Frontend:** HTML, CSS, JavaScript thuần, Fetch API và Chart.js.
- **Kiểm thử:** Tài liệu test thủ công trong `QA/Cold_Chain_QA_Test.docx`.
  `backend/package.json` hiện không khai báo script test tự động.

## Cấu trúc repository

```text
.
├── BA/                         # Tài liệu phân tích và sơ đồ nghiệp vụ
├── backend/
│   ├── app.js                  # Express app, API mount và static frontend
│   ├── db.js                   # PostgreSQL connection pool
│   ├── schema.sql              # Tạo bảng và nạp dữ liệu demo
│   ├── seed-warehouses.js      # Thêm telemetry mẫu cho thiết bị kho
│   ├── controllers/            # Xử lý nghiệp vụ API
│   ├── routes/                 # Khai báo API routes
│   └── package.json
├── design-references/          # Tài liệu tham khảo thiết kế
├── frontend/
│   ├── login.html
│   ├── dashboard.html
│   ├── pages/                  # Các trang nghiệp vụ
│   ├── js/                     # Logic giao diện và API client
│   ├── css/
│   └── assets/
├── QA/                         # Tài liệu kiểm thử
└── README.md
```

## Yêu cầu

- Node.js và npm.
- PostgreSQL đang chạy và tài khoản có quyền tạo database, bảng.
- `psql` trong `PATH`, hoặc PostgreSQL SQL Shell để chạy lệnh SQL.
- Trình duyệt hiện đại.

## Cài đặt và chạy

### 1. Tạo database

Tạo database trống:

```sql
CREATE DATABASE cold_chain_telemetry;
```

Từ thư mục gốc repository, nạp schema và dữ liệu mẫu:

```powershell
psql -U postgres -d cold_chain_telemetry -f .\backend\schema.sql
```

**Lưu ý:** `backend/schema.sql` tạo bảng, nạp dữ liệu mẫu và có lệnh
`TRUNCATE` trên các bảng nghiệp vụ. Chỉ chạy trên database demo mới hoặc
database mà bạn chấp nhận bị xóa dữ liệu tương ứng. Đây không phải migration
an toàn để chạy lại trên database đang sử dụng.

Schema mẫu có 10 kho, 20 xe, 40 thiết bị, 400 bản ghi telemetry và 4 tài khoản
demo.

### 2. Cấu hình backend

Tạo `backend/.env` với cấu hình PostgreSQL của máy bạn:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=cold_chain_telemetry

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
```

Không đưa `.env`, mật khẩu hoặc JWT secret thật lên Git. Backend hiện có giá
trị JWT secret dự phòng trong mã nguồn; cần loại bỏ giá trị dự phòng và cấu
hình secret an toàn trước khi triển khai thực tế.

### 3. Cài dependency và khởi động

```powershell
Set-Location .\backend
npm install
npm start
```

Chạy chế độ phát triển có `nodemon`:

```powershell
npm run dev
```

Mặc định ứng dụng chạy tại `http://localhost:3000`. Express phục vụ cả frontend
và API, vì vậy không cần chạy frontend server riêng. Mở:

- Đăng nhập: <http://localhost:3000/login.html>
- Dashboard: <http://localhost:3000/dashboard.html>
- API health check: <http://localhost:3000/api/health>
- Kiểm tra kết nối PostgreSQL: <http://localhost:3000/api/test-db>

Frontend mặc định gọi API tại cùng origin khi chạy trên cổng `3000`; nếu đổi
cổng, cần kiểm tra cấu hình API trong `frontend/js/api.js`.

### Dữ liệu mẫu bổ sung

`backend/seed-warehouses.js` thêm các bản ghi telemetry mẫu cho thiết bị kho.
Schema chính đã có thiết bị kho và dữ liệu ban đầu; chỉ chạy script này nếu
muốn bổ sung thêm dữ liệu. Mỗi lần chạy script sẽ thêm telemetry mới, không
chỉ cập nhật dữ liệu hiện có.

## Tài khoản demo

Các tài khoản được tạo bởi `backend/schema.sql`:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | `ADMIN` |
| `manager` | `manager123` | `MANAGER` |
| `user` | `user123` | `USER` |
| `staff` | `staff123` | `STAFF` |

Chỉ sử dụng trong môi trường local/demo. Đổi mật khẩu sau khi đăng nhập và
không triển khai các tài khoản này trên hệ thống thật. Backend tự băm mật khẩu
mẫu khi tài khoản đăng nhập lần đầu.

## API

Base URL: `http://localhost:3000/api`.

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/health` | Kiểm tra server |
| `GET` | `/test-db` | Kiểm tra kết nối PostgreSQL |
| `POST` | `/auth/login` | Đăng nhập, nhận JWT |
| `GET` | `/auth/me` | Lấy thông tin tài khoản hiện tại; cần đăng nhập |
| `PUT` | `/auth/change-password` | Đổi mật khẩu; cần đăng nhập |
| `GET` | `/warehouses`, `/warehouses/:id` | Danh sách và chi tiết kho |
| `POST`, `PUT` | `/warehouses`, `/warehouses/:id` | Tạo và cập nhật kho |
| `DELETE` | `/warehouses/:id` | Xóa kho |
| `GET` | `/vehicles`, `/vehicles/:id` | Danh sách và chi tiết xe |
| `POST`, `PUT` | `/vehicles`, `/vehicles/:id` | Tạo và cập nhật xe |
| `DELETE` | `/vehicles/:id` | Xóa xe |
| `GET` | `/devices`, `/devices/:id` | Danh sách và chi tiết thiết bị |
| `POST`, `PUT` | `/devices`, `/devices/:id` | Tạo và cập nhật thiết bị |
| `DELETE` | `/devices/:id` | Xóa thiết bị |
| `GET` | `/data/summary` | Số liệu tổng quan cho dashboard |
| `GET` | `/data/reports` | Báo cáo theo kho/xe; hỗ trợ `period` với giá trị `today`, `week`, `month` hoặc `quarter` |
| `GET` | `/data` | Danh sách telemetry; hỗ trợ `device_id`, `warehouse_id`, `vehicle_id`, `page`, `limit` |
| `GET` | `/data/device/:deviceId` | Lịch sử telemetry theo thiết bị |
| `POST` | `/data` | Ghi telemetry; ngoài ngưỡng nhiệt độ sẽ sinh cảnh báo |
| `GET` | `/alerts`, `/alerts/:id` | Danh sách và chi tiết cảnh báo |
| `POST` | `/alerts` | Tạo cảnh báo |
| `DELETE` | `/alerts/:id` | Xóa cảnh báo |

Các endpoint GET được cấu hình đọc công khai. Các thao tác tạo/cập nhật dữ liệu
và cảnh báo yêu cầu role `MANAGER` trở lên; xóa kho, xe và thiết bị yêu cầu
`ADMIN`. Xóa cảnh báo yêu cầu `MANAGER` trở lên. Endpoint `/auth/me` và
`/auth/change-password` yêu cầu đăng nhập.

Các API cần JWT nhận token theo header:

```text
Authorization: Bearer <JWT>
```

### Ví dụ gọi API bằng PowerShell

Đăng nhập:

```powershell
$loginBody = @{
  username = "admin"
  password = "admin123"
} | ConvertTo-Json

$login = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$token = $login.data.token
```

Gửi một bản ghi telemetry:

```powershell
$telemetryBody = @{
  device_id = 1
  temperature = 5.5
  humidity = 75
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/data" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $telemetryBody
```

Khoảng nhiệt độ được backend dùng để đánh giá là `2.0°C`–`8.0°C`; chỉ số thấp
hơn hoặc cao hơn khoảng này sẽ tạo cảnh báo khi ghi telemetry.

## Các trang giao diện

| Trang | Đường dẫn |
|---|---|
| Đăng nhập | `/login.html` |
| Dashboard | `/dashboard.html` |
| Kho | `/pages/warehouses.html` |
| Chi tiết kho | `/pages/warehouses-detail.html?id=1` |
| Xe vận chuyển | `/pages/vehicles.html` |
| Chi tiết xe | `/pages/vehicles-detail.html?id=1` |
| Thiết bị | `/pages/devices.html` |
| Chi tiết thiết bị | `/pages/devices-detail.html?id=1` |
| Telemetry | `/pages/data.html` |
| Cảnh báo | `/pages/alerts.html` |
| Báo cáo | `/pages/reports.html` |

## Kiểm thử

Tài liệu kiểm thử thủ công: [QA/Cold_Chain_QA_Test.docx](QA/Cold_Chain_QA_Test.docx).
Sau khi khởi động server, có thể kiểm tra nhanh:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```
