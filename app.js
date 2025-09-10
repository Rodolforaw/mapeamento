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

// Variáveis para o modal de marcação
let currentLayer = null;
let markingModal = null;

// Variáveis para geolocalização
let userLocationMarker = null;
let watchId = null;
let isTrackingLocation = false;

// Variáveis para gerenciamento de obras
let worksData = {}; // Estrutura: { osNumber: { product, markings: [], lastUpdate } }
let worksModal = null;

// Inicialização do aplicativo
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
    setupOfflineSupport();
    setupMobileMenu();
    loadOfflineData();
    hideLoading();
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
    document.getElementById('import-kmz').addEventListener('change', importKMZ);
    
    // Sincronização manual
    document.getElementById('sync-offline').addEventListener('click', function() {
        if (offlineQueue.length > 0) {
            syncOfflineData();
        } else {
            showNotification('Nenhum dado para sincronizar!', 'warning');
        }
    });
    
    // Limpar dados
    document.getElementById('clear-data').addEventListener('click', clearAllData);
    
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
    
    // Estilos
    kml += `<Style id=\"blueMarker\">\n`;
    kml += `<IconStyle><Icon><href>http://maps.google.com/mapfiles/ms/icons/blue-dot.png</href></Icon></IconStyle>\n`;
    kml += `</Style>\n`;
    kml += `<Style id=\"bluePolygon\">\n`;
    kml += `<LineStyle><color>ff0000ff</color><width>3</width></LineStyle>\n`;
    kml += `<PolyStyle><color>4d0000ff</color></PolyStyle>\n`;
    kml += `</Style>\n`;
    
    let placemarkIndex = 1;
    
    drawnItems.eachLayer(function(layer) {
        const md = getLayerMarkingData(layer) || {};
        if (layer instanceof L.Circle && md && !md.radius) {
            md.radius = layer.getRadius();
        }
        const placemarkName = md.osNumber ? `O.S.: ${md.osNumber} - ${md.product || 'Marcação'}` : `Marcação ${placemarkIndex}`;
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
        
        if (layer instanceof L.Marker) {
            kml += `<styleUrl>#blueMarker</styleUrl>\n`;
            const latlng = layer.getLatLng();
            kml += `<Point><coordinates>${latlng.lng},${latlng.lat},0</coordinates></Point>\n`;
        } else if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            kml += `<styleUrl>#bluePolygon</styleUrl>\n`;
            const latlngs = layer.getLatLngs()[0];
            kml += `<Polygon><outerBoundaryIs><LinearRing><coordinates>`;
            latlngs.forEach(latlng => {
                kml += `${latlng.lng},${latlng.lat},0 `;
            });
            // Fechar o polígono
            kml += `${latlngs[0].lng},${latlngs[0].lat},0`;
            kml += `</coordinates></LinearRing></outerBoundaryIs></Polygon>\n`;
        } else if (layer instanceof L.Polyline) {
            kml += `<styleUrl>#bluePolygon</styleUrl>\n`;
            const latlngs = layer.getLatLngs();
            kml += `<LineString><coordinates>`;
            latlngs.forEach(latlng => {
                kml += `${latlng.lng},${latlng.lat},0 `;
            });
            kml += `</coordinates></LineString>\n`;
        } else if (layer instanceof L.Circle) {
            kml += `<styleUrl>#blueMarker</styleUrl>\n`;
            const center = layer.getLatLng();
            kml += `<Point><coordinates>${center.lng},${center.lat},0</coordinates></Point>\n`;
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
function importKMZ(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    let processedFiles = 0;
    const totalFiles = files.length;
    
    showNotification(`Processando ${totalFiles} arquivo(s)...`, 'info');
    
    Array.from(files).forEach((file, index) => {
        if (file.name.toLowerCase().endsWith('.kmz')) {
            processKMZFile(file, () => {
                processedFiles++;
                if (processedFiles === totalFiles) {
                    showNotification(`${totalFiles} arquivo(s) importado(s) com sucesso!`, 'success');
                    updateWorksData();
                    if (worksModal && worksModal.classList.contains('show')) {
                        refreshWorksTable();
                    }
                }
            });
        } else {
            showNotification(`Arquivo ${file.name} não é um KMZ válido!`, 'error');
            processedFiles++;
        }
    });
    
    // Limpar input
    event.target.value = '';
}

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

// Analisar conteúdo KML
function parseKML(kmlContent) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        let importedCount = 0;
        
        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const name = placemark.getElementsByTagName('name')[0]?.textContent || `Importado ${i + 1}`;
            const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
            
            // Processar pontos
            const points = placemark.getElementsByTagName('Point');
            if (points.length > 0) {
                const coordinates = points[0].getElementsByTagName('coordinates')[0]?.textContent;
                if (coordinates) {
                    const coords = coordinates.trim().split(',');
                    const lng = parseFloat(coords[0]);
                    const lat = parseFloat(coords[1]);
                    
                    const marker = L.marker([lat, lng]).bindPopup(`<h4>${name}</h4><p>${description}</p>`);
                    drawnItems.addLayer(marker);
                    importedCount++;
                }
            }
            
            // Processar polígonos
            const polygons = placemark.getElementsByTagName('Polygon');
            if (polygons.length > 0) {
                const coordinates = polygons[0].getElementsByTagName('coordinates')[0]?.textContent;
                if (coordinates) {
                    const coordPairs = coordinates.trim().split(' ');
                    const latlngs = coordPairs.map(pair => {
                        const coords = pair.split(',');
                        return [parseFloat(coords[1]), parseFloat(coords[0])];
                    }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
                    
                    if (latlngs.length > 2) {
                        const polygon = L.polygon(latlngs).bindPopup(`<h4>${name}</h4><p>${description}</p>`);
                        drawnItems.addLayer(polygon);
                        importedCount++;
                    }
                }
            }
            
            // Processar linhas
            const lineStrings = placemark.getElementsByTagName('LineString');
            if (lineStrings.length > 0) {
                const coordinates = lineStrings[0].getElementsByTagName('coordinates')[0]?.textContent;
                if (coordinates) {
                    const coordPairs = coordinates.trim().split(' ');
                    const latlngs = coordPairs.map(pair => {
                        const coords = pair.split(',');
                        return [parseFloat(coords[1]), parseFloat(coords[0])];
                    }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
                    
                    if (latlngs.length > 1) {
                        const polyline = L.polyline(latlngs).bindPopup(`<h4>${name}</h4><p>${description}</p>`);
                        drawnItems.addLayer(polyline);
                        importedCount++;
                    }
                }
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
    const markingData = {
        id: generateId(),
        type: layerType,
        data: layerToGeoJSON(layer),
        timestamp: new Date().toISOString(),
        action: 'create'
    };
    
    // Adicionar ID à camada para referência futura
    layer._markingId = markingData.id;
    
    if (isOnline) {
        // Salvar diretamente se online
        saveToLocalStorage(markingData);
    } else {
        // Adicionar à fila offline
        offlineQueue.push(markingData);
        saveOfflineQueue();
        updateConnectionStatus();
    }
}

// Atualizar marcação existente
function updateMarking(layer) {
    const markingData = {
        id: layer._markingId || generateId(),
        type: getLayerType(layer).toLowerCase(),
        data: layerToGeoJSON(layer),
        timestamp: new Date().toISOString(),
        action: 'update'
    };
    
    if (!layer._markingId) {
        layer._markingId = markingData.id;
    }
    
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
function saveToLocalStorage(markingData) {
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
        
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
    }
}

// Remover do localStorage
function removeFromLocalStorage(markingId) {
    try {
        const existingData = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        const filteredData = existingData.filter(item => item.id !== markingId);
        localStorage.setItem('controle_obra_markings', JSON.stringify(filteredData));
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

// Converter GeoJSON para camada Leaflet
function geoJSONToLayer(geoJSON, type) {
    if (!geoJSON) return null;
    
    try {
        if (geoJSON.type === 'Point') {
            const [lng, lat] = geoJSON.coordinates;
            
            if (geoJSON.properties && geoJSON.properties.radius) {
                // É um círculo
                const layer = L.circle([lat, lng], {
                    radius: geoJSON.properties.radius,
                    color: '#2196F3',
                    weight: 3,
                    fillOpacity: 0.3
                });
                if (geoJSON.properties.popupContent) {
                    layer.bindPopup(geoJSON.properties.popupContent);
                }
                return layer;
            } else {
                // É um marcador
                const layer = L.marker([lat, lng], {
                    icon: new L.Icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                });
                if (geoJSON.properties.popupContent) {
                    layer.bindPopup(geoJSON.properties.popupContent);
                }
                return layer;
            }
        } else if (geoJSON.type === 'Polygon') {
            const coordinates = geoJSON.coordinates[0].map(coord => [coord[1], coord[0]]);
            const layer = L.polygon(coordinates, {
                color: '#2196F3',
                weight: 3,
                fillOpacity: 0.3
            });
            if (geoJSON.properties.popupContent) {
                layer.bindPopup(geoJSON.properties.popupContent);
            }
            return layer;
        } else if (geoJSON.type === 'LineString') {
            const coordinates = geoJSON.coordinates.map(coord => [coord[1], coord[0]]);
            const layer = L.polyline(coordinates, {
                color: '#2196F3',
                weight: 3
            });
            if (geoJSON.properties.popupContent) {
                layer.bindPopup(geoJSON.properties.popupContent);
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
    // Escutar mudanças no localStorage de outras abas/dispositivos
    window.addEventListener('storage', function(e) {
        if (e.key === 'controle_obra_markings' || e.key === 'worksData') {
            updateSyncStatus('syncing', 'Recebendo dados...');
            
            // Recarregar dados quando houver mudanças
            setTimeout(() => {
                loadOfflineData();
                updateWorksData();
                refreshWorksTable();
                updateSyncStatus('success', 'Dados atualizados');
                showSyncNotification('📱 Dados sincronizados do celular!', 'success');
                
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
        }, 100);
    });
    
    // Polling para verificar mudanças a cada 10 segundos
    let lastMarkingsHash = getDataHash('controle_obra_markings');
    let lastWorksHash = getDataHash('worksData');
    
    setInterval(() => {
        const currentMarkingsHash = getDataHash('controle_obra_markings');
        const currentWorksHash = getDataHash('worksData');
        
        if (currentMarkingsHash !== lastMarkingsHash || currentWorksHash !== lastWorksHash) {
             updateSyncStatus('syncing', 'Verificando dados...');
             
             loadOfflineData();
             updateWorksData();
             refreshWorksTable();
             
             lastMarkingsHash = currentMarkingsHash;
             lastWorksHash = currentWorksHash;
             
             updateSyncStatus('success', 'Dados atualizados');
             showSyncNotification('🔄 Novos dados detectados e carregados!', 'success');
             
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
    const markingData = {
        id: generateId(),
        ...data,
        geometry: layerToGeoJSON(layer),
        coordinates: getLayerCoordinates(layer),
        timestamp: new Date().toISOString(),
        action: 'create'
    };
    
    // Adicionar ID à camada para referência futura
    layer._markingId = markingData.id;
    
    if (isOnline) {
        saveToLocalStorage(markingData);
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
}

// Alternar rastreamento de localização
function toggleLocationTracking() {
    if (isTrackingLocation) {
        stopLocationTracking();
    } else {
        startLocationTracking();
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
function updateUserLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
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
        worksModal.classList.add('show');
    }
}

// Fechar modal de gerenciamento de obras
function closeWorksModal() {
    if (worksModal) {
        worksModal.classList.remove('show');
    }
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

// Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registrado com sucesso:', registration.scope);
            })
            .catch(function(error) {
                console.log('Falha ao registrar ServiceWorker:', error);
            });
    });
}