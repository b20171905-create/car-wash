const fs = require('fs');
const path = require('path');
const { Pool: PgPool } = require('pg');
const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set before starting the backend.');
}

function getDbType() {
  const configuredType = (process.env.DB_CLIENT || '').toLowerCase();
  if (configuredType === 'mysql' || configuredType === 'postgres') return configuredType;
  return connectionString.startsWith('mysql') ? 'mysql' : 'postgres';
}

const dbType = getDbType();

function normalizeSql(sql, params) {
  let replaced = 0;
  const normalized = sql.replace(/\?/g, () => {
    replaced += 1;
    return `$${replaced}`;
  });
  return { sql: normalized, params };
}

function buildMysqlPool() {
  const url = new URL(connectionString);
  return mysql.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password || ''),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    multipleStatements: true,
  });
}

function buildPostgresPool() {
  return new PgPool({
    connectionString,
    ssl: connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = dbType === 'mysql' ? buildMysqlPool() : buildPostgresPool();

let databaseReady = Promise.resolve();

function prepareStatement(sql, executor = pool) {
  if (sql.trim().toLowerCase().startsWith('pragma')) {
    return {
      all: async () => [],
      get: async () => null,
      run: async () => ({ changes: 0 }),
    };
  }

  return {
    all: async (...args) => {
      await databaseReady;
      const params = args.flat();
      if (dbType === 'mysql') {
        const [rows] = await executor.query(sql, params);
        return rows;
      }
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await executor.query(normalizedSql, normalizedParams);
      return result.rows;
    },
    get: async (...args) => {
      await databaseReady;
      const params = args.flat();
      if (dbType === 'mysql') {
        const [rows] = await executor.query(sql, params);
        return rows[0] || null;
      }
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await executor.query(normalizedSql, normalizedParams);
      return result.rows[0] || null;
    },
    run: async (...args) => {
      await databaseReady;
      const params = args.flat();
      if (dbType === 'mysql') {
        const [result] = await executor.query(sql, params);
        return {
          lastInsertRowid: result.insertId ?? null,
          changes: result.affectedRows || 0,
        };
      }
      const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
      const result = await executor.query(normalizedSql, normalizedParams);
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
    if (dbType === 'mysql') {
      const [rows] = await pool.query(sql, params);
      return { rows, fields: [] };
    }
    return pool.query(sql, params);
  },
  transaction: (callback) => async () => {
    await databaseReady;
    if (dbType === 'mysql') {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await callback({ prepare: (sql) => prepareStatement(sql, connection) });
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback({ prepare: (sql) => prepareStatement(sql, client) });
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
  const schemaFile = dbType === 'mysql' ? 'schema.mysql.sql' : 'schema.sql';
  const migrationFile = dbType === 'mysql' ? 'migrate_vehicle_types.mysql.sql' : 'migrate_vehicle_types.sql';

  const schema = fs.readFileSync(path.join(__dirname, schemaFile), 'utf8');
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    await pool.query(`${statement};`);
  }

  const migrationSql = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
  const migrationStatements = migrationSql.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of migrationStatements) {
    await pool.query(`${statement};`);
  }

  if (dbType === 'postgres') {
    await pool.query(`
      SELECT setval(
        'receipt_number_seq',
        COALESCE(MAX(CASE WHEN receipt_number ~ '^[0-9]{3}$' THEN receipt_number::integer END), 1),
        COUNT(CASE WHEN receipt_number ~ '^[0-9]{3}$' THEN 1 END) > 0
      ) FROM sales;
    `);
  }
})();

databaseReady.catch((error) => console.error('Database initialization failed:', error));

module.exports = db;
