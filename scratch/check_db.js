const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'ribbittalk'
  });
  const [rows] = await connection.execute('SELECT word, set_id FROM flashcards');
  console.log('Total flashcards:', rows.length);
  console.log('Words in DB:', rows.map(r => r.word));
  await connection.end();
}

main().catch(console.error);
