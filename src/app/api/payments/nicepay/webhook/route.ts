import { NextRequest, NextResponse } from 'next/server';

/**
 * 나이스페이 웹훅 수신 엔드포인트.
 *
 * 나이스페이 콘솔은 웹훅 등록 시 이 URL로 검증 요청을 보내 HTTP 200 을 기대한다.
 * 따라서 GET/POST 모두 200 으로 응답한다.
 *
 * ⚠️ 보안: 웹훅 수신만으로는 절대 구독을 활성화하지 않는다. 실제 결제 처리는
 * 본 통합(승인 API + 금액 검증 + 멱등) 구현 시 이 핸들러에 추가한다. 그 전까지는
 * 단순 200 ack 로 두어, 위조 웹훅이 권한을 얻는 일이 없도록 한다.
 */

export async function GET() {
  return new NextResponse('OK', { status: 200 });
}

export async function POST(req: NextRequest) {
  // 본문은 form-encoded 또는 JSON 으로 올 수 있음 — 일단 안전하게 읽어 로깅만.
  try {
    const ct = req.headers.get('content-type') || '';
    let payload: unknown = null;
    if (ct.includes('application/json')) {
      payload = await req.json().catch(() => null);
    } else {
      const text = await req.text().catch(() => '');
      payload = text;
    }
    console.log('[nicepay webhook] received:', payload);
  } catch (e) {
    console.error('[nicepay webhook] parse error:', e);
  }

  // 나이스페이는 200 을 받아야 정상 처리로 간주
  return new NextResponse('OK', { status: 200 });
}
