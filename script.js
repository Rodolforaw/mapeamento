// Script super simples - apenas mapa nativo
// SEM Google Maps - apenas Leaflet gratuito

let map;
let drawnItems;
let mapLayers = {};

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
        showToast('Obra deletada!', 'success');
    });

    // Evento de clique em obra
    map.on('click', function(e) {
        // Lógica de clique será implementada se necessário
    });
}

// Inicializar event listeners
function initializeEventListeners() {
    // Controle de camada
    document.getElementById('layerSelect').addEventListener('change', function(e) {
        const layer = e.target.value;
        changeMapLayer(layer);
    });
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
