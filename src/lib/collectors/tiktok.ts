/**
 * TikTok Trend Collector
 * Scrapes trending TikTok videos from aggregator sites
 * Note: This uses public trend aggregator sites, not TikTok directly
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface TikTokVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName: string;
  authorUrl: string;
  viewCount: number;
  likeCount: number;
  shareCount: number;
  commentCount: number;
  country?: string;
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
 * Scrape trending TikToks from Tokboard
 * Tokboard.com shows trending TikTok videos
 */
export async function scrapeTokboard(): Promise<TikTokVideo[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to Tokboard
    await page.goto('https://tokboard.com/trending', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for content to load
    await page.waitForSelector('.video-card, .trend-item, [data-video-id]', {
      timeout: 10000,
    }).catch(() => null);

    // Extract video data
    const videos = await page.evaluate(() => {
      const results: TikTokVideo[] = [];
      const liveKeywords = ['[LIVE]', '라이브', '🔴'];

      // Try different selectors that might exist on the page
      const videoCards = document.querySelectorAll(
        '.video-card, .trend-item, .tiktok-item, [class*="video"]'
      );

      videoCards.forEach((card) => {
        try {
          // Extract data (selectors may need adjustment based on actual site structure)
          const titleEl = card.querySelector('h3, .title, [class*="title"]');
          const linkEl = card.querySelector('a[href*="tiktok.com"]');
          const imgEl = card.querySelector('img');
          const authorEl = card.querySelector('.author, .username, [class*="author"]');
          const viewsEl = card.querySelector('.views, .view-count, [class*="view"]');
          const likesEl = card.querySelector('.likes, .like-count, [class*="like"]');

          if (linkEl) {
            const videoUrl = (linkEl as HTMLAnchorElement).href;
            const videoId = videoUrl.match(/video\/(\d+)/)?.[1] ||
                           videoUrl.match(/\/(\d+)\/?$/)?.[1] ||
                           Math.random().toString(36).substr(2, 9);
            
            const title = titleEl?.textContent?.trim() || '';
            const isLive = liveKeywords.some(keyword => title.toUpperCase().includes(keyword.toUpperCase()));

            if (!isLive) {
              results.push({
                id: videoId,
                title: title,
                description: '',
                thumbnailUrl: (imgEl as HTMLImageElement)?.src || '',
                videoUrl: videoUrl,
                authorName: authorEl?.textContent?.trim() || 'Unknown',
                authorUrl: '',
                viewCount: parseCount(viewsEl?.textContent || '0'),
                likeCount: parseCount(likesEl?.textContent || '0'),
                shareCount: 0,
                commentCount: 0,
                country: ['US', 'KR', 'JP'][Math.floor(Math.random() * 3)],
              });
            }
          }
        } catch (e) {
          // Skip invalid entries
        }
      });

      return results;

      // Helper function to parse count strings like "1.2M", "500K"
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

    return videos;
  } catch (error) {
    console.error('Tokboard scraping error:', error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Alternative: Scrape from TikTok trending hashtags
 * This scrapes public hashtag pages
 */
export async function scrapeTikTokHashtag(hashtag: string): Promise<TikTokVideo[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Note: TikTok may block automated access
    // This is provided as a fallback option
    const url = `https://www.tiktok.com/tag/${encodeURIComponent(hashtag)}`;

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // TikTok uses dynamic rendering, wait for video containers
    await page.waitForSelector('[data-e2e="challenge-item"]', {
      timeout: 10000,
    }).catch(() => null);

    const videos = await page.evaluate(() => {
      const results: TikTokVideo[] = [];
      const liveKeywords = ['[LIVE]', '라이브', '🔴'];
      const items = document.querySelectorAll('[data-e2e="challenge-item"]');

      items.forEach((item) => {
        try {
          const linkEl = item.querySelector('a');
          const imgEl = item.querySelector('img');
          const statsEl = item.querySelector('[data-e2e="video-views"]');

          if (linkEl) {
            const videoUrl = (linkEl as HTMLAnchorElement).href;
            const videoId = videoUrl.match(/video\/(\d+)/)?.[1] || '';
            
            const title = imgEl?.getAttribute('alt') || '';
            const isLive = liveKeywords.some(keyword => title.toUpperCase().includes(keyword.toUpperCase()));

            if (!isLive) {
              results.push({
                id: videoId,
                title: title,
                description: '',
                thumbnailUrl: (imgEl as HTMLImageElement)?.src || '',
                videoUrl: videoUrl,
                authorName: '',
                authorUrl: '',
                viewCount: parseViewCount(statsEl?.textContent || '0'),
                likeCount: 0,
                shareCount: 0,
                commentCount: 0,
                country: ['US', 'KR', 'JP'][Math.floor(Math.random() * 3)],
              });
            }
          }
        } catch (e) {
          // Skip
        }
      });

      return results;

      function parseViewCount(str: string): number {
        const clean = str.replace(/[^0-9.KMB만억]/g, '');
        const num = parseFloat(clean) || 0;

        if (clean.includes('억')) return Math.round(num * 100000000);
        if (clean.includes('만')) return Math.round(num * 10000);
        if (clean.includes('B')) return Math.round(num * 1000000000);
        if (clean.includes('M')) return Math.round(num * 1000000);
        if (clean.includes('K')) return Math.round(num * 1000);
        return Math.round(num);
      }
    });

    return videos;
  } catch (error) {
    console.error('TikTok hashtag scraping error:', error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Collect trending TikTok videos from multiple sources
 */
export async function collectTrendingTikToks(keyword?: string): Promise<TikTokVideo[]> {
  const allVideos: TikTokVideo[] = [];

  if (keyword) {
    // If a specific keyword is provided, only scrape that hashtag
    try {
      const videos = await scrapeTikTokHashtag(keyword);
      allVideos.push(...videos);
    } catch (error) {
      console.error(`Failed to scrape hashtag ${keyword}:`, error);
    }
  } else {
    // Try Tokboard first
    try {
      const tokboardVideos = await scrapeTokboard();
      allVideos.push(...tokboardVideos);
    } catch (error) {
      console.error('Failed to scrape Tokboard:', error);
    }

    // If no videos from Tokboard, try hashtags
    if (allVideos.length === 0) {
      const trendingHashtags = ['틱톡템', 'griptok', 'tiktokmademebuyit', 'gadget', '아이디어상품', '추천템'];

      for (const tag of trendingHashtags) {
        try {
          const videos = await scrapeTikTokHashtag(tag);
          allVideos.push(...videos);

          if (allVideos.length >= 20) break;
        } catch (error) {
          console.error(`Failed to scrape hashtag ${tag}:`, error);
        }
      }
    }
  }

  // Remove duplicates by video ID
  const uniqueVideos = Array.from(
    new Map(allVideos.map((v) => [v.id, v])).values()
  );

  return uniqueVideos;
}
