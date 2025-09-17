// Service Worker para PWA - Controle de Obra
const CACHE_NAME = 'controle-obra-v2';
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './config.js',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://unpkg.com/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instalar Service Worker
self.addEventListener('install', function(event) {
  console.log('Service Worker: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('Service Worker: Erro ao cachear recursos:', error);
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Ativando...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', function(event) {
  // Ignorar requisições do Supabase (sempre online)
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - retornar resposta do cache
        if (response) {
          return response;
        }
        
        // Cache miss - buscar da rede
        return fetch(event.request).then(function(response) {
          // Verificar se a resposta é válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clonar a resposta
          var responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(function() {
          // Se falhar, retornar página offline
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Sincronização em background
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Sincronização em background');
    event.waitUntil(doBackgroundSync());
  }
});

// Função de sincronização em background
function doBackgroundSync() {
  return new Promise(function(resolve) {
    // Notificar a página principal para sincronizar
    self.clients.matchAll().then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({
          type: 'SYNC_REQUEST',
          data: 'background-sync'
        });
      });
    });
    resolve();
  });
}

// Notificar sobre atualizações
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
