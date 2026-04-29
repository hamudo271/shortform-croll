import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateToken,
  getSessionCookieOptions,
  hashPassword,
} from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import {
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizeName,
  normalizePhone,
} from '@/lib/profile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, phone, companyName, businessNumber } = body ?? {};

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: '올바른 이메일을 입력해주세요' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 });
    }

    let normalizedPhone: string | null = null;
    let normalizedBusinessNumber: string | null = null;
    try {
      normalizedPhone = normalizePhone(phone);
      normalizedBusinessNumber = normalizeBusinessNumber(businessNumber);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'INVALID_PHONE') {
        return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다' }, { status: 400 });
      }
      if (code === 'INVALID_BUSINESS_NUMBER') {
        return NextResponse.json({ error: '사업자등록번호는 10자리 숫자여야 합니다 (예: 123-45-67890)' }, { status: 400 });
      }
      throw e;
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
        name: normalizeName(name),
        phone: normalizedPhone,
        companyName: normalizeCompanyName(companyName),
        businessNumber: normalizedBusinessNumber,
        role,
      },
    });

    void logActivity({ userId: user.id, action: 'SIGNUP', request });

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
