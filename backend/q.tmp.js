require('dotenv').config();
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
  const r = await c.query(process.argv[2]);
  console.table(r.rows);
  await c.end();
})();
