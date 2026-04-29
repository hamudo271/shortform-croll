import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateToken,
  getSessionCookieOptions,
  comparePassword,
} from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }

    // Bump activity counters in a single round-trip; logActivity is fire-and-forget.
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });
    void logActivity({ userId: user.id, action: 'LOGIN', request });

    const token = generateToken(user.id);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);
    return response;
  } catch {
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
