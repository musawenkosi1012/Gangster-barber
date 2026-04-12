/**
 * IndexNow — auto-notifies Bing, Yandex & others on every deploy.
 * Run via: node scripts/indexnow.mjs
 * Added to Vercel build command: next build && node scripts/indexnow.mjs
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gangsterbarber.com';
const KEY = '1aab24b423a34a0597a5ecd41c9d12c0';

const urls = [
  SITE_URL,
  `${SITE_URL}/book`,
];

async function submit() {
  const body = {
    host: new URL(SITE_URL).hostname,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (res.status === 200 || res.status === 202) {
    console.log(`[IndexNow] Submitted ${urls.length} URLs — status ${res.status}`);
  } else {
    const text = await res.text();
    console.warn(`[IndexNow] Unexpected status ${res.status}: ${text}`);
  }
}

submit().catch(console.error);
