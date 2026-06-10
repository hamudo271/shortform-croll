import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { levelFromActivity } from '@/lib/community';

/** GET /api/community/level — 현재 유저의 레벨/XP/활동 통계. */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ authenticated: false }, { status: 401 });

  // 작성 글/댓글 수
  const [posts, comments] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: me.id, status: 'PUBLISHED' },
      select: {
        id: true,
        _count: { select: { likes: true } },
        comments: { where: { status: 'PUBLISHED', authorId: { not: me.id } }, select: { id: true } },
      },
    }),
    prisma.communityComment.count({ where: { authorId: me.id, status: 'PUBLISHED' } }),
  ]);

  const receivedLikes = posts.reduce((sum, p) => sum + p._count.likes, 0);
  const receivedComments = posts.reduce((sum, p) => sum + p.comments.length, 0);

  const level = levelFromActivity({
    posts: posts.length,
    comments,
    receivedLikes,
    receivedComments,
  });

  return NextResponse.json(level);
}
