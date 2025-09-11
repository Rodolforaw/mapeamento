// ==============================================
// SISTEMA SIMPLIFICADO - CONTROLE DE OBRA
// Versão limpa e direta
// ==============================================

// Variáveis globais
let map;
let drawnItems;
let currentMode = 'polygon';
let isOnline = navigator.onLine;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    loadMarkings();
    updateConnectionStatus();
});

// Inicializar mapa
function initializeMap() {
    map = L.map('map').setView([-22.9077, -42.8226], 13);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Leaflet | Esri, Maxar, Earthstar Geographics, Esri'
    }).addTo(map);
    
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Ferramentas de desenho
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            remove: true
        },
        draw: {
            polygon: true,
            polyline: true,
            circle: true,
            marker: true,
            rectangle: false
        }
    });
    map.addControl(drawControl);
    
    // Eventos de desenho
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        const type = event.layerType;
        saveMarking(layer, type);
    });
    
    map.on(L.Draw.Event.EDITED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            updateMarking(layer);
        });
    });
    
    map.on(L.Draw.Event.DELETED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            deleteMarking(layer);
        });
    });
}

// Configurar eventos
function setupEventListeners() {
    // Botão de sincronização (PC)
    const syncBtn = document.getElementById('manual-sync-pc');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncMarkings);
    }
    
    // Botões PWA
    const downloadBtn = document.getElementById('download-offline-pwa');
    const uploadBtn = document.getElementById('upload-offline-pwa');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadData);
    }
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadData);
    }
    
    // Status de conexão
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
    });
}

// Salvar marcação
function saveMarking(layer, type) {
    const marking = {
        id: generateId(),
        type: type,
        coordinates: getLayerCoordinates(layer),
        properties: {
            name: `Marcação ${type}`,
            timestamp: Date.now()
        },
        timestamp: Date.now()
    };
    
    layer._markingId = marking.id;
    drawnItems.addLayer(layer);
    
    // Salvar no localStorage
    saveToLocalStorage(marking);
    
    // Sincronizar se online
    if (isOnline) {
        syncToSupabase(marking);
    }
    
    showNotification('Marcação salva!', 'success');
}

// Atualizar marcação
function updateMarking(layer) {
    const markingId = layer._markingId;
    if (!markingId) return;
    
    const marking = {
        id: markingId,
        type: getLayerType(layer),
        coordinates: getLayerCoordinates(layer),
        properties: {
            name: `Marcação ${getLayerType(layer)}`,
            timestamp: Date.now()
        },
        timestamp: Date.now()
    };
    
    // Atualizar no localStorage
    updateInLocalStorage(marking);
    
    // Sincronizar se online
    if (isOnline) {
        syncToSupabase(marking);
    }
    
    showNotification('Marcação atualizada!', 'success');
}

// Deletar marcação
function deleteMarking(layer) {
    const markingId = layer._markingId;
    if (!markingId) return;
    
    // Remover do localStorage
    removeFromLocalStorage(markingId);
    
    // Sincronizar se online
    if (isOnline) {
        deleteFromSupabase(markingId);
    }
    
    showNotification('Marcação removida!', 'success');
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
        const latlngs = layer.getLatLngs()[0];
        return latlngs.map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
    } else if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs();
        return latlngs.map(latlng => ({ lat: latlng.lat, lng: latlng.lng }));
    }
    return null;
}

// Obter tipo da camada
function getLayerType(layer) {
    if (layer instanceof L.Marker) return 'marker';
    if (layer instanceof L.Circle) return 'circle';
    if (layer instanceof L.Polygon || layer instanceof L.Rectangle) return 'polygon';
    if (layer instanceof L.Polyline) return 'polyline';
    return 'unknown';
}

// Gerar ID único
function generateId() {
    return 'marking_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Salvar no localStorage
function saveToLocalStorage(marking) {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const existingIndex = markings.findIndex(item => item.id === marking.id);
    
    if (existingIndex >= 0) {
        markings[existingIndex] = marking;
    } else {
        markings.push(marking);
    }
    
    localStorage.setItem('controle_obra_markings', JSON.stringify(markings));
}

// Atualizar no localStorage
function updateInLocalStorage(marking) {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const index = markings.findIndex(item => item.id === marking.id);
    
    if (index >= 0) {
        markings[index] = marking;
        localStorage.setItem('controle_obra_markings', JSON.stringify(markings));
    }
}

// Remover do localStorage
function removeFromLocalStorage(markingId) {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const filtered = markings.filter(item => item.id !== markingId);
    localStorage.setItem('controle_obra_markings', JSON.stringify(filtered));
}

// Carregar marcações
function loadMarkings() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    
    markings.forEach(marking => {
        const layer = createLayerFromMarking(marking);
        if (layer) {
            layer._markingId = marking.id;
            drawnItems.addLayer(layer);
        }
    });
    
    console.log(`Carregadas ${markings.length} marcações`);
}

