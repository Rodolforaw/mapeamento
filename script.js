// Script super simples - apenas mapa nativo
// SEM Google Maps - apenas Leaflet gratuito

let map;
let drawnItems;
let mapLayers = {};
let currentWork = null;

// Coordenadas de Maricá, RJ
const MARICA_CENTER = CONFIG.MAP_CENTER;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
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

    // Configurar controles de desenho nativos do Leaflet
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
    
    // Conectar botões personalizados com o Leaflet.draw
    connectCustomDrawButtons();

    // Eventos de desenho
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        const type = event.layerType;
        
        // Adicionar propriedades personalizadas
        layer.workId = generateWorkId();
        layer.workType = type;
        layer.workName = `Obra ${drawnItems.getLayers().length + 1}`;
        layer.workDescription = '';
        layer.workStatus = 'planejamento';
        layer.workType = 'outros';
        layer.workDate = new Date().toISOString().split('T')[0];
        layer.isSelected = false;

        // Adicionar à camada de desenhos
        drawnItems.addLayer(layer);
        
        // Mostrar modal para preencher informações
        currentWork = layer;
        showWorkModal();
    });

    // Evento de edição
    map.on(L.Draw.Event.EDITED, function(event) {
        showToast('Obra editada!', 'success');
    });

    // Evento de exclusão
    map.on(L.Draw.Event.DELETED, function(event) {
        showToast('Obra deletada!', 'success');
    });

    // Evento de clique em obra
    map.on('click', function(e) {
        // Lógica de clique será implementada se necessário
    });
}

// Inicializar event listeners
function initializeEventListeners() {
    // Menu hambúrguer
    document.getElementById('menuToggle').addEventListener('click', toggleSideMenu);
    document.getElementById('closeMenu').addEventListener('click', toggleSideMenu);
    
    // Controle de camada
    document.getElementById('layerSelect').addEventListener('change', function(e) {
        const layer = e.target.value;
        changeMapLayer(layer);
    });
    
    // Botões KMZ
    document.getElementById('importBtn').addEventListener('click', importKMZ);
    document.getElementById('exportBtn').addEventListener('click', exportToKMZ);
    
    // Modal
    document.getElementById('closeModal').addEventListener('click', hideWorkModal);
    document.getElementById('cancelWork').addEventListener('click', hideWorkModal);
    document.getElementById('saveWork').addEventListener('click', saveWorkInfo);
    
    // Input de arquivo
    document.getElementById('fileInput').addEventListener('change', handleFileImport);
}

// Alternar menu lateral
function toggleSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    sideMenu.classList.toggle('open');
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


