import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCommunityAccess } from '@/lib/auth';

/**
 * GET /api/community/[postId]/image — 게시글 이미지 단건 서빙.
 * 피드 응답에 base64 를 싣지 않기 위해 이미지는 이 라우트로 분리해 lazy 로드한다.
 * 외부 URL 이면 리다이렉트, data URI 면 바이너리로 디코딩해 캐시 가능하게 응답.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> },
) {
  const access = await requireCommunityAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { postId } = await context.params;
  const post = await prisma.communityPost.findFirst({
    where: { id: postId, status: 'PUBLISHED' },
    select: { image: true },
  });
  if (!post?.image) {
    return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 404 });
  }

  // 외부 URL 은 그대로 리다이렉트
  if (/^https?:\/\//.test(post.image)) {
    return NextResponse.redirect(post.image);
  }

  // data:image/<type>;base64,<payload>  (base64 는 줄바꿈이 없으므로 dotAll 불필요)
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(post.image);
  if (!match) {
    return NextResponse.json({ error: '이미지를 읽을 수 없습니다.' }, { status: 415 });
  }
  const [, contentType, b64] = match;
  const bytes = Buffer.from(b64, 'base64');

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      // 이미지 내용은 변하지 않으므로 장기 캐시 (구독 회원 전용이므로 private)
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  });
}
