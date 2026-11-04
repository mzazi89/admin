import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { adminJwtSecret, adminAuthConfigured } from '@/lib/authSecret';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mzazi.shop';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || '';
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

    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    // Fail closed: without configured credentials no password is accepted.
    let valid = false;
    if (ADMIN_PASSWORD_HASH) {
      valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    } else if (ADMIN_PASSWORD_PLAIN) {
      valid = password === ADMIN_PASSWORD_PLAIN;
    }

    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = jwt.sign({ role: 'admin', email: ADMIN_EMAIL }, ADMIN_JWT_SECRET, { expiresIn: '8h' });
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
