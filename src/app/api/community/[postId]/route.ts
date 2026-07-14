import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';

/**
 * 게시글 수정/삭제 — 작성자 본인 또는 관리자(모더레이션)만 가능.
 * 삭제는 hard delete 가 아니라 status='DELETED' 소프트 삭제 —
 * GET 피드가 PUBLISHED 만 조회하므로 즉시 사라지고, 분쟁 시 복구 가능.
 */

function cleanText(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

async function loadPostForWrite(postId: string) {
  return prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });
}

/** PATCH /api/community/[postId] — 제목/내용 수정 (작성자 or 관리자). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const { postId } = await params;
  const post = await loadPostForWrite(postId);
  if (!post || post.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (post.authorId !== me.id && me.role !== 'ADMIN') {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 });
  }

  let body: { title?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // POST /api/community 와 동일한 길이 제한
  const title = cleanText(body.title, 120);
  const message = cleanText(body.message, 2000);
  if (!title || !message) {
    return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });
  }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { title, message },
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/community/[postId] — 소프트 삭제 (작성자 or 관리자). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const { postId } = await params;
  const post = await loadPostForWrite(postId);
  if (!post || post.status !== 'PUBLISHED') {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (post.authorId !== me.id && me.role !== 'ADMIN') {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
  }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { status: 'DELETED' },
  });

  return NextResponse.json({ success: true });
}
