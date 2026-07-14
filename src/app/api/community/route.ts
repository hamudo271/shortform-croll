import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';
import { hotScore } from '@/lib/community';

const MAX_IMAGE_LEN = 3_000_000; // ~2MB 파일의 base64 길이 상한
const PAGE_SIZE = 20;
const POST_COOLDOWN_MS = 30_000; // 글 도배 방지

function cleanText(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/**
 * GET /api/community?sort=hot|new&cursor=<id>
 * 구독 회원/관리자만 조회 가능. cursor 기반 페이지네이션(최신순).
 * 이미지 base64 는 응답에 싣지 않고 hasImage 만 내려준다(전용 이미지 라우트로 lazy 로드).
 */
export async function GET(request: NextRequest) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  const sort = request.nextUrl.searchParams.get('sort') === 'new' ? 'new' : 'hot';
  const cursor = request.nextUrl.searchParams.get('cursor') || undefined;

  const rows = await prisma.communityPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1, // 다음 페이지 존재 여부 확인용 +1
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      comments: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, authorId: true, authorName: true, message: true, parentId: true, createdAt: true,
          author: { select: { profileImage: true } },
        },
      },
      author: { select: { profileImage: true } },
      _count: { select: { likes: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;

  // 내가 좋아요한 글 집합 — userId 배열 전체를 내려주지 않고 한 번의 쿼리로 해결
  const likedSet = new Set(
    (
      await prisma.postLike.findMany({
        where: { userId: me.id, postId: { in: pageRows.map((p) => p.id) } },
        select: { postId: true },
      })
    ).map((l) => l.postId),
  );

  const mapped = pageRows.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    mine: p.authorId === me.id,
    name: p.authorName,
    profileImage: p.author?.profileImage || null,
    title: p.title,
    message: p.message,
    hasImage: !!p.image,
    createdAt: p.createdAt,
    likes: p._count.likes,
    likedByMe: likedSet.has(p.id),
    comments: p.comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      mine: c.authorId === me.id,
      name: c.authorName,
      profileImage: c.author?.profileImage || null,
      message: c.message,
      parentId: c.parentId,
      createdAt: c.createdAt,
    })),
  }));

  if (sort === 'new') {
    mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    mapped.sort(
      (a, b) =>
        hotScore({ likes: b.likes, commentCount: b.comments.length, createdAt: b.createdAt }) -
        hotScore({ likes: a.likes, commentCount: a.comments.length, createdAt: a.createdAt }),
    );
  }

  // isAdmin — 프론트가 수정/삭제(모더레이션) 버튼 노출 여부를 결정하는 데 사용.
  return NextResponse.json({ posts: mapped, nextCursor, isAdmin: me.role === 'ADMIN' });
}

/** POST /api/community — 게시글 작성 (구독 회원/관리자). */
export async function POST(request: NextRequest) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const me = access.user;

  let body: { title?: string; message?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const title = cleanText(body.title, 120);
  const message = cleanText(body.message, 2000);
  if (!title || !message) {
    return NextResponse.json({ error: '제목과 내용을 입력하세요.' }, { status: 400 });
  }

  let image: string | null = typeof body.image === 'string' ? body.image : '';
  if (image && (image.length > MAX_IMAGE_LEN || !/^data:image\/|^https?:\/\//.test(image))) {
    return NextResponse.json({ error: '이미지는 2MB 이하 이미지 파일만 가능합니다.' }, { status: 400 });
  }
  if (!image) image = null;

  // 도배 방지: 직전 글 작성 후 30초 이내 재작성 차단
  const recent = await prisma.communityPost.findFirst({
    where: { authorId: me.id, createdAt: { gt: new Date(Date.now() - POST_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) {
    return NextResponse.json({ error: '잠시 후 다시 작성해주세요.' }, { status: 429 });
  }

  const post = await prisma.communityPost.create({
    data: {
      authorId: me.id,
      authorName: me.name || me.email.split('@')[0],
      title,
      message,
      image,
    },
  });

  return NextResponse.json({ id: post.id, success: true });
}
