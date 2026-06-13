import { createPool, type RowDataPacket } from 'mysql2/promise';
import { randomBytes, scryptSync } from 'crypto';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

async function seedAdmin() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'ribbittalk',
  });

  const adminEmail = 'rootuser@gmail.com';
  const adminPassword = 'rootuser@gmail.com';
  const adminUuid = randomUUID();
  const adminUsername = 'rootadmin';
  const hashedPassword = hashPassword(adminPassword);

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1',
      [adminEmail, adminUsername],
    );

    const rows = existing as RowDataPacket[];
    if (rows.length > 0) {
      console.log('✅ Admin account already exists. Skipping seed.');
      return;
    }

    await pool.execute(
      `INSERT INTO users
        (uuid, username, email, first_name, last_name, date_of_birth, password, role, is_email_verified, auth_provider, created_at, updated_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, 'admin', 1, 'local', NOW(), NOW())`,
      [
        adminUuid,
        adminUsername,
        adminEmail,
        'Root',
        'Admin',
        '1990-01-01',
        hashedPassword,
      ],
    );

    console.log('🐸 Admin account seeded successfully!');
    console.log(`   UUID     : ${adminUuid}`);
    console.log(`   Username : ${adminUsername}`);
    console.log(`   Email    : ${adminEmail}`);
    console.log(`   Password : ${adminPassword}`);
    console.log(`   Role     : admin`);
  } catch (error) {
    console.error('❌ Failed to seed admin account:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((error) => {
  console.error('Failed to seed admin:', error);
  process.exit(1);
});
