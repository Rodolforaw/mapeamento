// Script para versão PC - Sistema de Controle de Obras
// Usando Leaflet (gratuito) em vez do Google Maps

let map;
let drawnItems;
let currentDrawingMode = null;
let currentWork = null;
let works = [];
let selectedWork = null;

// Coordenadas de Maricá, RJ
const MARICA_CENTER = [-22.9194, -42.8186];

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadWorksFromSupabase();
});

// Inicializar o mapa
function initializeMap() {
    // Inicializar o mapa
    map = L.map('map').setView(MARICA_CENTER, 13);

    // Adicionar camada de tiles do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Adicionar camada de satélite (gratuita)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });

    // Adicionar camada de ruas
    const streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    // Controle de camadas
    const baseMaps = {
        "Satélite": satelliteLayer,
        "Ruas": streetsLayer
    };

    L.control.layers(baseMaps).addTo(map);

    // Inicializar camada para desenhos
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Configurar controles de desenho
    const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                shapeOptions: {
                    color: '#6d28d9',
                    fillColor: '#6d28d9',
                    fillOpacity: 0.3
                }
            },
            polyline: {
                shapeOptions: {
                    color: '#6d28d9',
                    weight: 3
                }
            },
            marker: {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: '<div style="background-color: #6d28d9; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            },
            circle: false,
            rectangle: false,
            circlemarker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });

    map.addControl(drawControl);

    // Eventos de desenho
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        const type = event.layerType;
        
        // Adicionar propriedades personalizadas
        layer.workId = generateWorkId();
        layer.workType = type;
        layer.workName = `Nova Obra ${works.length + 1}`;
        layer.workDescription = '';
        layer.workStatus = 'planejamento';
        layer.workType = 'outros';
        layer.workDate = new Date().toISOString().split('T')[0];
        layer.isSelected = false;

        // Adicionar à lista de obras
        works.push(layer);
        drawnItems.addLayer(layer);
        
        // Mostrar modal de informações
        showWorkModal(layer);
        
        // Atualizar lista
        updateWorksList();
    });

    // Evento de edição
    map.on(L.Draw.Event.EDITED, function(event) {
        updateWorksList();
    });

    // Evento de exclusão
    map.on(L.Draw.Event.DELETED, function(event) {
        const layers = event.layers;
        layers.eachLayer(function(layer) {
            const index = works.findIndex(work => work.workId === layer.workId);
            if (index !== -1) {
                works.splice(index, 1);
            }
        });
        updateWorksList();
    });

    // Evento de clique em obra
    map.on('click', function(e) {
        if (currentDrawingMode === 'edit' || currentDrawingMode === 'delete') {
            // Lógica de edição/exclusão será implementada
        }
    });
}

// Inicializar event listeners
function initializeEventListeners() {
    // Menu hambúrguer
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);

    // Botões de ferramentas
    document.getElementById('drawPolygonBtn').addEventListener('click', () => setDrawingMode('polygon'));
    document.getElementById('drawMarkerBtn').addEventListener('click', () => setDrawingMode('marker'));
    document.getElementById('drawLineBtn').addEventListener('click', () => setDrawingMode('polyline'));
    document.getElementById('editBtn').addEventListener('click', () => setDrawingMode('edit'));
    document.getElementById('deleteBtn').addEventListener('click', () => setDrawingMode('delete'));

    // Botões de ação
    document.getElementById('importKmzBtn').addEventListener('click', importKMZ);
    document.getElementById('exportKmzBtn').addEventListener('click', exportToKMZ);

    // Modal de obra
    document.getElementById('closeModal').addEventListener('click', hideWorkModal);
    document.getElementById('cancelWork').addEventListener('click', hideWorkModal);
    document.getElementById('saveWork').addEventListener('click', saveWorkInfo);

    // Modal de confirmação
    document.getElementById('cancelConfirm').addEventListener('click', hideConfirmModal);
    document.getElementById('confirmAction').addEventListener('click', confirmAction);

    // Configurações
    document.getElementById('showLabels').addEventListener('change', toggleLabels);
    document.getElementById('showTraffic').addEventListener('change', toggleTraffic);

    // Input de arquivo para importação
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileImport);
}

