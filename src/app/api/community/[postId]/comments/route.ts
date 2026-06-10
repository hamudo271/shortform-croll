import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/** POST /api/community/[postId]/comments — 댓글/대댓글 작성. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

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
