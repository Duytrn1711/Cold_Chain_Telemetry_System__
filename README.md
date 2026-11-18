# Cold Chain Telemetry System

Cold Chain là dịch vụ tiếp nhận yêu cầu lấy lô hàng từ Agri-Audit, quản lý vận chuyển đến điểm kiểm định, rồi giao đến điểm tiêu thụ nếu lô được duyệt hoặc trả về địa chỉ nông dân nếu bị từ chối. Danh mục kho, xe, thiết bị, telemetry, cảnh báo, lô hàng và lịch sử vận hành được lưu trong PostgreSQL.

Cold Chain cung cấp API tích hợp cho Agri-Audit và giao diện vận hành cho nhân viên. Có thể chọn webhook push từ Agri-Audit hoặc polling pull do Cold Chain chủ động chạy; chế độ pull không cần thay đổi mã nguồn Agri-Audit.

Cold Chain dùng chế độ pull: cấu hình thông tin đăng nhập admin Agri-Audit trong Environment Variables thì Cold Chain tự gọi API `/batches` ngay khi khởi động và mỗi 5 giây. Mỗi `batch_code` chỉ được nhập một lần.

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

Điền thông tin database và `JWT_SECRET` (tối thiểu 32 ký tự) trong `.env`. Chỉ cần `AGRI_WEBHOOK_SECRET` nếu dùng webhook push; chế độ polling pull không cần shared secret này. Đặt thông tin bootstrap admin mạnh trước khi tạo tài khoản:

```powershell
npm run bootstrap-admin
npm start
```

Ứng dụng mặc định chạy tại `http://localhost:3000`. Không chạy `schema.sql` trên database đã có dữ liệu: file này tạo schema cho database mới. Với database hiện có, sao lưu trước và chạy migration bổ sung Agri batches; không nạp lại seed/demo data.

## Luồng lô hàng

1. Agri-Audit gửi yêu cầu lấy lô hàng đến địa chỉ nông dân.
2. Nhân viên Cold Chain chọn xe và kho tiếp nhận; lô chuyển sang `PICKUP_ASSIGNED` (đang đi lấy hàng). Khi hàng về kho, nhân viên xác nhận để chuyển `PICKED_UP`, rồi bàn giao kiểm định ở trạng thái `AT_INSPECTION`.
3. Agri-Audit gửi quyết định kiểm định. `APPROVED` chuyển lô sang `DELIVERY_READY`; Cold Chain giao đến `consumption_address`. `REJECTED` chuyển sang `RETURN_READY`; địa chỉ trả hàng là `pickup_address`.
4. Nhân viên ghi nhận `OUT_FOR_DELIVERY` rồi `DELIVERED`, hoặc `OUT_FOR_RETURN` rồi `RETURNED`.

Các trạng thái giao/hoàn trả được backend giới hạn theo quyết định kiểm định. Mỗi event webhook có `event_id` duy nhất để chống xử lý lặp; event ID đã dùng cho lô khác sẽ bị từ chối.

## API tích hợp Agri-Audit

### Đồng bộ chủ động từ Agri-Audit (không cần sửa Agri-Audit)

Cold Chain đăng nhập tài khoản Auditor ở `POST /auth/login-auditor`, lấy `access_token`, rồi gọi `GET /batches` với `Authorization: Bearer <token>`. Đặt các biến sau trong Render Environment của Cold Chain:

```text
AGRI_AUDIT_API_URL=https://agri-audit-chain-backend.onrender.com
AGRI_AUDIT_AUDITOR_IDENTIFIER=<email hoặc username Auditor Agri-Audit>
AGRI_AUDIT_AUDITOR_PASSWORD=<mật khẩu Auditor Agri-Audit>
AGRI_AUDIT_POLL_INTERVAL_MS=5000
```

Polling bắt đầu khi Cold Chain khởi động. Dùng tài khoản Auditor dành cho tích hợp; các thông tin đăng nhập chỉ được lưu trên backend Cold Chain, không đưa vào frontend hoặc Git. Access token được giữ trong bộ nhớ và làm mới trước khi hết hạn; nếu API Agri-Audit không truy cập được, Cold Chain ghi lỗi đã khử thông tin nhạy cảm và thử lại ở chu kỳ kế tiếp.

