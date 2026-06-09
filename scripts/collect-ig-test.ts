/**
 * 일회성 IG 수집 검증 — collect 라우트 STEP 4(틱톡 방식 해시태그 검색)를 복제.
 *   npx tsx --env-file=.env scripts/collect-ig-test.ts
 */
import { prisma } from '../src/lib/prisma';
import { Platform } from '@prisma/client';
import { collectReelsByHashtags, fetchUserInfo } from '../src/lib/collectors/instagram-api';
import { isListicleTitle } from '../src/lib/collectors/tiktok-api';
import { getOrFetchCreator } from '../src/lib/creators';
import { classifyByKeywords } from '../src/lib/classifier';
import { classifyThumbnail } from '../src/lib/vision';
import { isExcludedContent } from '../src/lib/exclude';

const MIN_PUBLISHED_AT = new Date('2025-12-01T00:00:00Z');
const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || '20000', 10);

async function main() {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error('RAPIDAPI_KEY 없음');

  console.log('📷 해시태그 검색으로 IG 릴스 수집...');
  const { reels, errors } = await collectReelsByHashtags(key);
  reels.sort((a, b) => b.viewCount - a.viewCount);
  console.log(`raw 릴스(중복제거): ${reels.length}, 에러: ${errors.length}`);

  const stats = { lowView: 0, excluded: 0, listicle: 0, old: 0, noLink: 0, face: 0, saved: 0 };
  const saved: string[] = [];

  for (const reel of reels) {
    if (reel.viewCount < MIN_VIEWS) { stats.lowView++; continue; }
    if (isExcludedContent(`${reel.title} ${reel.description}`, reel.authorName)) { stats.excluded++; continue; }
    if (isListicleTitle(`${reel.title} ${reel.description}`)) { stats.listicle++; continue; }
    const pub = reel.takenAt ? new Date(reel.takenAt * 1000) : null;
    if (!pub || pub < MIN_PUBLISHED_AT) { stats.old++; continue; }

    const creator = await getOrFetchCreator(Platform.INSTAGRAM, reel.authorId, () =>
      fetchUserInfo(reel.authorId, key),
    );
    if (!creator?.hasSalesLink) { stats.noLink++; continue; }

    let visualClass: string | null = null;
    if (process.env.GEMINI_API_KEY && reel.thumbnailUrl) {
      visualClass = await classifyThumbnail(process.env.GEMINI_API_KEY, reel.thumbnailUrl);
      if (visualClass === 'face' || visualClass === 'mixed') { stats.face++; continue; }
    }

    const c = classifyByKeywords({ title: reel.title, description: reel.description });
    await prisma.video.upsert({
      where: { videoId: `ig_${reel.id}` },
      update: {
        viewCount: BigInt(reel.viewCount), likeCount: BigInt(reel.likeCount),
        commentCount: BigInt(reel.commentCount), publishedAt: pub,
        passReason: 'creator_link', visualClass, updatedAt: new Date(),
      },
      create: {
        platform: Platform.INSTAGRAM, videoId: `ig_${reel.id}`,
        title: reel.title, description: reel.description, thumbnailUrl: reel.thumbnailUrl,
        videoUrl: reel.videoUrl, authorName: reel.authorName,
        authorUrl: `https://www.instagram.com/${reel.authorId}/`,
        viewCount: BigInt(reel.viewCount), likeCount: BigInt(reel.likeCount),
        commentCount: BigInt(reel.commentCount), shareCount: BigInt(reel.shareCount),
        viralScore: reel.viewCount > 1000000 ? 90 : reel.viewCount > 100000 ? 60 : 30,
        category: c.category === 'OTHER' ? 'LIFESTYLE' : c.category,
        targetAge: c.targetAge, tags: c.tags, country: 'US',
        publishedAt: pub, passReason: 'creator_link', visualClass,
      },
    });
    stats.saved++;
    saved.push(`@${reel.authorId} v=${reel.viewCount} ${reel.title.slice(0, 40)}`);
  }

  console.log('\n=== 결과 ===');
  console.log(stats);
  console.log('\n=== 저장된 릴스 ===');
  saved.forEach((s) => console.log(s));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
