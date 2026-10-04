const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD || ""),
    database: process.env.DB_NAME
});

pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client", err);
});

module.exports = pool;