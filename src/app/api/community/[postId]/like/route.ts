import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';

/** POST /api/community/[postId]/like — 좋아요 토글 (유저당 1개, 본인 글 제외). */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const { postId } = await context.params;

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { id: true, authorId: true },
  });
  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

  // 본인 글 self-like 차단 — XP 셀프 파밍 방지
  if (post.authorId === me.id) {
    return NextResponse.json({ error: '본인 글에는 좋아요할 수 없습니다.' }, { status: 400 });
  }

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
