import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Returns null if caller is admin; returns a 401/403 response otherwise.
 * Use at the top of admin API routes.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
