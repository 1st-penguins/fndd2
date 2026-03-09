// 배포할 때마다 이 버전을 올려야 이전 캐시가 모두 삭제됩니다
const CACHE_VERSION = '2026030902';
const CACHE_NAME = `fp-cache-v${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/images/favicon-32x32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        // 현재 캐시 버전이 아니면 모두 삭제
        if (!key.startsWith('fp-cache-v') || key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve();
      })
    )).then(() => {
      // 모든 클라이언트에 즉시 적용
      return self.clients.claim();
    })
  );
});

// 네비게이션 요청: 네트워크 우선, 실패 시 캐시 폴백
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (e) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('/index.html');
    return cached || new Response('오프라인 상태입니다.', { status: 503 });
  }
}

// 정적 자원: 네트워크 우선, 실패 시 캐시 폴백 (업데이트 즉시 반영)
async function handleStaticAsset(request) {
  try {
    // 네트워크에서 먼저 시도
    const networkResponse = await fetch(request);
    
    // 성공 시 캐시 업데이트 (백그라운드)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone()).catch(() => {
        // 캐시 실패는 무시 (네트워크 응답은 이미 반환됨)
      });
    }
    
    return networkResponse;
  } catch (e) {
    // 네트워크 실패 시 캐시에서 가져오기
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || new Response('리소스를 불러올 수 없습니다.', { status: 504 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 외부 도메인(Firebase 등)은 패스스루
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // HTML/CSS/JS/이미지 등 정적 자원 처리
  event.respondWith(handleStaticAsset(request));
});


