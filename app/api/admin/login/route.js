import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { adminJwtSecret, adminAuthConfigured } from '@/lib/authSecret';
import { adminCredentials, sameUsername, verifyPassword } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

// Resolved per request from the settings table, then the environment — see
// lib/credentials.js. Nothing is captured at module scope, so a credential
// change applies to the next login without a redeploy.
const ADMIN_JWT_SECRET = adminJwtSecret();

export async function POST(request) {
  try {
    // Refuse before checking the password: without a real signing secret a
    // token cannot be trusted by any other instance, so "successful" login
    // would bounce the operator straight back to the form. Say why instead.
    if (process.env.NODE_ENV === 'production' && !adminAuthConfigured()) {
      console.error('[admin] login refused: ADMIN_JWT_SECRET is not set (min 16 chars)');
      return NextResponse.json(
        { error: 'Admin authentication is not configured on this deployment.' },
        { status: 503 }
      );
    }

    // The field is labelled "Admin username" but the historical name is `email`;
    // both keys are accepted so an older client keeps working.
    const body = await request.json();
    const email = body.email ?? body.username ?? '';
    const password = body.password ?? '';
    if (!email || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });

    const creds = await adminCredentials();

    // Evaluate both checks before replying: a wrong username and a wrong
    // password must look identical and take the same time.
    const nameOk = sameUsername(email, creds.username);
    const passOk = await verifyPassword(password, creds);

    if (!nameOk || !passOk) {
      console.warn(`[admin] failed login for "${String(email).slice(0, 40)}"`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({ role: 'admin', email: creds.username }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
    const cookieStore = await cookies();
    cookieStore.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    });
    return NextResponse.json({ message: 'Admin login successful' });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
