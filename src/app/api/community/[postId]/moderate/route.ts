import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const ACTIONS = ['pin', 'unpin', 'hide', 'unhide'] as const;
type Action = (typeof ACTIONS)[number];

/**
 * POST /api/community/[postId]/moderate { action: 'pin'|'unpin'|'hide'|'unhide' }
 * 관리자 전용 모더레이션:
 * - pin/unpin: 공지 고정 — 피드 최상단 노출 (About 의 "우수 글 공지 고정")
 * - hide/unhide: 임시 숨김(status=HIDDEN) — 삭제와 달리 관리자 피드에서 보이고 즉시 복구 가능
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { postId } = await params;
  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action 은 ${ACTIONS.join('/')} 중 하나여야 합니다.` }, { status: 400 });
  }

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, status: true },
  });
  // 삭제된 글은 모더레이션 대상 아님
  if (!post || post.status === 'DELETED') {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  const data =
    action === 'pin' ? { pinned: true }
    : action === 'unpin' ? { pinned: false }
    : action === 'hide' ? { status: 'HIDDEN' as const }
    : { status: 'PUBLISHED' as const };

  await prisma.communityPost.update({ where: { id: postId }, data });
  return NextResponse.json({ success: true, action });
}
