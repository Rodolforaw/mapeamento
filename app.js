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
    
    // Botão de sincronização (PWA)
    const syncBtnPWA = document.getElementById('manual-sync-pwa');
    if (syncBtnPWA) {
        syncBtnPWA.addEventListener('click', syncMarkings);
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
            
            // Adicionar popup se tiver dados da obra
            if (marking.properties && marking.properties.osNumber) {
                const popupContent = `
                    <div style="min-width: 200px;">
                        <h4>📋 ${marking.properties.product || 'Marcação'}</h4>
                        <p><strong>OS:</strong> ${marking.properties.osNumber}</p>
                        <p><strong>Medida:</strong> ${marking.properties.measurement || 'N/A'} ${marking.properties.measurementUnit || ''}</p>
                        <p><strong>Funcionário:</strong> ${marking.properties.workerName || 'N/A'}</p>
                        ${marking.properties.description ? `<p><strong>Descrição:</strong> ${marking.properties.description}</p>` : ''}
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
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
        
        // Limpar marcações atuais
        drawnItems.clearLayers();
        
        // Recarregar marcações do localStorage
        loadMarkings();
        
        const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        showNotification(`${markings.length} marcações carregadas!`, 'success');
        
        // Atualizar contador
        updateMarkingsCount();
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

// Atualizar contador de marcações
function updateMarkingsCount() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const pcCount = document.getElementById('markings-count-pc');
    const pwaCount = document.getElementById('markings-count');
    
    if (pcCount) pcCount.textContent = markings.length;
    if (pwaCount) pwaCount.textContent = markings.length;
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
async function exportKMZ() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    
    if (markings.length === 0) {
        showNotification('Nenhuma marcação para exportar', 'error');
        return;
    }
    
    try {
        showNotification('Gerando KMZ...', 'info');
        
        // Criar KML
        const kml = generateKML(markings);
        
        // Criar KMZ
        const zip = new JSZip();
        zip.file('doc.kml', kml);
        
        // Gerar arquivo KMZ
        const content = await zip.generateAsync({type: 'blob'});
        
        // Download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `controle_obra_${new Date().toISOString().split('T')[0]}.kmz`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('KMZ exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar KMZ:', error);
        showNotification('Erro ao exportar KMZ', 'error');
    }
}

// Gerar KML
function generateKML(markings) {
    const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Controle de Obra</name>
        <description>Marcacoes de obra exportadas</description>`;
    
    const kmlFooter = `    </Document>
</kml>`;
    
    let kmlContent = '';
    
    markings.forEach((marking, index) => {
        const name = marking.properties?.name || `Marcação ${index + 1}`;
        const description = generateDescription(marking);
        
        if (marking.type === 'marker') {
            kmlContent += `
        <Placemark>
            <name>${escapeXML(name)}</name>
            <description>${escapeXML(description)}</description>
            <Point>
                <coordinates>${marking.coordinates.lng},${marking.coordinates.lat},0</coordinates>
            </Point>
        </Placemark>`;
        } else if (marking.type === 'circle') {
            kmlContent += `
        <Placemark>
            <name>${escapeXML(name)}</name>
            <description>${escapeXML(description)}</description>
            <Circle>
                <center>${marking.coordinates.lng},${marking.coordinates.lat},0</center>
                <radius>${marking.coordinates.radius || 100}</radius>
            </Circle>
        </Placemark>`;
        } else if (marking.type === 'polygon') {
            const coordinates = marking.coordinates.map(coord => 
                `${coord.lng},${coord.lat},0`
            ).join(' ');
            
            kmlContent += `
        <Placemark>
            <name>${escapeXML(name)}</name>
            <description>${escapeXML(description)}</description>
            <Polygon>
                <outerBoundaryIs>
                    <LinearRing>
                        <coordinates>${coordinates}</coordinates>
                    </LinearRing>
                </outerBoundaryIs>
            </Polygon>
        </Placemark>`;
        } else if (marking.type === 'polyline') {
            const coordinates = marking.coordinates.map(coord => 
                `${coord.lng},${coord.lat},0`
            ).join(' ');
            
            kmlContent += `
        <Placemark>
            <name>${escapeXML(name)}</name>
            <description>${escapeXML(description)}</description>
            <LineString>
                <coordinates>${coordinates}</coordinates>
            </LineString>
        </Placemark>`;
        }
    });
    
    return kmlHeader + kmlContent + kmlFooter;
}

// Gerar descrição da marcação
function generateDescription(marking) {
    const props = marking.properties || {};
    let desc = '';
    
    if (props.osNumber) desc += `OS: ${props.osNumber}\n`;
    if (props.product) desc += `Produto: ${props.product}\n`;
    if (props.measurement) desc += `Medida: ${props.measurement} ${props.measurementUnit || ''}\n`;
    if (props.workerName) desc += `Funcionário: ${props.workerName}\n`;
    if (props.description) desc += `Descrição: ${props.description}\n`;
    
    const date = new Date(marking.timestamp);
    desc += `Criado em: ${date.toLocaleString('pt-BR')}`;
    
    return desc;
}

// Escapar XML
function escapeXML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Exportar Excel
function exportExcel() {
    const markings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    
    if (markings.length === 0) {
        showNotification('Nenhuma marcação para exportar', 'error');
        return;
    }
    
    try {
        showNotification('Gerando Excel...', 'info');
        
        // Criar CSV
        let csv = 'OS,Produto,Medida,Unidade,Funcionário,Descrição,Tipo,Latitude,Longitude,Data\n';
        
        markings.forEach(marking => {
            const props = marking.properties || {};
            const coords = getCoordinatesForExport(marking);
            
            csv += `"${props.osNumber || ''}","${props.product || ''}","${props.measurement || ''}","${props.measurementUnit || ''}","${props.workerName || ''}","${props.description || ''}","${marking.type}","${coords.lat}","${coords.lng}","${new Date(marking.timestamp).toLocaleString('pt-BR')}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `controle_obra_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Excel exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        showNotification('Erro ao exportar Excel', 'error');
    }
}

// Obter coordenadas para exportação
function getCoordinatesForExport(marking) {
    if (marking.type === 'marker' || marking.type === 'circle') {
        return {
            lat: marking.coordinates.lat,
            lng: marking.coordinates.lng
        };
    } else if (marking.type === 'polygon' || marking.type === 'polyline') {
        // Retornar centro do polígono/linha
        const coords = marking.coordinates;
        const latSum = coords.reduce((sum, coord) => sum + coord.lat, 0);
        const lngSum = coords.reduce((sum, coord) => sum + coord.lng, 0);
        return {
            lat: latSum / coords.length,
            lng: lngSum / coords.length
        };
    }
    return { lat: 0, lng: 0 };
}

// Importar KMZ
async function importKMZ() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kmz,.kml';
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                showNotification('Importando KMZ...', 'info');
                await processKMZFile(file);
            } catch (error) {
                console.error('Erro ao importar KMZ:', error);
                showNotification('Erro ao importar KMZ', 'error');
            }
        }
    };
    input.click();
}

