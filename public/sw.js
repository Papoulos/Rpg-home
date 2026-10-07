// Service Worker pour RPg-home
// Cache les assets statiques pour un chargement offline plus rapide

const CACHE_NAME = 'rpg-home-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/script.min.js',
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
  '/libs/fabric/fabric.js',
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
  // Ignorer les requêtes POST et les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Stratégie : Cache First pour les assets statiques
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si trouvé dans le cache, retourner la réponse
        if (response) {
          console.log('[SW] Servi depuis le cache:', event.request.url);
          return response;
        }

        // Sinon, faire la requête réseau
        console.log('[SW] Récupération depuis le réseau:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Cloner la réponse pour la mettre en cache
            const responseClone = response.clone();
            
            // Mettre en cache uniquement les requêtes réussies pour les assets statiques
            if (response.status === 200 && 
                (event.request.url.includes('.js') || 
                 event.request.url.includes('.css') || 
                 event.request.url.includes('.png') ||
                 event.request.url.includes('.jpg') ||
                 event.request.url.includes('.ico') ||
                 event.request.url.includes('/libs/') ||
                 event.request.url.endsWith('/'))) {
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                  console.log('[SW] Mise en cache de:', event.request.url);
                });
            }
            
            return response;
          })
          .catch((error) => {
            console.error('[SW] Erreur lors de la récupération:', error);
            // Retourner une réponse de fallback si disponible
            return caches.match('/index.html');
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

// Écouteur pour les erreurs de fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Si la requête échoue, essayer de retourner une page offline
      return caches.match('/index.html');
    })
  );
});