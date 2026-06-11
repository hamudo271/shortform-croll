import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';
import { levelFromActivity } from '@/lib/community';

/** GET /api/community/level — 현재 유저의 레벨/XP/활동 통계 (구독 회원/관리자). */
export async function GET() {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  // 작성 글(받은 좋아요/댓글은 본인 것 제외) + 작성 댓글 수
  const [posts, comments] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: me.id, status: 'PUBLISHED' },
      select: {
        id: true,
        likes: { where: { userId: { not: me.id } }, select: { id: true } },
        comments: { where: { status: 'PUBLISHED', authorId: { not: me.id } }, select: { id: true } },
      },
    }),
    prisma.communityComment.count({ where: { authorId: me.id, status: 'PUBLISHED' } }),
  ]);

  const receivedLikes = posts.reduce((sum, p) => sum + p.likes.length, 0);
  const receivedComments = posts.reduce((sum, p) => sum + p.comments.length, 0);

  const level = levelFromActivity({
    posts: posts.length,
    comments,
    receivedLikes,
    receivedComments,
  });

  return NextResponse.json(level);
}
