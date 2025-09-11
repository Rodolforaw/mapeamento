// Configurações do mapa
const MARICA_COORDS = [-22.9194, -42.8186]; // Coordenadas de Maricá, RJ
const DEFAULT_ZOOM = 13;

// Variáveis globais
let map;
let drawnItems;
let drawControl;
let satelliteLayer;
let streetLayer;
let labelsLayer;
let isSatelliteMode = true;
let isOnline = navigator.onLine;
let offlineQueue = [];
let syncInProgress = false;
let lastSyncTime = 0;
let syncCooldown = 10000; // 10 segundos de cooldown entre sincronizações

// Variáveis para o modal de marcação
let currentLayer = null;
let markingModal = null;

// Variáveis para geolocalização
let userLocationMarker = null;
let watchId = null;
let isTrackingLocation = false;

// Variáveis para rastreamento de dispositivos
let deviceLocations = {}; // Estrutura: { deviceId: { lat, lng, timestamp, deviceName } }
let deviceMarkers = {}; // Marcadores dos dispositivos no mapa
let isTrackingDevices = false;

// Variáveis para modo offline
let isOfflineMode = false;

// Variáveis para gerenciamento de obras
let worksData = {}; // Estrutura: { osNumber: { product, markings: [], lastUpdate } }

// Aguardar inicialização do Supabase
async function waitForSupabase(maxAttempts = 10, delay = 500) {
    for (let i = 0; i < maxAttempts; i++) {
        if (window.supabaseConfig && window.supabaseConfig.supabaseClient) {
            return true;
        }
        console.log(`⏳ Aguardando Supabase... tentativa ${i + 1}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false;
}

// Tratamento global de erros para capturar erros 403 e outros
window.addEventListener('unhandledrejection', function(event) {
    console.warn('⚠️ Erro não tratado detectado:', event.reason);
    
    // Verificar se é erro 403 do Supabase
    if (event.reason && event.reason.code === 403) {
        console.warn('🔒 Erro 403: Possível problema de permissões no Supabase');
        console.warn('💡 Verifique as políticas RLS (Row Level Security) no Supabase');
        
        // Mostrar notificação para o usuário
        if (typeof showNotification === 'function') {
            showNotification('⚠️ Erro de permissão detectado. Verifique a configuração do Supabase.', 'warning');
        }
        
        // Prevenir que o erro apareça no console como "Uncaught"
        event.preventDefault();
    } else if (event.reason && event.reason.httpStatus === 200 && event.reason.code === 403) {
        // Erro específico do Supabase com status 200 mas código 403
        console.warn('🔒 Erro de autorização Supabase detectado');
        event.preventDefault();
    }
});

// Tratamento de erros gerais
window.addEventListener('error', function(event) {
    console.warn('⚠️ Erro JavaScript detectado:', event.error);
});

// Função para diagnosticar problemas de conectividade
async function diagnoseSupabaseConnection() {
    console.log('🔍 Iniciando diagnóstico de conectividade com Supabase...');
    
    try {
        if (!window.supabaseConfig || !window.supabaseConfig.supabaseClient) {
            console.error('❌ Supabase não inicializado');
            return false;
        }
        
        // Testar conexão básica
        const { data, error } = await window.supabaseConfig.supabaseClient
            .from('markings')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Erro na conexão com Supabase:', error);
            
            if (error.code === 403) {
                console.error('🔒 Erro 403: Problema de permissões');
                console.error('💡 Verifique as políticas RLS (Row Level Security) no Supabase');
                console.error('💡 Certifique-se de que a tabela "markings" permite operações anônimas');
            } else if (error.code === 404) {
                console.error('🔍 Erro 404: Tabela não encontrada');
                console.error('💡 Verifique se a tabela "markings" existe no Supabase');
            } else if (error.code === 500) {
                console.error('🔧 Erro 500: Problema interno do servidor');
                console.error('💡 Verifique os logs do Supabase');
            }
            
            return false;
        }
        
        console.log('✅ Conexão com Supabase funcionando');
        console.log(`📊 Total de marcações no banco: ${data?.length || 0}`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        return false;
    }
}

// Controlar sincronização para evitar loops
function canSync() {
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime;
    
    if (syncInProgress) {
        console.log('⏸️ Sincronização já em andamento, pulando...');
        return false;
    }
    
    if (timeSinceLastSync < syncCooldown) {
        console.log(`⏸️ Cooldown ativo, aguardando ${Math.ceil((syncCooldown - timeSinceLastSync) / 1000)}s...`);
        return false;
    }
    
    return true;
}

// Marcar início da sincronização
function startSync() {
    syncInProgress = true;
    lastSyncTime = Date.now();
}

// Marcar fim da sincronização
function endSync() {
    syncInProgress = false;
}

// Função para obter ID único do dispositivo
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Função para obter nome do dispositivo
function getDeviceName() {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true || 
                  document.referrer.includes('android-app://');
    
    const deviceType = isPWA ? 'PWA' : 'Desktop';
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Mobile')) {
        return `${deviceType} Mobile`;
    } else if (userAgent.includes('Tablet')) {
        return `${deviceType} Tablet`;
    } else {
        return `${deviceType} PC`;
    }
}

// Função para enviar localização atual para o Supabase
async function sendLocationToSupabase(lat, lng) {
    if (!window.supabaseConfig || !window.supabaseConfig.supabaseClient) return;
    
    try {
        const deviceId = getDeviceId();
        const deviceName = getDeviceName();
        
        const locationData = {
            device_id: deviceId,
            device_name: deviceName,
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
            is_pwa: window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone === true || 
                    document.referrer.includes('android-app://')
        };
        
        const { error } = await window.supabaseConfig.supabaseClient
            .from('device_locations')
            .upsert(locationData, { 
                onConflict: 'device_id',
                ignoreDuplicates: false 
            });
        
        if (error) {
            console.error('❌ Erro ao enviar localização:', error);
        } else {
            console.log('📍 Localização enviada para o Supabase');
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar localização:', error);
    }
}

// Função para carregar localizações dos dispositivos do Supabase
async function loadDeviceLocations() {
    if (!window.supabaseConfig || !window.supabaseConfig.supabaseClient) return;
    
    try {
        const { data, error } = await window.supabaseConfig.supabaseClient
            .from('device_locations')
            .select('*')
            .gte('timestamp', Date.now() - 300000) // Últimos 5 minutos
            .order('timestamp', { ascending: false });
        
        if (error) {
            console.error('❌ Erro ao carregar localizações:', error);
            return;
        }
        
        // Atualizar localizações dos dispositivos
        deviceLocations = {};
        data.forEach(location => {
            deviceLocations[location.device_id] = {
                lat: location.latitude,
                lng: location.longitude,
                timestamp: location.timestamp,
                deviceName: location.device_name,
                isPWA: location.is_pwa
            };
        });
        
        // Atualizar marcadores no mapa
        updateDeviceMarkers();
        
        console.log(`📍 Carregadas ${Object.keys(deviceLocations).length} localizações de dispositivos`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar localizações dos dispositivos:', error);
    }
}

// Função para atualizar marcadores dos dispositivos no mapa
function updateDeviceMarkers() {
    // Remover marcadores antigos
    Object.values(deviceMarkers).forEach(marker => {
        map.removeLayer(marker);
    });
    deviceMarkers = {};
    
    // Adicionar novos marcadores
    Object.entries(deviceLocations).forEach(([deviceId, location]) => {
        const isCurrentDevice = deviceId === getDeviceId();
        
        // Não mostrar marcador do próprio dispositivo
        if (isCurrentDevice) return;
        
        const marker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
                className: 'device-location-marker',
                html: `<div class="device-marker ${location.isPWA ? 'pwa' : 'desktop'}">
                    <div class="device-icon">${location.isPWA ? '📱' : '💻'}</div>
                    <div class="device-pulse"></div>
                </div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="device-popup">
                <h4>${location.deviceName}</h4>
                <p><strong>Última atualização:</strong> ${new Date(location.timestamp).toLocaleString()}</p>
                <p><strong>Tipo:</strong> ${location.isPWA ? 'PWA' : 'Desktop'}</p>
                <button onclick="centerOnDevice('${deviceId}')" class="center-device-btn">Centralizar</button>
            </div>
        `);
        
        marker.addTo(map);
        deviceMarkers[deviceId] = marker;
    });
}

// Função para centralizar no dispositivo
function centerOnDevice(deviceId) {
    const location = deviceLocations[deviceId];
    if (location) {
        map.setView([location.lat, location.lng], 16);
    }
}

// Sincronizar dados entre contextos diferentes (PWA vs Desktop)
async function syncCrossContextData() {
    try {
        // Verificar se pode sincronizar
        if (!canSync()) {
            return false;
        }
        
        startSync();
        console.log('🔄 Iniciando sincronização entre contextos...');
        
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone === true || 
                      document.referrer.includes('android-app://');
        
        console.log(`📱 Contexto atual: ${isPWA ? 'PWA' : 'Desktop'}`);
        
        // Aguardar Supabase estar inicializado
        const supabaseReady = await waitForSupabase();
        if (!supabaseReady) {
            console.log('⚠️ Supabase não inicializado após aguardar, pulando sincronização');
            endSync();
            return false;
        }
        
        // Verificar se Supabase está inicializado antes de sincronizar
        if (window.supabaseConfig && window.supabaseConfig.loadMarkings) {
            console.log('📡 Sincronizando com Supabase...');
            
            try {
                // Carregar dados do Supabase
                const result = await window.supabaseConfig.loadMarkings();
                
                if (result.success) {
                    console.log(`✅ Carregados ${result.markings.length} marcações do Supabase`);
                    
                    // Carregar dados locais
                    const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
                    const localWorks = JSON.parse(localStorage.getItem('worksData') || '{}');
                    
                    // Fazer merge inteligente dos dados
                    const mergedMarkings = mergeMarkings(localMarkings, result.markings);
                    
                    // Salvar dados mesclados no localStorage
                    localStorage.setItem('controle_obra_markings', JSON.stringify(mergedMarkings));
                    
                    // Atualizar dados de obras
                    updateWorksData();
                    
                    // Recarregar marcações no mapa
                    drawnItems.clearLayers();
                    syncNewMarkings();
                    
                    // Salvar dados atualizados de volta no Supabase
                    await window.supabaseConfig.saveMarkings(mergedMarkings);
                    
                    showNotification(`🔄 Sincronizados ${mergedMarkings.length} marcações`, 'success');
                    
                    // Configurar sincronização em tempo real
                    setupRealTimeSync();
                    
                    endSync();
                    return true;
                } else {
                    console.log('ℹ️ Nenhuma marcação encontrada no Supabase');
                    // Salvar dados locais no Supabase se houver
                    const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
                    if (localMarkings.length > 0) {
                        await window.supabaseConfig.saveMarkings(localMarkings);
                        showNotification('📤 Dados locais enviados para o Supabase', 'info');
                    }
                    endSync();
                }
            } catch (error) {
                console.error('❌ Erro ao sincronizar com Supabase:', error);
                showNotification('⚠️ Erro na sincronização com Supabase', 'warning');
                endSync();
            }
        } else {
            console.log('⚠️ Supabase não disponível');
            showNotification('⚠️ Supabase não configurado', 'warning');
            endSync();
        }
        
    } catch (error) {
        console.error('❌ Erro na sincronização entre contextos:', error);
        showNotification('❌ Erro na sincronização', 'error');
        endSync();
    }
}

// Tentar sincronização via servidor local
function tryLocalServerSync() {
    try {
        console.log('🌐 Tentando sincronização via servidor local...');
        
        // Tentar diferentes URLs do servidor local
        const serverUrls = [
            'http://localhost:3000/api/markings',
            'http://127.0.0.1:3000/api/markings',
            window.location.origin + '/api/markings'
        ];
        
        let syncAttempted = false;
        
        serverUrls.forEach(url => {
            if (!syncAttempted) {
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success && data.markings && data.markings.length > 0) {
                            console.log(`✅ Carregados ${data.markings.length} marcações do servidor local`);
                            
                            // Mesclar com dados locais
                            const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
                            const mergedMarkings = mergeMarkings(localMarkings, data.markings);
                            
                            // Salvar dados mesclados
                            localStorage.setItem('controle_obra_markings', JSON.stringify(mergedMarkings));
                            
                            // Recarregar marcações no mapa
                            drawnItems.clearLayers();
                            syncNewMarkings();
                            
                            showNotification(`🌐 Sincronizados ${mergedMarkings.length} marcações do servidor`, 'success');
                            syncAttempted = true;
                        }
                    })
                    .catch(error => {
                        console.log(`❌ Erro ao conectar com ${url}:`, error.message);
                    });
            }
        });
        
        // Se nenhuma sincronização funcionou após 3 segundos
        setTimeout(() => {
            if (!syncAttempted) {
                console.log('ℹ️ Nenhum servidor disponível para sincronização');
                showNotification('⚠️ Sincronização offline - dados locais mantidos', 'warning');
            }
        }, 3000);
        
    } catch (error) {
        console.error('❌ Erro na sincronização via servidor local:', error);
    }
}

// Mesclar marcações evitando duplicatas com merge inteligente
function mergeMarkings(localMarkings, remoteMarkings) {
    const merged = [...localMarkings];
    
    remoteMarkings.forEach(remoteMarking => {
        // Procurar por correspondência por ID primeiro
        let existingIndex = merged.findIndex(local => local.id === remoteMarking.id);
        
        // Se não encontrar por ID, procurar por coordenadas e tipo
        if (existingIndex === -1) {
            existingIndex = merged.findIndex(local => 
                local.timestamp === remoteMarking.timestamp ||
                (Math.abs(local.lat - remoteMarking.lat) < 0.0001 && 
                 Math.abs(local.lng - remoteMarking.lng) < 0.0001 && 
                 local.type === remoteMarking.type)
            );
        }
        
        if (existingIndex >= 0) {
            // Manter a versão mais recente baseada em lastModified ou timestamp
            const localTime = merged[existingIndex].lastModified || merged[existingIndex].timestamp || 0;
            const remoteTime = remoteMarking.lastModified || remoteMarking.timestamp || 0;
            
            if (remoteTime > localTime) {
                console.log(`🔄 Atualizando marcação ${remoteMarking.id} do servidor`);
                merged[existingIndex] = remoteMarking;
            }
        } else {
            console.log(`➕ Adicionando nova marcação ${remoteMarking.id} do servidor`);
            merged.push(remoteMarking);
        }
    });
    
    // Ordenar por timestamp
    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    return merged;
}
let worksModal = null;

// Inicialização do aplicativo
document.addEventListener('DOMContentLoaded', function() {
    // Debug: Verificar contexto de execução
    console.log('🔍 Debug - Contexto de execução:');
    console.log('- URL atual:', window.location.href);
    console.log('- Origem:', window.location.origin);
    console.log('- Protocolo:', window.location.protocol);
    console.log('- Host:', window.location.host);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true || 
                  document.referrer.includes('android-app://');
    console.log('- PWA mode:', isPWA);
    console.log('- Service Worker ativo:', 'serviceWorker' in navigator);
    
    // Adicionar indicador visual do contexto
    if (isPWA) {
        document.body.classList.add('pwa-mode');
        console.log('🔥 Executando em modo PWA');
    } else {
        document.body.classList.add('desktop-mode');
        console.log('💻 Executando em modo Desktop');
    }
    
    // Verificar localStorage
    const markings = localStorage.getItem('controle_obra_markings');
    console.log('- Marcações no localStorage:', markings ? JSON.parse(markings).length : 0);
    
    // Verificar todas as chaves do localStorage relacionadas ao app
    const allKeys = Object.keys(localStorage).filter(key => key.includes('controle_obra'));
    console.log('- Chaves do localStorage:', allKeys);
    
    // Migrar marcações antigas primeiro
    migrateOldMarkings();
    
    // Aguardar inicialização do Supabase antes de sincronizar
    setTimeout(async () => {
        try {
            // Executar diagnóstico primeiro
            const isConnected = await diagnoseSupabaseConnection();
            
            if (isConnected) {
                await syncCrossContextData();
                console.log('✅ Sincronização inicial concluída');
            } else {
                console.warn('⚠️ Problemas de conectividade detectados, continuando em modo offline');
            }
        } catch (error) {
            console.error('❌ Erro na sincronização inicial:', error);
        }
    }, 3000); // Aguardar 3 segundos para o Supabase inicializar
    
    initializeMap();
    setupEventListeners();
    setupOfflineSupport();
    setupMobileMenu();
    loadOfflineData();
    
    // Inicializar Supabase
    if (window.supabaseConfig && window.supabaseConfig.init) {
        const supabaseInitialized = window.supabaseConfig.init();
        if (supabaseInitialized) {
            console.log('✅ Supabase configurado com sucesso!');
            // Configurar sincronização automática com Supabase
            setTimeout(() => {
                if (window.supabaseConfig.setupSync) {
                    window.supabaseConfig.setupSync();
                }
            }, 1000);
        } else {
            console.log('⚠️ Falha ao inicializar Supabase');
        }
    } else {
        console.log('⚠️ Supabase não disponível, usando modo local');
    }
    
    hideLoading();
    
    // Configurar botões baseado no modo (PWA vs Desktop)
    setupModeButtons();
});

// Inicializar o mapa
function initializeMap() {
    // Criar o mapa centrado em Maricá
    map = L.map('map', {
        center: MARICA_COORDS,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true
    });

    // Camada de rua (OSM)
    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    // Camada de satélite (Esri World Imagery)
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
    });

    // Camada de rótulos (nomes de ruas e limites)
    labelsLayer = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri'
        })
    ]);

    // Iniciar no modo satélite com rótulos
    satelliteLayer.addTo(map);
    labelsLayer.addTo(map);

    // Atualizar botão para indicar que o próximo clique vai para "Rua"
    const satBtnInit = document.getElementById('satellite-toggle');
    if (satBtnInit) {
        satBtnInit.classList.add('active');
        satBtnInit.innerHTML = '<span class="icon">🗺️</span>Rua';
    }

    // Inicializar grupo de desenhos
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Configurar controles de desenho
    drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>Erro:</strong> As bordas não podem se cruzar!'
                },
                shapeOptions: {
                    color: '#2196F3',
                    weight: 3,
                    fillOpacity: 0.3
                }
            },
            polyline: {
                shapeOptions: {
                    color: '#2196F3',
                    weight: 3
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#2196F3',
                    weight: 3,
                    fillOpacity: 0.3
                }
            },
            circle: {
                shapeOptions: {
                    color: '#2196F3',
                    weight: 3,
                    fillOpacity: 0.3
                }
            },
            marker: {
                icon: new L.Icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            },
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    
    map.addControl(drawControl);

    // Event listeners para desenhos
    map.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        
        // Armazenar a camada atual e mostrar modal
        currentLayer = layer;
        showMarkingModal(e.layerType);
    });

    map.on(L.Draw.Event.EDITED, function(e) {
        // Salvar edições
        e.layers.eachLayer(function(layer) {
            updateMarking(layer);
        });
        const status = isOnline ? 'online' : 'offline';
        showNotification(`Marcações editadas (${status})!`, 'success');
    });

    map.on(L.Draw.Event.DELETED, function(e) {
        // Remover marcações
        e.layers.eachLayer(function(layer) {
            deleteMarking(layer);
        });
        const status = isOnline ? 'online' : 'offline';
        showNotification(`Marcações removidas (${status})!`, 'success');
    });
 }

// Excluir marcações de um arquivo específico
function deleteImportedFile(fileName) {
    if (!confirm(`Tem certeza que deseja excluir todas as marcações do arquivo "${fileName}"?`)) {
        return;
    }
    
    try {
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        
        // Filtrar marcações, removendo as do arquivo especificado
        const filteredMarkings = markings.filter(marking => {
            return !(marking.properties && 
                    marking.properties.source === 'upload' && 
                    marking.properties.fileName === fileName);
        });
        
        // Salvar marcações filtradas
        localStorage.setItem('controle_obra_markings', JSON.stringify(filteredMarkings));
        
        // Remover camadas do mapa
        drawnItems.eachLayer(layer => {
            if (layer._markingId) {
                const marking = markings.find(m => m.id === layer._markingId);
                if (marking && marking.properties && 
                    marking.properties.source === 'upload' && 
                    marking.properties.fileName === fileName) {
                    drawnItems.removeLayer(layer);
                }
            }
        });
        
        // Sincronizar com Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.sync) {
            window.supabaseConfig.sync();
        }
        
        // Atualizar tabela
        refreshImportedTable();
        
        showNotification(`Arquivo "${fileName}" excluído com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao excluir arquivo importado:', error);
        showNotification('Erro ao excluir arquivo importado', 'error');
    }
}

// Limpar todas as marcações importadas
function clearAllImportedMarkings() {
    if (!confirm('Tem certeza que deseja excluir TODAS as marcações importadas? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        
        // Filtrar marcações, removendo todas as importadas
        const filteredMarkings = markings.filter(marking => {
            return !(marking.properties && marking.properties.source === 'upload');
        });
        
        // Salvar marcações filtradas
        localStorage.setItem('controle_obra_markings', JSON.stringify(filteredMarkings));
        
        // Remover camadas do mapa
        drawnItems.eachLayer(layer => {
            if (layer._markingId) {
                const marking = markings.find(m => m.id === layer._markingId);
                if (marking && marking.properties && marking.properties.source === 'upload') {
                    drawnItems.removeLayer(layer);
                }
            }
        });
        
        // Sincronizar com Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.sync) {
            window.supabaseConfig.sync();
        }
        
        // Atualizar tabela
        refreshImportedTable();
        
        showNotification('Todas as marcações importadas foram excluídas!', 'success');
        
    } catch (error) {
        console.error('Erro ao limpar marcações importadas:', error);
        showNotification('Erro ao limpar marcações importadas', 'error');
    }
}

// Criar conteúdo do popup
function createPopupContent(layer, type) {
    const timestamp = new Date().toLocaleString('pt-BR');
    let content = `<div class="popup-content">`;
    content += `<h4>Marcação ${type}</h4>`;
    content += `<p><strong>Criado em:</strong> ${timestamp}</p>`;
    
    if (type === 'marker') {
        const latlng = layer.getLatLng();
        content += `<p><strong>Coordenadas:</strong><br>Lat: ${latlng.lat.toFixed(6)}<br>Lng: ${latlng.lng.toFixed(6)}</p>`;
    } else if (type === 'circle') {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        content += `<p><strong>Centro:</strong><br>Lat: ${center.lat.toFixed(6)}<br>Lng: ${center.lng.toFixed(6)}</p>`;
        content += `<p><strong>Raio:</strong> ${radius.toFixed(2)}m</p>`;
    }
    
    content += `</div>`;
    return content;
}

// Configurar event listeners
function setupEventListeners() {
    // Toggle satélite
    document.getElementById('satellite-toggle').addEventListener('click', toggleSatellite);
    
    // Exportar KMZ
    document.getElementById('export-kmz').addEventListener('click', exportToKMZ);
    
    // Exportar Excel
    document.getElementById('export-excel').addEventListener('click', exportToExcel);
    
    // Importar KMZ
    document.getElementById('import-kmz').addEventListener('change', function(event) {
        const files = event.target.files;
        if (files.length > 0) {
            processKMZFiles(files);
        }
        // Limpar input
        event.target.value = '';
    });
    
    // Sincronização manual
    document.getElementById('sync-offline').addEventListener('click', function() {
        // Primeiro tentar sincronização entre contextos
        syncCrossContextData();
        
        if (window.supabaseConfig) {
            // Usar Supabase se disponível
            setTimeout(() => {
                window.supabaseConfig.sync();
            }, 1000);
        } else if (offlineQueue.length > 0) {
            // Fallback para sincronização offline
            syncOfflineData();
        } else {
            showNotification('Tentando sincronizar dados entre contextos...', 'info');
        }
    });
    
    // Limpar dados
    document.getElementById('clear-data').addEventListener('click', clearAllData);
    
    // Upload KMZ

    
    // Modal event listeners
    setupModalEventListeners();
    
    // Geolocalização event listeners
    setupGeolocationEventListeners();
    
    // Gerenciamento de obras event listeners
    setupWorksManagementEventListeners();
    
    // Carregar dados de obras do localStorage
    loadWorksData();
}

// Toggle entre modo satélite e rua
function toggleSatellite() {
    const btn = document.getElementById('satellite-toggle');
    
    if (isSatelliteMode) {
        map.removeLayer(satelliteLayer);
        map.addLayer(streetLayer);
        btn.classList.remove('active');
        btn.innerHTML = '<span class="icon">🛰️</span>Satélite';
        isSatelliteMode = false;
    } else {
        if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
        if (!map.hasLayer(satelliteLayer)) map.addLayer(satelliteLayer);
        if (labelsLayer && !map.hasLayer(labelsLayer)) map.addLayer(labelsLayer);
        btn.classList.add('active');
        btn.innerHTML = '<span class="icon">🗺️</span>Rua';
        isSatelliteMode = true;
    }
}

// Exportar para KMZ
function exportToKMZ() {
    if (drawnItems.getLayers().length === 0) {
        showNotification('Nenhuma marcação para exportar!', 'warning');
        return;
    }

    try {
        const kmlContent = generateKML();
        const zip = new JSZip();
        zip.file('doc.kml', kmlContent);
        
        zip.generateAsync({type: 'blob'}).then(function(content) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            saveAs(content, `controle-obra-marica-${timestamp}.kmz`);
            showNotification('Arquivo KMZ exportado com sucesso!', 'success');
        });
    } catch (error) {
        console.error('Erro ao exportar KMZ:', error);
        showNotification('Erro ao exportar arquivo KMZ!', 'error');
    }
}

