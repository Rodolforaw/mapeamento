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
    // Mostrar popup para informações da obra
    showWorkInfoPopup(layer, type);
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
    // Por enquanto, apenas salvar localmente
    console.log('Marcação salva localmente:', marking.id);
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
    try {
        showNotification('Sincronizando...', 'info');
        
        // Recarregar marcações do localStorage
        loadMarkings();
        
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        showNotification(`${markings.length} marcações carregadas!`, 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showNotification('Erro na sincronização', 'error');
    }
}

// Baixar dados (PWA)
async function downloadData() {
    showNotification('Modo offline - Dados já estão no dispositivo', 'info');
}

// Enviar dados (PWA)
async function uploadData() {
    showNotification('Modo offline - Dados salvos localmente', 'info');
}

// Atualizar status de conexão
function updateConnectionStatus() {
    const statusElement = document.querySelector('.connection-status');
    if (statusElement) {
        statusElement.textContent = isOnline ? 'Online' : 'Offline';
        statusElement.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    }
}

// Mostrar popup de informações da obra
function showWorkInfoPopup(layer, type) {
    // Criar modal
    const modal = document.createElement('div');
    modal.className = 'work-modal';
    modal.innerHTML = `
        <div class="work-modal-content">
            <div class="work-modal-header">
                <h3>📋 Informações da Obra</h3>
                <span class="work-modal-close">&times;</span>
            </div>
            <div class="work-modal-body">
                <form id="work-form">
                    <div class="form-group">
                        <label for="os-number">Número da OS:</label>
                        <input type="text" id="os-number" name="osNumber" required>
                    </div>
                    <div class="form-group">
                        <label for="product">Produto/Serviço:</label>
                        <input type="text" id="product" name="product" required>
                    </div>
                    <div class="form-group">
                        <label for="measurement">Medida:</label>
                        <input type="number" id="measurement" name="measurement" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label for="measurement-unit">Unidade:</label>
                        <select id="measurement-unit" name="measurementUnit" required>
                            <option value="m">Metros (m)</option>
                            <option value="m²">Metros Quadrados (m²)</option>
                            <option value="m³">Metros Cúbicos (m³)</option>
                            <option value="un">Unidade</option>
                            <option value="kg">Quilogramas (kg)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="description">Descrição:</label>
                        <textarea id="description" name="description" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="worker-name">Nome do Funcionário:</label>
                        <input type="text" id="worker-name" name="workerName" required>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-danger" id="cancel-work">Cancelar</button>
                        <button type="submit" class="btn btn-success">Salvar Marcação</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
        .work-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .work-modal-content {
            background: white;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .work-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #ddd;
        }
        .work-modal-header h3 {
            margin: 0;
            color: #333;
        }
        .work-modal-close {
            font-size: 24px;
            cursor: pointer;
            color: #999;
        }
        .work-modal-close:hover {
            color: #333;
        }
        .work-modal-body {
            padding: 20px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #007bff;
        }
        .form-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn:hover {
            opacity: 0.9;
        }
    `;
    document.head.appendChild(style);
    
    // Adicionar ao DOM
    document.body.appendChild(modal);
    
    // Eventos
    const form = modal.querySelector('#work-form');
    const closeBtn = modal.querySelector('.work-modal-close');
    const cancelBtn = modal.querySelector('#cancel-work');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const workData = {
            osNumber: formData.get('osNumber'),
            product: formData.get('product'),
            measurement: parseFloat(formData.get('measurement')),
            measurementUnit: formData.get('measurementUnit'),
            description: formData.get('description'),
            workerName: formData.get('workerName')
        };
        
        // Salvar marcação com dados da obra
        saveMarkingWithWorkData(layer, type, workData);
        
        // Remover modal
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
    
    closeBtn.addEventListener('click', function() {
        // Remover layer se cancelar
        drawnItems.removeLayer(layer);
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
    
    cancelBtn.addEventListener('click', function() {
        // Remover layer se cancelar
        drawnItems.removeLayer(layer);
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
}

// Salvar marcação com dados da obra
function saveMarkingWithWorkData(layer, type, workData) {
    const marking = {
        id: generateId(),
        type: type,
        coordinates: getLayerCoordinates(layer),
        properties: {
            name: `${workData.product} - OS ${workData.osNumber}`,
            osNumber: workData.osNumber,
            product: workData.product,
            measurement: workData.measurement,
            measurementUnit: workData.measurementUnit,
            description: workData.description,
            workerName: workData.workerName,
            timestamp: Date.now()
        },
        timestamp: Date.now()
    };
    
    layer._markingId = marking.id;
    drawnItems.addLayer(layer);
    
    // Adicionar popup à layer
    const popupContent = `
        <div style="min-width: 200px;">
            <h4>📋 ${workData.product}</h4>
            <p><strong>OS:</strong> ${workData.osNumber}</p>
            <p><strong>Medida:</strong> ${workData.measurement} ${workData.measurementUnit}</p>
            <p><strong>Funcionário:</strong> ${workData.workerName}</p>
            ${workData.description ? `<p><strong>Descrição:</strong> ${workData.description}</p>` : ''}
        </div>
    `;
    layer.bindPopup(popupContent);
    
    // Salvar no localStorage
    saveToLocalStorage(marking);
    
    // Sincronizar se online
    if (isOnline) {
        syncToSupabase(marking);
    }
    
    showNotification(`Marcação salva: ${workData.product} - OS ${workData.osNumber}`, 'success');
    updateMarkingsCount();
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
    // Implementar exportação KMZ
    console.log('Exportando KMZ...', markings.length);
}

// Exportar Excel
function exportExcel() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    // Implementar exportação Excel
    console.log('Exportando Excel...', markings.length);
}
