// Script super simples - apenas mapa e desenho
// SEM Google Maps - apenas Leaflet gratuito

let map;
let drawnItems;
let currentDrawingMode = null;
let works = [];
let selectedWork = null;
let mapLayers = {};

// Coordenadas de Maricá, RJ
const MARICA_CENTER = CONFIG.MAP_CENTER;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadWorksFromSupabase();
});

// Inicializar o mapa
function initializeMap() {
    // Criar mapa
    map = L.map('map').setView(MARICA_CENTER, CONFIG.MAP_ZOOM);

    // Criar camadas de mapa
    mapLayers.streets = L.tileLayer(CONFIG.MAP_LAYERS.streets.url, {
        attribution: CONFIG.MAP_LAYERS.streets.attribution,
        maxZoom: 19
    });

    mapLayers.satellite = L.tileLayer(CONFIG.MAP_LAYERS.satellite.url, {
        attribution: CONFIG.MAP_LAYERS.satellite.attribution,
        maxZoom: 19
    });

    mapLayers.topo = L.tileLayer(CONFIG.MAP_LAYERS.topo.url, {
        attribution: CONFIG.MAP_LAYERS.topo.attribution,
        maxZoom: 19
    });

    // Adicionar camada padrão (ruas)
    mapLayers.streets.addTo(map);

    // Inicializar camada para desenhos
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Configurar controles de desenho
    const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                shapeOptions: {
                    color: CONFIG.COLORS.primary,
                    fillColor: CONFIG.COLORS.primary,
                    fillOpacity: 0.3
                }
            },
            polyline: {
                shapeOptions: {
                    color: CONFIG.COLORS.primary,
                    weight: 3
                }
            },
            marker: {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${CONFIG.COLORS.primary}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
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
        layer.workName = `Obra ${works.length + 1}`;
        layer.workDescription = '';
        layer.workStatus = 'planejamento';
        layer.workType = 'outros';
        layer.workDate = new Date().toISOString().split('T')[0];
        layer.isSelected = false;

        // Adicionar à lista de obras
        works.push(layer);
        drawnItems.addLayer(layer);
        
        // Mostrar painel de informações
        showWorkInfo(layer);
        
        showToast('Obra criada!', 'success');
    });

    // Evento de edição
    map.on(L.Draw.Event.EDITED, function(event) {
        showToast('Obra editada!', 'success');
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
        showToast('Obra deletada!', 'success');
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
    // Controle de camada
    document.getElementById('layerSelect').addEventListener('change', function(e) {
        const layer = e.target.value;
        changeMapLayer(layer);
    });

    // Botões de ferramentas
    document.getElementById('drawPolygonBtn').addEventListener('click', () => setDrawingMode('polygon'));
    document.getElementById('drawMarkerBtn').addEventListener('click', () => setDrawingMode('marker'));
    document.getElementById('drawLineBtn').addEventListener('click', () => setDrawingMode('polyline'));
    document.getElementById('editBtn').addEventListener('click', () => setDrawingMode('edit'));
    document.getElementById('deleteBtn').addEventListener('click', () => setDrawingMode('delete'));
    document.getElementById('exportBtn').addEventListener('click', exportToKMZ);
    document.getElementById('importBtn').addEventListener('click', importKMZ);

    // Input de arquivo para importação
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileImport);
}

// Mudar camada do mapa
function changeMapLayer(layerName) {
    // Remover todas as camadas
    Object.values(mapLayers).forEach(layer => {
        map.removeLayer(layer);
    });
    
    // Adicionar camada selecionada
    if (mapLayers[layerName]) {
        mapLayers[layerName].addTo(map);
    }
}

// Definir modo de desenho
function setDrawingMode(mode) {
    currentDrawingMode = mode;
    
    // Ativar/desativar controles de desenho
    if (mode === 'edit') {
        map.editTools.startEdit();
    } else if (mode === 'delete') {
        map.editTools.startDelete();
    } else {
        map.editTools.stopEdit();
        map.editTools.stopDelete();
    }
    
    updateToolButtons();
}

// Atualizar botões de ferramentas
function updateToolButtons() {
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`#${currentDrawingMode}Btn`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// Mostrar informações da obra
function showWorkInfo(work) {
    const infoPanel = document.getElementById('infoPanel');
    const workName = document.getElementById('workName');
    const workDescription = document.getElementById('workDescription');
    const workStatus = document.getElementById('workStatus');
    const workType = document.getElementById('workType');
    
    workName.textContent = work.workName || 'Obra sem nome';
    workDescription.textContent = work.workDescription || 'Sem descrição';
    workStatus.textContent = `Status: ${work.workStatus || 'Não definido'}`;
    workType.textContent = `Tipo: ${work.workType || 'Não definido'}`;
    
    infoPanel.classList.add('show');
}

// Exportar para KMZ
async function exportToKMZ() {
    if (works.length === 0) {
        showToast('Nenhuma obra para exportar!', 'warning');
        return;
    }
    
    try {
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

// Importar KMZ
function importKMZ() {
    document.getElementById('fileInput').click();
}

// Manipular importação de arquivo
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
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
        
        showToast(`${works.length} obras importadas com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao importar KMZ:', error);
        showToast('Erro ao importar KMZ: ' + error.message, 'error');
    } finally {
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
        
        showToast(`${works.length} obras carregadas!`, 'success');
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
        showToast('Erro ao carregar obras: ' + error.message, 'error');
    }
}

// Criar obra a partir dos dados
function createWorkFromData(workData) {
    try {
        // Verificar se geometry é uma string ou objeto
        let geometry;
        if (typeof workData.geometry === 'string') {
            geometry = JSON.parse(workData.geometry);
        } else {
            geometry = workData.geometry;
        }
        
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
        }
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra:', error);
        return null;
    }
}

// Mostrar toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Gerar ID único para obra
function generateWorkId() {
    return 'work_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
