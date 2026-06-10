import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/** POST /api/community/[postId]/like — 좋아요 토글 (유저당 1개). */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { postId } = await context.params;

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: me.id } },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.postLike.create({ data: { postId, userId: me.id } });
  }

  const likes = await prisma.postLike.count({ where: { postId } });
  return NextResponse.json({ liked: !existing, likes });
}