// Utilitário: escapar valores para XML
function xmlEscape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Utilitário: montar ExtendedData com todos os campos da obra
function buildExtendedDataXML(data) {
    const fields = {
        osNumber: data.osNumber,
        product: data.product,
        measurement: data.measurement,
        measurementUnit: data.measurementUnit,
        description: data.description,
        date: data.date,
        type: data.type,
        radius: data.radius
    };
    let xml = `<ExtendedData>\n`;
    Object.keys(fields).forEach(key => {
        const val = fields[key];
        if (val !== undefined && val !== null && val !== '') {
            xml += `<Data name="${xmlEscape(key)}"><value>${xmlEscape(val)}</value></Data>\n`;
        }
    });
    xml += `</ExtendedData>\n`;
    return xml;
}

// Obter dados da marcação a partir do layer (localStorage ou popup)
function getLayerMarkingData(layer) {
    try {
        const list = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        if (layer._markingId) {
            const found = list.find(x => x.id === layer._markingId);
            if (found) {
                const d = { ...found };
                if (!d.type) {
                    try { d.type = getLayerTypeName(getLayerType(layer)); } catch (_) {}
                }
                return d;
            }
        }
    } catch (e) { /* ignore */ }
    
    // Fallback: extrair do popup
    if (layer.getPopup && layer.getPopup()) {
        try {
            const html = layer.getPopup().getContent();
            const container = document.createElement('div');
            container.innerHTML = html;
            const nodes = container.querySelectorAll('.popup-field');
            const data = {};
            nodes.forEach(el => {
                const t = el.textContent.trim();
                if (t.startsWith('O.S.:')) data.osNumber = t.replace('O.S.:', '').trim();
                else if (t.startsWith('Produto:')) data.product = t.replace('Produto:', '').trim();
                else if (t.startsWith('Medição:')) {
                    const rest = t.replace('Medição:', '').trim();
                    const parts = rest.split(' ');
                    data.measurement = parts.shift();
                    data.measurementUnit = parts.join(' ').trim();
                } else if (t.startsWith('Descrição:')) data.description = t.replace('Descrição:', '').trim();
                else if (t.startsWith('Data:')) data.date = t.replace('Data:', '').trim();
                else if (t.startsWith('Tipo:')) data.type = t.replace('Tipo:', '').trim();
            });
            if (layer instanceof L.Circle) data.radius = layer.getRadius();
            if (Object.keys(data).length > 0) return data;
        } catch (e) { /* ignore */ }
    }
    if (layer instanceof L.Circle) return { radius: layer.getRadius() };
    return null;
}

// Gerar conteúdo KML com ExtendedData para My Maps
function generateKML() {
    let kml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n`;
    kml += `<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n`;
    kml += `<Document>\n`;
    kml += `<name>Controle de Obra - Maricá</name>\n`;
    kml += `<description>Marcações exportadas do aplicativo de controle de obra</description>\n`;
    
    // Estilos melhorados
    kml += `<Style id=\"blueMarker\">\n`;
    kml += `<IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/blue-dot.png</href></Icon></IconStyle>\n`;
    kml += `</Style>\n`;
    kml += `<Style id=\"orangeMarker\">\n`;
    kml += `<IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/orange-dot.png</href></Icon></IconStyle>\n`;
    kml += `</Style>\n`;
    kml += `<Style id=\"bluePolygon\">\n`;
    kml += `<LineStyle><color>ff0000ff</color><width>3</width></LineStyle>\n`;
    kml += `<PolyStyle><color>4d0000ff</color></PolyStyle>\n`;
    kml += `</Style>\n`;
    kml += `<Style id=\"orangePolygon\">\n`;
    kml += `<LineStyle><color>ff0080ff</color><width>3</width></LineStyle>\n`;
    kml += `<PolyStyle><color>4d0080ff</color></PolyStyle>\n`;
    kml += `</Style>\n`;
    
    let placemarkIndex = 1;
    
    drawnItems.eachLayer(function(layer) {
        const md = getLayerMarkingData(layer) || {};
        if (layer instanceof L.Circle && md && !md.radius) {
            md.radius = layer.getRadius();
        }
        
        // Determinar se é marcação importada ou manual
        const isUploaded = md.source === 'upload' || (layer._markingId && 
            JSON.parse(localStorage.getItem('controle_obra_markings') || '[]')
                .find(m => m.id === layer._markingId)?.properties?.source === 'upload');
        
        const placemarkName = md.osNumber ? `O.S.: ${md.osNumber} - ${md.product || 'Marcação'}` : 
                             md.name || `Marcação ${placemarkIndex}`;
        const popupContent = (layer.getPopup && layer.getPopup()) ? layer.getPopup().getContent() : '';
        
        kml += `<Placemark>\n`;
        kml += `<name>${xmlEscape(placemarkName)}</name>\n`;
        if (popupContent) {
            kml += `<description><![CDATA[${popupContent}]]></description>\n`;
        } else {
            kml += `<description><![CDATA[Criado em: ${new Date().toLocaleString('pt-BR')}]]></description>\n`;
        }
        if (md && Object.keys(md).length) {
            kml += buildExtendedDataXML(md);
        }
        
        // Adicionar informações de origem
        if (isUploaded) {
            kml += `<ExtendedData>\n`;
            kml += `<Data name=\"source\"><value>upload</value></Data>\n`;
            if (md.fileName) {
                kml += `<Data name=\"fileName\"><value>${xmlEscape(md.fileName)}</value></Data>\n`;
            }
            kml += `</ExtendedData>\n`;
        }
        
        if (layer instanceof L.Marker) {
            kml += `<styleUrl>#${isUploaded ? 'orange' : 'blue'}Marker</styleUrl>\n`;
            const latlng = layer.getLatLng();
            kml += `<Point><coordinates>${latlng.lng},${latlng.lat},0</coordinates></Point>\n`;
        } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            kml += `<styleUrl>#${isUploaded ? 'orange' : 'blue'}Polygon</styleUrl>\n`;
            const latlngs = layer.getLatLngs()[0];
            kml += `<Polygon><outerBoundaryIs><LinearRing><coordinates>`;
            latlngs.forEach(latlng => {
                kml += `${latlng.lng},${latlng.lat},0 `;
            });
            // Fechar o polígono
            kml += `${latlngs[0].lng},${latlngs[0].lat},0`;
            kml += `</coordinates></LinearRing></outerBoundaryIs></Polygon>\n`;
        } else if (layer instanceof L.Polyline) {
            kml += `<styleUrl>#${isUploaded ? 'orange' : 'blue'}Polygon</styleUrl>\n`;
            const latlngs = layer.getLatLngs();
            kml += `<LineString><coordinates>`;
            latlngs.forEach(latlng => {
                kml += `${latlng.lng},${latlng.lat},0 `;
            });
            kml += `</coordinates></LineString>\n`;
        } else if (layer instanceof L.Circle) {
            kml += `<styleUrl>#${isUploaded ? 'orange' : 'blue'}Marker</styleUrl>\n`;
            const center = layer.getLatLng();
            kml += `<Point><coordinates>${center.lng},${center.lat},0</coordinates></Point>\n`;
            // Adicionar raio como ExtendedData
            if (md.radius) {
                kml += `<ExtendedData>\n`;
                kml += `<Data name=\"radius\"><value>${md.radius}</value></Data>\n`;
                kml += `</ExtendedData>\n`;
            }
        }
        
        kml += `</Placemark>\n`;
        placemarkIndex++;
    });
    
    kml += `</Document>\n`;
    kml += `</kml>`;
    
    return kml;
}

