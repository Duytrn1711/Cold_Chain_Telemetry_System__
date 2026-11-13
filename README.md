# Cold Chain Telemetry System

Cold Chain là dịch vụ tiếp nhận yêu cầu lấy lô hàng từ Agri-Audit, quản lý vận chuyển đến điểm kiểm định, rồi giao đến điểm tiêu thụ nếu lô được duyệt hoặc trả về địa chỉ nông dân nếu bị từ chối. Danh mục kho, xe, thiết bị, telemetry, cảnh báo, lô hàng và lịch sử vận hành được lưu trong PostgreSQL.

Cold Chain cung cấp API tích hợp cho Agri-Audit và giao diện vận hành cho nhân viên. Agri-Audit hiện cần cấu hình phía gửi webhook theo hợp đồng ở dưới; repo này chỉ triển khai phía Cold Chain.

## Yêu cầu

- Node.js và npm
- PostgreSQL
- Tạo database rỗng trước khi chạy schema

## Cài đặt

```powershell
createdb -U postgres cold_chain_telemetry
psql -U postgres -d cold_chain_telemetry -f .\Backend\schema.sql
psql -U postgres -d cold_chain_telemetry -f .\Backend\migrations\20261113_agri_batches.sql
psql -U postgres -d cold_chain_telemetry -f .\Backend\migrations\20261113_user_registration.sql
Copy-Item .\Backend\.env.example .\Backend\.env
Set-Location .\Backend
npm install
```

Điền thông tin database, `JWT_SECRET` (tối thiểu 32 ký tự) và `AGRI_WEBHOOK_SECRET` riêng trong `.env`. Đặt thông tin bootstrap admin mạnh trước khi tạo tài khoản:

```powershell
npm run bootstrap-admin
npm start
```

Ứng dụng mặc định chạy tại `http://localhost:3000`. Không chạy `schema.sql` trên database đã có dữ liệu: file này tạo schema cho database mới. Với database hiện có, sao lưu trước và chạy migration bổ sung Agri batches; không nạp lại seed/demo data.

## Luồng lô hàng

1. Agri-Audit gửi yêu cầu lấy lô hàng đến địa chỉ nông dân.
2. Nhân viên Cold Chain gán kho/xe và cập nhật trạng thái `PICKUP_ASSIGNED`, `PICKED_UP`, `AT_INSPECTION`.
3. Agri-Audit gửi quyết định kiểm định. `APPROVED` chuyển lô sang `DELIVERY_READY`; Cold Chain giao đến `consumption_address`. `REJECTED` chuyển sang `RETURN_READY`; địa chỉ trả hàng là `pickup_address`.
4. Nhân viên ghi nhận `OUT_FOR_DELIVERY` rồi `DELIVERED`, hoặc `OUT_FOR_RETURN` rồi `RETURNED`.

Các trạng thái giao/hoàn trả được backend giới hạn theo quyết định kiểm định. Mỗi event webhook có `event_id` duy nhất để chống xử lý lặp; event ID đã dùng cho lô khác sẽ bị từ chối.

## API tích hợp Agri-Audit

Base URL: `http://<cold-chain-host>:3000/api/integrations/agri/batches`. Hai webhook dùng header dùng chung bí mật:

```text
x-agri-webhook-secret: <AGRI_WEBHOOK_SECRET>
Content-Type: application/json
```

### Tạo yêu cầu lấy hàng

`POST /pickup-requests`

```json
{
  "event_id": "evt-unique-001",
  "batch_code": "AGR-2026-0001",
  "product_name": "Tomato",
  "product_type": "Fresh produce",
  "producer_name": "Nguyen Van A",
  "producer_phone": "+84901234567",
  "pickup_address": "Farm address, commune, district, province",
  "pickup_latitude": 10.1234567,
  "pickup_longitude": 106.1234567,
  "consumption_point_name": "Distribution market",
  "consumption_address": "Market address, district, province",
  "consumption_latitude": 10.2345678,
  "consumption_longitude": 106.2345678,
  "quantity": 250,
  "unit": "kg",
  "production_date": "2026-11-12",
  "expiry_date": "2026-11-20"
}
```