// Processar arquivo KMZ
async function processKMZFile(file) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    let kmlContent = '';
    
    // Procurar arquivo KML
    for (const [filename, file] of Object.entries(zipContent.files)) {
        if (filename.toLowerCase().endsWith('.kml')) {
            kmlContent = await file.async('text');
            break;
        }
    }
    
    if (!kmlContent) {
        throw new Error('Arquivo KML não encontrado no KMZ');
    }
    
    // Parsear KML
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(kmlContent);
    
    // Extrair marcações
    const markings = extractMarkingsFromKML(result);
    
    if (markings.length === 0) {
        showNotification('Nenhuma marcação encontrada no arquivo', 'error');
        return;
    }
    
    // Salvar marcações
    const existingMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
    const allMarkings = [...existingMarkings, ...markings];
    localStorage.setItem('controle_obra_markings', JSON.stringify(allMarkings));
    
    // Recarregar mapa
    loadMarkings();
    updateMarkingsCount();
    
    showNotification(`${markings.length} marcações importadas com sucesso!`, 'success');
}

// Extrair marcações do KML
function extractMarkingsFromKML(kmlData) {
    const markings = [];
    
    try {
        const document = kmlData.kml.Document[0];
        const placemarks = document.Placemark || [];
        
        placemarks.forEach((placemark, index) => {
            const name = placemark.name?.[0] || `Importada ${index + 1}`;
            const description = placemark.description?.[0] || '';
            
            // Extrair dados da obra da descrição
            const workData = parseWorkDataFromDescription(description);
            
            // Processar geometria
            if (placemark.Point) {
                const coords = placemark.Point[0].coordinates[0].split(',');
                const marking = {
                    id: generateId(),
                    type: 'marker',
                    coordinates: {
                        lat: parseFloat(coords[1]),
                        lng: parseFloat(coords[0])
                    },
                    properties: {
                        name: name,
                        ...workData,
                        timestamp: Date.now()
                    },
                    timestamp: Date.now()
                };
                markings.push(marking);
            } else if (placemark.Circle) {
                const center = placemark.Circle[0].center[0].split(',');
                const radius = placemark.Circle[0].radius?.[0] || 100;
                const marking = {
                    id: generateId(),
                    type: 'circle',
                    coordinates: {
                        lat: parseFloat(center[1]),
                        lng: parseFloat(center[0]),
                        radius: parseFloat(radius)
                    },
                    properties: {
                        name: name,
                        ...workData,
                        timestamp: Date.now()
                    },
                    timestamp: Date.now()
                };
                markings.push(marking);
            } else if (placemark.Polygon) {
                const coords = placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0]
                    .trim().split(' ').map(coord => {
                        const parts = coord.split(',');
                        return {
                            lat: parseFloat(parts[1]),
                            lng: parseFloat(parts[0])
                        };
                    });
                const marking = {
                    id: generateId(),
                    type: 'polygon',
                    coordinates: coords,
                    properties: {
                        name: name,
                        ...workData,
                        timestamp: Date.now()
                    },
                    timestamp: Date.now()
                };
                markings.push(marking);
            } else if (placemark.LineString) {
                const coords = placemark.LineString[0].coordinates[0]
                    .trim().split(' ').map(coord => {
                        const parts = coord.split(',');
                        return {
                            lat: parseFloat(parts[1]),
                            lng: parseFloat(parts[0])
                        };
                    });
                const marking = {
                    id: generateId(),
                    type: 'polyline',
                    coordinates: coords,
                    properties: {
                        name: name,
                        ...workData,
                        timestamp: Date.now()
                    },
                    timestamp: Date.now()
                };
                markings.push(marking);
            }
        });
    } catch (error) {
        console.error('Erro ao extrair marcações do KML:', error);
    }
    
    return markings;
}

// Extrair dados da obra da descrição
function parseWorkDataFromDescription(description) {
    const workData = {};
    
    if (description.includes('OS:')) {
        const osMatch = description.match(/OS:\s*([^\n]+)/);
        if (osMatch) workData.osNumber = osMatch[1].trim();
    }
    
    if (description.includes('Produto:')) {
        const productMatch = description.match(/Produto:\s*([^\n]+)/);
        if (productMatch) workData.product = productMatch[1].trim();
    }
    
    if (description.includes('Medida:')) {
        const measureMatch = description.match(/Medida:\s*([^\n]+)/);
        if (measureMatch) {
            const measureParts = measureMatch[1].trim().split(' ');
            workData.measurement = parseFloat(measureParts[0]);
            if (measureParts[1]) workData.measurementUnit = measureParts[1];
        }
    }
    
    if (description.includes('Funcionário:')) {
        const workerMatch = description.match(/Funcionário:\s*([^\n]+)/);
        if (workerMatch) workData.workerName = workerMatch[1].trim();
    }
    
    if (description.includes('Descrição:')) {
        const descMatch = description.match(/Descrição:\s*([^\n]+)/);
        if (descMatch) workData.description = descMatch[1].trim();
    }
    
    return workData;
}
