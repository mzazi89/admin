// MZAZI ADMIN — the automatic half.
//
// Vercel calls this on the schedule in vercel.json. Nothing else in the app
// touches it; the snapshot runs from here, unattended, whether or not anyone has
// opened the admin panel.
//
// Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the
// variable is set. If it is not set the route refuses to run in a deployed
// environment — an endpoint that writes to the backup store should not be open
// to the internet just because a variable was forgotten. Locally, with no
// Vercel environment, it runs so the schedule can be exercised by hand.

import { NextResponse } from 'next/server';
import { runSnapshot } from '@/lib/backup/snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const deployed = Boolean(process.env.VERCEL);

  if (secret) {
    const header = request.headers.get('authorization') || '';
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (deployed) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set, so the scheduled backup is disabled.' },
      { status: 503 }
    );
  }

  const result = await runSnapshot({ reason: 'cron' });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