Bắt buộc: `event_id`, `batch_code`, `product_name`, `producer_name`, `pickup_address`, `quantity` dương và `unit`. Tọa độ, liên hệ, loại sản phẩm và ngày là tùy chọn. Gửi lại cùng event/lô trả bản ghi hiện tại mà không tạo event mới.

### Gửi quyết định kiểm định

`POST /:batchCode/inspection-decision`

Duyệt:

```json
{
  "event_id": "evt-unique-002",
  "decision": "APPROVED",
  "consumption_point_name": "Distribution market",
  "consumption_address": "Market address, district, province",
  "consumption_latitude": 10.2345678,
  "consumption_longitude": 106.2345678,
  "decided_at": "2026-11-13T08:30:00Z"
}
```

Từ chối:

```json
{
  "event_id": "evt-unique-003",
  "decision": "REJECTED",
  "reason": "Inspection criteria not met",
  "decided_at": "2026-11-13T08:30:00Z"
}
```

`event_id` là duy nhất toàn hệ thống; từ chối bắt buộc có `reason`; duyệt bắt buộc có `consumption_address`. Khi trả hàng, Cold Chain dùng địa chỉ nông dân đã gửi trong yêu cầu lấy hàng.

## API vận hành Cold Chain

Các endpoint dưới cần JWT. Danh sách lô yêu cầu vai trò STAFF trở lên; cập nhật luồng cần MANAGER trở lên.

- `GET /api/agri-batches?status=PICKUP_REQUESTED`
- `GET /api/agri-batches/:id`
- `PATCH /api/agri-batches/:id/logistics-status`

Ví dụ body cập nhật:

```json
{
  "logistics_status": "PICKUP_ASSIGNED",
  "vehicle_id": 3,
  "warehouse_id": 2,
  "note": "Assigned for farm pickup"
}
```

Giao diện `/pages/agri-batches.html` cho phép tra cứu lô, gán phương tiện/kho và cập nhật các bước vận chuyển. Dữ liệu lô hiển thị từ PostgreSQL.

## Các trang chính

- `/login.html` — đăng nhập hoặc gửi yêu cầu tạo tài khoản
- `/dashboard.html` — số liệu thực từ database
- `/pages/agri-batches.html` — luồng lô hàng Agri-Audit
- `/pages/user-approvals.html` — hàng đợi duyệt tài khoản (ADMIN)
- `/pages/vehicles.html`, `/pages/warehouses.html`, `/pages/devices.html`
- `/pages/data.html`, `/pages/alerts.html`, `/pages/reports.html`

## Đăng ký và phê duyệt tài khoản

Đăng ký công khai chỉ cho phép đề nghị vai trò `STAFF` hoặc `MANAGER`. Mật khẩu được băm trước khi lưu; tài khoản mới ở trạng thái `PENDING` và không thể đăng nhập trước khi admin duyệt. Admin mở mục **Account approvals** để cấp vai trò cuối cùng (`STAFF`/`MANAGER`) hoặc từ chối. Vai trò `ADMIN` chỉ được tạo qua bootstrap/quản trị, không qua form công khai.

API: `POST /api/auth/register` (công khai), `GET /api/auth/registration-requests` và `PATCH /api/auth/users/:id/approval` (chỉ ADMIN).

Dashboard, báo cáo và biểu đồ chỉ dùng bản ghi đã lưu. Khi chưa có dữ liệu, giao diện hiển thị trạng thái rỗng/—. Các trường pin, RSSI, GPS hoặc payload thô không được PostgreSQL schema hiện tại lưu thì được báo là chưa ghi nhận, không tự tạo giá trị.

## Cấu hình bảo mật

- Không đưa `Backend/.env` vào Git.
- Đặt JWT secret và webhook secret dài, ngẫu nhiên và khác nhau.
- Chỉ mở webhook qua mạng tin cậy/HTTPS trong môi trường triển khai; bảo vệ secret như credential.
- Tài khoản admin đầu tiên được tạo bằng `npm run bootstrap-admin`, không có tài khoản demo mặc định.
- Trên database hiện có, chạy thêm migration `20261113_user_registration.sql`; migration này thêm email và dấu vết phê duyệt, không thay đổi tài khoản hiện hữu.

## Công nghệ

Node.js, Express, PostgreSQL, `pg`, JWT, bcryptjs, HTML/CSS/JavaScript thuần và Chart.js.
