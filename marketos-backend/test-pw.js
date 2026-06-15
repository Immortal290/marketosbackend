const { Pool } = require('pg');

const passwords = ['', 'postgres', 'admin', 'root', '1234', '123456', 'password', 'marketos'];

async function test() {
  for (const p of passwords) {
    const url = `postgresql://postgres:${encodeURIComponent(p)}@localhost:5432/postgres`;
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query('SELECT 1');
      console.log('SUCCESS:', p === '' ? '[empty string]' : p);
      process.exit(0);
    } catch (e) {
      // ignore
    } finally {
      await pool.end();
    }
  }
  console.log('ALL FAILED');
  process.exit(1);
}

test();
