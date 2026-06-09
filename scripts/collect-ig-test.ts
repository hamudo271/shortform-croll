/**
 * 일회성 IG 수집 검증 스크립트.
 * collect 라우트 STEP 4 의 게이팅을 그대로 복제해 prod DB 에 기록한다.
 *
 *   npx tsx --env-file=.env scripts/collect-ig-test.ts
 */
import { prisma } from '../src/lib/prisma';
import { Platform } from '@prisma/client';
import { collectProductReelsViaRapidApi } from '../src/lib/collectors/instagram-api';
import { getOrFetchCreator, isQualifiedSeller } from '../src/lib/creators';
import { classifyByKeywords } from '../src/lib/classifier';

const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');
const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || '10000', 10); // 배관 검증용 override 가능

async function main() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error('RAPIDAPI_KEY 없음');

  console.log('📷 RapidAPI 로 IG 릴스 수집 시작...');
  const { reels, errors, creators } = await collectProductReelsViaRapidApi(key);
  console.log(`수집된 raw 릴스: ${reels.length}, 크리에이터: ${creators.size}, 에러: ${errors.length}`);

  // 크리에이터 DB 동기화 (collect 라우트와 동일)
  for (const [username, info] of creators.entries()) {
    await getOrFetchCreator(Platform.INSTAGRAM, username, async () => ({
      bioUrl: info.bioUrl,
      signature: info.signature,
      authorName: info.authorName,
      followerCount: info.followerCount,
      videoCount: info.videoCount,
    }));
  }

  const stats = { skippedViews: 0, skippedKo: 0, skippedOld: 0, skippedGate: 0, saved: 0 };
  const gatePass: string[] = [];
  const gateFail: string[] = [];

  for (const reel of reels) {
    if (reel.viewCount < MIN_VIEWS) { stats.skippedViews++; continue; }
    if (/[가-힣]/.test(reel.title) || /[가-힣]/.test(reel.description)) { stats.skippedKo++; continue; }

    const igPublished = reel.takenAt ? new Date(reel.takenAt * 1000) : null;
    if (!igPublished || igPublished < MIN_PUBLISHED_AT) { stats.skippedOld++; continue; }

    const info = creators.get(reel.authorId);
    const pass = isQualifiedSeller({
      authorId: reel.authorId,
      bioUrl: info?.bioUrl,
      signature: info?.signature,
      videoCount: info?.videoCount,
    });
    if (!pass) {
      stats.skippedGate++;
      if (!gateFail.includes(reel.authorId)) gateFail.push(reel.authorId);
      continue;
    }
    if (!gatePass.includes(reel.authorId)) gatePass.push(reel.authorId);

    const classification = classifyByKeywords({ title: reel.title, description: reel.description });
    await prisma.video.upsert({
      where: { videoId: `ig_${reel.id}` },
      update: {
        viewCount: BigInt(reel.viewCount),
        likeCount: BigInt(reel.likeCount),
        commentCount: BigInt(reel.commentCount),
        publishedAt: igPublished,
        passReason: 'creator_link',
        updatedAt: new Date(),
      },
      create: {
        platform: Platform.INSTAGRAM,
        videoId: `ig_${reel.id}`,
        title: reel.title,
        description: reel.description,
        thumbnailUrl: reel.thumbnailUrl,
        videoUrl: reel.videoUrl,
        authorName: reel.authorName,
        authorUrl: `https://www.instagram.com/${reel.authorId}/`,
        viewCount: BigInt(reel.viewCount),
        likeCount: BigInt(reel.likeCount),
        commentCount: BigInt(reel.commentCount),
        shareCount: BigInt(reel.shareCount),
        viralScore: reel.viewCount > 1000000 ? 90 : reel.viewCount > 100000 ? 60 : 30,
        category: classification.category === 'OTHER' ? 'LIFESTYLE' : classification.category,
        targetAge: classification.targetAge,
        tags: classification.tags,
        country: 'US',
        publishedAt: igPublished,
        passReason: 'creator_link',
      },
    });
    stats.saved++;
  }

  console.log('\n=== 결과 ===');
  console.log(stats);
  console.log('게이트 통과 계정:', gatePass.join(', ') || '(없음)');
  console.log('게이트 탈락 계정:', gateFail.join(', ') || '(없음)');
  if (errors.length) console.log('에러:', errors.slice(0, 5));

  // 크리에이터별 hasSalesLink 현황
  const igCreators = await prisma.creator.findMany({
    where: { platform: Platform.INSTAGRAM },
    select: { authorId: true, hasSalesLink: true, bioUrl: true, videoCount: true },
  });
  console.log('\n=== IG 크리에이터 hasSalesLink ===');
  for (const c of igCreators) {
    console.log(`@${c.authorId}: salesLink=${c.hasSalesLink} videos=${c.videoCount} bio=${(c.bioUrl || '').slice(0, 40)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
