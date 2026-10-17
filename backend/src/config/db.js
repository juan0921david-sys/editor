const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: '10.18.3.62', // <-- Reemplaza esto con la IP real de tu laptop
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
module.exports = {
  query: (text, params) => pool.query(text, params),
};