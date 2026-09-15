// MZAZI API — the id of the primary bot profile.
//
// The primary is the FIRST configured profile. That is the same rule the bot
// applies (`quartz/lib/profiles.js` → `primary()` returns `list()[0]`), and the
// same rule that decides which bot owns a `bot_commands` row whose `profile` is
// empty.
//
// It delegates to listBots() rather than reading `bot_profiles` itself, because
// TWO callers must agree on this or they disagree silently:
//
//   - app/api/admin/bot-commands/route.js — decides whether rows with no
//     profile match the currently selected bot, so selecting the primary bot
//     shows the legacy rows instead of hiding them.
//   - app/api/admin/bot-commands/sync/route.js — decides which bot to aim a
//     reload at. A `bot_control` row with no bot_id is claimed by WHICHEVER bot
//     polls first (see lib/botSync.js), and a TARGETED row is only claimable when
//     bot_id is one of that bot's own profile ids (quartz/lib/botTelemetry.js).
//     So aiming at an id no bot owns reloads nothing at all — worse than not
//     targeting, which is why the caller checks the answer against the bot list.
//
// lib/bots.js already mirrors the bot's parsing including its fallback, so
// delegating keeps one definition of "which bots exist" instead of three.
import { listBots } from '@/lib/bots';

export async function primaryProfileId() {
  try {
    const bots = await listBots();
    if (bots.length && bots[0]?.id) return String(bots[0].id);
  } catch {
    // Fall through — an unreadable settings table still needs an answer.
  }
  // Matches the bot's own fallback (`list()` → `[{ id: 'main', ... }]`), so a
  // deployment with bot_profiles unset is addressed by the id the bot really
  // owns. 'quartz' would look right and never be claimable.
  return 'main';
}