// Mostrar toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Mostrar modal de obra
function showWorkModal() {
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
    
    const workNumber = document.getElementById('workNumber').value;
    const workProduct = document.getElementById('workProduct').value;
    const workMeasure = document.getElementById('workMeasure').value;
    const workObservation = document.getElementById('workObservation').value;
    
    if (!workNumber || !workProduct || !workMeasure) {
        showToast('Preencha todos os campos obrigatórios!', 'error');
        return;
    }
    
    // Atualizar propriedades da obra
    currentWork.workNumber = workNumber;
    currentWork.workProduct = workProduct;
    currentWork.workMeasure = workMeasure;
    currentWork.workObservation = workObservation;
    currentWork.workName = `OS ${workNumber} - ${workProduct}`;
    
    hideWorkModal();
    showToast('Obra salva com sucesso!', 'success');
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
        drawnItems.clearLayers();
        
        // Adicionar obras importadas
        kmlData.forEach(workData => {
            const work = createWorkFromKMLData(workData);
            if (work) {
                drawnItems.addLayer(work);
            }
        });
        
        showToast(`${kmlData.length} obras importadas com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao importar KMZ:', error);
        showToast('Erro ao importar KMZ: ' + error.message, 'error');
    } finally {
        event.target.value = '';
    }
}

// Exportar para KMZ
async function exportToKMZ() {
    const layers = drawnItems.getLayers();
    if (layers.length === 0) {
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
        a.download = `obras_${new Date().toISOString().split('T')[0]}.kmz`;
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
    const layers = drawnItems.getLayers();
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>Obras</name>
        <description>Sistema de Controle de Obras</description>
        ${layers.map(work => generateKMLPlacemark(work)).join('')}
    </Document>
</kml>`;
    
    return kml;
}

// Gerar placemark KML para uma obra
function generateKMLPlacemark(work) {
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
                    <b>Número da OS:</b> ${work.workNumber || 'Não informado'}<br/>
                    <b>Produto:</b> ${work.workProduct || 'Não informado'}<br/>
                    <b>Medida:</b> ${work.workMeasure || 'Não informado'}<br/>
                    <b>Observação:</b> ${work.workObservation || 'Sem observação'}
                ]]>
            </description>
            <Style>
                <LineStyle>
                    <color>ff6d28d9</color>
                    <width>2</width>
                </LineStyle>
                <PolyStyle>
                    <color>806d28d9</color>
                </PolyStyle>
            </Style>
            ${geometry}
        </Placemark>`;
}

// Parsear KML
async function parseKML(kmlContent) {
    return new Promise((resolve, reject) => {
        // Verificar se xml2js está disponível
        if (typeof xml2js === 'undefined') {
            reject(new Error('xml2js não está carregado. Recarregue a página.'));
            return;
        }
        
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
                        workNumber: '',
                        workProduct: '',
                        workMeasure: '',
                        workObservation: ''
                    };
                    
                    if (placemark.Point) {
                        workData.workType = 'marker';
                        const coords = placemark.Point[0].coordinates[0].split(',');
                        workData.position = {
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0])
                        };
                    } else if (placemark.Polygon) {
                        workData.workType = 'polygon';
                        const coords = placemark.Polygon[0].outerBoundaryIs[0].LinearRing[0].coordinates[0];
                        workData.paths = coords.split(' ').map(coord => {
                            const parts = coord.split(',');
                            return {
                                lat: parseFloat(parts[1]),
                                lng: parseFloat(parts[0])
                            };
                        });
                    } else if (placemark.LineString) {
                        workData.workType = 'polyline';
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
        
        if (workData.workType === 'marker') {
            work = L.marker([workData.position.lat, workData.position.lng]);
        } else if (workData.workType === 'polygon') {
            work = L.polygon(workData.paths);
        } else if (workData.workType === 'polyline') {
            work = L.polyline(workData.path);
        }
        
        if (work) {
            work.workId = generateWorkId();
            work.workName = workData.name;
            work.workNumber = workData.workNumber;
            work.workProduct = workData.workProduct;
            work.workMeasure = workData.workMeasure;
            work.workObservation = workData.workObservation;
            work.workDescription = workData.description;
            work.workStatus = 'planejamento';
            work.workType = workData.workType;
            work.workDate = new Date().toISOString().split('T')[0];
            work.isSelected = false;
        }
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra a partir do KML:', error);
        return null;
    }
}

// Gerar ID único para obra
function generateWorkId() {
    return 'work_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Conectar botões personalizados com Leaflet.draw
function connectCustomDrawButtons() {
    // Aguardar um pouco para garantir que os elementos estejam carregados
    setTimeout(() => {
        // Botão de linha
        const polylineBtn = document.querySelector('.leaflet-draw-draw-polyline');
        if (polylineBtn) {
            polylineBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Simular clique no botão nativo do Leaflet
                const nativePolylineBtn = document.querySelector('.leaflet-draw-toolbar-top .leaflet-draw-draw-polyline');
                if (nativePolylineBtn) {
                    nativePolylineBtn.click();
                }
            });
        }
        
        // Botão de polígono
        const polygonBtn = document.querySelector('.leaflet-draw-draw-polygon');
        if (polygonBtn) {
            polygonBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Simular clique no botão nativo do Leaflet
                const nativePolygonBtn = document.querySelector('.leaflet-draw-toolbar-top .leaflet-draw-draw-polygon');
                if (nativePolygonBtn) {
                    nativePolygonBtn.click();
                }
            });
        }
        
        // Botão de marcador
        const markerBtn = document.querySelector('.leaflet-draw-draw-marker');
        if (markerBtn) {
            markerBtn.addEventListener('click', function(e) {
                e.preventDefault();
                // Simular clique no botão nativo do Leaflet
                const nativeMarkerBtn = document.querySelector('.leaflet-draw-toolbar-top .leaflet-draw-draw-marker');
                if (nativeMarkerBtn) {
                    nativeMarkerBtn.click();
                }
            });
        }
    }, 100);
}
