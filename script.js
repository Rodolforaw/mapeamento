// Configuração do Supabase
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuração do Google Maps
let map;
let drawingManager;
let currentDrawingMode = null;
let currentWork = null;
let works = [];
let selectedWork = null;

// Coordenadas de Maricá, RJ
const MARICA_CENTER = CONFIG.MAP_CENTER;

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadWorksFromSupabase();
});

// Inicializar o mapa
function initializeMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: MARICA_CENTER,
        zoom: CONFIG.MAP_ZOOM,
        mapTypeId: google.maps.MapTypeId[CONFIG.MAP_TYPE.toUpperCase()],
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            {
                featureType: 'all',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'all',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#000000' }, { weight: 2 }]
            }
        ]
    });

    // Configurar o gerenciador de desenho
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        markerOptions: {
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="16" cy="16" r="12" fill="${CONFIG.COLORS.primary}" stroke="#ffffff" stroke-width="2"/>
                        <circle cx="16" cy="16" r="6" fill="#ffffff"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(32, 32)
            }
        },
        polygonOptions: {
            fillColor: CONFIG.COLORS.primary,
            fillOpacity: 0.3,
            strokeColor: CONFIG.COLORS.primary,
            strokeOpacity: 0.8,
            strokeWeight: 2
        },
        polylineOptions: {
            strokeColor: CONFIG.COLORS.primary,
            strokeOpacity: 0.8,
            strokeWeight: 3
        }
    });

    drawingManager.setMap(map);

    // Eventos do desenho
    google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
        const overlay = event.overlay;
        const type = event.type;
        
        // Adicionar propriedades personalizadas
        overlay.workId = generateWorkId();
        overlay.workType = type;
        overlay.workName = `Nova Obra ${works.length + 1}`;
        overlay.workDescription = '';
        overlay.workStatus = 'planejamento';
        overlay.workType = 'outros';
        overlay.workDate = new Date().toISOString().split('T')[0];
        overlay.isSelected = false;

        // Adicionar à lista de obras
        works.push(overlay);
        
        // Mostrar modal de informações
        showWorkModal(overlay);
        
        // Parar o modo de desenho
        drawingManager.setDrawingMode(null);
        updateToolButtons();
    });

    // Eventos de clique no mapa
    google.maps.event.addListener(map, 'click', function(event) {
        if (currentDrawingMode === 'edit') {
            // Lógica de edição será implementada
        }
    });
}

// Inicializar event listeners
function initializeEventListeners() {
    // Botões de ferramentas
    document.getElementById('drawPolygonBtn').addEventListener('click', () => setDrawingMode('polygon'));
    document.getElementById('drawMarkerBtn').addEventListener('click', () => setDrawingMode('marker'));
    document.getElementById('drawLineBtn').addEventListener('click', () => setDrawingMode('polyline'));
    document.getElementById('editBtn').addEventListener('click', () => setDrawingMode('edit'));
    document.getElementById('deleteBtn').addEventListener('click', () => setDrawingMode('delete'));

    // Botões de ação
    document.getElementById('saveBtn').addEventListener('click', saveCurrentWork);
    document.getElementById('loadBtn').addEventListener('click', loadWorksFromSupabase);
    document.getElementById('exportBtn').addEventListener('click', exportToKMZ);
    document.getElementById('importBtn').addEventListener('click', importKMZ);

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
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.kmz';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.addEventListener('change', handleFileImport);
    window.fileInput = fileInput;
}

// Definir modo de desenho
function setDrawingMode(mode) {
    currentDrawingMode = mode;
    
    if (mode === 'edit' || mode === 'delete') {
        drawingManager.setDrawingMode(null);
        // Ativar modo de seleção
        map.setOptions({ draggableCursor: 'crosshair' });
    } else {
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType[mode.toUpperCase()]);
        map.setOptions({ draggableCursor: 'default' });
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
        'planejamento': CONFIG.COLORS.warning,
        'em_andamento': CONFIG.COLORS.info,
        'pausada': CONFIG.COLORS.error,
        'concluida': CONFIG.COLORS.success
    };
    
    const color = statusColors[work.workStatus] || CONFIG.COLORS.primary;
    
    if (work.workType === 'marker') {
        work.setIcon({
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="16" cy="16" r="6" fill="#ffffff"/>
                </svg>
            `)}`,
            scaledSize: new google.maps.Size(32, 32)
        });
    } else if (work.workType === 'polygon') {
        work.setOptions({
            fillColor: color,
            strokeColor: color
        });
    } else if (work.workType === 'polyline') {
        work.setOptions({
            strokeColor: color
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
        map.setCenter(work.getPosition());
        map.setZoom(16);
    } else {
        const bounds = new google.maps.LatLngBounds();
        if (work.getPath) {
            work.getPath().forEach(point => bounds.extend(point));
        } else if (work.getPosition) {
            bounds.extend(work.getPosition());
        }
        map.fitBounds(bounds);
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
            work.setMap(null);
            works.splice(index, 1);
            updateWorksList();
            showToast('Obra deletada com sucesso!', 'success');
        }
    );
}