// Criar layer a partir da marcação
function createLayerFromMarking(marking) {
    try {
        if (marking.type === 'marker') {
            return L.marker([marking.coordinates.lat, marking.coordinates.lng]);
        } else if (marking.type === 'circle') {
            return L.circle([marking.coordinates.lat, marking.coordinates.lng], {
                radius: marking.coordinates.radius || 100
            });
        } else if (marking.type === 'polygon') {
            const coords = marking.coordinates.map(coord => [coord.lat, coord.lng]);
            return L.polygon(coords);
        } else if (marking.type === 'polyline') {
            const coords = marking.coordinates.map(coord => [coord.lat, coord.lng]);
            return L.polyline(coords);
        }
    } catch (error) {
        console.error('Erro ao criar layer:', error);
    }
    return null;
}

// Sincronizar com Supabase
async function syncToSupabase(marking) {
    if (!window.supabaseConfig) return;
    
    try {
        await window.supabaseConfig.saveMarkings([marking]);
        console.log('Marcação sincronizada com Supabase');
    } catch (error) {
        console.error('Erro ao sincronizar:', error);
    }
}

// Deletar do Supabase
async function deleteFromSupabase(markingId) {
    if (!window.supabaseConfig) return;
    
    try {
        await window.supabaseConfig.deleteMarking(markingId);
        console.log('Marcação removida do Supabase');
    } catch (error) {
        console.error('Erro ao deletar:', error);
    }
}

// Sincronizar marcações (PC)
async function syncMarkings() {
    if (!window.supabaseConfig) {
        showNotification('Supabase não configurado', 'error');
        return;
    }
    
    try {
        showNotification('Sincronizando...', 'info');
        
        // Carregar do Supabase
        const result = await window.supabaseConfig.loadMarkings();
        if (result.success) {
            // Limpar marcações atuais
            drawnItems.clearLayers();
            
            // Carregar novas marcações
            result.markings.forEach(marking => {
                const layer = createLayerFromMarking(marking);
                if (layer) {
                    layer._markingId = marking.id;
                    drawnItems.addLayer(layer);
                }
            });
            
            // Salvar no localStorage
            localStorage.setItem('controle_obra_markings', JSON.stringify(result.markings));
            
            showNotification(`${result.markings.length} marcações sincronizadas!`, 'success');
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showNotification('Erro na sincronização', 'error');
    }
}

// Baixar dados (PWA)
async function downloadData() {
    if (!window.supabaseConfig) {
        showNotification('Supabase não configurado', 'error');
        return;
    }
    
    try {
        showNotification('Baixando dados...', 'info');
        
        const result = await window.supabaseConfig.loadMarkings();
        if (result.success) {
            localStorage.setItem('controle_obra_markings', JSON.stringify(result.markings));
            loadMarkings();
            showNotification('Dados baixados!', 'success');
        }
    } catch (error) {
        console.error('Erro ao baixar:', error);
        showNotification('Erro ao baixar dados', 'error');
    }
}

// Enviar dados (PWA)
async function uploadData() {
    if (!window.supabaseConfig) {
        showNotification('Supabase não configurado', 'error');
        return;
    }
    
    try {
        showNotification('Enviando dados...', 'info');
        
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        await window.supabaseConfig.saveMarkings(markings);
        
        showNotification('Dados enviados!', 'success');
    } catch (error) {
        console.error('Erro ao enviar:', error);
        showNotification('Erro ao enviar dados', 'error');
    }
}

// Atualizar status de conexão
function updateConnectionStatus() {
    const statusElement = document.querySelector('.connection-status');
    if (statusElement) {
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    // Implementar sistema de notificações simples
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Exportar KMZ
function exportKMZ() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    // Implementar exportação KMZ
    console.log('Exportando KMZ...', markings.length);
}

// Exportar Excel
function exportExcel() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    // Implementar exportação Excel
    console.log('Exportando Excel...', markings.length);
}
