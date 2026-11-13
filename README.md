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
