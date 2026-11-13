require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("../db");

async function bootstrapAdmin() {
    const username = String(process.env.BOOTSTRAP_ADMIN_USERNAME || "").trim();
    const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "");
    const fullName = String(process.env.BOOTSTRAP_ADMIN_NAME || "System Administrator").trim();
    if (!username || password.length < 12) {
        throw new Error("Set BOOTSTRAP_ADMIN_USERNAME and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters in Backend/.env");
    }

    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rowCount) {
        console.log(`Administrator ${username} already exists; no account changes were made.`);
        return;
    }

    const idResult = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users");
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(`
        INSERT INTO users (id, username, password, full_name, role, status, created_at)
        VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)
    `, [idResult.rows[0].next_id, username, passwordHash, fullName]);
    console.log(`Created administrator ${username}. Remove bootstrap credentials from the environment after use.`);
}

bootstrapAdmin()
    .catch((error) => {
        console.error("Administrator bootstrap failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
