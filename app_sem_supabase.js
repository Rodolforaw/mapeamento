// ==============================================
// SISTEMA SIMPLIFICADO - SEM SUPABASE
// Para testar localmente primeiro
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
    
    showNotification('Marcação salva!', 'success');
    updateMarkingsCount();
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
    
    showNotification('Marcação atualizada!', 'success');
    updateMarkingsCount();
}

// Deletar marcação
function deleteMarking(layer) {
    const markingId = layer._markingId;
    if (!markingId) return;
    
    // Remover do localStorage
    removeFromLocalStorage(markingId);
    
    showNotification('Marcação removida!', 'success');
    updateMarkingsCount();
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
    updateMarkingsCount();
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

// Sincronizar marcações (PC) - SEM SUPABASE
function syncMarkings() {
    showNotification('Sincronização desabilitada - Configure Supabase primeiro', 'info');
}

// Baixar dados (PWA) - SEM SUPABASE
function downloadData() {
    showNotification('Download desabilitado - Configure Supabase primeiro', 'info');
}

// Enviar dados (PWA) - SEM SUPABASE
function uploadData() {
    showNotification('Upload desabilitado - Configure Supabase primeiro', 'info');
}

// Atualizar status de conexão
function updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    }
}

// Atualizar contador de marcações
function updateMarkingsCount() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const countElement = document.getElementById('markings-count');
    if (countElement) {
        countElement.textContent = markings.length;
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Exportar KMZ
function exportKMZ() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    if (markings.length === 0) {
        showNotification('Nenhuma marcação para exportar', 'error');
        return;
    }
    
    showNotification('Exportando KMZ...', 'info');
    console.log('Exportando KMZ:', markings);
}

// Exportar Excel
function exportExcel() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    if (markings.length === 0) {
        showNotification('Nenhuma marcação para exportar', 'error');
        return;
    }
    
    showNotification('Exportando Excel...', 'info');
    console.log('Exportando Excel:', markings);
}
