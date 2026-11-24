/* Lightweight Vietnamese / English UI localization for all frontend pages. */
(function () {
    const phrases = [
        ["Cold Chain Logistics Operations", "Hoạt động logistics chuỗi lạnh"],
        ["TELEMETRY MANAGEMENT", "QUẢN LÝ DỮ LIỆU GIÁM SÁT"],
        ["MAIN", "CHÍNH"], ["MANAGEMENT", "QUẢN LÝ"],
        ["Dashboard", "Tổng quan"], ["Warehouses", "Kho lạnh"],
        ["Delivery Vehicles", "Xe vận chuyển"], ["Devices", "Thiết bị"],
        ["Telemetry Data", "Dữ liệu giám sát"], ["Alerts", "Cảnh báo"],
        ["Reports", "Báo cáo"], ["Agri Batch Logistics", "Điều phối lô hàng Agri"],
        ["Account approvals", "Duyệt tài khoản"], ["Account management", "Quản lý tài khoản"], ["Administrator", "Quản trị viên"],
        ["Sign Out", "Đăng xuất"], ["Logout", "Đăng xuất"],
        ["Quick search...", "Tìm kiếm nhanh..."], ["Quick search packets, devices...", "Tìm gói dữ liệu, thiết bị..."],
        ["Quick search facilities, devices, batches...", "Tìm kho, thiết bị, lô hàng..."],
        ["Systems Nominal (2°C - 8°C)", "Hệ thống ổn định (2°C - 8°C)"],
        ["Systems Nominal (2°C – 8°C)", "Hệ thống ổn định (2°C – 8°C)"],
        ["Notifications", "Thông báo"], ["Updated: just now", "Cập nhật: vừa xong"],
        ["Live", "Trực tiếp"], ["Last updated:", "Cập nhật lần cuối:"],
        ["Cold Storage Warehouses", "Kho lạnh"], ["Monitored cold rooms, vaccine chambers, and environmental depot hubs", "Theo dõi kho lạnh, buồng bảo quản và các điểm trung chuyển"],
        ["Active Network", "Mạng lưới đang hoạt động"], ["Export Facility Data", "Xuất dữ liệu kho"],
        ["Add New Warehouse", "Thêm kho mới"], ["Add Warehouse", "Thêm kho"],
        ["MONITORED FACILITIES", "CƠ SỞ ĐANG GIÁM SÁT"], ["ACTIVE CHAMBER PROBES", "ĐẦU DÒ ĐANG HOẠT ĐỘNG"],
        ["AVG COLD TEMP", "NHIỆT ĐỘ LẠNH TRUNG BÌNH"], ["THERMAL EXCURSIONS", "LẦN VƯỢT NGƯỠNG NHIỆT"],
        ["Registered Facilities", "Danh sách kho"], ["Facilities", "Kho"], ["LOCATION", "VỊ TRÍ"],
        ["STATUS", "TRẠNG THÁI"], ["TELEMETRIES", "DỮ LIỆU GIÁM SÁT"], ["AVG TEMP", "NHIỆT ĐỘ TB"],
        ["ACTION", "THAO TÁC"], ["Details", "Chi tiết"], ["COORDINATES", "TỌA ĐỘ"],
        ["FACILITY MANAGER", "QUẢN LÝ CƠ SỞ"], ["COMMISSIONED", "NGÀY ĐƯA VÀO HOẠT ĐỘNG"],
        ["COMPLIANCE STD.", "TIÊU CHUẨN TUÂN THỦ"], ["Not recorded", "Chưa có dữ liệu"],
        ["ACTIVE", "ĐANG HOẠT ĐỘNG"], ["INACTIVE", "NGỪNG HOẠT ĐỘNG"], ["Online", "Trực tuyến"],
        ["Delivery Vehicles", "Xe vận chuyển"], ["Real-time telemetry tracking and reefer condition monitoring for refrigerated fleet", "Theo dõi dữ liệu trực tiếp và tình trạng làm lạnh của đội xe"],
        ["Fleet Status Filter", "Lọc trạng thái đội xe"], ["Add Vehicle", "Thêm xe"], ["Export Telemetry Log", "Xuất nhật ký dữ liệu"],
        ["Reefer Fleet Live Nodes", "Thiết bị giám sát đội xe lạnh"], ["IN TRANSIT", "ĐANG VẬN CHUYỂN"],
        ["All Fleet", "Toàn bộ đội xe"], ["Unassigned to shipment", "Chưa gán lô hàng"], ["Temperature excursion", "Vượt ngưỡng nhiệt độ"],
        ["Search by license plate (e.g. 29A-12345), driver, or route...", "Tìm biển số xe, tài xế hoặc tuyến đường..."],
        ["Assigned depot:", "Kho được phân công:"], ["Database status:", "Trạng thái dữ liệu:"], ["No active Agri shipment", "Không có lô Agri đang vận chuyển"],
        ["CARGO TEMP", "NHIỆT ĐỘ HÀNG"], ["HUMIDITY", "ĐỘ ẨM"], ["IOT NODE", "THIẾT BỊ IoT"], ["BATTERY", "PIN"], ["SPEED", "TỐC ĐỘ"],
        ["Safe Range", "Ngưỡng an toàn"], ["Safe band", "Khoảng an toàn"], ["Safe Range (2°C - 8°C)", "Ngưỡng an toàn (2°C - 8°C)"],
        ["Not recorded", "Chưa ghi nhận"], ["Recorded humidity", "Độ ẩm đã ghi nhận"], ["Battery telemetry is not stored", "Chưa lưu dữ liệu pin"],
        ["Waiting for battery telemetry", "Đang chờ dữ liệu pin"], ["Sensor has not sent battery level", "Cảm biến chưa gửi mức pin"],
        ["No live battery telemetry", "Chưa có dữ liệu pin trực tiếp"], ["Simulated sensor reading", "Số đo cảm biến mô phỏng"],
        ["Live sensor reading", "Số đo cảm biến trực tiếp"], ["Speed appears during transport", "Tốc độ hiển thị khi xe vận chuyển"],
        ["No live speed reading", "Chưa có số đo tốc độ trực tiếp"], ["Simulated vehicle speed", "Tốc độ xe mô phỏng"],
        ["Live vehicle speed", "Tốc độ xe trực tiếp"],
        ["Vehicle", "Xe"], ["Edit", "Sửa"], ["Delete", "Xóa"], ["Save", "Lưu"], ["Cancel", "Hủy"], ["Close", "Đóng"],
        ["Add Device", "Thêm thiết bị"], ["Add New Device", "Thêm thiết bị mới"], ["Device Token", "Mã thiết bị"],
        ["Time-Series Thermal & Humidity Profile", "Biểu đồ nhiệt độ và độ ẩm theo thời gian"],
        ["Observed Temperature (°C)", "Nhiệt độ ghi nhận (°C)"], ["Live Temperature (°C)", "Nhiệt độ trực tiếp (°C)"],
        ["Recent Raw Telemetry Records", "Các bản ghi giám sát gần đây"], ["ID", "Mã"], ["TEMPERATURE (°C)", "NHIỆT ĐỘ (°C)"],
        ["HUMIDITY (%)", "ĐỘ ẨM (%)"], ["RECEIVED TIMESTAMP", "THỜI GIAN NHẬN"], ["EXCURSION", "VƯỢT NGƯỠNG"],
        ["SAFE", "AN TOÀN"], ["CURRENT TEMPERATURE", "NHIỆT ĐỘ HIỆN TẠI"], ["RELATIVE HUMIDITY", "ĐỘ ẨM TƯƠNG ĐỐI"],
        ["BATTERY RESERVE", "PIN CÒN LẠI"], ["RSSI SIGNAL", "TÍN HIỆU RSSI"], ["Probe Calibration", "Hiệu chuẩn đầu dò"],
        ["Calibration evidence", "Hồ sơ hiệu chuẩn"], ["Back to Devices", "Quay lại danh sách thiết bị"],
        ["ACTIVE TRANSMITTING NODES", "THIẾT BỊ ĐANG TRUYỀN"], ["NOMINAL RANGE COMPLIANCE", "TUÂN THỦ NGƯỠNG CHUẨN"],
        ["ACTIVE EXCURSIONS", "LẦN VƯỢT NGƯỠNG ĐANG HOẠT ĐỘNG"], ["INGESTION & PACKET RATE", "TIẾP NHẬN VÀ TẦN SUẤT GÓI TIN"],
        ["Safe standard: 2.0°C to 8.0°C", "Ngưỡng an toàn: 2,0°C đến 8,0°C"], ["No database alert details", "Không có chi tiết cảnh báo trong cơ sở dữ liệu"],
        ["No ingestion latency metrics are stored", "Chưa lưu số liệu độ trễ tiếp nhận"],
        ["Live Time-Series Temperature Fluctuation", "Biến động nhiệt độ theo thời gian thực"],
        ["Thermal Band Distribution", "Phân bố các ngưỡng nhiệt độ"], ["PostgreSQL readings", "Số đo PostgreSQL"],
        ["Refresh data", "Làm mới dữ liệu"], ["Log Reading", "Ghi nhận số đo"], ["Export CSV", "Xuất CSV"],
        ["All Devices (All Nodes)", "Tất cả thiết bị"], ["All Warehouses", "Tất cả kho"], ["All Vehicles", "Tất cả xe"],
        ["All Statuses", "Tất cả trạng thái"], ["Normal (2.0°C - 8.0°C)", "Bình thường (2,0°C - 8,0°C)"],
        ["High Excursion (>8.0°C)", "Nhiệt độ cao (>8,0°C)"], ["Low Excursion (<2.0°C)", "Nhiệt độ thấp (<2,0°C)"],
        ["Humidity Warning (>80%)", "Cảnh báo độ ẩm (>80%)"], ["Search Telemetry ID, Device Token, Location...", "Tìm mã dữ liệu, mã thiết bị, vị trí..."],
        ["Reset Filters", "Xóa bộ lọc"], ["TELEMETRY ID", "MÃ DỮ LIỆU"], ["DEVICE TOKEN", "MÃ THIẾT BỊ"],
        ["MONITORED ENTITY / ASSET", "ĐỐI TƯỢNG / TÀI SẢN GIÁM SÁT"], ["TEMPERATURE", "NHIỆT ĐỘ"], ["HUMIDITY", "ĐỘ ẨM"],
        ["SIGNAL & LATENCY", "TÍN HIỆU VÀ ĐỘ TRỄ"], ["TIMESTAMP (UTC+7)", "THỜI GIAN (UTC+7)"], ["ACTIONS", "THAO TÁC"],
        ["Showing measurements persisted in PostgreSQL.", "Đang hiển thị các số đo đã lưu trong PostgreSQL."],
        ["Sub-zero (<2°C)", "Dưới ngưỡng (<2°C)"], ["Safe Band (2-8°C)", "Ngưỡng an toàn (2-8°C)"], ["Excursion (>8°C)", "Vượt ngưỡng (>8°C)"],
        ["Alerts & Incidents", "Cảnh báo và sự cố"], ["Cold chain temperature excursions, environmental anomalies, and hardware alerts", "Cảnh báo nhiệt độ, bất thường môi trường và sự cố thiết bị chuỗi lạnh"],
        ["Active Breach", "Sự cố đang hoạt động"], ["Safe Thresholds (2°C - 8°C)", "Ngưỡng an toàn (2°C - 8°C)"],
        ["Acknowledge All", "Xác nhận tất cả"], ["ACTIVE ALERTS", "CẢNH BÁO ĐANG HOẠT ĐỘNG"],
        ["CRITICAL EXCURSIONS", "VƯỢT NGƯỠNG NGHIÊM TRỌNG"], ["WARNINGS", "CẢNH BÁO"], ["RESOLVED TODAY", "ĐÃ XỬ LÝ HÔM NAY"],
        ["Requires attention", "Cần xử lý"], ["Resolved alerts", "Cảnh báo đã xử lý"], ["Threshold proximity", "Gần ngưỡng giới hạn"],
        ["Active Incident Queue", "Danh sách sự cố đang hoạt động"], ["FILTER:", "LỌC:"], ["All", "Tất cả"], ["Excursions", "Vượt ngưỡng"],
        ["Equipment", "Thiết bị"], ["SEVERITY", "MỨC ĐỘ"], ["DEVICE", "THIẾT BỊ"], ["VEHICLE / FACILITY", "XE / CƠ SỞ"],
        ["ALERT TYPE", "LOẠI CẢNH BÁO"], ["TRIGGERED VALUE", "GIÁ TRỊ KÍCH HOẠT"], ["TIMESTAMP", "THỜI GIAN"],
        ["Displaying active & recent incidents · Continuous sync frequency", "Hiển thị sự cố đang hoạt động và gần đây · Đồng bộ liên tục"],
        ["Incident Details:", "Chi tiết sự cố:"], ["Incident Progression (Recent Telemetry)", "Diễn biến sự cố (dữ liệu gần đây)"],
        ["RECOMMENDED STANDARD OPERATING PROCEDURE", "QUY TRÌNH VẬN HÀNH ĐƯỢC ĐỀ XUẤT"],
        ["Dispatch unavailable", "Chưa hỗ trợ điều phối"], ["Maintenance dispatch is not integrated", "Chức năng điều phối bảo trì chưa được tích hợp"],
        ["Generate Report", "Tạo báo cáo"], ["Export Report", "Xuất báo cáo"], ["Report Overview", "Tổng quan báo cáo"],
        ["Operational Reports", "Báo cáo vận hành"], ["Temperature Compliance", "Mức độ tuân thủ nhiệt độ"],
        ["Start Date", "Ngày bắt đầu"], ["End Date", "Ngày kết thúc"], ["Apply Filters", "Áp dụng bộ lọc"],
        ["Agri Batch Logistics", "Điều phối lô hàng Agri"], ["Lô nông sản từ Agri Audit", "Lô nông sản từ Agri Audit"],
        ["According to Agri-Audit batches", "Theo dõi các lô hàng từ Agri-Audit"],
        ["NÔNG DÂN", "NÔNG DÂN"], ["ĐIỂM LẤY", "ĐIỂM LẤY"], ["ĐÍCH ĐẾN", "ĐÍCH ĐẾN"], ["SỐ LƯỢNG", "SỐ LƯỢNG"],
        ["KIỂM ĐỊNH", "KIỂM ĐỊNH"], ["VẬN CHUYỂN", "VẬN CHUYỂN"], ["XE / THAO TÁC", "XE / THAO TÁC"],
        ["No batches found", "Không tìm thấy lô hàng"], ["Choose vehicle & dispatch", "Chọn xe và điều phối"],
        ["Confirm arrived at warehouse", "Xác nhận hàng đã về kho"], ["Inspection handoff", "Bàn giao kiểm định"],
        ["Account Approvals", "Duyệt tài khoản"], ["Pending approvals", "Yêu cầu chờ duyệt"], ["Approve", "Phê duyệt"],
        ["Reject", "Từ chối"], ["Full Name", "Họ và tên"], ["Username", "Tên đăng nhập"], ["Role", "Vai trò"],
        ["Requested At", "Thời gian yêu cầu"], ["No pending account requests", "Không có yêu cầu tài khoản chờ duyệt"],
        ["Sign In", "Đăng nhập"], ["Sign in", "Đăng nhập"], ["Welcome back", "Chào mừng trở lại"],
        ["Sign in to your Cold Chain operations system.", "Đăng nhập vào hệ thống vận hành Cold Chain."],
        ["Email or username", "Email hoặc tên đăng nhập"], ["Password", "Mật khẩu"], ["Remember me on this device", "Giữ đăng nhập trên thiết bị này"],
        ["Create account", "Tạo tài khoản"], ["Register", "Đăng ký"], ["Request access", "Gửi yêu cầu truy cập"],
        ["No account yet?", "Chưa có tài khoản?"], ["Submit registration request", "Gửi yêu cầu đăng ký"],
        ["Access is granted after admin approval", "Quyền truy cập được cấp sau khi quản trị viên phê duyệt"],
        ["Company staff system", "Hệ thống nhân sự công ty"], ["Company operations management", "Quản lý vận hành công ty"],
        ["Temperature monitoring", "Giám sát nhiệt độ"], ["Batch coordination", "Điều phối lô hàng"],
        ["Show password", "Hiện mật khẩu"], ["Hide password", "Ẩn mật khẩu"],
        ["No data available", "Chưa có dữ liệu"], ["Loading...", "Đang tải..."], ["Loading", "Đang tải"],
        ["Search", "Tìm kiếm"], ["Filter", "Lọc"], ["Refresh", "Làm mới"], ["Save Changes", "Lưu thay đổi"],
        ["Success", "Thành công"], ["Error", "Lỗi"], ["Warning", "Cảnh báo"], ["Normal", "Bình thường"],
        ["High", "Cao"], ["Low", "Thấp"], ["Pending", "Đang chờ"], ["Approved", "Đã duyệt"], ["Rejected", "Bị từ chối"],
        ["Resolved", "Đã xử lý"], ["Critical", "Nghiêm trọng"], ["Active", "Đang hoạt động"], ["Inactive", "Ngừng hoạt động"],
        ["Page", "Trang"], ["of", "/"], ["Records", "bản ghi"], ["Record", "bản ghi"], ["Showing", "Đang hiển thị"],
        ["No telemetry records logged for this sensor device", "Thiết bị này chưa có bản ghi giám sát"],
        ["Assigned to Warehouse:", "Được gán cho kho:"], ["Installed on Reefer Vehicle:", "Được lắp trên xe lạnh:"], ["Standby Sensor", "Thiết bị dự phòng"],
        ["Cảnh báo nhiệt độ mới", "Cảnh báo nhiệt độ mới"], ["Chào mừng trở lại", "Chào mừng trở lại"]
        , ["Last 24 Hours", "24 giờ qua"], ["Last 7 Days", "7 ngày qua"], ["Last 30 Days", "30 ngày qua"],
        ["SEVERITY", "MỨC ĐỘ"], ["DEVICE ID", "MÃ THIẾT BỊ"], ["ASSET / FACILITY", "TÀI SẢN / CƠ SỞ"],
        ["EVENT DETAIL", "CHI TIẾT SỰ KIỆN"], ["VALUE", "GIÁ TRỊ"], ["TIME", "THỜI GIAN"],
        ["Temperature alerts", "Cảnh báo nhiệt độ"], ["Database status", "Trạng thái cơ sở dữ liệu"],
        ["Review alerts", "Xem cảnh báo"], ["Search by Device ID, token or serial...", "Tìm mã thiết bị, token hoặc số sê-ri..."],
        ["All Assignments", "Tất cả phân công"], ["Assignment:", "Phân công:"], ["Warehouse Hubs", "Các kho"],
        ["TOKEN / MAC", "TOKEN / MAC"], ["ASSIGNED ENTITY", "ĐỐI TƯỢNG ĐƯỢC GÁN"], ["ENTITY TYPE", "LOẠI ĐỐI TƯỢNG"],
        ["SIGNAL / RSSI", "TÍN HIỆU / RSSI"], ["CURRENT TEMP", "NHIỆT ĐỘ HIỆN TẠI"], ["Previous", "Trước"], ["Next", "Tiếp"],
        ["Register New IoT Sensor", "Đăng ký cảm biến IoT mới"], ["Edit IoT Sensor Device", "Sửa thiết bị cảm biến IoT"],
        ["Device Token / Serial Identifier *", "Mã thiết bị / số sê-ri *"], ["Assign to Cold Warehouse (Optional)", "Gán vào kho lạnh (không bắt buộc)"],
        ["Or Assign to Reefer Vehicle (Optional)", "Hoặc gán vào xe lạnh (không bắt buộc)"], ["Loading database locations…", "Đang tải vị trí từ cơ sở dữ liệu…"],
        ["Loading database vehicles…", "Đang tải danh sách xe từ cơ sở dữ liệu…"], ["Register Device", "Đăng ký thiết bị"], ["Save Device", "Lưu thiết bị"],
        ["Download Compliance PDF", "Tải PDF tuân thủ"], ["Calibration records are not available", "Chưa có hồ sơ hiệu chuẩn"],
        ["License Plate *", "Biển số xe *"], ["Assigned Warehouse Hub *", "Kho được phân công *"], ["Initial Status", "Trạng thái ban đầu"],
        ["Save Vehicle", "Lưu xe"], ["Update Vehicle", "Cập nhật xe"], ["Add Refrigerated Vehicle", "Thêm xe lạnh"],
        ["Search by warehouse name, facility code, or location...", "Tìm tên kho, mã cơ sở hoặc vị trí..."],
        ["All Statuses", "Tất cả trạng thái"], ["Active Facilities", "Cơ sở đang hoạt động"], ["Maintenance / Inactive", "Bảo trì / Ngừng hoạt động"],
        ["All Regions (National)", "Tất cả khu vực (toàn quốc)"], ["Northern Region", "Miền Bắc"], ["Central Region", "Miền Trung"], ["Southern Region", "Miền Nam"],
        ["ID & FACILITY", "MÃ & CƠ SỞ"], ["Select a warehouse", "Chọn một kho"], ["Warehouse telemetry", "Dữ liệu giám sát kho"],
        ["Add New Cold Storage Facility", "Thêm cơ sở kho lạnh mới"], ["Facility Name *", "Tên cơ sở *"],
        ["Search by license plate, driver, or route...", "Tìm biển số xe, tài xế hoặc tuyến đường..."],
        ["All Fleet", "Toàn bộ đội xe"], ["Unassigned to shipment", "Chưa gán lô hàng"], ["Add Refrigerated Vehicle", "Thêm xe lạnh"],
        ["Select a vehicle", "Chọn xe"], ["Cargo Temp", "Nhiệt độ hàng"], ["Vehicle Temperature Profile", "Biểu đồ nhiệt độ xe"],
        ["Route & Geofence", "Tuyến đường và vùng địa lý"], ["Telemetry Ping History", "Lịch sử dữ liệu giám sát"],
        ["LICENSE PLATE", "BIỂN SỐ XE"], ["LATEST TEMP", "NHIỆT ĐỘ MỚI NHẤT"], ["View Sensor", "Xem cảm biến"], ["View Vehicle", "Xem xe"],
        ["Facility & Delivery Fleet", "Cơ sở và đội xe"], ["ENTITY / FACILITY NAME", "TÊN ĐỐI TƯỢNG / CƠ SỞ"], ["CATEGORY", "DANH MỤC"],
        ["SENSOR NODES", "THIẾT BỊ CẢM BIẾN"], ["TOTAL READINGS", "TỔNG SỐ ĐO"], ["COMPLIANCE RATE", "TỶ LỆ TUÂN THỦ"],
        ["RECORDED RANGE", "KHOẢNG ĐÃ GHI NHẬN"], ["AUDIT STATUS", "TRẠNG THÁI KIỂM ĐỊNH"], ["All Time (Database)", "Toàn bộ thời gian (cơ sở dữ liệu)"],
        ["Today (Past 24 Hours)", "Hôm nay (24 giờ qua)"], ["Past 7 Days", "7 ngày qua"], ["Past 30 Days (Rolling)", "30 ngày gần nhất"],
        ["Certification unavailable", "Chưa hỗ trợ chứng nhận"], ["Certification evidence is not stored", "Chưa lưu hồ sơ chứng nhận"],
        ["Batch Logistics", "Quản lý lô hàng"], ["Cold Chain · Batch Logistics", "Cold Chain · Quản lý lô hàng"],
        ["Agri-Audit integration", "Tích hợp Agri-Audit"], ["TEMPERATURE / HUMIDITY", "NHIỆT ĐỘ / ĐỘ ẨM"],
        ["Yêu cầu đăng ký tài khoản", "Account Registration Requests"],
        ["Chọn vai trò được cấp trước khi phê duyệt. Tài khoản chờ duyệt chưa thể đăng nhập.", "Select the role to grant before approval. Pending accounts cannot sign in."],
        ["Refresh", "Làm mới"], ["HỌ TÊN", "FULL NAME"], ["TÊN ĐĂNG NHẬP", "USERNAME"], ["EMAIL", "EMAIL"],
        ["VAI TRÒ ĐỀ NGHỊ", "REQUESTED ROLE"], ["NGÀY GỬI", "SUBMITTED"], ["THAO TÁC", "ACTIONS"],
        ["Đang tải yêu cầu…", "Loading requests…"], ["Đang tải dữ liệu từ PostgreSQL...", "Loading data from PostgreSQL..."],
        ["Lô nông sản từ Agri Audit", "Agri-Audit Produce Batches"],
        ["Theo dõi lấy hàng, chuyển đến kiểm định và giao hoặc hoàn trả theo kết quả.", "Track pickup, inspection transfer, and delivery or return based on the result."],
        ["All statuses", "Tất cả trạng thái"], ["Search batch code, product, farmer...", "Tìm mã lô, sản phẩm, nông dân..."],
        ["Search batches", "Tìm lô hàng"], ["Loading data from PostgreSQL...", "Đang tải dữ liệu từ PostgreSQL..."],
        ["BATCH / PRODUCT", "MÃ LÔ / SẢN PHẨM"], ["FARMER", "NÔNG DÂN"], ["PICKUP LOCATION", "ĐIỂM LẤY"],
        ["DESTINATION", "ĐÍCH ĐẾN"], ["QUANTITY", "SỐ LƯỢNG"], ["INSPECTION", "KIỂM ĐỊNH"], ["TRANSPORT", "VẬN CHUYỂN"],
        ["VEHICLE / ACTION", "XE / THAO TÁC"], ["No batches found", "Không tìm thấy lô hàng"],
        ["Awaiting result", "Chờ kết quả"], ["Passed", "Đạt"], ["Rejected", "Từ chối"],
        ["Waiting for Agri to provide the destination", "Đang chờ Agri cung cấp điểm tiêu thụ"],
        ["Waiting for pickup dispatch", "Chờ điều xe lấy hàng"], ["Picking up from farmer", "Đang đi lấy hàng"],
        ["Goods received at warehouse", "Hàng đã về kho"], ["Handed over for inspection", "Đã bàn giao kiểm định"],
        ["Approved · awaiting delivery to destination", "Đã duyệt · chờ giao điểm tiêu thụ"],
        ["Rejected · awaiting return to farmer", "Bị từ chối · chờ hoàn nông dân"],
        ["Delivering to consumption point", "Đang giao điểm tiêu thụ"], ["Returning to farmer", "Đang hoàn về nông dân"],
        ["Delivered to destination", "Đã giao điểm tiêu thụ"], ["Returned to farmer", "Đã hoàn nông dân"], ["Cancelled", "Đã hủy"],
        ["Select vehicle and dispatch", "Chọn xe và điều phối"], ["Confirm goods received at warehouse", "Xác nhận hàng đã về kho"],
        ["Hand over for inspection", "Bàn giao kiểm định"], ["Start delivery", "Xuất phát giao hàng"],
        ["Start return", "Xuất phát hoàn hàng"], ["Confirm delivery", "Xác nhận đã giao"], ["Confirm return", "Xác nhận đã hoàn"],
        ["No vehicle assigned", "Chưa gán xe"], ["No further action", "Không còn thao tác"],
        ["Waiting for live reading", "Chờ số đo trực tiếp"], ["Not in transit", "Chưa vận chuyển"],
        ["SIMULATION", "MÔ PHỎNG"], ["SENSOR", "CẢM BIẾN"], ["No available active vehicle", "Chưa có xe trống đang hoạt động"],
        ["No active receiving warehouse", "Chưa có kho đang hoạt động"], ["Dispatch pickup vehicle", "Điều xe lấy hàng"],
        ["No batches match the filters.", "Không có lô nào khớp bộ lọc."],
        ["Agri-Audit just sent a batch:", "Agri-Audit vừa gửi lô hàng:"], ["new batches", "lô hàng mới"],
        ["New batch received by Cold Chain", "Cold Chain nhận lô hàng mới"],
        ["Hệ thống Cold Chain", "Cold Chain System"], ["Một nơi để đội ngũ công ty theo dõi và điều phối hoạt động chuỗi lạnh.", "A central place for company teams to monitor and coordinate cold-chain operations."],
        ["Vận hành chuỗi lạnh an toàn, minh bạch.", "Safe and transparent cold-chain operations."],
        ["Hệ thống công ty quản lý kho lạnh, đội xe, thiết bị giám sát và quá trình vận chuyển nông sản từ điểm lấy hàng đến nơi tiêu thụ.", "The company system manages cold storage, fleet, monitoring devices, and produce transport from pickup to destination."],
        ["Hệ thống vận hành nội bộ", "Internal Operations System"], ["Hệ thống nhân sự công ty", "Company Staff System"],
        ["Tài khoản", "Account"], ["Đăng nhập", "Sign in"], ["Đăng ký", "Register"], ["Chào mừng trở lại", "Welcome back"],
        ["Đăng nhập vào hệ thống vận hành Cold Chain.", "Sign in to the Cold Chain operations system."],
        ["Email hoặc tên đăng nhập", "Email or username"], ["Mật khẩu", "Password"], ["Hiện mật khẩu", "Show password"],
        ["Hiện", "Show"], ["Ẩn", "Hide"], ["Giữ đăng nhập trên thiết bị này", "Keep me signed in on this device"],
        ["Chưa có tài khoản?", "Don't have an account?"], ["Gửi yêu cầu đăng ký", "Submit registration request"],
        ["Tạo tài khoản", "Create account"], ["Yêu cầu sẽ được admin xem xét trước khi bạn có thể đăng nhập.", "Your request will be reviewed by an administrator before you can sign in."],
        ["Họ và tên", "Full name"], ["Tên đăng nhập", "Username"], ["Email công ty", "Company email"],
        ["Vai trò đề nghị", "Requested role"], ["Nhân viên (Staff)", "Staff"],
        ["Tối thiểu 10 ký tự.", "At least 10 characters."], ["Nhập lại mật khẩu", "Confirm password"],
        ["Đã có tài khoản?", "Already have an account?"], ["Quay lại đăng nhập", "Back to sign in"],
        ["Quyền truy cập được cấp sau khi admin phê duyệt", "Access is granted after administrator approval"],
        ["Chọn ngôn ngữ / Select language", "Select language / Chọn ngôn ngữ"]
        , ["Telemetry Feed Live", "Luồng dữ liệu trực tiếp"],
        ["Real-time overview of your cold chain operations & critical compliance metrics", "Tổng quan hoạt động chuỗi lạnh và các chỉ số tuân thủ quan trọng theo thời gian thực"],
        ["Refresh (10s ago)", "Làm mới (10 giây trước)"], ["Export Log", "Xuất nhật ký"],
        ["Active Network", "Mạng lưới đang hoạt động"], ["Monitored cold rooms, vaccine chambers, and environmental depot hubs", "Theo dõi kho lạnh, buồng bảo quản vắc-xin và điểm trung chuyển"],
        ["Active Reefers Only", "Chỉ xe lạnh đang hoạt động"], ["Excursion Vehicles", "Xe vượt ngưỡng"], ["Fleet Status Filter", "Lọc trạng thái đội xe"],
        ["Real-time telemetry tracking and reefer condition monitoring for refrigerated fleet", "Theo dõi dữ liệu trực tiếp và tình trạng làm lạnh của đội xe"],
        ["Monitor IoT sensor hardware, calibration dates, battery levels, and telemetry tokens", "Theo dõi thiết bị cảm biến IoT, ngày hiệu chuẩn, pin và mã dữ liệu"],
        ["Bulk Firmware Sync", "Đồng bộ firmware hàng loạt"], ["Register Device", "Đăng ký thiết bị"], ["14 Active Nodes", "14 thiết bị đang hoạt động"],
        ["Temperature excursions are shown here when persisted telemetry exceeds the configured range.", "Các lần vượt ngưỡng nhiệt độ sẽ hiển thị ở đây khi số đo đã lưu vượt khoảng cấu hình."],
        ["Cold Chain Reports & Compliance Audits", "Báo cáo chuỗi lạnh và kiểm tra tuân thủ"],
        ["Regulatory compliance reports, excursion root-cause analysis, Mean Kinetic Temperature (MKT), and executive audit exports", "Báo cáo tuân thủ quy định, phân tích nguyên nhân vượt ngưỡng, nhiệt độ động học trung bình (MKT) và dữ liệu kiểm tra cho lãnh đạo"],
        ["Database report", "Báo cáo cơ sở dữ liệu"], ["All Time (Database)", "Toàn bộ thời gian (cơ sở dữ liệu)"],
        ["Today (Past 24 Hours)", "Hôm nay (24 giờ qua)"], ["Past 7 Days", "7 ngày qua"], ["Past 30 Days (Rolling)", "30 ngày gần nhất"],
        ["Q3 2026 Audit", "Kiểm tra quý 3 năm 2026"], ["Generate New Report", "Tạo báo cáo mới"],
        ["Alerts & Incidents", "Cảnh báo và sự cố"], ["Cold chain temperature excursions, environmental anomalies, and hardware alerts", "Cảnh báo nhiệt độ chuỗi lạnh, bất thường môi trường và sự cố thiết bị"],
        ["Active Breach", "Sự cố đang hoạt động"], ["Safe Thresholds (2°C - 8°C)", "Ngưỡng an toàn (2°C - 8°C)"], ["Acknowledge All", "Xác nhận tất cả"],
        ["REFRESH", "LÀM MỚI"], ["WAREHOUSE", "KHO"], ["WAREHOUSES", "KHO LẠNH"], ["VEHICLES", "XE VẬN CHUYỂN"],
        ["DEVICES", "THIẾT BỊ"], ["REPORTS", "BÁO CÁO"], ["ALERTS", "CẢNH BÁO"],
        ["Vehicle Temperature Profile", "Biểu đồ nhiệt độ xe"], ["Route & Geofence", "Tuyến đường và vùng địa lý"],
        ["Telemetry Ping History", "Lịch sử dữ liệu giám sát"], ["Cold Storage Facility", "Cơ sở kho lạnh"],
        ["Edit Facility Details", "Sửa thông tin cơ sở"], ["Add New Cold Storage Facility", "Thêm cơ sở kho lạnh mới"],
        ["Facility Name *", "Tên cơ sở *"], ["Can Tho Mekong Regional Hub", "Trung tâm vùng Mekong Cần Thơ"],
        ["Facility Name", "Tên cơ sở"], ["Facility Code", "Mã cơ sở"], ["Warehouse Name", "Tên kho"],
        ["Select a warehouse", "Chọn một kho"], ["Select a vehicle", "Chọn một xe"], ["Select a device", "Chọn thiết bị"],
        ["All Regions (National)", "Tất cả khu vực (toàn quốc)"], ["Active Facilities", "Cơ sở đang hoạt động"],
        ["Maintenance / Inactive", "Bảo trì / Ngừng hoạt động"], ["Northern Region", "Miền Bắc"], ["Central Region", "Miền Trung"], ["Southern Region", "Miền Nam"],
        ["Search by warehouse name, facility code, or location...", "Tìm tên kho, mã cơ sở hoặc vị trí..."],
        ["+ Add New Warehouse", "+ Thêm kho mới"], ["+ Add Vehicle", "+ Thêm xe"], ["+ Register Device", "+ Đăng ký thiết bị"],
        ["Download Compliance PDF", "Tải PDF tuân thủ"], ["GPS Radar", "Radar GPS"], ["Real-time GPS Radar", "Radar GPS trực tiếp"],
        ["Export Trip Log", "Xuất nhật ký hành trình"], ["Facility GDP Audit", "Kiểm tra GDP cơ sở"], ["Facility GPS Map", "Bản đồ GPS cơ sở"],
        ["Mã lô / sản phẩm", "BATCH / PRODUCT"], ["Nông dân", "FARMER"], ["Điểm lấy", "PICKUP LOCATION"], ["Đích đến", "DESTINATION"],
        ["Số lượng", "QUANTITY"], ["Kiểm định", "INSPECTION"], ["Vận chuyển", "TRANSPORT"], ["Xe / thao tác", "VEHICLE / ACTION"],
        ["Lô nông sản từ Agri Audit", "Agri-Audit Produce Batches"], ["Theo dõi lấy hàng, chuyển đến kiểm định và giao hoặc hoàn trả theo kết quả.", "Track pickup, inspection transfer, and delivery or return based on the result."],
        ["Chào mừng trở lại", "Welcome back"], ["Hệ thống Cold Chain", "Cold Chain System"], ["Một nơi để đội ngũ công ty theo dõi và điều phối hoạt động chuỗi lạnh.", "A central place for company teams to monitor and coordinate cold-chain operations."],
        ["Hệ thống công ty quản lý kho lạnh, đội xe, thiết bị giám sát và quá trình vận chuyển nông sản từ điểm lấy hàng đến nơi tiêu thụ.", "The company system manages cold storage, fleet, monitoring devices, and produce transport from pickup to destination."],
        ["Gửi yêu cầu đăng ký", "Submit registration request"], ["Tạo tài khoản", "Create account"], ["Đăng ký", "Register"],
        ["Tài khoản", "Account"], ["Quản lý tài khoản", "Account Management"], ["Yêu cầu đăng ký tài khoản", "Account Registration Requests"],
        ["All user accounts. Admins can change roles, approve new requests, or delete accounts.", "Hiển thị mọi tài khoản. Admin có thể đổi vai trò, duyệt yêu cầu mới hoặc xóa tài khoản."],
        ["Loading accounts…", "Đang tải tài khoản…"], ["No accounts found.", "Chưa có tài khoản nào."],
        ["CREATED", "NGÀY TẠO"], ["Save role", "Lưu vai trò"],
        ["Role", "Vai trò"], ["Staff", "Nhân viên"], ["Admin", "Quản trị viên"], ["User", "Người dùng"],
        ["PENDING", "CHỜ DUYỆT"], ["REJECTED", "BỊ TỪ CHỐI"], ["USER", "NGƯỜI DÙNG"], ["STAFF", "NHÂN VIÊN"], ["ADMIN", "QUẢN TRỊ VIÊN"],
        ["Shipment tracking", "Theo dõi lô hàng"], ["Shipments in transit", "Lô hàng đang vận chuyển"],
        ["Only shipments currently on a vehicle route are shown, with the assigned vehicle and route endpoints.", "Chỉ hiển thị lô đang trên đường, xe được phân công và tuyến từ điểm đi đến điểm đến."],
        ["Currently in transit", "Đang vận chuyển"], ["Loading…", "Đang tải…"], ["Loading shipments…", "Đang tải lô hàng…"],
        ["No shipments are currently in transit.", "Hiện không có lô hàng nào đang vận chuyển."], ["BATCH / PRODUCT", "MÃ LÔ / SẢN PHẨM"],
        ["QUANTITY", "SỐ LƯỢNG"], ["STATUS", "TRẠNG THÁI"], ["VEHICLE", "XE"], ["ROUTE", "LỘ TRÌNH"],
        ["TEMPERATURE / HUMIDITY", "NHIỆT ĐỘ / ĐỘ ẨM"], ["Collecting from farmer", "Đang lấy hàng từ nông dân"],
        ["Delivering to consumption point", "Đang giao đến điểm tiêu thụ"], ["Returning batch to farmer", "Đang hoàn hàng về nông dân"],
        ["No live reading", "Chưa có số đo trực tiếp"], ["Updated", "Cập nhật"],
        ["Chọn vai trò được cấp trước khi phê duyệt. Tài khoản chờ duyệt chưa thể đăng nhập.", "Select the role to grant before approval. Pending accounts cannot sign in."],
        ["Chưa có tài khoản?", "Don't have an account?"], ["Đã có tài khoản?", "Already have an account?"], ["Quay lại đăng nhập", "Back to sign in"],
        ["Quyền truy cập được cấp sau khi admin phê duyệt", "Access is granted after administrator approval"],
        ["Lô hàng mới từ Agri-Audit", "New batch from Agri-Audit"], ["Chưa có lô hàng nào được Agri gửi sang Cold Chain.", "No batches have been received from Agri by Cold Chain."],
        ["Theo dõi lấy hàng, chuyển đến kiểm định và giao hoặc hoàn trả theo kết quả.", "Track pickup, inspection transfer, and delivery or return based on the result."],
        ["ONLINE", "TRỰC TUYẾN"], ["OFFLINE", "NGOẠI TUYẾN"], ["INACTIVE", "ĐÃ TẮT"],
        ["Online", "Trực tuyến"], ["Offline", "Ngoại tuyến"], ["No live data", "Chưa có dữ liệu trực tiếp"],
        ["ONLINE & HEALTHY", "TRỰC TUYẾN & ỔN ĐỊNH"], ["Registered Telemetry Units", "Thiết bị giám sát đã đăng ký"],
        ["A device is online only while its Arduino sends live readings.", "Thiết bị chỉ được tính là trực tuyến khi Arduino đang gửi số đo thực."],
        ["All", "Tất cả"], ["Warehouse", "Kho lạnh"], ["Delivery vehicle", "Xe vận chuyển"], ["Unassigned", "Chưa phân công"],
        ["Not collected", "Chưa thu thập"], ["No registered devices match this filter.", "Không có thiết bị phù hợp với bộ lọc này."],
        ["database records", "bản ghi trong cơ sở dữ liệu"], ["registered devices", "thiết bị đã đăng ký"],
        ["Select a device from the device list.", "Chọn một thiết bị trong danh sách."], ["No reading", "Chưa có số đo"],
        ["Picking up from farmer", "Đang đến lấy hàng"], ["At receiving warehouse", "Đã về kho tiếp nhận"], ["At inspection", "Đang kiểm định"],
        ["Waiting to depart for delivery", "Chờ xuất phát giao hàng"], ["Waiting to depart for return", "Chờ xuất phát hoàn hàng"],
        ["Delivering to consumption point", "Đang giao đến điểm tiêu thụ"], ["Returning to farmer", "Đang hoàn hàng về nông dân"],
        ["Ready", "Sẵn sàng"], ["Idle", "Tạm nghỉ"], ["NO LIVE CARGO SENSOR", "CHƯA CÓ CẢM BIẾN HÀNG HÓA TRỰC TIẾP"],
        ["NO ACTIVE LOAD", "KHÔNG CÓ LÔ ĐANG VẬN CHUYỂN"], ["High temp spike", "Nhiệt độ tăng cao"], ["Low freeze risk", "Nhiệt độ thấp"],
        ["Vehicle is not transporting an Agri batch", "Xe hiện không vận chuyển lô hàng Agri"],
        ["No live cargo telemetry", "Chưa có dữ liệu trực tiếp của lô hàng"], ["No active route", "Không có lộ trình đang chạy"],
        ["ROUTE PLANNED", "ĐÃ LÊN LỘ TRÌNH"], ["NO ACTIVE ROUTE", "KHÔNG CÓ LỘ TRÌNH ĐANG CHẠY"],
        ["IN TRANSIT", "ĐANG VẬN CHUYỂN"], ["From:", "Từ:"], ["To:", "Đến:"], ["Farmer:", "Nông dân:"],
        ["Destination pending", "Đang chờ điểm đến"], ["Route will appear when an Agri batch is assigned to this vehicle.", "Lộ trình sẽ hiện khi xe được gán lô Agri."],
        ["Route will appear when an Agri batch is assigned.", "Lộ trình sẽ hiện khi xe được gán lô hàng."],
        ["No Agri shipment is assigned to this vehicle.", "Xe chưa được gán lô hàng Agri nào."],
        ["Vehicle is travelling from the farmer to the receiving warehouse", "Xe đang đi từ nông dân đến kho tiếp nhận"],
        ["Vehicle is returning the rejected batch to the farmer", "Xe đang hoàn lô bị từ chối về cho nông dân"],
        ["Vehicle is delivering the approved batch to the consumption point", "Xe đang giao lô đã duyệt đến điểm tiêu thụ"],
        ["Inspection approved · waiting for dispatch to the consumption point", "Đã duyệt kiểm định · chờ xuất phát đến điểm tiêu thụ"],
        ["Inspection rejected · waiting for return dispatch", "Bị từ chối kiểm định · chờ xuất phát hoàn hàng"],
        ["Pickup route completed · batch is at the inspection warehouse", "Đã hoàn tất chặng lấy hàng · lô hàng đang ở kho kiểm định"],
        ["In transit · no live cargo sensor", "Đang vận chuyển · chưa có cảm biến hàng hóa trực tiếp"],
        ["No active shipment in transit", "Không có lô hàng đang vận chuyển"],
        ["Cargo temperature is shown while this vehicle is transporting an Agri batch.", "Nhiệt độ lô hàng sẽ hiện khi xe đang vận chuyển lô Agri."],
        ["No live readings have arrived for this transport yet.", "Chưa nhận được số đo trực tiếp cho chuyến hàng này."],
        ["Cargo telemetry is unavailable: no live vehicle sensor is connected.", "Chưa có dữ liệu hàng hóa trực tiếp vì xe chưa kết nối cảm biến."],
        ["Cargo Temperature Profile", "Biểu đồ nhiệt độ lô hàng"], ["live cargo readings", "số đo lô hàng trực tiếp"],
        ["Live Geofence Active", "Vùng theo dõi trực tiếp đang bật"], ["NO SENSOR", "CHƯA CÓ CẢM BIẾN"], ["NORMAL", "BÌNH THƯỜNG"], ["ALERT", "CẢNH BÁO"],
        ["Receiving warehouse:", "Kho tiếp nhận:"], ["No active shipment", "Không có lô đang hoạt động"], ["Destination not assigned", "Chưa có điểm đến"],
        ["No route", "Chưa có tuyến"], ["Temperature above range", "Nhiệt độ vượt ngưỡng trên"], ["Temperature below range", "Nhiệt độ thấp hơn ngưỡng"],
        ["In transit · cargo temperature safe", "Đang vận chuyển · nhiệt độ hàng hóa an toàn"], ["Agri batch route", "Lộ trình lô Agri"],
        ["Route appears when a batch is assigned.", "Lộ trình sẽ hiện khi có lô được phân công."], ["NO ACTIVE ROUTE", "KHÔNG CÓ LỘ TRÌNH ĐANG CHẠY"],
        ["Observed Humidity (%)", "Độ ẩm ghi nhận (%)"], ["Simulated Temperature (°C)", "Nhiệt độ mô phỏng (°C)"],
        ["Simulated Humidity (%)", "Độ ẩm mô phỏng (%)"], ["SIMULATED · ONLINE", "MÔ PHỎNG · TRỰC TUYẾN"],
        ["SIMULATED DATA", "DỮ LIỆU MÔ PHỎNG"], ["SIMULATED", "MÔ PHỎNG"],
        ["A device is online only while it sends live readings.", "Thiết bị chỉ trực tuyến khi đang gửi số đo mới."],
        ["Online devices report every second. Simulated readings are labeled separately from Arduino data.", "Thiết bị trực tuyến gửi số đo mỗi giây. Dữ liệu mô phỏng được ghi nhãn riêng với Arduino."]
    ];

    const sortedPhrases = [...phrases].sort((a, b) => Math.max(b[0].length, b[1].length) - Math.max(a[0].length, a[1].length));
    const storageKey = "coldchain_ui_language";
    const getLanguage = () => localStorage.getItem(storageKey) || "vi";
    const excluded = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE"]);
    const originalTextNodes = new WeakMap();
    const originalAttributes = new WeakMap();

    function translateTextNode(node, language) {
        let state = originalTextNodes.get(node);
        if (!state || node.nodeValue !== state.rendered) state = { source: node.nodeValue, rendered: null };
        const translated = replacePhrases(state.source, language);
        if (node.nodeValue !== translated) node.nodeValue = translated;
        state.rendered = translated;
        originalTextNodes.set(node, state);
    }

    function translateAttribute(element, attribute, language) {
        const current = element.getAttribute(attribute);
        if (!current) return;
        let states = originalAttributes.get(element);
        if (!states) { states = new Map(); originalAttributes.set(element, states); }
        let state = states.get(attribute);
        if (!state || current !== state.rendered) state = { source: current, rendered: null };
        const translated = replacePhrases(state.source, language);
        if (current !== translated) element.setAttribute(attribute, translated);
        state.rendered = translated;
        states.set(attribute, state);
    }

    function replacePhrases(value, language) {
        let output = value;
        for (const [english, vietnamese] of sortedPhrases) {
            const from = language === "vi" ? english : vietnamese;
            const to = language === "vi" ? vietnamese : english;
            if (!from || from === to || !output.includes(from)) continue;
            if (from.length <= 4) {
                const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                output = output.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu"), to);
            } else {
                output = output.split(from).join(to);
            }
        }
        return output;
    }

    function translateElement(root, language) {
        if (root.nodeType === Node.TEXT_NODE) {
            if (root.parentElement && excluded.has(root.parentElement.tagName)) return;
            translateTextNode(root, language);
            return;
        }
        if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
        if (root.nodeType === Node.ELEMENT_NODE && excluded.has(root.tagName)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                return node.parentElement && excluded.has(node.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
        });
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach((node) => translateElement(node, language));

        const elements = root === document ? document.querySelectorAll("[placeholder], [title], [aria-label]") : root.querySelectorAll?.("[placeholder], [title], [aria-label]") || [];
        elements.forEach((element) => translateAttributes(element, language));
        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.("[placeholder], [title], [aria-label]")) translateAttributes(root, language);
    }

    function translateAttributes(element, language) {
        ["placeholder", "title", "aria-label"].forEach((attribute) => {
            translateAttribute(element, attribute, language);
        });
    }

    function renderLanguageSwitch() {
        if (document.getElementById("coldchain-language-switch")) return;
        const host = document.querySelector(".top-header .header-right, .top-header, .form-header-right") || document.body;
        const switcher = document.createElement("div");
        switcher.id = "coldchain-language-switch";
        switcher.className = "coldchain-language-switch";
        switcher.setAttribute("aria-label", "Chọn ngôn ngữ / Select language");
        switcher.innerHTML = '<button type="button" data-language="vi">VI</button><button type="button" data-language="en">EN</button>';
        if (host === document.body) switcher.classList.add("floating");
        host.appendChild(switcher);
        switcher.addEventListener("click", (event) => {
            const button = event.target.closest("[data-language]");
            if (button) setLanguage(button.dataset.language);
        });
        updateLanguageSwitch();
    }

    function updateLanguageSwitch() {
        document.querySelectorAll("#coldchain-language-switch [data-language]").forEach((button) => {
            const active = button.dataset.language === getLanguage();
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function setLanguage(language) {
        if (language !== "vi" && language !== "en") return;
        localStorage.setItem(storageKey, language);
        document.documentElement.lang = language;
        translateElement(document, language);
        updateLanguageSwitch();
    }

    function addStyles() {
        if (document.getElementById("coldchain-i18n-style")) return;
        const style = document.createElement("style");
        style.id = "coldchain-i18n-style";
        style.textContent = `
            .coldchain-language-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;background:#eef2f7;border:1px solid #dbe3ef;border-radius:9px;margin-left:10px;flex:0 0 auto}
            .coldchain-language-switch button{border:0;background:transparent;color:#52627a;font:600 11px Inter,Arial,sans-serif;padding:5px 8px;border-radius:6px;cursor:pointer}
            .coldchain-language-switch button.active{background:#2563eb;color:#fff;box-shadow:0 1px 3px #0002}
            .coldchain-language-switch.floating{position:fixed;right:20px;top:14px;z-index:1500;background:#fff;box-shadow:0 4px 16px #0f172a18}
            .login-page .coldchain-language-switch{position:absolute;right:22px;top:14px;margin:0}
        `;
        document.head.appendChild(style);
    }

    function init() {
        addStyles();
        const language = getLanguage();
        document.documentElement.lang = language;
        translateElement(document, language);
        renderLanguageSwitch();
        const observer = new MutationObserver((mutations) => {
            const lang = getLanguage();
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) translateElement(node, lang);
                });
                if (mutation.type === "attributes") translateAttributes(mutation.target, lang);
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
    }

    window.setUiLanguage = setLanguage;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
