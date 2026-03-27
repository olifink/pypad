// Custom service worker that augments the Angular ngsw with Web Share Target support.
//
// IMPORTANT: the share-target fetch handler MUST be registered before importScripts()
// so that it runs before ngsw's own fetch handlers (first respondWith() wins).

const SHARE_CACHE = 'pypad-share-v1';

// Resolve the share-target path relative to the SW scope so subdirectory
// deployments (e.g. /pypad/) work correctly.
const SHARE_TARGET_PATH = new URL('share-target', self.registration.scope).pathname;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.pathname === SHARE_TARGET_PATH && req.method === 'POST') {
    event.respondWith(handleShareTarget(req));
  }
  // All other requests fall through to ngsw's fetch handler below.
});

/**
 * Reads the multipart/form-data payload from the Web Share Target POST, stores it
 * in the Cache API, then issues a 303 redirect to the app with `?share=pending`.
 */
async function handleShareTarget(request) {
  const formData = await request.formData();

  const text = String(formData.get('text') ?? '');
  const title = String(formData.get('title') ?? '');
  const url = String(formData.get('url') ?? '');

  /** @type {string | null} */
  let fileContent = null;
  /** @type {string | null} */
  let fileName = null;

  const files = formData.getAll('files');
  if (files.length > 0) {
    const file = files[0];
    fileName = file.name;
    fileContent = await file.text();
  }

  const payload = { text, title, url, fileContent, fileName, timestamp: Date.now() };

  const cache = await caches.open(SHARE_CACHE);
  await cache.put(
    '/share-target-data',
    new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } }),
  );

  // Redirect back into the app scope, not the origin root.
  const redirectUrl = new URL('?share=pending', self.registration.scope);
  return Response.redirect(redirectUrl.href, 303);
}

// Delegate everything else (navigation, assets, API calls) to ngsw.
importScripts('./ngsw-worker.js');
