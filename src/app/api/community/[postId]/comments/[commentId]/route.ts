import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';

/**
 * 댓글 삭제 — 작성자 본인 또는 관리자(모더레이션).
 * 게시글과 동일하게 status='DELETED' 소프트 삭제.
 * 대댓글이 달린 부모 댓글을 지워도 대댓글은 남는다(피드 쿼리가 개별 status 필터).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const { postId, commentId } = await params;
  const comment = await prisma.communityComment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, status: true },
  });
  if (!comment || comment.postId !== postId || comment.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (comment.authorId !== me.id && me.role !== 'ADMIN') {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
  }

  await prisma.communityComment.update({
    where: { id: commentId },
    data: { status: 'DELETED' },
  });

  return NextResponse.json({ success: true });
}