Cold Chain tạo yêu cầu lấy hàng khi phát hiện `batch_code` mới. Khi Agri-Audit đổi trạng thái sang `AUDITED` hoặc `REJECTED`, quyết định được đồng bộ sau khi lô đã ở `AT_INSPECTION`. API danh sách hiện không cung cấp `consumption_address`; vì vậy lô được duyệt sẽ chờ địa chỉ điểm tiêu thụ trước khi xe được phép xuất phát giao hàng. API cần bổ sung trường địa chỉ này để hoàn tất giao tự động theo điểm doanh nghiệp đã chọn.

Polling lấy toàn bộ danh sách `/batches` mỗi chu kỳ vì API hiện chưa có bộ lọc trạng thái hoặc phân trang. Lô sẽ được phát hiện trong tối đa khoảng 5 giây sau khi Agri-Audit tạo; API đọc định kỳ không thể đảm bảo đồng bộ đúng cùng thời điểm tạo lô.

Base URL: `http://<cold-chain-host>:3000/api/integrations/agri/batches`. Hai webhook dùng header dùng chung bí mật:

```text
x-agri-webhook-secret: <AGRI_WEBHOOK_SECRET>
Content-Type: application/json
```

### Tạo yêu cầu lấy hàng

`POST /pickup-requests`

Agri-Audit gửi các trường nông dân đã nhập cùng `event_id` và `batch_code` do hệ thống tự sinh:

```json
{
  "event_id": "evt-unique-001",
  "batch_code": "AGR-2026-0001",
  "product_name": "Tomato",
  "product_type": "Fresh produce",
  "origin": "Farm address, commune, district, province",
  "quantity": 250,
  "unit": "kg",
  "production_date": "2026-11-12",
  "expiry_date": "2026-11-20",
  "note": "Harvested this morning",
  "producer_name": "Nguyen Van A",
  "farmer_id": 2042
}
```

Bắt buộc từ form nông dân: `product_name` và `product_type` dài 2–200 ký tự, `origin` dài 2–200 ký tự, `quantity` lớn hơn 0 và `unit` dài 1–50 ký tự. `production_date`, `expiry_date`, `note`, `producer_name` và `farmer_id` là tùy chọn. `event_id` và `batch_code` là metadata do Agri-Audit tự sinh; chúng cùng trạng thái kiểm định/điều phối được lưu trong `cold_chain_batch_operations`. Bảng `agri_batches` chỉ lưu dữ liệu lô trong ảnh và khóa kỹ thuật `id`. `origin` được dùng làm địa chỉ lấy hàng và hoàn trả nông dân. `producer_name` có thể null; `farmer_id` là mã tham chiếu từ Agri-Audit, không có khóa ngoại cục bộ. Gửi lại cùng event/lô trả bản ghi hiện tại mà không tạo event mới.

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

Danh sách và chi tiết lô trả thêm `vehicle_license_plate` (biển số xe đã chọn) và `warehouse_name` (kho tiếp nhận), bên cạnh `vehicle_id`, `warehouse_id`, `logistics_status` và `external_batch_code`. Hai trường tên xe/kho là `null` trước khi điều phối.

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

## Lưu ý phát triển

- Backend đang phục vụ frontend static bằng Express nên không cần chạy frontend dev server riêng.
- Database sử dụng PostgreSQL, không phải SQLite.
- Schema hiện dùng ID do ứng dụng tự sinh bằng `MAX(id) + 1`; khi kiểm thử đồng thời cần chú ý nguy cơ trùng ID.
- Một số thông tin hiển thị trên UI như RSSI, pin, tuyến đường hoặc dữ liệu chart có thể là dữ liệu mô phỏng phục vụ demo.
- Không dùng tài khoản và JWT secret mặc định trong môi trường production.

## License

Dự án phục vụ mục đích học tập, minh họa và phát triển nội bộ. Chưa khai báo license phát hành công khai.
