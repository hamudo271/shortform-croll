/**
 * One-off migration: convert all YouTube thumbnailUrls in the database to the
 * permanent `https://i.ytimg.com/vi/<id>/hqdefault.jpg` format.
 *
 * Why: YouTube Data API returns thumbnail URLs that include CDN routing tokens
 * which can become stale; the canonical i.ytimg.com path with no params is
 * the documented permanent URL and never expires.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-yt-thumbnails.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const yt = await prisma.video.findMany({
  where: { platform: 'YOUTUBE' },
  select: { id: true, videoId: true, thumbnailUrl: true },
});

console.log(`Found ${yt.length} YouTube videos`);

let updated = 0;
let skipped = 0;
for (const v of yt) {
  const target = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
  if (v.thumbnailUrl === target) { skipped++; continue; }
  await prisma.video.update({
    where: { id: v.id },
    data: { thumbnailUrl: target },
  });
  updated++;
}

console.log(`✓ updated: ${updated}`);
console.log(`✓ skipped (already correct): ${skipped}`);

await prisma.$disconnect();
