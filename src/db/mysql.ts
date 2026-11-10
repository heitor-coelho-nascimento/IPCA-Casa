/**
 * IPCA-Casa: Conexão Pool MySQL (Backend Only)
 * Configurado exclusivamente via variáveis de ambiente (MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD).
 * Conexão preguiçosa (lazy) sem sondagens de inicialização ou loops de reconexão.
 */
import mysql, { Pool } from 'mysql2/promise';

declare global {
  var _ipcaMysqlPool: Pool | undefined;
  var _ipcaMysqlSchemaPromise: Promise<void> | undefined;
}

export function isMySQLConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST?.trim() &&
      process.env.MYSQL_USER?.trim() &&
      process.env.MYSQL_DATABASE?.trim()
  );
}

export function getMySQLPool(): Pool {
  if (!isMySQLConfigured()) {
    throw new Error('Configuração de banco de dados MySQL não definida nas variáveis de ambiente.');
  }

  if (!global._ipcaMysqlPool) {
    const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) || 3306 : 3306;
    const useSsl = process.env.MYSQL_SSL === 'true';

    global._ipcaMysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST!.trim(),
      port,
      database: process.env.MYSQL_DATABASE!.trim(),
      user: process.env.MYSQL_USER!.trim(),
      password: process.env.MYSQL_PASSWORD ?? '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      charset: 'utf8mb4',
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }

  return global._ipcaMysqlPool;
}

export async function ensureMySQLSchema(): Promise<void> {
  if (!isMySQLConfigured()) return;

  if (!global._ipcaMysqlSchemaPromise) {
    global._ipcaMysqlSchemaPromise = (async () => {
      const pool = getMySQLPool();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          display_name VARCHAR(255) NOT NULL,
          auth_provider ENUM('local', 'google') NOT NULL DEFAULT 'local',
          google_sub VARCHAR(128) NULL UNIQUE,
          avatar_url TEXT NULL,
          password_hash VARCHAR(255) NULL,
          profile_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_users_profile (profile_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS family_profiles (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NULL,
          name VARCHAR(255) NOT NULL,
          members_count INT UNSIGNED NOT NULL DEFAULT 1,
          reference_region VARCHAR(128) NOT NULL DEFAULT 'Brasil',
          currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
          is_demo BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_profiles_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS consumption_groups (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL UNIQUE,
          description TEXT,
          color VARCHAR(32) NOT NULL,
          icon VARCHAR(64) NOT NULL,
          national_weight_ibge DECIMAL(5,2) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS basket_items (
          id VARCHAR(64) PRIMARY KEY,
          profile_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          group_name VARCHAR(128) NOT NULL,
          classification ENUM('Essencial', 'Supérfluo', 'Não classificado') NOT NULL DEFAULT 'Não classificado',
          monthly_spend DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          old_price DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
          current_price DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
          old_price_date VARCHAR(32) NOT NULL,
          current_price_date VARCHAR(32) NOT NULL,
          unit VARCHAR(32) NOT NULL DEFAULT 'unidade',
          notes TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_basket_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE,
          INDEX idx_basket_profile_group (profile_id, group_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS price_history (
          id VARCHAR(64) PRIMARY KEY,
          item_id VARCHAR(64) NOT NULL,
          price DECIMAL(12,4) NOT NULL,
          reference_date VARCHAR(32) NOT NULL,
          unit VARCHAR(32),
          source VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_price_item FOREIGN KEY (item_id) REFERENCES basket_items(id) ON DELETE CASCADE,
          INDEX idx_price_item_date (item_id, reference_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS income_history (
          id VARCHAR(64) PRIMARY KEY,
          profile_id VARCHAR(64) NOT NULL,
          reference_date VARCHAR(32) NOT NULL,
          nominal_income DECIMAL(12,2) NOT NULL,
          source VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_income_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE,
          INDEX idx_income_profile_date (profile_id, reference_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS saving_strategies (
          id VARCHAR(64) PRIMARY KEY,
          profile_id VARCHAR(64) NOT NULL,
          plan_type ENUM('PLAN_A', 'PLAN_B', 'PLAN_C') NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          estimated_monthly_savings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          applied BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_strategy_profile FOREIGN KEY (profile_id) REFERENCES family_profiles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    })().catch((err) => {
      global._ipcaMysqlSchemaPromise = undefined;
      console.error('Falha ao inicializar esquema MySQL:', err instanceof Error ? err.message : err);
      throw new Error('Falha ao conectar ou inicializar esquema no banco MySQL.', { cause: err });
    });
  }

  return global._ipcaMysqlSchemaPromise;
}
