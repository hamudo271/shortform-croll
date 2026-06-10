import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hotScore } from '@/lib/community';

const MAX_IMAGE_LEN = 3_000_000; // ~2MB 파일의 base64 길이 상한

function cleanText(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** GET /api/community?sort=hot|new — 공개 게시글 목록. */
export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  const sort = request.nextUrl.searchParams.get('sort') === 'new' ? 'new' : 'hot';

  const posts = await prisma.communityPost.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      comments: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorId: true, authorName: true, message: true, parentId: true, createdAt: true },
      },
      likes: { select: { userId: true } },
      author: { select: { profileImage: true } },
    },
    take: 200,
  });

  const mapped = posts.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    name: p.authorName,
    profileImage: p.author?.profileImage || null,
    title: p.title,
    message: p.message,
    image: p.image,
    createdAt: p.createdAt,
    likes: p.likes.length,
    likedByMe: me ? p.likes.some((l) => l.userId === me.id) : false,
    comments: p.comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      name: c.authorName,
      message: c.message,
      parentId: c.parentId,
      createdAt: c.createdAt,
    })),
  }));

  mapped.sort((a, b) => {
    if (sort === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return (
      hotScore({ likes: b.likes, commentCount: b.comments.length, createdAt: b.createdAt }) -
      hotScore({ likes: a.likes, commentCount: a.comments.length, createdAt: a.createdAt })
    );
  });

  return NextResponse.json(mapped);
}

/** POST /api/community — 게시글 작성 (로그인 필요). */
export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

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
