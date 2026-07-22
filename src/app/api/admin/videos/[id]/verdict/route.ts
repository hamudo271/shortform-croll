import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

/**
 * Phase 0 캘리브레이션 라벨링 — 운영자가 직접 "이건 소싱감/애매/탈락" 을 찍는다.
 * 기준서: docs/COLLECTION_CRITERIA_V2.md "Phase 0"
 *
 * 이 라벨이 임계값 보정의 정답지다. /admin/calibration 에서 WINNER 그룹과
 * REJECT 그룹의 신호 분포를 비교해 어느 구간이 실제 소싱감인지 역산한다.
 *
 * 숨김(hidden)과는 별개 축이다 — 숨김은 회원 노출 제어, 평가는 학습 데이터.
 */
const VERDICTS = ['WINNER', 'MAYBE', 'REJECT'] as const;
type Verdict = (typeof VERDICTS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  let body: { verdict?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // null 은 평가 취소 (잘못 누른 라벨을 되돌릴 수 있어야 데이터가 깨끗해진다)
  const verdict = body.verdict ?? null;
  if (verdict !== null && !VERDICTS.includes(verdict as Verdict)) {
    return NextResponse.json(
      { error: `verdict 는 ${VERDICTS.join(' | ')} 또는 null 이어야 합니다.` },
      { status: 400 },
    );
  }

  try {
    await prisma.video.update({
      where: { id },
      data: { userVerdict: verdict, verdictAt: verdict ? new Date() : null },
    });
  } catch {
    return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, verdict });
}