// Exportar para Excel
function exportToExcel() {
    if (drawnItems.getLayers().length === 0) {
        showNotification('Nenhuma marcação para exportar!', 'warning');
        return;
    }

    try {
        const data = [];
        let index = 1;
        
        drawnItems.eachLayer(function(layer) {
            const row = {
                'ID': index,
                'Tipo': getLayerTypeFriendlyName(layer),
                'Data/Hora': new Date().toLocaleString('pt-BR'),
                'Latitude': '',
                'Longitude': '',
                'Informações Extras': ''
            };
            
            if (layer instanceof L.Marker) {
                const latlng = layer.getLatLng();
                row['Latitude'] = latlng.lat.toFixed(6);
                row['Longitude'] = latlng.lng.toFixed(6);
            } else if (layer instanceof L.Circle) {
                const center = layer.getLatLng();
                const radius = layer.getRadius();
                row['Latitude'] = center.lat.toFixed(6);
                row['Longitude'] = center.lng.toFixed(6);
                row['Informações Extras'] = `Raio: ${radius.toFixed(2)}m`;
            } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                row['Latitude'] = center.lat.toFixed(6);
                row['Longitude'] = center.lng.toFixed(6);
                row['Informações Extras'] = 'Área delimitada';
            } else if (layer instanceof L.Polyline) {
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                row['Latitude'] = center.lat.toFixed(6);
                row['Longitude'] = center.lng.toFixed(6);
                row['Informações Extras'] = 'Linha traçada';
            }
            
            data.push(row);
            index++;
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Marcações');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        XLSX.writeFile(wb, `controle-obra-marica-${timestamp}.xlsx`);
        
        showNotification('Arquivo Excel exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        showNotification('Erro ao exportar arquivo Excel!', 'error');
    }
}

// Obter tipo da camada
function getLayerType(layer) {
    if (layer instanceof L.Marker) return 'marker';
    if (layer instanceof L.Rectangle) return 'rectangle';
    if (layer instanceof L.Circle) return 'circle';
    if (layer instanceof L.Polygon) return 'polygon';
    if (layer instanceof L.Polyline) return 'polyline';
    return 'unknown';
}

// Função para obter nome amigável do tipo
function getLayerTypeFriendlyName(layer) {
    if (layer instanceof L.Marker) return 'Marcador';
    if (layer instanceof L.Circle) return 'Círculo';
    if (layer instanceof L.Rectangle) return 'Retângulo';
    if (layer instanceof L.Polygon) return 'Polígono';
    if (layer instanceof L.Polyline) return 'Linha';
    return 'Desconhecido';
}

// Importar arquivos KMZ (múltiplos)


// Processar arquivo KMZ individual
function processKMZFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            JSZip.loadAsync(e.target.result).then(function(zip) {
                const kmlFile = zip.file('doc.kml') || Object.values(zip.files).find(f => f.name.endsWith('.kml'));
                if (kmlFile) {
                    kmlFile.async('string').then(function(kmlContent) {
                        parseKML(kmlContent);
                        if (callback) callback();
                    });
                } else {
                    showNotification('Arquivo KML não encontrado no KMZ!', 'error');
                    if (callback) callback();
                }
            }).catch(function(error) {
                console.error('Erro ao processar KMZ:', error);
                showNotification('Erro ao importar KMZ: ' + error.message, 'error');
                if (callback) callback();
            });
        } catch (error) {
            console.error('Erro ao importar arquivo:', error);
            showNotification('Erro ao importar arquivo!', 'error');
            if (callback) callback();
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// ===== FUNÇÕES DE UPLOAD KMZ =====

// Função para processar arquivos KMZ carregados
async function processKMZFiles(files) {
    showNotification('Processando arquivos KMZ...', 'info');
    
    let totalMarkings = 0;
    
    for (let file of files) {
        try {
            const markings = await processUploadedKMZFile(file);
            if (markings.length > 0) {
                await saveUploadedMarkings(markings, file.name);
                totalMarkings += markings.length;
            }
        } catch (error) {
            console.error('Erro ao processar arquivo:', file.name, error);
            showNotification(`Erro ao processar ${file.name}: ${error.message}`, 'error');
        }
    }
    
    if (totalMarkings > 0) {
        showNotification(`✅ ${totalMarkings} marcações carregadas com sucesso!`, 'success');
        // Recarregar marcações no mapa
        drawnItems.clearLayers();
        syncNewMarkings();
        
        // Sincronizar com Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.sync) {
            setTimeout(() => {
                window.supabaseConfig.sync();
            }, 1000);
        }
    } else {
        showNotification('Nenhuma marcação válida encontrada nos arquivos.', 'warning');
    }
}

// Função para processar um único arquivo KMZ para upload
async function processUploadedKMZFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const zip = new JSZip();
                const zipData = await zip.loadAsync(e.target.result);
                
                // Procurar arquivo KML dentro do KMZ
                let kmlContent = null;
                
                for (let filename in zipData.files) {
                    if (filename.toLowerCase().endsWith('.kml')) {
                        kmlContent = await zipData.files[filename].async('text');
                        break;
                    }
                }
                
                if (!kmlContent) {
                    reject(new Error('Arquivo KML não encontrado no KMZ'));
                    return;
                }
                
                // Processar conteúdo KML
                const markings = parseUploadedKMLContent(kmlContent, file.name);
                resolve(markings);
                
            } catch (error) {
                reject(new Error('Erro ao processar arquivo KMZ: ' + error.message));
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Erro ao ler arquivo'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Função para analisar conteúdo KML e extrair marcações para upload
function parseUploadedKMLContent(kmlContent, fileName) {
    const markings = [];
    
    try {
        // Criar parser XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        // Extrair Placemarks (marcações)
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        
        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const marking = extractMarkingFromPlacemark(placemark, fileName);
            
            if (marking) {
                markings.push(marking);
            }
        }
        
    } catch (error) {
        console.error('Erro ao analisar KML:', error);
    }
    
    return markings;
}

// Função para extrair marcação de um Placemark
function extractMarkingFromPlacemark(placemark, fileName) {
    try {
        // Extrair nome
        const nameElement = placemark.getElementsByTagName('name')[0];
        const name = nameElement ? nameElement.textContent : 'Marcação Importada';
        
        // Extrair descrição
        const descElement = placemark.getElementsByTagName('description')[0];
        const description = descElement ? descElement.textContent : '';
        
        // Extrair coordenadas
        let coordinates = null;
        let type = 'marker';
        
        // Verificar Point (marcador)
        const point = placemark.getElementsByTagName('Point')[0];
        if (point) {
            const coordsElement = point.getElementsByTagName('coordinates')[0];
            if (coordsElement) {
                const coords = coordsElement.textContent.trim().split(',');
                if (coords.length >= 2) {
                    coordinates = {
                        lat: parseFloat(coords[1]),
                        lng: parseFloat(coords[0])
                    };
                    type = 'marker';
                }
            }
        }
        
        // Verificar LineString (linha)
        const lineString = placemark.getElementsByTagName('LineString')[0];
        if (lineString) {
            const coordsElement = lineString.getElementsByTagName('coordinates')[0];
            if (coordsElement) {
                const coordsText = coordsElement.textContent.trim();
                const coordPairs = coordsText.split(/\s+/);
                const latLngs = [];
                
                for (let coordPair of coordPairs) {
                    const coords = coordPair.split(',');
                    if (coords.length >= 2) {
                        latLngs.push({
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0])
                        });
                    }
                }
                
                if (latLngs.length > 0) {
                    coordinates = latLngs;
                    type = 'polyline';
                }
            }
        }
        
        // Verificar Polygon (polígono)
        const polygon = placemark.getElementsByTagName('Polygon')[0];
        if (polygon) {
            const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
            if (outerBoundary) {
                const linearRing = outerBoundary.getElementsByTagName('LinearRing')[0];
                if (linearRing) {
                    const coordsElement = linearRing.getElementsByTagName('coordinates')[0];
                    if (coordsElement) {
                        const coordsText = coordsElement.textContent.trim();
                        const coordPairs = coordsText.split(/\s+/);
                        const latLngs = [];
                        
                        for (let coordPair of coordPairs) {
                            const coords = coordPair.split(',');
                            if (coords.length >= 2) {
                                latLngs.push({
                                    lat: parseFloat(coords[1]),
                                    lng: parseFloat(coords[0])
                                });
                            }
                        }
                        
                        if (latLngs.length > 0) {
                            coordinates = latLngs;
                            type = 'polygon';
                        }
                    }
                }
            }
        }
        
        if (!coordinates) {
            return null;
        }
        
        // Criar objeto de marcação
        const marking = {
            id: generateId(),
            type: type,
            coordinates: coordinates,
            properties: {
                name: name,
                description: description,
                source: 'upload',
                fileName: fileName,
                uploadedAt: Date.now()
            },
            timestamp: Date.now(),
            lastModified: Date.now()
        };
        
        // Para compatibilidade com formato antigo
        if (type === 'marker') {
            marking.lat = coordinates.lat;
            marking.lng = coordinates.lng;
        }
        
        return marking;
        
    } catch (error) {
        console.error('Erro ao extrair marcação:', error);
        return null;
    }
}

// Função para salvar marcações carregadas
async function saveUploadedMarkings(markings, fileName) {
    try {
        // Carregar marcações existentes
        const existingMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        
        // Adicionar novas marcações
        const allMarkings = [...existingMarkings, ...markings];
        
        // Salvar no localStorage
        localStorage.setItem('controle_obra_markings', JSON.stringify(allMarkings));
        
        console.log(`Salvadas ${markings.length} marcações do arquivo ${fileName}`);
        
        // Salvar no Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.saveMarkings) {
            const result = await window.supabaseConfig.saveMarkings(markings);
            if (result.success) {
                console.log('Marcações salvas no Supabase:', result.data?.length || markings.length);
            } else {
                console.warn('Erro ao salvar no Supabase:', result.error);
            }
        }
        
    } catch (error) {
        console.error('Erro ao salvar marcações:', error);
        throw error;
    }
}

// Analisar conteúdo KML (versão unificada)
function parseKML(kmlContent) {
    try {
        const markings = parseUploadedKMLContent(kmlContent, 'Importado');
        let importedCount = 0;
        
        for (const marking of markings) {
            try {
                // Criar camada a partir da marcação
                let layer = null;
                
                if (marking.type === 'marker') {
                    layer = L.marker([marking.coordinates.lat, marking.coordinates.lng], {
                        icon: new L.Icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    });
                } else if (marking.type === 'polygon') {
                    const latlngs = marking.coordinates.map(coord => [coord.lat, coord.lng]);
                    layer = L.polygon(latlngs, {
                        color: '#FF9800',
                        weight: 3,
                        fillOpacity: 0.3
                    });
                } else if (marking.type === 'polyline') {
                    const latlngs = marking.coordinates.map(coord => [coord.lat, coord.lng]);
                    layer = L.polyline(latlngs, {
                        color: '#FF9800',
                        weight: 3
                    });
                }
                
                if (layer) {
                    // Adicionar popup com informações
                    const popupContent = `
                        <h4>${marking.properties.name || 'Marcação Importada'}</h4>
                        <p>${marking.properties.description || ''}</p>
                        <p><small>Fonte: ${marking.properties.fileName || 'Importado'}</small></p>
                    `;
                    layer.bindPopup(popupContent);
                    
                    // Adicionar ID da marcação
                    layer._markingId = marking.id;
                    
                    // Salvar marcação no localStorage
                    const markingData = {
                        id: marking.id,
                        type: marking.type,
                        coordinates: marking.coordinates,
                        properties: marking.properties,
                        timestamp: marking.timestamp,
                        lastModified: marking.lastModified,
                        action: 'create',
                        layerData: extractLayerData(layer),
                        visualProperties: extractVisualProperties(layer)
                    };
                    
                    // Adicionar ao localStorage
                    const existingMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
                    existingMarkings.push(markingData);
                    localStorage.setItem('controle_obra_markings', JSON.stringify(existingMarkings));
                    
                    drawnItems.addLayer(layer);
                        importedCount++;
                    }
            } catch (error) {
                console.error('Erro ao processar marcação individual:', error);
            }
        }
        
        if (importedCount > 0) {
            showNotification(`${importedCount} marcação(ões) importada(s) com sucesso!`, 'success');
            // Ajustar visualização para mostrar todas as marcações
            if (drawnItems.getLayers().length > 0) {
                map.fitBounds(drawnItems.getBounds(), {padding: [20, 20]});
            }
        } else {
            showNotification('Nenhuma marcação válida encontrada no arquivo!', 'warning');
        }
    } catch (error) {
        console.error('Erro ao analisar KML:', error);
        showNotification('Erro ao processar arquivo KML!', 'error');
    }
}

