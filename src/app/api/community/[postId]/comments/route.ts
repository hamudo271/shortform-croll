import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';

const COMMENT_COOLDOWN_MS = 8_000; // 댓글 도배 방지

/** POST /api/community/[postId]/comments — 댓글/대댓글 작성 (구독 회원/관리자). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const { postId } = await context.params;

  let body: { message?: string; parentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const message = String(body.message ?? '').trim().slice(0, 260);
  if (!message) return NextResponse.json({ error: '댓글을 입력하세요.' }, { status: 400 });
  const parentId = body.parentId ? String(body.parentId).slice(0, 80) : null;

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

  // 대댓글이면 parent 가 같은 글의 PUBLISHED top-level 댓글인지 검증 (위조/딥 네스팅 차단)
  if (parentId) {
    const parent = await prisma.communityComment.findFirst({
      where: { id: parentId, postId, status: 'PUBLISHED', parentId: null },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: '답글 대상 댓글을 찾을 수 없습니다.' }, { status: 400 });
    }
  }

  // 도배 방지: 직전 댓글 후 8초 이내 재작성 차단
  const recent = await prisma.communityComment.findFirst({
    where: { authorId: me.id, createdAt: { gt: new Date(Date.now() - COMMENT_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) {
    return NextResponse.json({ error: '잠시 후 다시 작성해주세요.' }, { status: 429 });
  }

  const comment = await prisma.communityComment.create({
    data: {
      postId,
      authorId: me.id,
      authorName: me.name || me.email.split('@')[0],
      message,
      parentId,
    },
  });

  return NextResponse.json({ id: comment.id, success: true });
}
