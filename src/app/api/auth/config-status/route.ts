import { NextResponse } from 'next/server';

/**
 * GET /api/auth/config-status
 * 소셜/결제 환경변수가 런타임에 보이는지 진단(값은 노출하지 않고 존재여부·길이만).
 * 배포 환경변수 설정 확인용.
 */
export async function GET() {
  const peek = (k: string) => {
    const v = process.env[k];
    return { set: !!v && v.trim().length > 0, len: v ? v.length : 0 };
  };
  return NextResponse.json(
    {
      google: { id: peek('GOOGLE_CLIENT_ID'), secret: peek('GOOGLE_CLIENT_SECRET') },
      naver: { id: peek('NAVER_CLIENT_ID'), secret: peek('NAVER_CLIENT_SECRET') },
      toss: { secret: peek('TOSS_SECRET_KEY') },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
