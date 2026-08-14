// Shared helper — ask the running bot to re-import the command registry.
//
// The bot polls the shared `bot_control` table every ~15s and executes the
// `sync` action (see quartz/lib/botTelemetry.js), which re-imports all
// enabled commands from `bot_commands`. So after any admin save we enqueue a
// sync row and the change goes live on the bot within ~15 seconds.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function requestBotCommandSync() {
  try {
    // Dedupe: keep at most one pending/claimed sync at a time — saves made in
    // quick succession collapse into a single reload, which is all we need.
    await sql`
      INSERT INTO bot_control (action, payload, status)
      SELECT 'sync', '{"source":"admin"}'::jsonb, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM bot_control
        WHERE action = 'sync' AND status IN ('pending', 'claimed')
      )
    `;
  } catch (e) {
    // A failed notify must never break the admin save itself.
    console.error('requestBotCommandSync error:', e.message);
  }
}
