// Script super simples - apenas mapa nativo
// SEM Google Maps - apenas Leaflet gratuito

let map;
let drawnItems;
let mapLayers = {};
let currentWork = null;

// Configuração do Supabase
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

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

// Funções do Supabase
function createSupabaseClient() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase não está carregado');
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Salvar obra no Supabase
async function saveWorkToSupabase(workData) {
    try {
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            console.warn('Supabase não carregado');
            return false;
        }

        const { data, error } = await supabaseClient
            .from('works')
            .insert([workData]);

        if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
        return false;
    }
}

// Carregar obras do Supabase
async function loadWorksFromSupabase() {
    try {
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            console.warn('Supabase não carregado');
            return;
        }

        const { data, error } = await supabaseClient
            .from('works')
            .select('*');

        if (error) {
            console.error('Erro ao carregar do Supabase:', error);
            return;
        }

        if (data && data.length > 0) {
            data.forEach(workData => {
                const work = createWorkFromData(workData);
                if (work) {
                    drawnItems.addLayer(work);
                }
            });
        }
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
    }
}

// Criar obra a partir dos dados do Supabase
function createWorkFromData(workData) {
    try {
        let work;
        let geometry;
        
        // Verificar se geometry é string ou objeto
        if (typeof workData.geometry === 'string') {
            geometry = JSON.parse(workData.geometry);
        } else {
            geometry = workData.geometry;
        }
        
        if (workData.type === 'marker') {
            work = L.marker([geometry.lat, geometry.lng]);
        } else if (workData.type === 'polygon') {
            work = L.polygon(geometry.paths);
        } else if (workData.type === 'polyline') {
            work = L.polyline(geometry.path);
        } else {
            return null;
        }
        
        // Adicionar propriedades da obra
        work.workNumber = workData.work_number || '';
        work.workProduct = workData.product || '';
        work.workMeasure = workData.measure || '';
        work.workObservation = workData.observation || '';
        work.workName = workData.name || 'Obra sem nome';
        
        // Adicionar popup
        work.bindPopup(`
            <div class="work-popup">
                <h4>${work.workName}</h4>
                <p><strong>OS:</strong> ${work.workNumber}</p>
                <p><strong>Produto:</strong> ${work.workProduct}</p>
                <p><strong>Medida:</strong> ${work.workMeasure}</p>
                <p><strong>Observação:</strong> ${work.workObservation}</p>
            </div>
        `);
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra:', error);
        return null;
    }
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
async function saveWorkInfo() {
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
    
    // Preparar dados para salvar no Supabase
    let geometry;
    let workType;
    
    if (currentWork instanceof L.Marker) {
        workType = 'marker';
        geometry = {
            lat: currentWork.getLatLng().lat,
            lng: currentWork.getLatLng().lng
        };
    } else if (currentWork instanceof L.Polygon) {
        workType = 'polygon';
        geometry = {
            paths: currentWork.getLatLngs()[0].map(latlng => ({
                lat: latlng.lat,
                lng: latlng.lng
            }))
        };
    } else if (currentWork instanceof L.Polyline) {
        workType = 'polyline';
        geometry = {
            path: currentWork.getLatLngs().map(latlng => ({
                lat: latlng.lat,
                lng: latlng.lng
            }))
        };
    }
    
    const workData = {
        name: currentWork.workName,
        description: workObservation,
        type: workType,
        geometry: JSON.stringify(geometry),
        work_number: workNumber,
        product: workProduct,
        measure: workMeasure,
        observation: workObservation,
        status: 'planejamento',
        date: new Date().toISOString()
    };
    
    // Salvar no Supabase
    const saved = await saveWorkToSupabase(workData);
    if (saved) {
        showToast('Obra salva com sucesso!', 'success');
    } else {
        showToast('Obra salva localmente (erro ao conectar com servidor)', 'warning');
    }
    
    hideWorkModal();
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
        const fileName = file.name.toLowerCase();
        const isKMZ = fileName.endsWith('.kmz');
        const isKML = fileName.endsWith('.kml');
        
        if (!isKMZ && !isKML) {
            throw new Error('Por favor, selecione um arquivo KMZ ou KML válido');
        }
        
        // Validar tamanho do arquivo (máximo 10MB)
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('Arquivo muito grande. Máximo 10MB permitido');
        }
        
        let kmlContent;
        
        if (isKML) {
            // Arquivo KML direto
            showToast('Importando arquivo KML...', 'info');
            kmlContent = await file.text();
        } else {
            // Arquivo KMZ (ZIP)
            showToast('Importando arquivo KMZ...', 'info');
            
            // Ler arquivo como array buffer
            const arrayBuffer = await file.arrayBuffer();
            
            // Verificar se é um arquivo ZIP válido
            if (arrayBuffer.byteLength < 22) {
                throw new Error('Arquivo inválido ou corrompido');
            }
            
            // Verificar assinatura ZIP
            const view = new Uint8Array(arrayBuffer);
            const zipSignature = view[0] === 0x50 && view[1] === 0x4B; // PK
            if (!zipSignature) {
                throw new Error('Arquivo não é um ZIP válido. Verifique se o arquivo não está corrompido.');
            }
            
            try {
                // Processar com JSZip
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(arrayBuffer);
                
                // Procurar arquivo KML (pode ter diferentes nomes)
                const kmlFiles = Object.keys(zipContent.files).filter(name => name.endsWith('.kml'));
                if (kmlFiles.length === 0) {
                    throw new Error('Arquivo KML não encontrado no KMZ');
                }
                
                // Usar o primeiro arquivo KML encontrado
                const kmlFile = zipContent.file(kmlFiles[0]);
                if (!kmlFile) {
                    throw new Error('Não foi possível acessar o arquivo KML');
                }
                
                kmlContent = await kmlFile.async('text');
            } catch (zipError) {
                if (zipError.message.includes('end of central directory')) {
                    throw new Error('Arquivo KMZ corrompido ou não é um ZIP válido. Tente exportar novamente do Google Earth.');
                }
                throw zipError;
            }
        }
        
        // Validar conteúdo KML
        if (!kmlContent || kmlContent.trim().length === 0) {
            throw new Error('Arquivo KML está vazio ou corrompido');
        }
        
        // Verificar se é um KML válido
        if (!kmlContent.includes('<kml') && !kmlContent.includes('<KML')) {
            throw new Error('Arquivo não é um KML válido');
        }
        
        const kmlData = await parseKML(kmlContent);
        
        if (!kmlData || kmlData.length === 0) {
            throw new Error('Nenhuma obra encontrada no arquivo');
        }
        
        // Limpar obras existentes
        drawnItems.clearLayers();
        
        // Adicionar obras importadas
        let importedCount = 0;
        kmlData.forEach(workData => {
            const work = createWorkFromKMLData(workData);
            if (work) {
                drawnItems.addLayer(work);
                importedCount++;
            }
        });
        
        showToast(`${importedCount} obras importadas com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao importar arquivo:', error);
        showToast('Erro ao importar: ' + error.message, 'error');
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

// Parsear KML usando DOMParser (mais confiável)
async function parseKML(kmlContent) {
    return new Promise((resolve, reject) => {
        try {
            // Usar DOMParser para parsing XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
            
            // Verificar se há erros de parsing
            const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
            if (parseError) {
                throw new Error('Erro ao fazer parse do XML: ' + parseError.textContent);
            }
            
            // Buscar todos os Placemarks
            const placemarks = xmlDoc.getElementsByTagName('Placemark');
            const works = [];
            
            for (let i = 0; i < placemarks.length; i++) {
                const placemark = placemarks[i];
                
                // Extrair nome
                const nameElement = placemark.getElementsByTagName('name')[0];
                const name = nameElement ? nameElement.textContent.trim() : 'Obra sem nome';
                
                // Extrair descrição
                const descElement = placemark.getElementsByTagName('description')[0];
                const description = descElement ? descElement.textContent.trim() : '';
                
                let workData = {
                    name: name,
                    description: description,
                    workNumber: '',
                    workProduct: '',
                    workMeasure: '',
                    workObservation: ''
                };
                
                // Verificar tipo de geometria
                const point = placemark.getElementsByTagName('Point')[0];
                const polygon = placemark.getElementsByTagName('Polygon')[0];
                const lineString = placemark.getElementsByTagName('LineString')[0];
                
                if (point) {
                    // Marcador
                    workData.workType = 'marker';
                    const coordsElement = point.getElementsByTagName('coordinates')[0];
                    if (coordsElement) {
                        const coords = coordsElement.textContent.trim().split(',');
                        workData.position = {
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0])
                        };
                    }
                } else if (polygon) {
                    // Polígono
                    workData.workType = 'polygon';
                    const coordsElement = polygon.getElementsByTagName('coordinates')[0];
                    if (coordsElement) {
                        const coords = coordsElement.textContent.trim();
                        workData.paths = coords.split(' ').map(coord => {
                            const parts = coord.split(',');
                            return {
                                lat: parseFloat(parts[1]),
                                lng: parseFloat(parts[0])
                            };
                        });
                    }
                } else if (lineString) {
                    // Linha
                    workData.workType = 'polyline';
                    const coordsElement = lineString.getElementsByTagName('coordinates')[0];
                    if (coordsElement) {
                        const coords = coordsElement.textContent.trim();
                        workData.path = coords.split(' ').map(coord => {
                            const parts = coord.split(',');
                            return {
                                lat: parseFloat(parts[1]),
                                lng: parseFloat(parts[0])
                            };
                        });
                    }
                }
                
                // Só adicionar se tiver geometria válida
                if (workData.position || workData.paths || workData.path) {
                    works.push(workData);
                }
            }
            
            resolve(works);
        } catch (error) {
            reject(error);
        }
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
