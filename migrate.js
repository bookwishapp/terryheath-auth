require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Get already applied migrations
    const result = await pool.query('SELECT filename FROM _migrations');
    const applied = new Set(result.rows.map(r => r.filename));

    // Apply new migrations
    for (const file of sqlFiles) {
      if (!applied.has(file)) {
        console.log(`Applying migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf-8');

        await pool.query('BEGIN');
        try {
          await pool.query(sql);
          await pool.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
          await pool.query('COMMIT');
          console.log(`✓ Applied ${file}`);
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`Skipping already applied migration: ${file}`);
      }
    }

    console.log('All migrations complete');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate();
}