// Alternar sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Definir modo de desenho
function setDrawingMode(mode) {
    currentDrawingMode = mode;
    
    // Ativar/desativar controles de desenho
    if (mode === 'edit') {
        // Ativar modo de edição
        map.editTools.startEdit();
    } else if (mode === 'delete') {
        // Ativar modo de exclusão
        map.editTools.startDelete();
    } else {
        // Desativar modos de edição
        map.editTools.stopEdit();
        map.editTools.stopDelete();
    }
    
    updateToolButtons();
}

// Atualizar botões de ferramentas
function updateToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`#${currentDrawingMode}Btn`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Mostrar modal de obra
function showWorkModal(work) {
    currentWork = work;
    
    document.getElementById('workName').value = work.workName || '';
    document.getElementById('workDescription').value = work.workDescription || '';
    document.getElementById('workStatus').value = work.workStatus || 'planejamento';
    document.getElementById('workType').value = work.workType || 'outros';
    document.getElementById('workDate').value = work.workDate || '';
    
    document.getElementById('workModal').classList.add('show');
}

// Esconder modal de obra
function hideWorkModal() {
    document.getElementById('workModal').classList.remove('show');
    currentWork = null;
}

// Salvar informações da obra
function saveWorkInfo() {
    if (!currentWork) return;
    
    currentWork.workName = document.getElementById('workName').value;
    currentWork.workDescription = document.getElementById('workDescription').value;
    currentWork.workStatus = document.getElementById('workStatus').value;
    currentWork.workType = document.getElementById('workType').value;
    currentWork.workDate = document.getElementById('workDate').value;
    
    // Atualizar visual no mapa
    updateWorkVisual(currentWork);
    
    // Atualizar lista
    updateWorksList();
    
    hideWorkModal();
    showToast('Obra salva com sucesso!', 'success');
}

// Atualizar visual da obra no mapa
function updateWorkVisual(work) {
    const statusColors = {
        'planejamento': '#f59e0b',
        'em_andamento': '#3b82f6',
        'pausada': '#ef4444',
        'concluida': '#10b981'
    };
    
    const color = statusColors[work.workStatus] || '#6d28d9';
    
    if (work.workType === 'marker') {
        work.setIcon(L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        }));
    } else if (work.workType === 'polygon') {
        work.setStyle({
            color: color,
            fillColor: color,
            fillOpacity: 0.3
        });
    } else if (work.workType === 'polyline') {
        work.setStyle({
            color: color,
            weight: 3
        });
    }
}

