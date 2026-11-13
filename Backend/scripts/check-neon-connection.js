const path = require("path");

require("dotenv").config({
    path: [path.join(__dirname, "../../.env.local"), path.join(__dirname, "../.env")]
});

const pool = require("../db");

async function checkConnection() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is missing from .env.local and Backend/.env");
    }

    let targetsNeon = false;
    try {
        targetsNeon = new URL(connectionString).hostname.toLowerCase().endsWith(".neon.tech");
    } catch {
        throw new Error("DATABASE_URL is not a valid PostgreSQL URL");
    }
    if (!targetsNeon) {
        throw new Error("DATABASE_URL does not target a Neon hostname");
    }

    const connectionCheck = await pool.query("SELECT 1 AS result");
    if (connectionCheck.rows[0]?.result !== 1) {
        throw new Error("SELECT 1 returned an unexpected result");
    }

    const database = await pool.query("SELECT current_database() AS database_name");
    await pool.query("SELECT current_user");
    const version = await pool.query("SELECT version() AS server_version");

    console.log("DATABASE_URL loaded from local environment: yes");
    console.log("Neon hostname: confirmed (hostname hidden)");
    console.log("SELECT 1: passed");
    console.log(`Database: ${database.rows[0].database_name}`);
    console.log("SELECT current_user: passed (value hidden)");
    console.log(`PostgreSQL version: ${version.rows[0].server_version}`);
}

checkConnection()
    .catch((error) => {
        const code = typeof error.code === "string" ? ` (${error.code})` : "";
        console.error(`Neon PostgreSQL connection check failed${code}; credentials and connection details were withheld.`);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
