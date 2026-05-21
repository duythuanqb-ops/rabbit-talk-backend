const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'ribbittalk',
    multipleStatements: true
  });
  
  console.log("Connected to MySQL database successfully.");
  
  const migrationFile = '20260519010000_create_flashcards_table.sql';
  const filePath = path.join(__dirname, '../src/database/migrations', migrationFile);
  
  console.log(`Executing migration: ${migrationFile}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    await connection.query(sql);
    console.log(`Migration ${migrationFile} completed successfully.`);
  } catch (err) {
    console.error(`Migration ${migrationFile} failed:`, err.message);
    process.exit(1);
  }
  
  await connection.end();
}

run().catch((err) => {
  console.error("Migration runner crashed:", err);
  process.exit(1);
});