// Função para mostrar notificações
function showNotification(message, type = 'success') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Adicionar ao container de notificações
    let container = document.getElementById('notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.className = 'notifications-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Mostrar notificação
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Notificação específica para sincronização
function showSyncNotification(message, type = 'success') {
    console.log(`SYNC ${type.toUpperCase()}: ${message}`);
    
    // Criar elemento de notificação de sincronização
    const notification = document.createElement('div');
    notification.className = `notification sync-notification ${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <div class="sync-indicator">
            <div class="sync-pulse"></div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Adicionar ao container de notificações
    let container = document.getElementById('notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications-container';
        container.className = 'notifications-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Mostrar notificação
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-remover após 4 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 4000);
}

// Ícones para notificações
function getNotificationIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || icons.info;
}

// Esconder loading
function hideLoading() {
    setTimeout(() => {
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
    }, 1000);
}

// Configurar suporte offline
function setupOfflineSupport() {
    // Detectar mudanças na conectividade
    window.addEventListener('online', function() {
        isOnline = true;
        updateConnectionStatus();
        syncOfflineData();
    });
    
    window.addEventListener('offline', function() {
        isOnline = false;
        updateConnectionStatus();
    });
    
    // Verificar conectividade inicial
    updateConnectionStatus();
    
    // Tentar sincronizar a cada 30 segundos quando online
    setInterval(function() {
        if (isOnline && offlineQueue.length > 0) {
            syncOfflineData();
        }
    }, 30000);
    
    // Configurar sincronização automática em tempo real
    setupRealTimeSync();
}

// Atualizar indicador de status de conexão
function updateConnectionStatus() {
    const sidebar = document.getElementById('sidebar');
    let statusIndicator = document.getElementById('connection-status');
    const syncButton = document.getElementById('sync-offline');
    const drawToolbar = document.querySelector('.leaflet-draw-toolbar');
    
    if (!statusIndicator && sidebar) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'connection-status';
        statusIndicator.className = 'connection-status';
        const controlGroup = sidebar.querySelector('.control-group');
        if (controlGroup) {
            controlGroup.insertBefore(statusIndicator, controlGroup.firstChild);
        }
    }
    
    if (isOnline) {
        statusIndicator.innerHTML = '<span class="status-dot online"></span>Online';
        statusIndicator.className = 'connection-status online';
        if (drawToolbar) {
            drawToolbar.classList.remove('offline');
        }
    } else {
        statusIndicator.innerHTML = '<span class="status-dot offline"></span>Offline';
        statusIndicator.className = 'connection-status offline';
        if (drawToolbar) {
            drawToolbar.classList.add('offline');
        }
    }
    
    // Mostrar contador de itens pendentes
    if (offlineQueue.length > 0) {
        statusIndicator.innerHTML += ` (${offlineQueue.length} pendente${offlineQueue.length > 1 ? 's' : ''})`;
        syncButton.style.display = 'flex';
    } else {
        syncButton.style.display = 'none';
    }
}

// Salvar marcação (offline ou online)
function saveMarking(layer, layerType) {
    // Extrair dados específicos do tipo de camada
    let coordinates = null;
    let radius = null;
    let bounds = null;
    
    if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        coordinates = { lat: center.lat, lng: center.lng };
        radius = layer.getRadius();
        console.log(`🔵 Salvando círculo: centro [${center.lat}, ${center.lng}], raio ${radius}`);
    } else if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        coordinates = { lat: latlng.lat, lng: latlng.lng };
        console.log(`📍 Salvando marcador: [${latlng.lat}, ${latlng.lng}]`);
    } else if (layer instanceof L.Polyline) {
        coordinates = layer.getLatLngs().map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`📏 Salvando linha com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Polygon) {
        coordinates = layer.getLatLngs()[0].map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`🔷 Salvando polígono com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Rectangle) {
        const rectBounds = layer.getBounds();
        bounds = {
            southWest: { lat: rectBounds.getSouthWest().lat, lng: rectBounds.getSouthWest().lng },
            northEast: { lat: rectBounds.getNorthEast().lat, lng: rectBounds.getNorthEast().lng }
        };
        coordinates = [
            { lat: bounds.southWest.lat, lng: bounds.southWest.lng },
            { lat: bounds.northEast.lat, lng: bounds.northEast.lng }
        ];
        console.log(`⬜ Salvando retângulo: ${rectBounds.toString()}`);
    }
    
    const markingData = {
        id: generateId(),
        type: layerType,
        coordinates: coordinates,
        radius: radius, // Preservar raio para círculos
        bounds: bounds, // Preservar bounds para retângulos
        data: layerToGeoJSON(layer),
        timestamp: new Date().toISOString(),
        action: 'create',
        // Preservar dados da camada para recriação fiel
        layerData: extractLayerData(layer),
        // Preservar propriedades visuais
        visualProperties: extractVisualProperties(layer)
    };
    
    // Adicionar ID à camada para referência futura
    layer._markingId = markingData.id;
    
    console.log(`💾 Salvando marcação ${markingData.id} do tipo ${layerType}:`, markingData);
    
    if (isOnline) {
        // Salvar diretamente se online
        saveToLocalStorage(markingData);
        
        // Sincronizar imediatamente com Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.saveMarkings) {
            setTimeout(async () => {
                try {
                    await window.supabaseConfig.saveMarkings([markingData]);
                    console.log(`✅ Marcação ${markingData.id} sincronizada com Supabase`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao sincronizar marcação ${markingData.id}:`, error);
                }
            }, 1000);
        }
    } else {
        // Adicionar à fila offline
        offlineQueue.push(markingData);
        saveOfflineQueue();
        updateConnectionStatus();
    }
}

// Atualizar marcação existente
function updateMarking(layer) {
    // Extrair dados específicos do tipo de camada
    let coordinates = null;
    let radius = null;
    let bounds = null;
    
    if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        coordinates = { lat: center.lat, lng: center.lng };
        radius = layer.getRadius();
        console.log(`🔵 Atualizando círculo: centro [${center.lat}, ${center.lng}], raio ${radius}`);
    } else if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        coordinates = { lat: latlng.lat, lng: latlng.lng };
        console.log(`📍 Atualizando marcador: [${latlng.lat}, ${latlng.lng}]`);
    } else if (layer instanceof L.Polyline) {
        coordinates = layer.getLatLngs().map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`📏 Atualizando linha com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Polygon) {
        coordinates = layer.getLatLngs()[0].map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`🔷 Atualizando polígono com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Rectangle) {
        const rectBounds = layer.getBounds();
        bounds = {
            southWest: { lat: rectBounds.getSouthWest().lat, lng: rectBounds.getSouthWest().lng },
            northEast: { lat: rectBounds.getNorthEast().lat, lng: rectBounds.getNorthEast().lng }
        };
        coordinates = [
            { lat: bounds.southWest.lat, lng: bounds.southWest.lng },
            { lat: bounds.northEast.lat, lng: bounds.northEast.lng }
        ];
        console.log(`⬜ Atualizando retângulo: ${rectBounds.toString()}`);
    }
    
    const markingData = {
        id: layer._markingId || generateId(),
        type: getLayerType(layer).toLowerCase(),
        coordinates: coordinates,
        radius: radius, // Preservar raio para círculos
        bounds: bounds, // Preservar bounds para retângulos
        data: layerToGeoJSON(layer),
        timestamp: new Date().toISOString(),
        action: 'update',
        // Preservar dados da camada para recriação fiel
        layerData: extractLayerData(layer),
        // Preservar propriedades visuais
        visualProperties: extractVisualProperties(layer)
    };
    
    if (!layer._markingId) {
        layer._markingId = markingData.id;
    }
    
    console.log(`💾 Atualizando marcação ${markingData.id} do tipo ${markingData.type}:`, markingData);
    
    if (isOnline) {
        saveToLocalStorage(markingData);
    } else {
        offlineQueue.push(markingData);
        saveOfflineQueue();
        updateConnectionStatus();
    }
}

// Deletar marcação
function deleteMarking(layer) {
    const markingData = {
        id: layer._markingId || generateId(),
        timestamp: new Date().toISOString(),
        action: 'delete'
    };
    
    if (isOnline) {
        removeFromLocalStorage(markingData.id);
    } else {
        offlineQueue.push(markingData);
        saveOfflineQueue();
        updateConnectionStatus();
    }
}

// Converter camada para GeoJSON
function layerToGeoJSON(layer) {
    if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        return {
            type: 'Point',
            coordinates: [latlng.lng, latlng.lat],
            properties: {
                popupContent: layer.getPopup() ? layer.getPopup().getContent() : ''
            }
        };
    } else if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        return {
            type: 'Point',
            coordinates: [center.lng, center.lat],
            properties: {
                radius: radius,
                popupContent: layer.getPopup() ? layer.getPopup().getContent() : ''
            }
        };
    } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const latlngs = layer.getLatLngs()[0];
        const coordinates = [latlngs.map(latlng => [latlng.lng, latlng.lat])];
        return {
            type: 'Polygon',
            coordinates: coordinates,
            properties: {
                popupContent: layer.getPopup() ? layer.getPopup().getContent() : ''
            }
        };
    } else if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs();
        const coordinates = latlngs.map(latlng => [latlng.lng, latlng.lat]);
        return {
            type: 'LineString',
            coordinates: coordinates,
            properties: {
                popupContent: layer.getPopup() ? layer.getPopup().getContent() : ''
            }
        };
    }
    return null;
}

