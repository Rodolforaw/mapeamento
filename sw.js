const CACHE_NAME = 'controle-obra-v2.0.0';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './supabase-config.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://unpkg.com/@supabase/supabase-js@2'
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
                console.log('Service Worker: Erro ao fazer cache:', error);
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
        }).then(function() {
            // Forçar atualização imediata
            console.log('Service Worker: Forçando atualização...');
            return self.clients.claim();
        })
    );
});

// Interceptar requisições
self.addEventListener('fetch', function(event) {
    // Ignorar requisições de chrome-extension e outras não HTTP
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    // Ignorar requisições de ícones que podem não existir
    if (event.request.url.includes('icon-') || 
        event.request.url.includes('.svg') ||
        event.request.url.includes('favicon')) {
        return;
    }
    
    // Estratégia: Cache First para recursos estáticos
    if (event.request.url.includes('unpkg.com') || 
        event.request.url.includes('.css') || 
        event.request.url.includes('.js') ||
        event.request.url.includes('.html')) {
        
        event.respondWith(
            caches.match(event.request)
                .then(function(response) {
                    // Retorna do cache se encontrado
                    if (response) {
                        return response;
                    }
                    // Senão, busca na rede
                    return fetch(event.request)
                        .then(function(response) {
                            // Verifica se a resposta é válida
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            
                            // Clona a resposta
                            const responseToCache = response.clone();
                            
                            // Adiciona ao cache
                            caches.open(CACHE_NAME)
                                .then(function(cache) {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return response;
                        })
                        .catch(function(error) {
                            console.log('Service Worker: Erro ao buscar recurso:', event.request.url, error);
                            // Se falhar, retorna página offline se for HTML
                            if (event.request.destination === 'document') {
                                return caches.match('./index.html');
                            }
                            // Para outros recursos, retorna uma resposta vazia
                            return new Response('', { status: 404, statusText: 'Not Found' });
                        });
                })
        );
    }
    // Estratégia: Network First para tiles de mapa
    else if (event.request.url.includes('tile') || 
             event.request.url.includes('openstreetmap') ||
             event.request.url.includes('arcgisonline')) {
        
        event.respondWith(
            fetch(event.request)
                .then(function(response) {
                    // Se a resposta for válida, adiciona ao cache
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME + '-tiles')
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return response;
                })
                .catch(function() {
                    // Se falhar, tenta buscar no cache
                    return caches.match(event.request);
                })
        );
    }
    // Para outras requisições, deixa passar normalmente
    else {
        event.respondWith(
            fetch(event.request)
                .catch(function() {
                    return caches.match(event.request);
                })
        );
    }
});

// Limpar cache de tiles periodicamente (para não ocupar muito espaço)
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'CLEAR_TILES_CACHE') {
        caches.delete(CACHE_NAME + '-tiles')
            .then(function() {
                console.log('Service Worker: Cache de tiles limpo');
                event.ports[0].postMessage({success: true});
            })
            .catch(function(error) {
                console.log('Service Worker: Erro ao limpar cache de tiles:', error);
                event.ports[0].postMessage({success: false, error: error});
            });
    }
});

// Notificar sobre atualizações
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
