import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const sql = neon(process.env.DATABASE_URL);

export async function initializeDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firstname VARCHAR(255) NOT NULL,
        lastname VARCHAR(255) NOT NULL,
        fullname VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        google_id VARCHAR(255),
        security_question VARCHAR(255),
        security_answer VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS firstname VARCHAR(255) DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lastname VARCHAR(255) DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question VARCHAR(255)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer VARCHAR(255)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id VARCHAR(255)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id) WHERE supabase_id IS NOT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id) WHERE clerk_id IS NOT NULL`;

    // Legacy column migrations — non-fatal: if the table doesn't exist yet
    // (fresh database), skip and let the CREATE TABLE below handle it.
    try {
      await sql`ALTER TABLE packages ADD COLUMN IF NOT EXISTS expires_after_hours INTEGER DEFAULT NULL`;
    } catch (e) {
      console.warn('init: packages ALTER skipped —', e.message);
    }
    try {
      await sql`ALTER TABLE panels ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL`;
    } catch (e) {
      console.warn('init: panels ALTER skipped —', e.message);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS wallet (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        reference VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS panels (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        ptero_server_id INTEGER,
        ptero_user_id INTEGER,
        ptero_username VARCHAR(255),
        package_name VARCHAR(255),
        package_price DECIMAL(10, 2),
        nest_id INTEGER,
        egg_id INTEGER,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER,
        package_name VARCHAR(255),
        amount DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'pending',
        reference VARCHAR(255) UNIQUE,
        pterodactyl_credentials TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        message TEXT NOT NULL,
        approved BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        user_email VARCHAR(255),
        user_name VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        admin_reply TEXT,
        replied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Packages table — replaces the hardcoded PACKAGES array
    await sql`
      CREATE TABLE IF NOT EXISTS packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        cpu INTEGER NOT NULL DEFAULT 0,
        ram INTEGER NOT NULL DEFAULT 0,
        disk INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        popular BOOLEAN DEFAULT false,
        accent VARCHAR(20) DEFAULT '#2563eb',
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed default packages if the table is empty
    const existing = await sql`SELECT COUNT(*) AS cnt FROM packages`;
    if (parseInt(existing[0].cnt) === 0) {
      await sql`
        INSERT INTO packages (name, price, cpu, ram, disk, description, popular, accent, sort_order)
        VALUES
          ('Starter',  50,  20,  512,   2048,  'Perfect for small bots and lightweight servers',           false, '#1e3a8a', 1),
          ('Standard', 75,  50,  1024,  5120,  'Great for Minecraft, Discord bots & medium workloads',    true,  '#2563eb', 2),
          ('Premium',  100, 100, 5120,  10240, 'Full power for high-performance game servers',             false, '#1d4ed8', 3),
          ('Ultimate', 120, 0,   0,     0,     'No limits. Maximum performance for any workload.',         false, '#4f46e5', 4)
      `;
    }

    // Insert Testing Server package if it doesn't exist
    await sql`
      INSERT INTO packages (name, price, cpu, ram, disk, description, popular, accent, active, sort_order, expires_after_hours)
      SELECT 'Testing Server', 5, 20, 512, 1024, 'Try our platform risk-free. Server is automatically removed after 6 hours.', false, '#7c3aed', true, 0, 6
      WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Testing Server')
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS voucher_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_by VARCHAR(255),
        used_by INTEGER REFERENCES users(id),
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    /* ═══════════════════════════════════════════════════════════════
       MZAZI API PLATFORM — additive schema (safe on re-run)
       ═══════════════════════════════════════════════════════════════ */

    // users: role + status (safe on re-run)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`;

    // users: referral system (safe on re-run)
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`;

    // referral_commissions — one commission per referred order (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id SERIAL PRIMARY KEY,
        referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id INTEGER NOT NULL UNIQUE,
        amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
        status VARCHAR(20) DEFAULT 'paid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_user_id, created_at DESC)`;

    // api_keys — only the SHA-256 hash is stored, never the raw key
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT 'Default Key',
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(32) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        plan VARCHAR(20) NOT NULL DEFAULT 'FREE',
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status)`;

    // api_requests — one row per API call (request log)
    await sql`
      CREATE TABLE IF NOT EXISTS api_requests (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(64) NOT NULL UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        provider VARCHAR(100),
        ip VARCHAR(45),
        user_agent VARCHAR(255),
        error_code VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_requests_user ON api_requests(user_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_requests_key ON api_requests(api_key_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_requests_endpoint ON api_requests(endpoint, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_requests_created ON api_requests(created_at DESC)`;
    await sql`ALTER TABLE api_requests ADD COLUMN IF NOT EXISTS category VARCHAR(50)`;

    // api_usage — daily rollup per key (rate-limit counter + analytics)
    await sql`
      CREATE TABLE IF NOT EXISTS api_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        provider_failures INTEGER NOT NULL DEFAULT 0,
        total_response_time_ms BIGINT NOT NULL DEFAULT 0,
        UNIQUE (api_key_id, date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date DESC)`;

    // subscriptions — one active plan per user (upsert on change)
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(20) NOT NULL DEFAULT 'FREE',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan)`;

    // endpoints — registry of all platform endpoints (future-proof)
    await sql`
      CREATE TABLE IF NOT EXISTS endpoints (
        id SERIAL PRIMARY KEY,
        path VARCHAR(255) NOT NULL UNIQUE,
        method VARCHAR(10) NOT NULL DEFAULT 'GET',
        category VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        provider VARCHAR(100),
        upstream VARCHAR(255),
        parameters JSONB DEFAULT '[]'::jsonb,
        example_response JSONB,
        requires_query BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_endpoints_category ON endpoints(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_endpoints_active ON endpoints(is_active)`;
    // columns added after initial deploy — safe on re-run
    await sql`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS upstream VARCHAR(255)`;
    await sql`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS example_response JSONB`;

    // api_settings — key/value config (rate limits etc.), admin-editable
    await sql`
      CREATE TABLE IF NOT EXISTS api_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // providers — upstream service registry + aggregated health
    await sql`
      CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        base_url VARCHAR(255) NOT NULL,
        api_key_configured BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active',
        avg_response_ms NUMERIC(10,1),
        failure_rate NUMERIC(6,2),
        total_requests INTEGER DEFAULT 0,
        total_failures INTEGER DEFAULT 0,
        last_success_at TIMESTAMP,
        last_failure_at TIMESTAMP,
        last_error VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status)`;
    await sql`ALTER TABLE providers ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`;

    // provider_health — per-check health log
    await sql`
      CREATE TABLE IF NOT EXISTS provider_health (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
        ok BOOLEAN NOT NULL,
        response_time_ms INTEGER,
        error VARCHAR(255),
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_provider_health_provider ON provider_health(provider_id, checked_at DESC)`;

    // endpoint_usage — daily rollup per endpoint (analytics)
    await sql`
      CREATE TABLE IF NOT EXISTS endpoint_usage (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        date DATE NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        provider_failures INTEGER NOT NULL DEFAULT 0,
        total_response_time_ms BIGINT NOT NULL DEFAULT 0,
        UNIQUE (endpoint, date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_endpoint_usage_date ON endpoint_usage(date DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_endpoint_usage_category ON endpoint_usage(category, date DESC)`;

    // Seed upstream provider row (base URL overridable via env)
    await sql`
      INSERT INTO providers (name, display_name, base_url, api_key_configured, status)
      VALUES ('davidcyril', 'Mzazi Tech Inc', ${process.env.DAVIDCYRIL_API_URL || 'https://apis.davidcyril.name.ng'},
              ${Boolean(process.env.DAVIDCYRIL_API_KEY)}, 'active')
      ON CONFLICT (name) DO UPDATE SET
        display_name = 'Mzazi Tech Inc',
        base_url = EXCLUDED.base_url,
        api_key_configured = EXCLUDED.api_key_configured
    `;

    // Seed provider rows (base URLs overridable via env)
    await sql`
      INSERT INTO providers (name, display_name, base_url, api_key_configured, status)
      VALUES ('drexapp', 'Mzazi Tech Inc', ${process.env.DREXAPP_API_URL || 'https://apis-17ad50309099.herokuapp.com'},
              ${Boolean(process.env.DREXAPP_API_KEY)}, 'active')
      ON CONFLICT (name) DO UPDATE SET
        display_name = 'Mzazi Tech Inc',
        base_url = EXCLUDED.base_url,
        api_key_configured = EXCLUDED.api_key_configured
    `;

    // Seed endpoint registry from provider inventories (DavidCyril + DrexApp).
    // Only endpoints verified against the live upstream are marked active.
    // is_active is intentionally NOT overwritten on re-runs (admin toggles survive).
    const REGISTRY_DIR = path.join(process.cwd(), 'lib', 'api', 'registry');
    const REGISTRIES = [
      { file: 'davidcyril.json', provider: 'davidcyril' },
      { file: 'drexapp.json', provider: 'drexapp' },
    ];
    for (const { file, provider } of REGISTRIES) {
      const registryPath = path.join(REGISTRY_DIR, file);
      if (!fs.existsSync(registryPath)) continue;
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      for (const ep of registry) {
        const paramsDef = {
          required: ep.params.required.map(n => ({ name: n, example: ep.examples?.[n] || null })),
          optional: ep.params.optional.map(n => ({ name: n, example: ep.examples?.[n] || null })),
        };
        await sql`
          INSERT INTO endpoints (path, method, category, name, description, provider, upstream, parameters, requires_query, is_active)
          VALUES (${ep.path}, ${ep.method}, ${ep.category}, ${ep.name}, ${ep.name}, ${provider},
                  ${ep.upstream}, ${JSON.stringify(paramsDef)}, ${ep.params.required.length > 0}, ${ep.active})
          ON CONFLICT (path) DO UPDATE SET
            method = EXCLUDED.method,
            category = EXCLUDED.category,
            name = EXCLUDED.name,
            provider = EXCLUDED.provider,
            upstream = EXCLUDED.upstream,
            parameters = EXCLUDED.parameters,
            requires_query = EXCLUDED.requires_query
        `;
      }
      console.log(`Seeded ${registry.length} endpoints from ${file}`);
    }

    // Seed configurable rate-limit settings (only if missing)
    await sql`
      INSERT INTO api_settings (key, value) VALUES
        ('rate_limit.FREE', '100'),
        ('rate_limit.PREMIUM', '10000'),
        ('rate_limit.BUSINESS', '100000'),
        ('rate_limit.ADMIN', '-1'),
        ('default_plan', 'FREE')
      ON CONFLICT (key) DO NOTHING
    `;

    // Ensure every existing user has a subscription row
    await sql`
      INSERT INTO subscriptions (user_id, plan, status)
      SELECT id, 'FREE', 'active' FROM users
      WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = users.id)
    `;

    /* ═══════════════════════════════════════════════════════════════
       BOT — command registry, status + control (mzazi.shop bot)
       ═══════════════════════════════════════════════════════════════ */

    // bot_commands — the WhatsApp bot command registry (admin-editable)
    await sql`
      CREATE TABLE IF NOT EXISTS bot_commands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(64) UNIQUE NOT NULL,
        aliases JSONB DEFAULT '[]'::jsonb,
        description TEXT DEFAULT '',
        category VARCHAR(64) DEFAULT 'General',
        usage TEXT DEFAULT '',
        owner_only BOOLEAN DEFAULT false,
        admin_only BOOLEAN DEFAULT false,
        group_only BOOLEAN DEFAULT false,
        enabled BOOLEAN DEFAULT true,
        code TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bot_commands_name ON bot_commands(name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_bot_commands_enabled ON bot_commands(enabled)`;

    // bot_status — heartbeat reported by the running bot
    await sql`
      CREATE TABLE IF NOT EXISTS bot_status (
        bot_id VARCHAR(64) PRIMARY KEY,
        online BOOLEAN DEFAULT false,
        version VARCHAR(32),
        uptime_seconds BIGINT DEFAULT 0,
        telegram_online BOOLEAN DEFAULT false,
        whatsapp_sessions INTEGER DEFAULT 0,
        command_count INTEGER DEFAULT 0,
        last_sync_at TIMESTAMP,
        last_sync_error TEXT,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // bot_control — admin-issued control commands consumed by the bot
    await sql`
      CREATE TABLE IF NOT EXISTS bot_control (
        id SERIAL PRIMARY KEY,
        action VARCHAR(64) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(20) DEFAULT 'pending',
        result TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        claimed_at TIMESTAMP,
        done_at TIMESTAMP
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bot_control_status ON bot_control(status, id)`;

    // bot_config — key/value settings for the bot platform (e.g. bot_api_key)
    await sql`
      CREATE TABLE IF NOT EXISTS bot_config (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed the command registry from data/bot-commands.json
    // Runs whenever the DB holds fewer commands than the shipped registry file
    // (covers first run + partial-fill recovery). Aliases are passed as an
    // explicit JSON string + ::jsonb cast — neon serializes non-empty JS arrays
    // as Postgres array literals, which jsonb columns reject.
    const botCommandsPath = path.join(process.cwd(), 'data', 'bot-commands.json');
    if (fs.existsSync(botCommandsPath)) {
      const botCount = await sql`SELECT COUNT(*) AS cnt FROM bot_commands`;
      const seedRegistry = JSON.parse(fs.readFileSync(botCommandsPath, 'utf8'));
      const seedList = seedRegistry.commands || [];
      if (parseInt(botCount[0].cnt) < seedList.length) {
        let seeded = 0;
        for (const cmd of seedList) {
          try {
            const r = await sql`
              INSERT INTO bot_commands (name, aliases, description, category, usage, owner_only, admin_only, group_only, enabled, code)
              VALUES (${cmd.name}, ${JSON.stringify(cmd.aliases || [])}::jsonb, ${cmd.description || ''}, ${cmd.category || 'General'},
                      ${cmd.usage || ''}, ${!!cmd.ownerOnly}, ${!!cmd.adminOnly}, ${!!cmd.groupOnly},
                      ${cmd.enabled !== false}, ${cmd.code || ''})
              ON CONFLICT (name) DO NOTHING
              RETURNING id
            `;
            if (r.length) seeded++;
          } catch (e) {
            console.error(`Seed skipped command "${cmd.name}": ${e.message}`);
          }
        }
        console.log(`Seeded ${seeded} bot commands from registry (${seedList.length} in file)`);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export { sql };
export default sql;
// This content is patched below in initializeDatabase — see voucher_codes addition


// ─── ensureDatabase ───────────────────────────────────────────────────────────
// Idempotent, memoized schema bootstrap. Every API route that touches the DB
// should `await ensureDatabase()` once before querying. Runs initializeDatabase
// a single time per serverless warm instance; retries on failure.
// Self-healing: if bot_commands disappears after init (e.g. an external
// "prisma db push" dropped it), the next call re-runs the full init.
let _dbInitPromise = null;
export async function ensureDatabase() {
  if (!_dbInitPromise) {
    _dbInitPromise = initializeDatabase().catch((e) => {
      _dbInitPromise = null; // allow a later retry
      throw e;
    });
  }
  await _dbInitPromise;

  try {
    await sql`SELECT 1 FROM bot_commands LIMIT 1`;
  } catch {
    _dbInitPromise = null;
    _dbInitPromise = initializeDatabase().catch((e) => {
      _dbInitPromise = null;
      throw e;
    });
    await _dbInitPromise;
  }
}
