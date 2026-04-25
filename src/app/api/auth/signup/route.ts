import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateToken,
  getSessionCookieOptions,
  hashPassword,
} from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: '올바른 이메일을 입력해주세요' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: '이미 가입된 이메일입니다' }, { status: 409 });
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const role = adminEmail && adminEmail === normalizedEmail ? 'ADMIN' : 'USER';

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 50) : null,
        role,
      },
    });

    const token = generateToken(user.id);
    const cookieOptions = getSessionCookieOptions();

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);
    return response;
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: '회원가입 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