// Salvar obra atual
function saveCurrentWork() {
    if (works.length === 0) {
        showToast('Nenhuma obra para salvar!', 'warning');
        return;
    }
    
    saveWorksToSupabase();
}

// Salvar obras no Supabase
async function saveWorksToSupabase() {
    try {
        showLoading(true);
        
        const worksData = works.map(work => ({
            id: work.workId,
            name: work.workName,
            description: work.workDescription,
            status: work.workStatus,
            type: work.workType,
            date: work.workDate,
            geometry: getWorkGeometry(work),
            created_at: new Date().toISOString()
        }));
        
        const { error } = await supabase
            .from('works')
            .upsert(worksData);
        
        if (error) throw error;
        
        showToast('Obras salvas com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao salvar obras:', error);
        showToast('Erro ao salvar obras: ' + error.message, 'error');
    } finally {
        showLoading(false);
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
        works.forEach(work => work.setMap(null));
        works = [];
        
        // Carregar obras do banco
        if (data) {
            data.forEach(workData => {
                const work = createWorkFromData(workData);
                if (work) {
                    works.push(work);
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
            work = new google.maps.Marker({
                position: geometry.position,
                map: map,
                title: workData.name
            });
        } else if (workData.type === 'polygon') {
            work = new google.maps.Polygon({
                paths: geometry.paths,
                map: map
            });
        } else if (workData.type === 'polyline') {
            work = new google.maps.Polyline({
                path: geometry.path,
                map: map
            });
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

// Obter geometria da obra
function getWorkGeometry(work) {
    if (work.workType === 'marker') {
        return JSON.stringify({
            position: work.getPosition().toJSON()
        });
    } else if (work.workType === 'polygon') {
        return JSON.stringify({
            paths: work.getPath().getArray().map(point => point.toJSON())
        });
    } else if (work.workType === 'polyline') {
        return JSON.stringify({
            path: work.getPath().getArray().map(point => point.toJSON())
        });
    }
    return null;
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
        'planejamento': CONFIG.COLORS.warning,
        'em_andamento': CONFIG.COLORS.info,
        'pausada': CONFIG.COLORS.error,
        'concluida': CONFIG.COLORS.success
    };
    
    const color = statusColors[work.workStatus] || CONFIG.COLORS.primary;
    
    let coordinates = '';
    let geometry = '';
    
    if (work.workType === 'marker') {
        const pos = work.getPosition();
        coordinates = `${pos.lng()},${pos.lat()},0`;
        geometry = `<Point><coordinates>${coordinates}</coordinates></Point>`;
    } else if (work.workType === 'polygon') {
        const path = work.getPath();
        coordinates = path.getArray().map(point => `${point.lng()},${point.lat()},0`).join(' ');
        geometry = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    } else if (work.workType === 'polyline') {
        const path = work.getPath();
        coordinates = path.getArray().map(point => `${point.lng()},${point.lat()},0`).join(' ');
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

// Importar KMZ
function importKMZ() {
    window.fileInput.click();
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
        works.forEach(work => work.setMap(null));
        works = [];
        
        // Adicionar obras importadas
        kmlData.forEach(workData => {
            const work = createWorkFromKMLData(workData);
            if (work) {
                works.push(work);
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
            work = new google.maps.Marker({
                position: workData.position,
                map: map,
                title: workData.name
            });
        } else if (workData.type === 'polygon') {
            work = new google.maps.Polygon({
                paths: workData.paths,
                map: map
            });
        } else if (workData.type === 'polyline') {
            work = new google.maps.Polyline({
                path: workData.path,
                map: map
            });
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
    const showLabels = document.getElementById('showLabels').checked;
    map.setOptions({
        styles: showLabels ? [] : [
            {
                featureType: 'all',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });
}

// Alternar tráfego
function toggleTraffic() {
    const showTraffic = document.getElementById('showTraffic').checked;
    const trafficLayer = new google.maps.TrafficLayer();
    
    if (showTraffic) {
        trafficLayer.setMap(map);
    } else {
        trafficLayer.setMap(null);
    }
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
