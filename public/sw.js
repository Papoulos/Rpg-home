// Service Worker pour Rpg-home
// Cache les assets statiques pour un chargement rapide tout en garantissant la fraîcheur du code applicatif

const CACHE_NAME = 'rpg-home-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/script.min.js',
  '/script.js',
  '/style.min.css',
  '/style.css',
  '/wiki.css',
  '/character-sheet.css',
  '/navigation.js',
  '/game-systems.js',
  '/images.js',
  '/fabric-whiteboard.js',
  '/music.js',
  '/wiki.js',
  '/default-tokens/player.svg',
  '/default-tokens/item.svg',
  '/libs/fabric/fabric.min.js',
  '/libs/easymde/easymde.min.js',
  '/libs/easymde/easymde.min.css',
  '/libs/showdown/showdown.min.js',
  '/libs/webrtc/adapter.min.js',
  '/favicon.ico'
];

// Installation : mise en cache des assets critiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Mise en cache des assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Assets mis en cache avec succès');
        // Force le Service Worker à devenir actif immédiatement
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Erreur lors de la mise en cache:', error);
      })
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[SW] Service Worker activé');
      // Prend le contrôle des clients immédiatement
      return self.clients.claim();
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET, les requêtes Range (streaming vidéo WebM/MP4) ou les uploads/fonds/tokens
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin) || event.request.headers.has('range') || event.request.url.includes('/backgrounds/') || event.request.url.includes('/tokens/') || event.request.url.includes('/upload-token')) {
    return;
  }

  const requestUrl = event.request.url;
  const isImmutableLib = requestUrl.includes('/libs/') || requestUrl.includes('/music/');

  if (isImmutableLib) {
    // Stratégie Cache First uniquement pour les librairies tierces immuables
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stratégie Network First (avec repli sur le cache en cas de coupure réseau) pour le code applicatif
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 &&
            (requestUrl.includes('.js') ||
             requestUrl.includes('.css') ||
             requestUrl.includes('.html') ||
             requestUrl.endsWith('/'))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

// Gestion des messages depuis le client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Saut de l\'attente...');
    self.skipWaiting();
  }
});
