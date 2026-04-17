/**
 * IndexNow — auto-notifies Bing, Yandex & others on every deploy.
 * Run via: node scripts/indexnow.mjs
 * Added to Vercel build command: next build && node scripts/indexnow.mjs
 *
 * NOTE: The service slug list below must stay in sync with
 * `frontend/data/services.ts`. It's duplicated here because this script runs
 * via `node` as plain .mjs — importing the .ts source would require a build
 * step. Services change rarely, so inline duplication is the lowest-friction
 * option.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gangsterbarber.com';
const KEY = '1aab24b423a34a0597a5ecd41c9d12c0';

/** Keep in sync with frontend/data/services.ts */
const SERVICE_SLUGS = [
  'taper-fade',
  'lineup-shape-up',
  'beard-sculpt',
  'full-gangster',
];

const urls = [
  SITE_URL,
  `${SITE_URL}/services`,
  `${SITE_URL}/book`,
  ...SERVICE_SLUGS.map((slug) => `${SITE_URL}/services/${slug}`),
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
