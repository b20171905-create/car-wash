const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set before starting the backend.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
});

function normalizeSql(sql, params) {
  let replaced = 0;
  const normalized = sql.replace(/\?/g, () => {
    replaced += 1;
    return `$${replaced}`;
  });
  return { sql: normalized, params };
}

let databaseReady = Promise.resolve();

function prepareStatement(sql) {
  if (sql.trim().toLowerCase().startsWith('pragma')) {
    return {
      all: async () => [],
      get: async () => null,
      run: async () => ({ changes: 0 })
    };
  }

  return {
    all: async (...args) => {
      await databaseReady;
      const params = args.flat();
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await pool.query(normalizedSql, normalizedParams);
      return result.rows;
    },
    get: async (...args) => {
      await databaseReady;
      const params = args.flat();
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await pool.query(normalizedSql, normalizedParams);
      return result.rows[0] || null;
    },
    run: async (...args) => {
      await databaseReady;
      const params = args.flat();
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await pool.query(normalizedSql, normalizedParams);
      return {
        lastInsertRowid: result.rows?.[0]?.id ?? null,
        changes: result.rowCount || 0,
      };
    },
  };
}

const db = {
  prepare: prepareStatement,
  query: async (sql, params = []) => {
    await databaseReady;
    return pool.query(sql, params);
  },
  transaction: (callback) => async () => {
    await databaseReady;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  pool,
  close: () => pool.end(),
};

databaseReady = (async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      await db.query(`${statement};`);
    }

    const vehicleTypeMigration = fs.readFileSync(path.join(__dirname, 'migrate_vehicle_types.sql'), 'utf8');
    const migrationStatements = vehicleTypeMigration.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of migrationStatements) {
      await db.query(`${statement};`);
    }
  } catch (error) {
    console.warn('Database initialization warning:', error.message);
  }
})().catch((error) => {
  console.error('Database initialization failed:', error);
});

module.exports = db;
