/**
 * Instagram Reels Trend Collector
 * Scrapes trending reels data from aggregator sites
 * Note: Direct Instagram scraping requires authentication
 */

import puppeteer, { Browser } from 'puppeteer';

interface InstagramReel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  authorUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

let browser: Browser | null = null;

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Scrape trending reels from aggregator sites
 * Uses sites like Heepsy, Social Blade, or similar
 */
export async function scrapeTrendingReels(): Promise<InstagramReel[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Try scraping from influencer marketing hub or similar
    // Note: URLs and selectors may need adjustment
    await page.goto('https://influencermarketinghub.com/instagram-reels-trends/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.waitForSelector('article, .trend-item, .reel-card', {
      timeout: 10000,
    }).catch(() => null);

    const reels = await page.evaluate(() => {
      const results: InstagramReel[] = [];

      // Try to find reel items
      const items = document.querySelectorAll(
        'article, .trend-item, .reel-card, [class*="reel"]'
      );

      items.forEach((item) => {
        try {
          const linkEl = item.querySelector('a[href*="instagram.com"]');
          const imgEl = item.querySelector('img');
          const titleEl = item.querySelector('h2, h3, .title');
          const authorEl = item.querySelector('.author, .username');
          const statsEl = item.querySelector('.stats, .views');

          if (linkEl || imgEl) {
            const videoUrl = (linkEl as HTMLAnchorElement)?.href || '';
            const reelId = videoUrl.match(/reel\/([A-Za-z0-9_-]+)/)?.[1] ||
                          Math.random().toString(36).substr(2, 11);

            results.push({
              id: reelId,
              title: titleEl?.textContent?.trim() || '',
              description: '',
              thumbnailUrl: (imgEl as HTMLImageElement)?.src || '',
              videoUrl: videoUrl,
              authorName: authorEl?.textContent?.trim() || 'Unknown',
              authorUrl: '',
              viewCount: parseCount(statsEl?.textContent || '0'),
              likeCount: 0,
              commentCount: 0,
            });
          }
        } catch (e) {
          // Skip invalid entries
        }
      });

      return results;

      function parseCount(str: string): number {
        const clean = str.replace(/[^0-9.KMBkmb]/g, '');
        const num = parseFloat(clean) || 0;
        const suffix = clean.match(/[KMBkmb]$/)?.[0]?.toUpperCase();

        switch (suffix) {
          case 'K': return Math.round(num * 1000);
          case 'M': return Math.round(num * 1000000);
          case 'B': return Math.round(num * 1000000000);
          default: return Math.round(num);
        }
      }
    });

    return reels;
  } catch (error) {
    console.error('Instagram Reels scraping error:', error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Generate sample trending reels data
 * Used as fallback when scraping fails
 * In production, this should be replaced with actual data sources
 */
export function getSampleReelsData(): InstagramReel[] {
  // This is placeholder data - in production, you would:
  // 1. Use a paid API service like Apify
  // 2. Manually curate trending reels
  // 3. Use RSS feeds from trend aggregators

  console.warn(
    'Using sample Instagram Reels data. ' +
    'For production, integrate with a data provider or implement manual curation.'
  );

  return [];
}

/**
 * Collect trending Instagram Reels
 * Combines data from multiple sources
 */
export async function collectTrendingReels(): Promise<InstagramReel[]> {
  const allReels: InstagramReel[] = [];

  // Try scraping first
  try {
    const scrapedReels = await scrapeTrendingReels();
    allReels.push(...scrapedReels);
  } catch (error) {
    console.error('Failed to scrape reels:', error);
  }

  // If scraping failed, use sample data
  if (allReels.length === 0) {
    const sampleReels = getSampleReelsData();
    allReels.push(...sampleReels);
  }

  // Remove duplicates
  const uniqueReels = Array.from(
    new Map(allReels.map((r) => [r.id, r])).values()
  );

  return uniqueReels;
}

/**
 * Get Instagram Reel URL from ID
 */
export function getInstagramReelUrl(reelId: string): string {
  return `https://www.instagram.com/reel/${reelId}/`;
}
