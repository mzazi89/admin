// Shared helper — ask the running bot to re-import the command registry.
//
// The bot polls the shared `bot_control` table every ~15s and executes the
// `sync` action (see quartz/lib/botTelemetry.js), which re-imports all
// enabled commands from `bot_commands`. So after any admin save we enqueue a
// sync row and the change goes live on the bot within ~15 seconds.
//
// With two bots running, an UNTARGETED row (bot_id NULL/'') is claimed by
// WHICHEVER BOT POLLS FIRST, so an edit made to one bot's command could sync
// only the other. Passing a bot id writes it into bot_control.bot_id, and the
// claim query only lets a bot take rows that are NULL/'' or name one of its
// own profiles — so the right bot is the one that wakes up.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function requestBotCommandSync(botId) {
  try {
    const target = typeof botId === 'string' ? botId.trim() : '';

    if (target) {
      // Dedupe per bot — saved commands for one bot collapse into a single
      // reload for that bot, but a sync aimed at another bot is not swallowed.
      await sql`
        INSERT INTO bot_control (action, payload, status, bot_id)
        SELECT 'sync', '{"source":"admin"}'::jsonb, 'pending', ${target}
        WHERE NOT EXISTS (
          SELECT 1 FROM bot_control
          WHERE action = 'sync' AND status IN ('pending', 'claimed') AND bot_id = ${target}
        )
      `;
      return;
    }

    // Omitted/empty id — exactly the previous behaviour: no bot target, so any
    // bot may claim it.
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
