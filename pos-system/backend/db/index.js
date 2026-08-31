const fs = require('fs');
const path = require('path');
const { Pool: PgPool } = require('pg');
const mysql = require('mysql2/promise');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL must be set before starting the backend.');
}

// Defensive cleanup: strip accidental wrapping quotes/whitespace that some
// panel UIs or copy-pastes introduce — these can silently break both the
// new URL() parse and the regex fallback below, causing a fallback to
// localhost with empty credentials.
connectionString = connectionString.trim().replace(/^['"]|['"]$/g, '');

// One-time diagnostic (no secrets leaked): confirms what actually reached
// process.env vs. what's shown in the hPanel editor. Safe to remove once
// the connection is confirmed working.
console.log(
  `[DB Config Debug] DATABASE_URL length: ${connectionString.length}, ` +
  `starts: ${JSON.stringify(connectionString.slice(0, 12))}, ` +
  `ends: ${JSON.stringify(connectionString.slice(-12))}`
);

function getDbType() {
  const configuredType = (process.env.DB_CLIENT || '').toLowerCase();
  if (configuredType === 'mysql' || configuredType === 'postgres') return configuredType;
  const normalizedConnectionString = (connectionString || '').toLowerCase();
  return normalizedConnectionString.startsWith('mysql') ? 'mysql' : 'postgres';
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
  const rawUrl = connectionString || '';
  let host = 'localhost';
  let port = 3306;
  let user = '';
  let password = '';
  let database = '';

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      host = parsed.hostname || 'localhost';
      port = Number(parsed.port || 3306);
      user = decodeURIComponent(parsed.username || '');
      password = decodeURIComponent(parsed.password || '');
      database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).split('?')[0];
    } catch (e) {
      console.error(`[DB Config Error] new URL() parse failed: ${e.message}`);
      const match = rawUrl.match(/^mysql:\/\/(?:([^:]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?\/(.+)$/);
      if (match) {
        user = decodeURIComponent(match[1] || '');
        password = decodeURIComponent(match[2] || '');
        host = match[3] || 'localhost';
        port = Number(match[4] || 3306);
        database = decodeURIComponent(match[5] || '').split('?')[0];
      }
    }
  }

  if (!user || !database) {
    console.error(`[DB Config Error] Could not extract MySQL user/database from DATABASE_URL`);
  }

  const poolOptions = {
    host,
    port,
    user,
    password,
    database,
    timezone: '+05:00',
    waitForConnections: true,
    connectionLimit: 20,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    decimalNumbers: true,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000,
  };

  // If host is localhost, check for Unix sockets commonly used on Hostinger shared hosting
  if (host === 'localhost') {
    const socketPaths = ['/var/run/mysqld/mysqld.sock', '/tmp/mysql.sock', '/var/lib/mysql/mysql.sock'];
    for (const socketPath of socketPaths) {
      if (fs.existsSync(socketPath)) {
        console.log(`[DB Pool] Using Hostinger MySQL socket: ${socketPath}`);
        poolOptions.socketPath = socketPath;
        break;
      }
    }
  }

  console.log(`[DB Pool] Initializing MySQL pool -> Host: ${host}:${port}, User: ${user}, DB: ${database}`);

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    timezone: '+05:00',
    waitForConnections: true,
    connectionLimit: 20,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    decimalNumbers: true,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000,
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

async function executeWithRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isConnError =
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EPIPE' ||
        err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
        err.fatal === true;

      if (isConnError && attempt < retries) {
        console.warn(`[DB Retry] Connection issue (${err.code || err.message}). Retrying query (attempt ${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      throw err;
    }
  }
}

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
      await databaseReady.catch(() => {});
      const params = args.flat();
      return executeWithRetry(async () => {
        if (dbType === 'mysql') {
          const [rows] = await executor.query(sql, params);
          return rows;
        }
        const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
        const result = await executor.query(normalizedSql, normalizedParams);
        return result.rows;
      });
    },
    get: async (...args) => {
      await databaseReady.catch(() => {});
      const params = args.flat();
      return executeWithRetry(async () => {
        if (dbType === 'mysql') {
          const [rows] = await executor.query(sql, params);
          return rows[0] || null;
        }
        const { sql: normalizedSql, params: normalizedParams } = normalizeSql(sql, params);
        const result = await executor.query(normalizedSql, normalizedParams);
        return result.rows[0] || null;
      });
    },
    run: async (...args) => {
      await databaseReady.catch(() => {});
      const params = args.flat();
      return executeWithRetry(async () => {
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
      });
    },
  };
}

const db = {
  prepare: prepareStatement,
  query: async (sql, params = []) => {
    await databaseReady.catch(() => {});
    return executeWithRetry(async () => {
      if (dbType === 'mysql') {
        const [rows] = await pool.query(sql, params);
        return { rows, fields: [] };
      }
      return pool.query(sql, params);
    });
  },
  transaction: (callback) => async () => {
    await databaseReady.catch(() => {});
    return executeWithRetry(async () => {
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
    });
  },
  pool,
  close: () => pool.end(),
};

databaseReady = (async () => {
  try {
    const schemaFile = dbType === 'mysql' ? 'schema.mysql.sql' : 'schema.sql';
    const migrationFile = dbType === 'mysql' ? 'migrate_vehicle_types.mysql.sql' : 'migrate_vehicle_types.sql';

    const schema = fs.readFileSync(path.join(__dirname, schemaFile), 'utf8');
    const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) {
      try {
        await pool.query(`${statement};`);
      } catch (err) {
        const isDuplicateError =
          err.code === 'ER_DUP_KEYNAME' ||
          err.errno === 1061 ||
          err.code === 'ER_TABLE_EXISTS_ERROR' ||
          err.errno === 1050 ||
          err.code === 'ER_DUP_FIELDNAME' ||
          err.errno === 1060 ||
          (err.message && (
            err.message.includes('Duplicate key name') ||
            err.message.includes('already exists') ||
            err.message.includes('Duplicate column name')
          ));
        if (!isDuplicateError) {
          console.warn(`[DB Schema Notice] ${err.message}`);
        }
      }
    }

    const migrationSql = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
    const migrationStatements = migrationSql.split(';').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of migrationStatements) {
      try {
        await pool.query(`${statement};`);
      } catch (err) {
        const isDuplicateError =
          err.code === 'ER_DUP_KEYNAME' ||
          err.errno === 1061 ||
          err.code === 'ER_TABLE_EXISTS_ERROR' ||
          err.errno === 1050 ||
          err.code === 'ER_DUP_FIELDNAME' ||
          err.errno === 1060 ||
          (err.message && (
            err.message.includes('Duplicate key name') ||
            err.message.includes('already exists') ||
            err.message.includes('Duplicate column name')
          ));
        if (!isDuplicateError) {
          console.warn(`[DB Migration Notice] ${err.message}`);
        }
      }
    }
  } catch (error) {
    console.warn('[DB Init Notice] Non-fatal schema init error:', error.message);
  }
})();

databaseReady.catch((error) => console.warn('[DB Ready] Non-fatal warning:', error.message));

module.exports = db;
module.exports.databaseReady = databaseReady;