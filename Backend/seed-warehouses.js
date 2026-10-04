const pool = require('./db');

async function seedWarehouseData() {
  try {
    console.log("Seeding dedicated warehouse devices and telemetry...");

    // 1. Update warehouse names to English
    const whUpdates = [
      { id: 1, name: 'Hanoi Central Cold Storage' },
      { id: 2, name: 'Hai Phong Port Cold Facility' },
      { id: 3, name: 'Da Nang Regional Logistics Hub' },
      { id: 4, name: 'Ho Chi Minh Mega Distribution Center' },
      { id: 5, name: 'Can Tho Mekong Cold Terminal' }
    ];

    for (const w of whUpdates) {
      await pool.query('UPDATE warehouse SET warehouse_name = $1 WHERE id = $2', [w.name, w.id]);
    }
    console.log('1. Warehouse names updated to English.');

    // 2. Add warehouse-dedicated devices (vehicle_id IS NULL)
    const warehouseDevices = [
      { id: 15, token: 'DEV-WH-001', wh_id: 1 },
      { id: 16, token: 'DEV-WH-002', wh_id: 1 },
      { id: 17, token: 'DEV-WH-003', wh_id: 2 },
      { id: 18, token: 'DEV-WH-004', wh_id: 2 },
      { id: 19, token: 'DEV-WH-005', wh_id: 3 },
      { id: 20, token: 'DEV-WH-006', wh_id: 3 },
      { id: 21, token: 'DEV-WH-007', wh_id: 4 },
      { id: 22, token: 'DEV-WH-008', wh_id: 4 },
      { id: 23, token: 'DEV-WH-009', wh_id: 5 },
      { id: 24, token: 'DEV-WH-010', wh_id: 5 }
    ];

    for (const d of warehouseDevices) {
      await pool.query(`
        INSERT INTO device (id, device_token, warehouse_id, vehicle_id, status)
        VALUES ($1, $2, $3, NULL, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET warehouse_id = $3, vehicle_id = NULL, device_token = $2
      `, [d.id, d.token, d.wh_id]);
    }
    console.log('2. Warehouse-type devices registered (vehicle_id = NULL).');

    // 3. Insert telemetry data for warehouse devices
    const whReadings = [
      { dev_id: 15, temp: 3.4, hum: 62.0 },
      { dev_id: 15, temp: 3.6, hum: 61.5 },
      { dev_id: 15, temp: 3.5, hum: 63.0 },
      { dev_id: 16, temp: -20.2, hum: 45.0 },
      { dev_id: 16, temp: -20.5, hum: 44.8 },
      { dev_id: 17, temp: 4.1, hum: 64.0 },
      { dev_id: 17, temp: 4.3, hum: 65.2 },
      { dev_id: 18, temp: 3.9, hum: 63.8 },
      { dev_id: 19, temp: 2.8, hum: 58.4 },
      { dev_id: 19, temp: 3.1, hum: 59.1 },
      { dev_id: 20, temp: 4.5, hum: 66.2 },
      { dev_id: 21, temp: 3.7, hum: 62.9 },
      { dev_id: 22, temp: 4.2, hum: 60.5 },
      { dev_id: 23, temp: 3.8, hum: 61.0 },
      { dev_id: 24, temp: -18.4, hum: 46.2 }
    ];

    const maxIdRes = await pool.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM data');
    let nextId = parseInt(maxIdRes.rows[0].max_id, 10) + 1;

    for (const r of whReadings) {
      await pool.query(`
        INSERT INTO data (id, device_id, temperature, humidity, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '5 minutes')
      `, [nextId++, r.dev_id, r.temp, r.hum]);
    }
    console.log('3. Warehouse telemetry data points seeded.');

    // 4. Update existing vehicle devices to have warehouse_id NULL if they are vehicles, or keep them
    console.log('All warehouse mockdata seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seedWarehouseData();