// Atualizar lista de obras
function updateWorksList() {
    const worksList = document.getElementById('worksList');
    worksList.innerHTML = '';
    
    works.forEach((work, index) => {
        const workItem = document.createElement('div');
        workItem.className = 'work-item';
        workItem.innerHTML = `
            <div class="work-info">
                <h4>${work.workName || 'Obra sem nome'}</h4>
                <p>${work.workStatus || 'Status não definido'} - ${work.workType || 'Tipo não definido'}</p>
            </div>
            <div class="work-actions">
                <button onclick="selectWork(${index})" title="Selecionar">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="editWork(${index})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteWork(${index})" title="Deletar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        worksList.appendChild(workItem);
    });
}

// Selecionar obra
function selectWork(index) {
    const work = works[index];
    
    // Remover seleção anterior
    works.forEach(w => w.isSelected = false);
    
    // Selecionar obra atual
    work.isSelected = true;
    selectedWork = work;
    
    // Centralizar no mapa
    if (work.workType === 'marker') {
        map.setView(work.getLatLng(), 16);
    } else {
        map.fitBounds(work.getBounds());
    }
    
    updateWorksList();
}

// Editar obra
function editWork(index) {
    const work = works[index];
    showWorkModal(work);
}

// Deletar obra
function deleteWork(index) {
    const work = works[index];
    showConfirmModal(
        `Tem certeza que deseja deletar a obra "${work.workName}"?`,
        () => {
            drawnItems.removeLayer(work);
            works.splice(index, 1);
            updateWorksList();
            showToast('Obra deletada com sucesso!', 'success');
        }
    );
}

// Importar KMZ
function importKMZ() {
    document.getElementById('fileInput').click();
}

// Manipular importação de arquivo
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        showLoading(true);
        
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        const kmlFile = zipContent.file('doc.kml');
        if (!kmlFile) {
            throw new Error('Arquivo KMZ inválido: doc.kml não encontrado');
        }
        
        const kmlContent = await kmlFile.async('text');
        const kmlData = await parseKML(kmlContent);
        
        // Limpar obras existentes
        works.forEach(work => drawnItems.removeLayer(work));
        works = [];
        
        // Adicionar obras importadas
        kmlData.forEach(workData => {
            const work = createWorkFromKMLData(workData);
            if (work) {
                works.push(work);
                drawnItems.addLayer(work);
            }
        });
        
        updateWorksList();
        showToast(`${works.length} obras importadas com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao importar KMZ:', error);
        showToast('Erro ao importar KMZ: ' + error.message, 'error');
    } finally {
        showLoading(false);
        event.target.value = '';
    }
}

// Exportar para KMZ
async function exportToKMZ() {
    if (works.length === 0) {
        showToast('Nenhuma obra para exportar!', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const kmlContent = generateKML();
        const zip = new JSZip();
        
        zip.file('doc.kml', kmlContent);
        
        const blob = await zip.generateAsync({ type: 'blob' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `obras_marica_${new Date().toISOString().split('T')[0]}.kmz`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('KMZ exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar KMZ:', error);
        showToast('Erro ao exportar KMZ: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Gerar conteúdo KML
function generateKML() {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Obras - Maricá</name>
        <description>Sistema de Controle de Obras - Maricá/RJ</description>
        ${works.map(work => generateKMLPlacemark(work)).join('')}
    </Document>
</kml>`;
    
    return kml;
}

// Gerar placemark KML para uma obra
function generateKMLPlacemark(work) {
    const statusColors = {
        'planejamento': '#f59e0b',
        'em_andamento': '#3b82f6',
        'pausada': '#ef4444',
        'concluida': '#10b981'
    };
    
    const color = statusColors[work.workStatus] || '#6d28d9';
    
    let coordinates = '';
    let geometry = '';
    
    if (work.workType === 'marker') {
        const pos = work.getLatLng();
        coordinates = `${pos.lng},${pos.lat},0`;
        geometry = `<Point><coordinates>${coordinates}</coordinates></Point>`;
    } else if (work.workType === 'polygon') {
        const latLngs = work.getLatLngs()[0];
        coordinates = latLngs.map(latLng => `${latLng.lng},${latLng.lat},0`).join(' ');
        geometry = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    } else if (work.workType === 'polyline') {
        const latLngs = work.getLatLngs();
        coordinates = latLngs.map(latLng => `${latLng.lng},${latLng.lat},0`).join(' ');
        geometry = `<LineString><coordinates>${coordinates}</coordinates></LineString>`;
    }
    
    return `
        <Placemark>
            <name>${work.workName || 'Obra sem nome'}</name>
            <description>
                <![CDATA[
                    <b>Status:</b> ${work.workStatus || 'Não definido'}<br/>
                    <b>Tipo:</b> ${work.workType || 'Não definido'}<br/>
                    <b>Data:</b> ${work.workDate || 'Não definida'}<br/>
                    <b>Descrição:</b> ${work.workDescription || 'Sem descrição'}
                ]]>
            </description>
            <Style>
                <LineStyle>
                    <color>${color.replace('#', 'ff')}</color>
                    <width>2</width>
                </LineStyle>
                <PolyStyle>
                    <color>${color.replace('#', '80')}</color>
                </PolyStyle>
            </Style>
            ${geometry}
        </Placemark>`;
}

// Parsear KML
async function parseKML(kmlContent) {
    return new Promise((resolve, reject) => {
        const parser = new xml2js.Parser();
        parser.parseString(kmlContent, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            
            try {
                const placemarks = result.kml.Document[0].Placemark || [];
                const works = placemarks.map(placemark => {
                    const name = placemark.name ? placemark.name[0] : 'Obra sem nome';
                    const description = placemark.description ? placemark.description[0] : '';
                    const geometry = placemark.Point || placemark.Polygon || placemark.LineString;
                    
                    let workData = {
                        name: name,
                        description: description,
                        status: 'planejamento',
                        type: 'outros',
                        date: new Date().toISOString().split('T')[0]
                    };
                    
                    if (placemark.Point) {
                        workData.type = 'marker';
                        const coords = placemark.Point[0].coordinates[0].split(',');
                        workData.position = {
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0])
                        };
                    } else if (placemark.Polygon) {
                        workData.type = 'polygon';
                        const coords = placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0];
                        workData.paths = coords.split(' ').map(coord => {
                            const parts = coord.split(',');
                            return {
                                lat: parseFloat(parts[1]),
                                lng: parseFloat(parts[0])
                            };
                        });
                    } else if (placemark.LineString) {
                        workData.type = 'polyline';
                        const coords = placemark.LineString[0].coordinates[0];
                        workData.path = coords.split(' ').map(coord => {
                            const parts = coord.split(',');
                            return {
                                lat: parseFloat(parts[1]),
                                lng: parseFloat(parts[0])
                            };
                        });
                    }
                    
                    return workData;
                });
                
                resolve(works);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Criar obra a partir dos dados KML
function createWorkFromKMLData(workData) {
    try {
        let work;
        
        if (workData.type === 'marker') {
            work = L.marker([workData.position.lat, workData.position.lng]);
        } else if (workData.type === 'polygon') {
            work = L.polygon(workData.paths);
        } else if (workData.type === 'polyline') {
            work = L.polyline(workData.path);
        }
        
        if (work) {
            work.workId = generateWorkId();
            work.workName = workData.name;
            work.workDescription = workData.description;
            work.workStatus = workData.status;
            work.workType = workData.type;
            work.workDate = workData.date;
            work.isSelected = false;
            
            updateWorkVisual(work);
        }
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra a partir do KML:', error);
        return null;
    }
}

// Carregar obras do Supabase
async function loadWorksFromSupabase() {
    try {
        showLoading(true);
        
        const { data, error } = await supabase
            .from('works')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Limpar obras existentes
        works.forEach(work => drawnItems.removeLayer(work));
        works = [];
        
        // Carregar obras do banco
        if (data) {
            data.forEach(workData => {
                const work = createWorkFromData(workData);
                if (work) {
                    works.push(work);
                    drawnItems.addLayer(work);
                }
            });
        }
        
        updateWorksList();
        showToast(`${works.length} obras carregadas!`, 'success');
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        showToast('Erro ao carregar obras: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Criar obra a partir dos dados
function createWorkFromData(workData) {
    try {
        const geometry = JSON.parse(workData.geometry);
        let work;
        
        if (workData.type === 'marker') {
            work = L.marker([geometry.position.lat, geometry.position.lng]);
        } else if (workData.type === 'polygon') {
            work = L.polygon(geometry.paths);
        } else if (workData.type === 'polyline') {
            work = L.polyline(geometry.path);
        }
        
        if (work) {
            work.workId = workData.id;
            work.workName = workData.name;
            work.workDescription = workData.description;
            work.workStatus = workData.status;
            work.workType = workData.type;
            work.workDate = workData.date;
            work.isSelected = false;
            
            updateWorkVisual(work);
        }
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra:', error);
        return null;
    }
}

// Mostrar modal de confirmação
function showConfirmModal(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.add('show');
    
    window.confirmCallback = callback;
}

// Esconder modal de confirmação
function hideConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
    window.confirmCallback = null;
}

// Confirmar ação
function confirmAction() {
    if (window.confirmCallback) {
        window.confirmCallback();
    }
    hideConfirmModal();
}

// Alternar labels
function toggleLabels() {
    // Implementar lógica para alternar labels
    showToast('Funcionalidade em desenvolvimento', 'info');
}

// Alternar tráfego
function toggleTraffic() {
    // Implementar lógica para alternar tráfego
    showToast('Funcionalidade em desenvolvimento', 'info');
}

// Mostrar loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// Mostrar toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="toast-icon ${icons[type]}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Gerar ID único para obra
function generateWorkId() {
    return 'work_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