// Gerar ID único
function generateId() {
    return 'marking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Salvar no localStorage
async function saveToLocalStorage(markingData) {
    try {
        const existingData = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const existingIndex = existingData.findIndex(item => item.id === markingData.id);
        
        if (existingIndex >= 0) {
            existingData[existingIndex] = markingData;
        } else {
            existingData.push(markingData);
        }
        
        localStorage.setItem('controle_obra_markings', JSON.stringify(existingData));
        
        // Forçar atualização dos dados de obras
        updateWorksData();
        
        // Disparar evento personalizado para sincronização
        window.dispatchEvent(new CustomEvent('markingsUpdated', {
            detail: { markingData, action: 'save' }
        }));
        
        // Sincronizar com Supabase se disponível
        if (window.supabaseConfig && navigator.onLine && !isOfflineMode) {
            try {
                await window.supabaseConfig.saveMarkings([markingData]);
                console.log('✅ Marcação salva no Supabase');
            } catch (error) {
                console.error('❌ Erro ao salvar no Supabase:', error);
                // Adicionar à fila offline em caso de erro
                addToOfflineQueue('save', markingData);
            }
        } else if (isOfflineMode || !navigator.onLine) {
            // Adicionar à fila offline
            addToOfflineQueue('save', markingData);
            console.log('📝 Marcação adicionada à fila offline');
        }
        
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
    }
}

// Remover do localStorage
async function removeFromLocalStorage(markingId) {
    try {
        const existingData = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const filteredData = existingData.filter(item => item.id !== markingId);
        localStorage.setItem('controle_obra_markings', JSON.stringify(filteredData));
        
        // Sincronizar remoção com Supabase se disponível
        if (window.supabaseConfig && navigator.onLine && !isOfflineMode) {
            try {
                await window.supabaseConfig.deleteMarking(markingId);
                console.log('✅ Marcação removida do Supabase');
            } catch (error) {
                console.error('❌ Erro ao remover do Supabase:', error);
                // Adicionar à fila offline em caso de erro
                addToOfflineQueue('delete', { id: markingId });
            }
        } else if (isOfflineMode || !navigator.onLine) {
            // Adicionar à fila offline
            addToOfflineQueue('delete', { id: markingId });
            console.log('📝 Remoção adicionada à fila offline');
        }
    } catch (error) {
        console.error('Erro ao remover do localStorage:', error);
    }
}

// Salvar fila offline
function saveOfflineQueue() {
    try {
        localStorage.setItem('controle_obra_offline_queue', JSON.stringify(offlineQueue));
    } catch (error) {
        console.error('Erro ao salvar fila offline:', error);
    }
}

// Carregar dados offline
function loadOfflineData() {
    try {
        // Carregar fila offline
        const savedQueue = localStorage.getItem('controle_obra_offline_queue');
        if (savedQueue) {
            offlineQueue = JSON.parse(savedQueue);
        }
        
        // Carregar marcações salvas
        const savedMarkings = localStorage.getItem('controle_obra_markings');
        if (savedMarkings) {
            const markings = JSON.parse(savedMarkings);
            markings.forEach(marking => {
                if (marking.action !== 'delete') {
                    const layer = geoJSONToLayer(marking.data, marking.type);
                    if (layer) {
                        layer._markingId = marking.id;
                        drawnItems.addLayer(layer);
                    }
                }
            });
        }
        
        updateConnectionStatus();
    } catch (error) {
        console.error('Erro ao carregar dados offline:', error);
    }
}

// Função para sincronizar apenas novas marcações sem apagar as existentes
function syncNewMarkings() {
    try {
        const savedMarkings = localStorage.getItem('controle_obra_markings');
        if (!savedMarkings) return;
        
        const markings = JSON.parse(savedMarkings);
        const existingIds = new Set();
        
        // Coletar IDs das marcações já existentes no mapa
        drawnItems.eachLayer(layer => {
            if (layer._markingId) {
                existingIds.add(layer._markingId);
            }
        });
        
        // Adicionar apenas marcações novas
        let newMarkingsCount = 0;
        markings.forEach(marking => {
            // Verificar se não foi excluída localmente
            const localData = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
            const isLocallyDeleted = !localData.find(item => item.id === marking.id);
            
            if (marking.action !== 'delete' && !existingIds.has(marking.id) && !isLocallyDeleted) {
                let layer = null;
                
                // Priorizar dados preservados da camada para manter formato original
                if (marking.layerData) {
                    console.log(`🔄 Recriando marcação ${marking.id} do tipo ${marking.type} com dados preservados`);
                    layer = recreateLayerFromData(marking.layerData, marking.type);
                } else if (marking.data) {
                    console.log(`🔄 Recriando marcação ${marking.id} do tipo ${marking.type} com GeoJSON`);
                    layer = geoJSONToLayer(marking.data, marking.type);
                } else {
                    console.log(`⚠️ Marcação ${marking.id} sem dados preservados, pulando...`);
                }
                
                // Se conseguiu recriar a camada, adicionar ao mapa
                if (layer) {
                    layer._markingId = marking.id;
                    
                    // Preservar propriedades visuais originais
                    if (marking.visualProperties) {
                        applyVisualProperties(layer, marking.visualProperties);
                    }
                    
                    // Adicionar popup se não tiver
                    if (!layer.getPopup()) {
                        const popupContent = marking.properties?.name || 
                                           marking.properties?.description || 
                                           `Marcação ${marking.type}`;
                        layer.bindPopup(popupContent);
                    }
                    
                    drawnItems.addLayer(layer);
                    newMarkingsCount++;
                    console.log(`✅ Marcação ${marking.id} (${marking.type}) adicionada ao mapa`);
                } else {
                    console.log(`⚠️ Falha ao recriar marcação ${marking.id} do tipo ${marking.type}, pulando...`);
                }
            }
        });
        
        return newMarkingsCount;
    } catch (error) {
        console.error('Erro ao sincronizar novas marcações:', error);
        return 0;
    }
}

// Função para migrar marcações antigas que não têm dados preservados
function migrateOldMarkings() {
    try {
        const savedMarkings = localStorage.getItem('controle_obra_markings');
        if (!savedMarkings) return;
        
        const markings = JSON.parse(savedMarkings);
        let migrated = 0;
        
        markings.forEach(marking => {
            // Se não tem layerData mas tem data (formato antigo), tentar migrar
            if (!marking.layerData && marking.data && marking.type === 'circle') {
                console.log(`🔄 Migrando marcação antiga ${marking.id} do tipo ${marking.type}`);
                
                // Tentar extrair raio do GeoJSON
                if (marking.data.properties && marking.data.properties.radius) {
                    marking.radius = marking.data.properties.radius;
                    console.log(`🔵 Raio migrado: ${marking.radius}`);
                }
                
                // Marcar como migrada
                marking.migrated = true;
                migrated++;
            }
        });
        
        if (migrated > 0) {
            localStorage.setItem('controle_obra_markings', JSON.stringify(markings));
            console.log(`✅ ${migrated} marcações antigas migradas`);
        }
        
    } catch (error) {
        console.error('Erro ao migrar marcações antigas:', error);
    }
}

// Função para forçar sincronização imediata
function forceSyncNow() {
    if (window.supabaseConfig && window.supabaseConfig.sync) {
        console.log('🔄 Forçando sincronização imediata...');
        window.supabaseConfig.sync().then(result => {
            if (result.success) {
                console.log('✅ Sincronização forçada concluída');
            } else {
                console.warn('⚠️ Erro na sincronização forçada:', result.error);
            }
        });
    }
}

// Função para debug de marcações
function debugMarkings() {
    console.log('🔍 DEBUG: Analisando marcações locais...');
    const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    
    localMarkings.forEach((marking, index) => {
        console.log(`📋 Marcação ${index + 1} (${marking.id}):`);
        console.log(`   Tipo: ${marking.type}`);
        console.log(`   Radius: ${marking.radius}`);
        console.log(`   Properties.radius: ${marking.properties?.radius}`);
        console.log(`   Data.properties.radius: ${marking.data?.properties?.radius}`);
        console.log(`   LayerData.radius: ${marking.layerData?.radius}`);
        console.log(`   Bounds: ${marking.bounds ? 'Sim' : 'Não'}`);
        console.log(`   LayerData.bounds: ${marking.layerData?.bounds ? 'Sim' : 'Não'}`);
        console.log('---');
    });
}

// Função para limpar marcações antigas e forçar migração
function clearOldMarkings() {
    console.log('🗑️ Limpando marcações antigas...');
    localStorage.removeItem('controle_obra_markings');
    console.log('✅ Marcações antigas removidas');
    showNotification('Marcações antigas removidas. Desenhe novas marcações para testar.', 'info');
}

// Função para debug dos dados do Supabase
function debugSupabaseData() {
    console.log('🔍 DEBUG: Analisando dados do Supabase...');
    if (window.supabaseConfig && window.supabaseConfig.supabaseClient) {
        window.supabaseConfig.supabaseClient
            .from('markings')
            .select('*')
            .limit(5)
            .then(({ data, error }) => {
                if (error) {
                    console.error('❌ Erro ao buscar dados do Supabase:', error);
                } else {
                    console.log('📊 Dados do Supabase (primeiras 5 marcações):');
                    data.forEach((marking, index) => {
                        console.log(`📋 Marcação ${index + 1} (${marking.id}):`);
                        console.log(`   Tipo: ${marking.type}`);
                        console.log(`   Radius: ${marking.radius}`);
                        console.log(`   Bounds: ${marking.bounds ? 'Sim' : 'Não'}`);
                        console.log(`   LayerData: ${marking.layerData ? 'Sim' : 'Não'}`);
                        if (marking.layerData) {
                            console.log(`   LayerData.radius: ${marking.layerData.radius}`);
                            console.log(`   LayerData.bounds: ${marking.layerData.bounds ? 'Sim' : 'Não'}`);
                        }
                        console.log('---');
                    });
                }
            });
    } else {
        console.error('❌ Supabase não inicializado');
    }
}

// Função para testar criação de círculo
function testCircleCreation() {
    console.log('🧪 TESTE: Criando círculo de teste...');
    
    // Criar um círculo de teste
    const testCircle = L.circle([-22.9, -42.8], {
        radius: 500, // Raio grande para teste
        color: '#ff0000',
        weight: 3,
        fillOpacity: 0.3
    });
    
    // Adicionar ao mapa
    drawnItems.addLayer(testCircle);
    
    // Salvar usando a função corrigida
    saveMarkingWithData(testCircle, {
        name: 'Teste Círculo',
        description: 'Círculo de teste com raio 500'
    });
    
    console.log('✅ Círculo de teste criado e salvo');
}

// Função para testar criação de diferentes formas
function testAllShapes() {
    console.log('🧪 TESTE: Criando todas as formas de teste...');
    
    // 1. Círculo
    const testCircle = L.circle([-22.9, -42.8], {
        radius: 300,
        color: '#ff0000',
        weight: 3,
        fillOpacity: 0.3
    });
    drawnItems.addLayer(testCircle);
    saveMarkingWithData(testCircle, {
        name: 'Teste Círculo',
        description: 'Círculo de teste'
    });
    
    // 2. Linha
    const testLine = L.polyline([
        [-22.9, -42.8],
        [-22.91, -42.81],
        [-22.92, -42.82]
    ], {
        color: '#00ff00',
        weight: 3
    });
    drawnItems.addLayer(testLine);
    saveMarkingWithData(testLine, {
        name: 'Teste Linha',
        description: 'Linha de teste'
    });
    
    // 3. Polígono
    const testPolygon = L.polygon([
        [-22.9, -42.8],
        [-22.91, -42.8],
        [-22.91, -42.81],
        [-22.9, -42.81]
    ], {
        color: '#0000ff',
        weight: 3,
        fillOpacity: 0.3
    });
    drawnItems.addLayer(testPolygon);
    saveMarkingWithData(testPolygon, {
        name: 'Teste Polígono',
        description: 'Polígono de teste'
    });
    
    // 4. Retângulo
    const testRect = L.rectangle([
        [-22.9, -42.8],
        [-22.91, -42.81]
    ], {
        color: '#ffff00',
        weight: 3,
        fillOpacity: 0.3
    });
    drawnItems.addLayer(testRect);
    saveMarkingWithData(testRect, {
        name: 'Teste Retângulo',
        description: 'Retângulo de teste'
    });
    
    console.log('✅ Todas as formas de teste criadas e salvas');
}

// Função para sincronização automática com Supabase
async function autoSyncWithSupabase() {
    if (!window.supabaseConfig || !canSync()) return;
    
    try {
        startSync();
        console.log('🔄 Sincronização automática com Supabase...');
        
        // Carregar dados locais
        const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        
        // Salvar dados locais no Supabase
        if (localMarkings.length > 0) {
            try {
            await window.supabaseConfig.saveMarkings(localMarkings);
            } catch (error) {
                console.warn('⚠️ Erro ao salvar marcações no Supabase:', error);
                // Continuar mesmo com erro de salvamento
            }
        }
        
        // Carregar dados atualizados do Supabase
        try {
        const result = await window.supabaseConfig.loadMarkings();
        if (result.success && result.markings.length > 0) {
            // Fazer merge com dados locais
            const mergedMarkings = mergeMarkings(localMarkings, result.markings);
            
            // Atualizar localStorage se houver mudanças
            if (JSON.stringify(mergedMarkings) !== JSON.stringify(localMarkings)) {
                localStorage.setItem('controle_obra_markings', JSON.stringify(mergedMarkings));
                
                // Recarregar marcações no mapa
                drawnItems.clearLayers();
                syncNewMarkings();
                updateWorksData();
                refreshWorksTable();
                
                console.log('✅ Dados sincronizados com Supabase');
            }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao carregar marcações do Supabase:', error);
            // Continuar mesmo com erro de carregamento
        }
        
        // Carregar localizações dos dispositivos se estiver ativo
        if (isTrackingDevices) {
            try {
            await loadDeviceLocations();
            } catch (error) {
                console.warn('⚠️ Erro ao carregar localizações dos dispositivos:', error);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro na sincronização automática com Supabase:', error);
    } finally {
        endSync();
    }
}

// Converter marcação para formato GeoJSON
function convertMarkingToGeoJSON(marking) {
    if (!marking.coordinates) return null;
    
    try {
        // Se já tem data (formato antigo), usar diretamente
        if (marking.data) {
            return marking.data;
        }
        
        let geoJSON = {
            properties: {
                popupContent: marking.properties?.name || marking.properties?.description || '',
                source: marking.properties?.source || 'manual',
                fileName: marking.properties?.fileName
            }
        };
        
        if (marking.type === 'marker') {
            geoJSON.type = 'Point';
            geoJSON.coordinates = [marking.coordinates.lng, marking.coordinates.lat];
        } else if (marking.type === 'polyline') {
            geoJSON.type = 'LineString';
            // Verificar se coordinates é array ou objeto
            if (Array.isArray(marking.coordinates) && marking.coordinates.length > 1) {
                geoJSON.coordinates = marking.coordinates.map(coord => [coord.lng, coord.lat]);
                console.log(`📏 Convertendo linha com ${marking.coordinates.length} pontos`);
            } else {
                geoJSON.coordinates = [[marking.coordinates.lng, marking.coordinates.lat]];
                console.log(`⚠️ Linha com apenas 1 ponto, usando coordenadas simples`);
            }
        } else if (marking.type === 'polygon') {
            geoJSON.type = 'Polygon';
            // Verificar se coordinates é array ou objeto
            if (Array.isArray(marking.coordinates) && marking.coordinates.length > 2) {
                geoJSON.coordinates = [marking.coordinates.map(coord => [coord.lng, coord.lat])];
                console.log(`🔷 Convertendo polígono com ${marking.coordinates.length} pontos`);
            } else {
                geoJSON.coordinates = [[[marking.coordinates.lng, marking.coordinates.lat]]];
                console.log(`⚠️ Polígono com menos de 3 pontos, usando coordenadas simples`);
            }
        } else if (marking.type === 'circle') {
            geoJSON.type = 'Point';
            geoJSON.coordinates = [marking.coordinates.lng, marking.coordinates.lat];
            
            // Buscar raio em múltiplos locais
            let radius = 100; // Padrão
            if (marking.radius) {
                radius = marking.radius;
            } else if (marking.properties?.radius) {
                radius = marking.properties.radius;
            } else if (marking.data?.properties?.radius) {
                radius = marking.data.properties.radius;
            } else if (marking.layerData?.radius) {
                radius = marking.layerData.radius;
            }
            
            geoJSON.properties.radius = radius;
            geoJSON.properties.isCircle = true; // Marcar como círculo
            console.log(`🔵 Convertendo círculo para GeoJSON: raio ${radius} (marking.radius: ${marking.radius}, properties.radius: ${marking.properties?.radius}, data.radius: ${marking.data?.properties?.radius}, layerData.radius: ${marking.layerData?.radius})`);
        } else if (marking.type === 'rectangle') {
            geoJSON.type = 'Polygon';
            if (marking.bounds) {
                // Usar bounds preservados
                const sw = marking.bounds.southWest;
                const ne = marking.bounds.northEast;
                geoJSON.coordinates = [[
                    [sw.lng, sw.lat],
                    [ne.lng, sw.lat],
                    [ne.lng, ne.lat],
                    [sw.lng, ne.lat],
                    [sw.lng, sw.lat]
                ]];
                console.log(`⬜ Convertendo retângulo com bounds: SW[${sw.lat}, ${sw.lng}] NE[${ne.lat}, ${ne.lng}]`);
            } else if (marking.coordinates && marking.coordinates.length === 2) {
                // Usar coordenadas preservadas
                const sw = marking.coordinates[0];
                const ne = marking.coordinates[1];
                geoJSON.coordinates = [[
                    [sw.lng, sw.lat],
                    [ne.lng, sw.lat],
                    [ne.lng, ne.lat],
                    [sw.lng, ne.lat],
                    [sw.lng, sw.lat]
                ]];
                console.log(`⬜ Convertendo retângulo com coordenadas: SW[${sw.lat}, ${sw.lng}] NE[${ne.lat}, ${ne.lng}]`);
            } else if (marking.layerData?.bounds) {
                // Usar bounds do layerData
                const sw = marking.layerData.bounds.southWest;
                const ne = marking.layerData.bounds.northEast;
                geoJSON.coordinates = [[
                    [sw.lng, sw.lat],
                    [ne.lng, sw.lat],
                    [ne.lng, ne.lat],
                    [sw.lng, ne.lat],
                    [sw.lng, sw.lat]
                ]];
                console.log(`⬜ Convertendo retângulo com layerData bounds: SW[${sw.lat}, ${sw.lng}] NE[${ne.lat}, ${ne.lng}]`);
            } else {
                // Fallback para coordenadas simples
                geoJSON.coordinates = [[[marking.coordinates.lng, marking.coordinates.lat]]];
                console.log(`⚠️ Retângulo sem bounds, usando coordenadas simples`);
            }
        }
        
        return geoJSON;
    } catch (error) {
        console.error('Erro ao converter marcação para GeoJSON:', error);
        return null;
    }
}

// Função para recriar camada a partir de dados preservados
function recreateLayerFromData(layerData, type) {
    try {
        if (type === 'marker' || type === 'point') {
            console.log(`📍 Recriando marcador em [${layerData.lat}, ${layerData.lng}]`);
            return L.marker([layerData.lat, layerData.lng], layerData.options || {});
        } else if (type === 'circle') {
            // Garantir que o raio seja preservado
            const options = { ...layerData.options };
            if (layerData.radius) {
                options.radius = layerData.radius;
            }
            console.log(`🔵 Recriando círculo: centro [${layerData.lat}, ${layerData.lng}], raio ${layerData.radius}`);
            return L.circle([layerData.lat, layerData.lng], options);
        } else if (type === 'polyline') {
            console.log(`📏 Recriando linha com ${layerData.latlngs.length} pontos`);
            console.log(`📏 Coordenadas da linha:`, layerData.latlngs);
            return L.polyline(layerData.latlngs, layerData.options || {});
        } else if (type === 'polygon') {
            console.log(`🔷 Recriando polígono com ${layerData.latlngs.length} pontos`);
            console.log(`🔷 Coordenadas do polígono:`, layerData.latlngs);
            return L.polygon(layerData.latlngs, layerData.options || {});
        } else if (type === 'rectangle') {
            if (layerData.bounds) {
                // Usar bounds preservados
                const bounds = L.latLngBounds(
                    [layerData.bounds.southWest.lat, layerData.bounds.southWest.lng],
                    [layerData.bounds.northEast.lat, layerData.bounds.northEast.lng]
                );
                console.log(`⬜ Recriando retângulo com bounds: ${bounds.toString()}`);
                return L.rectangle(bounds, layerData.options || {});
            } else if (layerData.latlngs && layerData.latlngs.length === 2) {
                // Usar coordenadas preservadas
                const bounds = L.latLngBounds(layerData.latlngs);
                console.log(`⬜ Recriando retângulo com coordenadas: ${bounds.toString()}`);
                return L.rectangle(bounds, layerData.options || {});
            } else {
                console.warn(`⚠️ Dados insuficientes para recriar retângulo:`, layerData);
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error('Erro ao recriar camada:', error);
        return null;
    }
}

// Função para aplicar propriedades visuais preservadas
function applyVisualProperties(layer, visualProperties) {
    try {
        if (visualProperties.color) {
            layer.setStyle({ color: visualProperties.color });
        }
        if (visualProperties.fillColor) {
            layer.setStyle({ fillColor: visualProperties.fillColor });
        }
        if (visualProperties.weight) {
            layer.setStyle({ weight: visualProperties.weight });
        }
        if (visualProperties.opacity) {
            layer.setStyle({ opacity: visualProperties.opacity });
        }
        if (visualProperties.fillOpacity) {
            layer.setStyle({ fillOpacity: visualProperties.fillOpacity });
        }
        if (visualProperties.icon && layer.setIcon) {
            layer.setIcon(visualProperties.icon);
        }
    } catch (error) {
        console.error('Erro ao aplicar propriedades visuais:', error);
    }
}

// Função para extrair propriedades visuais de uma camada
function extractVisualProperties(layer) {
    const properties = {};
    
    try {
        if (layer.options) {
            properties.color = layer.options.color;
            properties.fillColor = layer.options.fillColor;
            properties.weight = layer.options.weight;
            properties.opacity = layer.options.opacity;
            properties.fillOpacity = layer.options.fillOpacity;
        }
        
        if (layer._icon && layer._icon.options) {
            properties.icon = layer._icon;
        }
        
        return properties;
    } catch (error) {
        console.error('Erro ao extrair propriedades visuais:', error);
        return {};
    }
}

// Função para extrair dados da camada para preservação
function extractLayerData(layer) {
    try {
        if (layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            return {
                lat: latlng.lat,
                lng: latlng.lng,
                options: { ...layer.options } || {}
            };
        } else if (layer instanceof L.Circle) {
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            console.log(`🔵 Extraindo círculo: centro [${center.lat}, ${center.lng}], raio ${radius}`);
            return {
                lat: center.lat,
                lng: center.lng,
                radius: radius,
                options: { ...layer.options } || {}
            };
        } else if (layer instanceof L.Polyline) {
            const latlngs = layer.getLatLngs();
            console.log(`📏 Extraindo linha com ${latlngs.length} pontos`);
            return {
                latlngs: latlngs,
                options: { ...layer.options } || {}
            };
        } else if (layer instanceof L.Polygon) {
            const latlngs = layer.getLatLngs()[0];
            console.log(`🔷 Extraindo polígono com ${latlngs.length} pontos`);
            return {
                latlngs: latlngs,
                options: { ...layer.options } || {}
            };
        } else if (layer instanceof L.Rectangle) {
            const bounds = layer.getBounds();
            const latlngs = [
                [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
                [bounds.getNorthEast().lat, bounds.getNorthEast().lng]
            ];
            console.log(`⬜ Extraindo retângulo: ${bounds.toString()}`);
            return {
                latlngs: latlngs,
                bounds: {
                    southWest: { lat: bounds.getSouthWest().lat, lng: bounds.getSouthWest().lng },
                    northEast: { lat: bounds.getNorthEast().lat, lng: bounds.getNorthEast().lng }
                },
                options: { ...layer.options } || {}
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao extrair dados da camada:', error);
        return null;
    }
}

// Converter GeoJSON para camada Leaflet
function geoJSONToLayer(geoJSON, type) {
    if (!geoJSON) return null;
    
    try {
        // Determinar se é marcação importada
        const isUploaded = geoJSON.properties?.source === 'upload';
        
        // Cores diferentes para marcações importadas vs manuais
        const colors = {
            manual: {
                color: '#2196F3', // Azul para marcações manuais
                iconColor: 'blue'
            },
            upload: {
                color: '#FF9800', // Laranja para marcações importadas
                iconColor: 'orange'
            }
        };
        
        const colorScheme = isUploaded ? colors.upload : colors.manual;
        
        if (geoJSON.type === 'Point') {
            const [lng, lat] = geoJSON.coordinates;
            
            if (geoJSON.properties && (geoJSON.properties.radius || geoJSON.properties.isCircle)) {
                // É um círculo
                const radius = geoJSON.properties.radius || 100; // Raio padrão se não especificado
                const layer = L.circle([lat, lng], {
                    radius: radius,
                    color: colorScheme.color,
                    weight: 3,
                    fillOpacity: 0.3
                });
                if (geoJSON.properties.popupContent) {
                    layer.bindPopup(geoJSON.properties.popupContent);
                }
                console.log(`🔵 Criando círculo com raio ${radius} em [${lat}, ${lng}]`);
                return layer;
            } else {
                // É um marcador
                const iconUrl = isUploaded 
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png'
                    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';
                    
                const layer = L.marker([lat, lng], {
                    icon: new L.Icon({
                        iconUrl: iconUrl,
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                });
                
                // Adicionar informação sobre origem no popup
                let popupContent = geoJSON.properties.popupContent || '';
                if (isUploaded) {
                    const fileName = geoJSON.properties.fileName || 'Arquivo KMZ';
                    popupContent += `<br><small style="color: #FF9800;">📁 Importado de: ${fileName}</small>`;
                }
                
                if (popupContent) {
                    layer.bindPopup(popupContent);
                }
                return layer;
            }
        } else if (geoJSON.type === 'Polygon') {
            const coordinates = geoJSON.coordinates[0].map(coord => [coord[1], coord[0]]);
            const layer = L.polygon(coordinates, {
                color: colorScheme.color,
                weight: 3,
                fillOpacity: 0.3
            });
            
            // Adicionar informação sobre origem no popup
            let popupContent = geoJSON.properties.popupContent || '';
            if (isUploaded) {
                const fileName = geoJSON.properties.fileName || 'Arquivo KMZ';
                popupContent += `<br><small style="color: #FF9800;">📁 Importado de: ${fileName}</small>`;
            }
            
            if (popupContent) {
                layer.bindPopup(popupContent);
            }
            return layer;
        } else if (geoJSON.type === 'LineString') {
            const coordinates = geoJSON.coordinates.map(coord => [coord[1], coord[0]]);
            const layer = L.polyline(coordinates, {
                color: colorScheme.color,
                weight: 3
            });
            
            // Adicionar informação sobre origem no popup
            let popupContent = geoJSON.properties.popupContent || '';
            if (isUploaded) {
                const fileName = geoJSON.properties.fileName || 'Arquivo KMZ';
                popupContent += `<br><small style="color: #FF9800;">📁 Importado de: ${fileName}</small>`;
            }
            
            if (popupContent) {
                layer.bindPopup(popupContent);
            }
            return layer;
        }
    } catch (error) {
        console.error('Erro ao converter GeoJSON para camada:', error);
    }
    
    return null;
}

// Atualizar status de sincronização no header
function updateSyncStatus(status, message) {
    const syncStatus = document.getElementById('sync-status');
    const syncText = syncStatus?.querySelector('.sync-text');
    
    if (!syncStatus || !syncText) return;
    
    // Remover classes anteriores
    syncStatus.classList.remove('syncing', 'error');
    
    switch (status) {
        case 'syncing':
            syncStatus.classList.add('syncing');
            syncText.textContent = message || 'Sincronizando...';
            break;
        case 'error':
            syncStatus.classList.add('error');
            syncText.textContent = message || 'Erro na sincronização';
            break;
        case 'success':
        default:
            syncText.textContent = message || 'Sincronizado';
            break;
    }
}

// Configurar sincronização em tempo real
function setupRealTimeSync() {
    console.log('🔄 Configurando sincronização em tempo real...');
    
    // Escutar mudanças no localStorage de outras abas/dispositivos
    window.addEventListener('storage', function(e) {
        if (e.key === 'controle_obra_markings' || e.key === 'worksData') {
            console.log('📡 Mudança detectada no localStorage de outra aba');
            updateSyncStatus('syncing', 'Recebendo dados...');
            
            // Sincronizar apenas novas marcações quando houver mudanças
            setTimeout(() => {
                const newMarkings = syncNewMarkings();
                updateWorksData();
                refreshWorksTable();
                
                if (newMarkings > 0) {
                    updateSyncStatus('success', 'Dados atualizados');
                    showSyncNotification(`📱 ${newMarkings} nova(s) marcação(ões) do celular!`, 'success');
                } else {
                    updateSyncStatus('success', 'Dados sincronizados');
                    showSyncNotification('📱 Dados sincronizados do celular!', 'success');
                }
                
                // Voltar ao status normal após 3 segundos
                setTimeout(() => {
                    updateSyncStatus('success', 'Sincronizado');
                }, 3000);
            }, 500);
        }
    });
    
    // Escutar eventos personalizados de marcações
    window.addEventListener('markingsUpdated', function(e) {
        setTimeout(() => {
            refreshWorksTable();
            // Auto-sincronizar com Supabase quando houver mudanças
            if (isOnline && !syncInProgress && window.supabaseConfig) {
                autoSyncWithSupabase();
            }
        }, 100);
    });
    
    // Sincronização automática com Supabase a cada 2 minutos
    setInterval(async () => {
        if (isOnline && window.supabaseConfig) {
            try {
                await autoSyncWithSupabase();
            } catch (error) {
                console.error('❌ Erro na sincronização automática:', error);
            }
        }
    }, 120000);
    
    // Sincronizar quando voltar online
    window.addEventListener('online', () => {
        console.log('🌐 Conexão restaurada, sincronizando...');
        setTimeout(async () => {
            if (!syncInProgress && window.supabaseConfig) {
                await syncCrossContextData();
                // Processar fila offline quando voltar online
                await processOfflineQueue();
            }
        }, 2000);
    });
    
    // Sincronizar quando a página ganha foco (mudança de aba) - apenas se passou muito tempo
    window.addEventListener('focus', () => {
        const timeSinceLastSync = Date.now() - lastSyncTime;
        if (isOnline && !syncInProgress && window.supabaseConfig && timeSinceLastSync > 300000) { // 5 minutos
            console.log('👁️ Página em foco, verificando sincronização...');
            setTimeout(async () => {
                await syncCrossContextData();
            }, 1000);
        }
    });
    
    // Sincronização inicial ao carregar a página
    if (isOnline) {
        setTimeout(() => {
            loadDataFromServer();
        }, 2000);
    }
    
    // Polling local para verificar mudanças a cada 10 segundos (backup)
    let lastMarkingsHash = getDataHash('controle_obra_markings');
    let lastWorksHash = getDataHash('worksData');
    
    setInterval(() => {
        const currentMarkingsHash = getDataHash('controle_obra_markings');
        const currentWorksHash = getDataHash('worksData');
        
        if (currentMarkingsHash !== lastMarkingsHash || currentWorksHash !== lastWorksHash) {
             updateSyncStatus('syncing', 'Verificando dados...');
             
             const newMarkings = syncNewMarkings();
             updateWorksData();
             refreshWorksTable();
             
             lastMarkingsHash = currentMarkingsHash;
             lastWorksHash = currentWorksHash;
             
             if (newMarkings > 0) {
                 updateSyncStatus('success', 'Dados atualizados');
                 showSyncNotification(`🔄 ${newMarkings} nova(s) marcação(ões) detectada(s)!`, 'success');
             } else {
                 updateSyncStatus('success', 'Dados verificados');
             }
             
             // Voltar ao status normal após 3 segundos
             setTimeout(() => {
                 updateSyncStatus('success', 'Sincronizado');
             }, 3000);
         }
    }, 10000);
}

// Gerar hash dos dados para detectar mudanças
function getDataHash(key) {
    try {
        const data = localStorage.getItem(key) || '';
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    } catch (e) {
        return '0';
    }
}

// Sincronizar dados offline
function syncOfflineData() {
    if (!isOnline || syncInProgress || offlineQueue.length === 0) {
        if (!isOnline) {
            showNotification('Sem conexão com internet!', 'error');
        }
        return;
    }
    
    syncInProgress = true;
    const syncButton = document.getElementById('sync-offline');
    const controlPanel = document.getElementById('control-panel');
    
    // Adicionar animação de sincronização
    controlPanel.classList.add('syncing');
    syncButton.disabled = true;
    syncButton.innerHTML = '<span class="icon spinning">🔄</span>Sincronizando...';
    
    showNotification('Sincronizando dados offline...', 'success');
    
    // Simular sincronização (em um app real, enviaria para servidor)
    setTimeout(() => {
        try {
            // Processar fila offline
            offlineQueue.forEach(item => {
                if (item.action === 'create' || item.action === 'update') {
                    saveToLocalStorage(item);
                } else if (item.action === 'delete') {
                    removeFromLocalStorage(item.id);
                }
            });
            
            // Limpar fila offline
            offlineQueue = [];
            saveOfflineQueue();
            updateConnectionStatus();
            
            showNotification(`${offlineQueue.length || 'Todos os'} dados sincronizados com sucesso!`, 'success');
        } catch (error) {
            console.error('Erro na sincronização:', error);
            showNotification('Erro na sincronização. Tentando novamente...', 'error');
        } finally {
            syncInProgress = false;
            controlPanel.classList.remove('syncing');
            syncButton.disabled = false;
            syncButton.innerHTML = '<span class="icon">🔄</span>Sincronizar';
        }
    }, 2000);
}

// Limpar todos os dados
function clearAllData() {
    if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
        try {
            // Limpar mapa
            drawnItems.clearLayers();
            
            // Limpar localStorage
            localStorage.removeItem('controle_obra_markings');
            localStorage.removeItem('controle_obra_offline_queue');
            
            // Limpar fila offline
            offlineQueue = [];
            
            updateConnectionStatus();
            showNotification('Todos os dados foram limpos!', 'success');
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            showNotification('Erro ao limpar dados!', 'error');
        }
    }
}

// Configurar event listeners do modal
function setupModalEventListeners() {
    markingModal = document.getElementById('marking-modal');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-marking');
    const form = document.getElementById('marking-form');
    
    // Fechar modal
    closeBtn.addEventListener('click', closeMarkingModal);
    cancelBtn.addEventListener('click', closeMarkingModal);
    
    // Fechar modal clicando fora
    markingModal.addEventListener('click', function(e) {
        if (e.target === markingModal) {
            closeMarkingModal();
        }
    });
    
    // Submeter formulário
    form.addEventListener('submit', handleMarkingSubmit);
}

// Mostrar modal de marcação
function showMarkingModal(layerType) {
    const modal = document.getElementById('marking-modal');
    const title = modal.querySelector('.modal-header h3');
    
    title.textContent = `Nova Marcação - ${getLayerTypeName(layerType)}`;
    
    // Limpar formulário
    document.getElementById('marking-form').reset();
    
    // Mostrar modal
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Focar no primeiro campo
    setTimeout(() => {
        document.getElementById('os-number').focus();
    }, 300);
}

// Fechar modal de marcação
function closeMarkingModal() {
    const modal = document.getElementById('marking-modal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Remover camada se cancelar
    if (currentLayer && !currentLayer._popup) {
        // Camada não foi salva, remover do mapa
        if (map.hasLayer(currentLayer)) {
            map.removeLayer(currentLayer);
        }
    }
    
    currentLayer = null;
}

// Processar submissão do formulário
function handleMarkingSubmit(e) {
    e.preventDefault();
    
    if (!currentLayer) {
        showNotification('Erro: Nenhuma marcação selecionada!', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const markingData = {
        osNumber: formData.get('osNumber'),
        product: formData.get('product'),
        measurement: formData.get('measurement'),
        measurementUnit: formData.get('measurementUnit'),
        description: formData.get('description'),
        date: new Date().toLocaleString('pt-BR'),
        type: getLayerType(currentLayer)
    };
    
    // Criar popup com as informações
    const popupContent = createPopupContentWithData(markingData);
    currentLayer.bindPopup(popupContent);
    
    // Adicionar ao mapa
    drawnItems.addLayer(currentLayer);
    
    // Salvar marcação
    saveMarkingWithData(currentLayer, markingData);
    
    // Fechar modal
    closeMarkingModal();
    
    showNotification('Marcação salva com sucesso!', 'success');
}

// Criar conteúdo do popup com dados
function createPopupContentWithData(data) {
    return `
        <div class="popup-content">
            <div class="popup-header">
                <h3>📍 Informações da Marcação</h3>
            </div>
            <div class="popup-body">
                <div class="popup-field">
                    <strong>O.S.:</strong> ${data.osNumber}
                </div>
                <div class="popup-field">
                    <strong>Produto:</strong> ${data.product}
                </div>
                <div class="popup-field">
                    <strong>Medição:</strong> ${data.measurement} ${data.measurementUnit}
                </div>
                <div class="popup-field">
                    <strong>Descrição:</strong> ${data.description}
                </div>
                <div class="popup-field">
                    <strong>Data:</strong> ${data.date}
                </div>
                <div class="popup-field">
                    <strong>Tipo:</strong> ${getLayerTypeName(data.type)}
                </div>
            </div>
            <div class="popup-actions">
                <button onclick="centerOnUserLocation()" class="btn-center" title="Centralizar na minha localização">
                    📍 Minha localização
                </button>
            </div>
        </div>
    `;
}

// Obter nome do tipo de camada
function getLayerTypeName(type) {
    const types = {
        'marker': 'Marcador',
        'polyline': 'Linha',
        'polygon': 'Polígono',
        'rectangle': 'Retângulo',
        'circle': 'Círculo'
    };
    return types[type] || 'Desconhecido';
}

// Salvar marcação com dados
function saveMarkingWithData(layer, data) {
    // Extrair dados específicos do tipo de camada
    let coordinates = null;
    let radius = null;
    let bounds = null;
    
    if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        coordinates = { lat: center.lat, lng: center.lng };
        radius = layer.getRadius();
        console.log(`🔵 Salvando círculo: centro [${center.lat}, ${center.lng}], raio ${radius}`);
    } else if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        coordinates = { lat: latlng.lat, lng: latlng.lng };
        console.log(`📍 Salvando marcador: [${latlng.lat}, ${latlng.lng}]`);
    } else if (layer instanceof L.Polyline) {
        coordinates = layer.getLatLngs().map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`📏 Salvando linha com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Polygon) {
        coordinates = layer.getLatLngs()[0].map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
        console.log(`🔷 Salvando polígono com ${coordinates.length} pontos`);
    } else if (layer instanceof L.Rectangle) {
        const rectBounds = layer.getBounds();
        bounds = {
            southWest: { lat: rectBounds.getSouthWest().lat, lng: rectBounds.getSouthWest().lng },
            northEast: { lat: rectBounds.getNorthEast().lat, lng: rectBounds.getNorthEast().lng }
        };
        coordinates = [
            { lat: bounds.southWest.lat, lng: bounds.southWest.lng },
            { lat: bounds.northEast.lat, lng: bounds.northEast.lng }
        ];
        console.log(`⬜ Salvando retângulo: ${rectBounds.toString()}`);
    }
    
    const markingData = {
        id: generateId(),
        ...data,
        type: getLayerType(layer),
        coordinates: coordinates,
        radius: radius, // Preservar raio para círculos
        bounds: bounds, // Preservar bounds para retângulos
        data: layerToGeoJSON(layer),
        timestamp: new Date().toISOString(),
        action: 'create',
        // Preservar dados da camada para recriação fiel
        layerData: extractLayerData(layer),
        // Preservar propriedades visuais
        visualProperties: extractVisualProperties(layer)
    };
    
    // Adicionar ID à camada para referência futura
    layer._markingId = markingData.id;
    
    console.log(`💾 Salvando marcação ${markingData.id} do tipo ${markingData.type}:`, markingData);
    
    if (isOnline) {
        saveToLocalStorage(markingData);
        
        // Sincronizar imediatamente com Supabase se disponível
        if (window.supabaseConfig && window.supabaseConfig.saveMarkings) {
            setTimeout(async () => {
                try {
                    console.log(`🔄 Sincronizando marcação ${markingData.id} com Supabase:`, markingData);
                    await window.supabaseConfig.saveMarkings([markingData]);
                    console.log(`✅ Marcação ${markingData.id} sincronizada com Supabase`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao sincronizar marcação ${markingData.id}:`, error);
                }
            }, 1000);
        }
    } else {
        offlineQueue.push(markingData);
        saveOfflineQueue();
        updateConnectionStatus();
    }
}

// Obter coordenadas da camada
function getLayerCoordinates(layer) {
    if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        return { lat: latlng.lat, lng: latlng.lng };
    } else if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        return { lat: center.lat, lng: center.lng, radius: layer.getRadius() };
    } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        return { lat: center.lat, lng: center.lng };
    } else if (layer instanceof L.Polyline) {
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        return { lat: center.lat, lng: center.lng };
    }
    return null;
}

// Configurar event listeners de geolocalização
function setupGeolocationEventListeners() {
    const locationBtn = document.getElementById('location-toggle');
    if (locationBtn) {
        locationBtn.addEventListener('click', toggleLocationTracking);
    }
    
    const devicesBtn = document.getElementById('devices-toggle');
    if (devicesBtn) {
        devicesBtn.addEventListener('click', toggleDeviceTracking);
    }
    
    // Event listeners para sincronização manual e offline
    const manualSyncPC = document.getElementById('manual-sync-pc');
    if (manualSyncPC) {
        manualSyncPC.addEventListener('click', manualSync);
    }
    
    const forceSyncTest = document.getElementById('force-sync-test');
    if (forceSyncTest) {
        forceSyncTest.addEventListener('click', forceSyncNow);
    }
    
    const debugMarkingsBtn = document.getElementById('debug-markings');
    if (debugMarkingsBtn) {
        debugMarkingsBtn.addEventListener('click', debugMarkings);
    }
    
    const clearOldMarkingsBtn = document.getElementById('clear-old-markings');
    if (clearOldMarkingsBtn) {
        clearOldMarkingsBtn.addEventListener('click', clearOldMarkings);
    }
    
    const debugSupabaseBtn = document.getElementById('debug-supabase');
    if (debugSupabaseBtn) {
        debugSupabaseBtn.addEventListener('click', debugSupabaseData);
    }
    
    const testCircleBtn = document.getElementById('test-circle');
    if (testCircleBtn) {
        testCircleBtn.addEventListener('click', testCircleCreation);
    }
    
    const testAllShapesBtn = document.getElementById('test-all-shapes');
    if (testAllShapesBtn) {
        testAllShapesBtn.addEventListener('click', testAllShapes);
    }
    
    const downloadOffline = document.getElementById('download-offline-pwa');
    if (downloadOffline) {
        downloadOffline.addEventListener('click', downloadOfflineData);
    }
    
    const uploadOffline = document.getElementById('upload-offline-pwa');
    if (uploadOffline) {
        uploadOffline.addEventListener('click', uploadOfflineData);
    }
}

// Alternar rastreamento de localização
function toggleLocationTracking() {
    if (isTrackingLocation) {
        stopLocationTracking();
    } else {
        startLocationTracking();
    }
}

// Alternar rastreamento de dispositivos
function toggleDeviceTracking() {
    if (isTrackingDevices) {
        stopDeviceTracking();
    } else {
        startDeviceTracking();
    }
}

// Iniciar rastreamento de dispositivos
function startDeviceTracking() {
    if (!window.supabaseConfig || !window.supabaseConfig.supabaseClient) {
        showNotification('Supabase não disponível para rastreamento de dispositivos', 'error');
        return;
    }
    
    isTrackingDevices = true;
    
    // Carregar localizações iniciais
    loadDeviceLocations();
    
    // Atualizar a cada 30 segundos
    const deviceInterval = setInterval(() => {
        if (isTrackingDevices) {
            loadDeviceLocations();
        } else {
            clearInterval(deviceInterval);
        }
    }, 30000);
    
    // Atualizar botão
    const devicesBtn = document.getElementById('devices-toggle');
    if (devicesBtn) {
        devicesBtn.classList.add('active');
        devicesBtn.innerHTML = '📱 Ocultar Dispositivos';
    }
    
    showNotification('Rastreamento de dispositivos ativado!', 'success');
}

// Parar rastreamento de dispositivos
function stopDeviceTracking() {
    isTrackingDevices = false;
    
    // Remover marcadores dos dispositivos
    Object.values(deviceMarkers).forEach(marker => {
        map.removeLayer(marker);
    });
    deviceMarkers = {};
    
    // Atualizar botão
    const devicesBtn = document.getElementById('devices-toggle');
    if (devicesBtn) {
        devicesBtn.classList.remove('active');
        devicesBtn.innerHTML = '📱 Dispositivos Online';
    }
    
    showNotification('Rastreamento de dispositivos desativado!', 'info');
}

// ==============================================
// SISTEMA DE SINCRONIZAÇÃO MANUAL E OFFLINE
// ==============================================

// Função para mostrar status de sincronização
function showSyncStatus(message, type = 'syncing') {
    const status = document.getElementById('sync-status');
    const text = document.getElementById('sync-status-text');
    
    if (status && text) {
        text.textContent = message;
        status.className = `sync-status ${type}`;
        status.style.display = 'block';
        
        // Auto-hide após 3 segundos (exceto para erros)
        if (type !== 'error') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }
}

// Função para sincronização manual (modo PC)
async function manualSync() {
    const button = document.getElementById('manual-sync-pc');
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
    }
    
    try {
        showSyncStatus('🔄 Sincronizando manualmente...', 'syncing');
        
        if (window.supabaseConfig && navigator.onLine) {
            await autoSyncWithSupabase();
            showSyncStatus('✅ Sincronização concluída!', 'success');
        } else {
            showSyncStatus('❌ Sem conexão com internet', 'error');
        }
    } catch (error) {
        console.error('❌ Erro na sincronização manual:', error);
        showSyncStatus('❌ Erro na sincronização', 'error');
    } finally {
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
}

// Função para baixar dados para modo offline (PWA)
async function downloadOfflineData() {
    const button = document.getElementById('download-offline-pwa');
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
    }
    
    try {
        showSyncStatus('📥 Baixando dados para offline...', 'syncing');
        
        if (window.supabaseConfig && navigator.onLine) {
            // Baixar todas as marcações do servidor
            const result = await window.supabaseConfig.loadMarkings();
            if (result.success) {
                // Salvar no localStorage para uso offline
                localStorage.setItem('controle_obra_markings', JSON.stringify(result.markings));
                localStorage.setItem('controle_obra_offline_sync', Date.now().toString());
                
                isOfflineMode = true;
                showSyncStatus(`✅ ${result.markings.length} marcações baixadas!`, 'success');
                
                // Atualizar contador offline
                updateOfflineCounter();
            } else {
                showSyncStatus('❌ Erro ao baixar dados', 'error');
            }
        } else {
            showSyncStatus('❌ Sem conexão com internet', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao baixar dados offline:', error);
        showSyncStatus('❌ Erro ao baixar dados', 'error');
    } finally {
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
}

// Função para enviar dados quando voltar online (PWA)
async function uploadOfflineData() {
    const button = document.getElementById('upload-offline-pwa');
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
    }
    
    try {
        showSyncStatus('📤 Enviando dados offline...', 'syncing');
        
        if (window.supabaseConfig && navigator.onLine) {
            // Carregar dados locais
            const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
            
            if (localMarkings.length > 0) {
                // Enviar para o servidor
                const result = await window.supabaseConfig.saveMarkings(localMarkings);
                if (result.success) {
                    // Limpar fila offline
                    offlineQueue = [];
                    localStorage.removeItem('controle_obra_offline_queue');
                    
                    isOfflineMode = false;
                    showSyncStatus(`✅ ${localMarkings.length} marcações enviadas!`, 'success');
                    
                    // Atualizar contador offline
                    updateOfflineCounter();
                } else {
                    showSyncStatus('❌ Erro ao enviar dados', 'error');
                }
            } else {
                showSyncStatus('ℹ️ Nenhum dado para enviar', 'success');
            }
        } else {
            showSyncStatus('❌ Sem conexão com internet', 'error');
        }
    } catch (error) {
        console.error('❌ Erro ao enviar dados offline:', error);
        showSyncStatus('❌ Erro ao enviar dados', 'error');
    } finally {
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
}

// Função para adicionar item à fila offline
function addToOfflineQueue(action, data) {
    const queueItem = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action: action, // 'save', 'delete'
        data: data,
        timestamp: Date.now()
    };
    
    offlineQueue.push(queueItem);
    localStorage.setItem('controle_obra_offline_queue', JSON.stringify(offlineQueue));
    
    updateOfflineCounter();
    console.log(`📝 Item adicionado à fila offline: ${action}`, queueItem);
}

// Função para processar fila offline
async function processOfflineQueue() {
    if (offlineQueue.length === 0 || !navigator.onLine || !window.supabaseConfig) {
        return;
    }
    
    try {
        showSyncStatus(`🔄 Processando ${offlineQueue.length} itens offline...`, 'syncing');
        
        for (const item of offlineQueue) {
            if (item.action === 'save') {
                await window.supabaseConfig.saveMarkings([item.data]);
            } else if (item.action === 'delete') {
                await window.supabaseConfig.deleteMarking(item.data.id);
            }
        }
        
        // Limpar fila após processamento
        offlineQueue = [];
        localStorage.removeItem('controle_obra_offline_queue');
        
        showSyncStatus('✅ Fila offline processada!', 'success');
        updateOfflineCounter();
        
    } catch (error) {
        console.error('❌ Erro ao processar fila offline:', error);
        showSyncStatus('❌ Erro ao processar fila offline', 'error');
    }
}

// Função para atualizar contador offline
function updateOfflineCounter() {
    const count = offlineQueue.length;
    const uploadButton = document.getElementById('upload-offline-pwa');
    
    if (uploadButton) {
        // Remover contador existente
        const existingCounter = uploadButton.querySelector('.offline-counter');
        if (existingCounter) {
            existingCounter.remove();
        }
        
        // Adicionar novo contador se houver itens
        if (count > 0) {
            const counter = document.createElement('span');
            counter.className = 'offline-counter';
            counter.textContent = count;
            uploadButton.style.position = 'relative';
            uploadButton.appendChild(counter);
        }
    }
}

// Função para detectar modo PWA
function isPWAMode() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true || 
           document.referrer.includes('android-app://');
}

// Função para configurar botões baseado no modo
function setupModeButtons() {
    const isPWA = isPWAMode();
    
    // Botões do modo PC
    const manualSyncPC = document.getElementById('manual-sync-pc');
    if (manualSyncPC) {
        manualSyncPC.style.display = !isPWA ? 'flex' : 'none';
    }
    
    // Botões do modo PWA
    const downloadOffline = document.getElementById('download-offline-pwa');
    const uploadOffline = document.getElementById('upload-offline-pwa');
    
    if (downloadOffline) {
        downloadOffline.style.display = isPWA ? 'flex' : 'none';
    }
    if (uploadOffline) {
        uploadOffline.style.display = isPWA ? 'flex' : 'none';
    }
    
    // Verificar se já está em modo offline
    const lastSync = localStorage.getItem('controle_obra_offline_sync');
    if (lastSync && isPWA) {
        const timeSinceSync = Date.now() - parseInt(lastSync);
        if (timeSinceSync > 300000) { // 5 minutos
            isOfflineMode = true;
            showSyncStatus('📱 Modo offline ativo', 'offline');
        }
    }
    
    // Carregar fila offline
    const savedQueue = localStorage.getItem('controle_obra_offline_queue');
    if (savedQueue) {
        offlineQueue = JSON.parse(savedQueue);
        updateOfflineCounter();
    }
}

// Iniciar rastreamento de localização
function startLocationTracking() {
    if (!navigator.geolocation) {
        showNotification('Geolocalização não é suportada neste navegador!', 'error');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
    };
    
    // Obter localização inicial
    navigator.geolocation.getCurrentPosition(
        (position) => {
            updateUserLocation(position);
            showNotification('Localização ativada!', 'success');
        },
        (error) => {
            handleLocationError(error);
        },
        options
    );
    
    // Iniciar rastreamento contínuo
    watchId = navigator.geolocation.watchPosition(
        updateUserLocation,
        handleLocationError,
        options
    );
    
    isTrackingLocation = true;
    updateLocationButton();
}

// Parar rastreamento de localização
function stopLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
    
    isTrackingLocation = false;
    updateLocationButton();
    showNotification('Localização desativada!', 'info');
}

// Atualizar localização do usuário
async function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    // Enviar localização para o Supabase
    await sendLocationToSupabase(lat, lng);
    
    // Remover marcador anterior se existir
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    
    // Criar ícone personalizado para localização
    const locationIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div class="location-dot"><div class="location-pulse"></div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Criar novo marcador
    userLocationMarker = L.marker([lat, lng], {
        icon: locationIcon,
        zIndexOffset: 1000
    }).addTo(map);
    
    // Adicionar popup com informações
    const popupContent = `
        <div class="popup-content">
            <h4>📍 Sua Localização</h4>
            <p><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
            <p><strong>Precisão:</strong> ±${Math.round(accuracy)}m</p>
            <p><strong>Atualizado:</strong> ${new Date().toLocaleTimeString('pt-BR')}</p>
            <button onclick="centerOnUserLocation()" class="center-btn">🎯 Centralizar</button>
        </div>
    `;
    
    userLocationMarker.bindPopup(popupContent);
    
    // Centralizar mapa na primeira localização
    if (!map.getBounds().contains([lat, lng])) {
        map.setView([lat, lng], 16);
    }
}

// Centralizar mapa na localização do usuário
function centerOnUserLocation() {
    if (userLocationMarker) {
        const latlng = userLocationMarker.getLatLng();
        map.setView(latlng, 16);
        showNotification('Mapa centralizado na sua localização!', 'success');
    }
}

// Configurar event listeners para gerenciamento de obras
function setupWorksManagementEventListeners() {
    const manageWorksBtn = document.getElementById('manage-works');
    const worksModalElement = document.getElementById('works-modal');
    const closeWorksModalBtn = document.querySelector('.modal-close');
    const clearWorksBtn = document.getElementById('clear-all-works');
    const osFilterInput = document.getElementById('search-works');
    const refreshWorksBtn = document.getElementById('refresh-works');
    const exportAllWorksBtn = document.getElementById('export-all-works');
    
    worksModal = worksModalElement;
    
    if (manageWorksBtn) {
        manageWorksBtn.addEventListener('click', openWorksModal);
    }
    
    if (closeWorksModalBtn) {
        closeWorksModalBtn.addEventListener('click', closeWorksModal);
    }
    
    if (clearWorksBtn) {
        clearWorksBtn.addEventListener('click', clearAllWorks);
    }

    if (osFilterInput) {
        osFilterInput.addEventListener('input', filterWorksTable);
    }

    if (refreshWorksBtn) {
        refreshWorksBtn.addEventListener('click', function() {
            updateWorksData();
            refreshWorksTable();
        });
    }

    if (exportAllWorksBtn) {
        exportAllWorksBtn.addEventListener('click', function() {
            exportToKMZ();
        });
    }
    
    // Event listener para limpar todas as importações
    const clearImportedBtn = document.getElementById('clear-imported-markings');
    if (clearImportedBtn) {
        clearImportedBtn.addEventListener('click', clearAllImportedMarkings);
    }
    
    // Fechar modal clicando fora
    if (worksModalElement) {
        worksModalElement.addEventListener('click', function(e) {
            if (e.target === worksModalElement) {
                closeWorksModal();
            }
        });
    }
}

// Abrir modal de gerenciamento de obras
function openWorksModal() {
    if (worksModal) {
        updateWorksData();
        refreshWorksTable();
        loadImportedMarkings();
        refreshImportedTable();
        worksModal.classList.add('show');
    }
}

// Fechar modal de gerenciamento de obras
function closeWorksModal() {
    if (worksModal) {
        worksModal.classList.remove('show');
    }
}

// Carregar marcações importadas
function loadImportedMarkings() {
    try {
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const importedFiles = {};
        
        // Agrupar marcações por arquivo de origem
        markings.forEach(marking => {
            if (marking.properties && marking.properties.source === 'upload' && marking.properties.fileName) {
                const fileName = marking.properties.fileName;
                if (!importedFiles[fileName]) {
                    importedFiles[fileName] = {
                        fileName: fileName,
                        markings: [],
                        uploadedAt: marking.properties.uploadedAt || Date.now()
                    };
                }
                importedFiles[fileName].markings.push(marking);
            }
        });
        
        return Object.values(importedFiles);
    } catch (error) {
        console.error('Erro ao carregar marcações importadas:', error);
        return [];
    }
}

// Atualizar tabela de marcações importadas
function refreshImportedTable() {
    const importedFiles = loadImportedMarkings();
    const tableBody = document.getElementById('imported-table-body');
    const totalFilesSpan = document.getElementById('total-imported-files');
    const totalMarkingsSpan = document.getElementById('total-imported-markings');
    
    if (!tableBody || !totalFilesSpan || !totalMarkingsSpan) return;
    
    // Atualizar resumo
    const totalMarkings = importedFiles.reduce((sum, file) => sum + file.markings.length, 0);
    totalFilesSpan.textContent = importedFiles.length;
    totalMarkingsSpan.textContent = totalMarkings;
    
    // Limpar tabela
    tableBody.innerHTML = '';
    
    if (importedFiles.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="4" style="text-align: center; color: #666; padding: 20px;">
                📁 Nenhum arquivo KMZ importado
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    // Adicionar linhas da tabela
    importedFiles.forEach(file => {
        const row = document.createElement('tr');
        row.className = 'imported-file-row';
        
        const uploadDate = new Date(file.uploadedAt).toLocaleString('pt-BR');
        
        row.innerHTML = `
            <td>
                <strong>📁 ${file.fileName}</strong>
            </td>
            <td>
                <span class="badge">${file.markings.length}</span>
            </td>
            <td>${uploadDate}</td>
            <td>
                <button class="delete-imported-btn" onclick="deleteImportedFile('${file.fileName}')">
                    🗑️ Excluir
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Carregar dados de obras do localStorage
function loadWorksData() {
    try {
        const saved = localStorage.getItem('worksData');
        if (saved) {
            worksData = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Erro ao carregar dados de obras:', error);
        worksData = {};
    }
}

// Salvar dados de obras no localStorage
function saveWorksData() {
    try {
        localStorage.setItem('worksData', JSON.stringify(worksData));
    } catch (error) {
        console.error('Erro ao salvar dados de obras:', error);
    }
}

// Atualizar dados de obras com base nas marcações atuais
function updateWorksData() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const newWorksData = {};
    
    markings.forEach(marking => {
        if (marking.osNumber) {
            const osNumber = marking.osNumber;
            
            if (!newWorksData[osNumber]) {
                newWorksData[osNumber] = {
                    product: marking.product || 'Produto não especificado',
                    markings: [],
                    lastUpdate: new Date().toLocaleString('pt-BR')
                };
            }
            
            newWorksData[osNumber].markings.push(marking);
            
            // Atualizar produto se não estiver definido
            if (marking.product && newWorksData[osNumber].product === 'Produto não especificado') {
                newWorksData[osNumber].product = marking.product;
            }
        }
    });
    
    worksData = newWorksData;
    saveWorksData();
}

// Atualizar tabela de obras
function refreshWorksTable() {
    const tbody = document.querySelector('#works-table tbody');
    const totalWorksElement = document.getElementById('total-works');
    const totalMarkingsElement = document.getElementById('total-markings');
    
    if (!tbody || !totalWorksElement || !totalMarkingsElement) return;
    
    // Limpar tabela
    tbody.innerHTML = '';
    
    const osNumbers = Object.keys(worksData).sort();
    let totalMarkings = 0;
    
    osNumbers.forEach(osNumber => {
        const work = worksData[osNumber];
        const markingsCount = work.markings.length;
        totalMarkings += markingsCount;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${osNumber}</td>
            <td>${work.product}</td>
            <td><span class="markings-count">${markingsCount}</span></td>
            <td>${work.lastUpdate}</td>
            <td class="actions">
                <button onclick="downloadWorkKMZ('${osNumber}')" class="btn-action" title="Baixar KMZ">
                    📁 KMZ
                </button>
                <button onclick="downloadWorkExcel('${osNumber}')" class="btn-action" title="Baixar Excel">
                    📊 Excel
                </button>
                <button onclick="viewWorkOnMap('${osNumber}')" class="btn-action" title="Ver no Mapa">
                    🗺️ Ver
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Atualizar resumo
    totalWorksElement.textContent = osNumbers.length;
    totalMarkingsElement.textContent = totalMarkings;
}

// Filtrar tabela de obras
function filterWorksTable() {
    const filter = document.getElementById('search-works').value.toLowerCase();
    const rows = document.querySelectorAll('#works-table tbody tr');
    
    rows.forEach(row => {
        const osNumber = row.cells[0].textContent.toLowerCase();
        const product = row.cells[1].textContent.toLowerCase();
        
        if (osNumber.includes(filter) || product.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Visualizar obra no mapa
function viewWorkOnMap(osNumber) {
    const work = worksData[osNumber];
    if (!work || work.markings.length === 0) {
        showNotification('Nenhuma marcação encontrada para esta obra', 'error');
        return;
    }
    
    // Fechar modal
    closeWorksModal();
    
    // Criar bounds para centralizar no mapa
    const bounds = L.latLngBounds();
    let foundMarkings = 0;
    
    // Encontrar marcações no mapa
    drawnItems.eachLayer(layer => {
        const popup = layer.getPopup();
        if (popup) {
            const content = popup.getContent();
            if (content && content.includes(`O.S.: ${osNumber}`)) {
                if (layer.getLatLng) {
                    bounds.extend(layer.getLatLng());
                } else if (layer.getBounds) {
                    bounds.extend(layer.getBounds());
                }
                foundMarkings++;
            }
        }
    });
    
    if (foundMarkings > 0) {
        map.fitBounds(bounds, { padding: [20, 20] });
        showNotification(`Visualizando ${foundMarkings} marcação(ões) da O.S. ${osNumber}`, 'success');
    } else {
        showNotification('Marcações não encontradas no mapa atual', 'error');
    }
}

// Baixar KMZ da obra
function downloadWorkKMZ(osNumber) {
    const work = worksData[osNumber];
    if (!work || work.markings.length === 0) {
        showNotification('Nenhuma marcação encontrada para esta obra', 'error');
        return;
    }
    
    try {
        // Criar KML apenas com marcações desta obra
        let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>Obra ${osNumber} - ${work.product}</name>
<description>Marcações da obra ${osNumber}</description>
`;
        
        work.markings.forEach((marking, index) => {
            const coords = marking.coordinates;
            if (coords) {
                kmlContent += `<Placemark>
<name>Marcação ${index + 1}</name>
<description><![CDATA[
O.S.: ${marking.osNumber}<br/>
Produto: ${marking.product}<br/>
Medição: ${marking.measurement} ${marking.measurementUnit}<br/>
Descrição: ${marking.description}<br/>
Data: ${marking.date}
]]></description>
`;
                
                if (marking.type === 'marker') {
                    kmlContent += `<Point><coordinates>${coords.lng},${coords.lat}</coordinates></Point>
`;
                } else if (marking.type === 'circle') {
                    kmlContent += `<Point><coordinates>${coords.lng},${coords.lat}</coordinates></Point>
`;
                }
                
                kmlContent += `</Placemark>
`;
            }
        });
        
        kmlContent += `</Document>
</kml>`;
        
        // Criar e baixar arquivo KMZ
        const zip = new JSZip();
        zip.file('doc.kml', kmlContent);
        
        zip.generateAsync({ type: 'blob' }).then(function(content) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Obra_${osNumber}_${work.product.replace(/[^a-zA-Z0-9]/g, '_')}.kmz`;
            link.click();
            
            showNotification(`KMZ da obra ${osNumber} baixado com sucesso!`, 'success');
        });
        
    } catch (error) {
        console.error('Erro ao gerar KMZ:', error);
        showNotification('Erro ao gerar arquivo KMZ', 'error');
    }
}

// Baixar Excel da obra
function downloadWorkExcel(osNumber) {
    const work = worksData[osNumber];
    if (!work || work.markings.length === 0) {
        showNotification('Nenhuma marcação encontrada para esta obra', 'error');
        return;
    }
    
    try {
        // Preparar dados para Excel
        const data = work.markings.map((marking, index) => ({
            'Nº': index + 1,
            'O.S.': marking.osNumber,
            'Produto': marking.product,
            'Tipo': getLayerTypeFriendlyName(marking.type),
            'Medição': marking.measurement,
            'Unidade': marking.measurementUnit,
            'Descrição': marking.description,
            'Data': marking.date,
            'Latitude': marking.coordinates ? marking.coordinates.lat : '',
            'Longitude': marking.coordinates ? marking.coordinates.lng : ''
        }));
        
        // Criar CSV (compatível com Excel)
        const headers = Object.keys(data[0]);
        let csvContent = '\uFEFF' + headers.join(';') + '\n'; // BOM para UTF-8
        
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] || '';
                // Escapar aspas e adicionar aspas se contém ponto e vírgula
                return value.toString().includes(';') ? `"${value.toString().replace(/"/g, '""')}"` : value;
            });
            csvContent += values.join(';') + '\n';
        });
        
        // Baixar arquivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Obra_${osNumber}_${work.product.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        link.click();
        
        showNotification(`Excel da obra ${osNumber} baixado com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao gerar Excel:', error);
        showNotification('Erro ao gerar arquivo Excel', 'error');
    }
}

// Limpar todas as obras
function clearAllWorks() {
    if (confirm('Tem certeza que deseja limpar todas as obras? Esta ação não pode ser desfeita.')) {
        worksData = {};
        saveWorksData();
        refreshWorksTable();
        showNotification('Todas as obras foram removidas', 'success');
    }
}

// Tratar erros de geolocalização
function handleLocationError(error) {
    let message = 'Erro ao obter localização: ';
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            message += 'Permissão negada pelo usuário.';
            break;
        case error.POSITION_UNAVAILABLE:
            message += 'Localização indisponível.';
            break;
        case error.TIMEOUT:
            message += 'Tempo limite excedido.';
            break;
        default:
            message += 'Erro desconhecido.';
            break;
    }
    
    showNotification(message, 'error');
    
    // Parar rastreamento em caso de erro
    if (isTrackingLocation) {
        stopLocationTracking();
    }
}

// Atualizar botão de localização
function updateLocationButton() {
    const locationBtn = document.getElementById('location-toggle');
    if (locationBtn) {
        if (isTrackingLocation) {
            locationBtn.classList.add('active');
            locationBtn.innerHTML = '📍 Parar Localização';
            locationBtn.title = 'Parar rastreamento de localização';
        } else {
            locationBtn.classList.remove('active');
            locationBtn.innerHTML = '📍 Minha Localização';
            locationBtn.title = 'Ativar rastreamento de localização';
        }
    }
}

// Configurar menu mobile
function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarClose = document.getElementById('sidebar-close');
    
    if (menuToggle && sidebar && sidebarOverlay && sidebarClose) {
        // Abrir menu
        menuToggle.addEventListener('click', function() {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
            menuToggle.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        // Fechar menu - botão X
        sidebarClose.addEventListener('click', closeMobileMenu);
        
        // Fechar menu - overlay
        sidebarOverlay.addEventListener('click', closeMobileMenu);
        
        // Fechar menu - tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar.classList.contains('active')) {
                closeMobileMenu();
            }
        });
    }
}

// Fechar menu mobile
function closeMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebar && sidebarOverlay && menuToggle) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Função global para centralizar (chamada do popup)
window.centerOnUserLocation = centerOnUserLocation;

// ===== FUNÇÕES DE SINCRONIZAÇÃO COM SERVIDOR =====

// Sincronizar dados locais com o servidor
async function syncWithServer() {
    try {
        const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const localWorks = JSON.parse(localStorage.getItem('worksData') || '{}');
        
        const response = await fetch('/.netlify/functions/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    markings: localMarkings,
                    works: localWorks
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Atualizar dados locais com os dados sincronizados
            localStorage.setItem('controle_obra_markings', JSON.stringify(result.data.markings));
            localStorage.setItem('worksData', JSON.stringify(result.data.works));
            
            return {
                success: true,
                message: result.message
            };
        } else {
            throw new Error(result.error || 'Erro na sincronização');
        }
    } catch (error) {
        console.error('Erro ao sincronizar com servidor:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Carregar dados do servidor
async function loadDataFromServer(silent = false) {
    try {
        const response = await fetch('/.netlify/functions/markings');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const serverData = await response.json();
        
        // Verificar se há dados novos
        const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const localWorks = JSON.parse(localStorage.getItem('worksData') || '{}');
        
        const hasNewMarkings = serverData.markings && serverData.markings.length !== localMarkings.length;
        const hasNewWorks = serverData.works && JSON.stringify(serverData.works) !== JSON.stringify(localWorks);
        
        if (hasNewMarkings || hasNewWorks) {
            // Atualizar localStorage com dados do servidor
            if (serverData.markings) {
                localStorage.setItem('controle_obra_markings', JSON.stringify(serverData.markings));
            }
            if (serverData.works) {
                localStorage.setItem('worksData', JSON.stringify(serverData.works));
            }
            
            // Recarregar marcações no mapa
            drawnItems.clearLayers();
            const newMarkings = syncNewMarkings();
            updateWorksData();
            refreshWorksTable();
            
            if (!silent && newMarkings > 0) {
                updateSyncStatus('success', 'Dados atualizados');
                showSyncNotification(`🌐 ${newMarkings} nova(s) marcação(ões) do servidor!`, 'success');
                
                setTimeout(() => {
                    updateSyncStatus('success', 'Sincronizado');
                }, 3000);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao carregar dados do servidor:', error);
        if (!silent) {
            updateSyncStatus('error', 'Erro ao carregar dados');
        }
        return false;
    }
}

// Sincronização automática silenciosa
async function autoSyncWithServer() {
    try {
        const result = await syncWithServer();
        if (result.success) {
            console.log('Auto-sincronização concluída:', result.message);
        }
    } catch (error) {
        console.error('Erro na auto-sincronização:', error);
    }
}

// Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registrado com sucesso:', registration.scope);
                
                // Verificar se há atualizações
                registration.addEventListener('updatefound', function() {
                    console.log('Nova versão do Service Worker encontrada!');
                    const newWorker = registration.installing;
                    
                    newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Nova versão instalada, recarregando...');
                            // Forçar recarregamento para aplicar nova versão
                            window.location.reload();
                        }
                    });
                });
                
                // Forçar verificação de atualizações
                registration.update();
            })
            .catch(function(error) {
                console.log('Falha ao registrar ServiceWorker:', error);
            });
    });
}
