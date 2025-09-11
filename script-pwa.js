// Script para versão PWA - Sistema de Controle de Obras
// Usando Leaflet (gratuito) - SEM Google Maps API

let map;
let drawnItems;
let currentDrawingMode = null;
let currentWork = null;
let works = [];
let selectedWork = null;
let mapLayers = {};

// Coordenadas de Maricá, RJ
const MARICA_CENTER = CONFIG.MAP_CENTER;

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadWorksFromSupabase();
    
    // Registrar service worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});

// Inicializar o mapa
function initializeMap() {
    // Inicializar o mapa
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

    // Controle de camadas
    const baseMaps = {
        [CONFIG.MAP_LAYERS.streets.name]: mapLayers.streets,
        [CONFIG.MAP_LAYERS.satellite.name]: mapLayers.satellite,
        [CONFIG.MAP_LAYERS.topo.name]: mapLayers.topo
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
        
        // Atualizar painel de informações
        updateWorkInfoPanel();
    });

    // Evento de edição
    map.on(L.Draw.Event.EDITED, function(event) {
        updateWorkInfoPanel();
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
        updateWorkInfoPanel();
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
    // Botão de sincronização
    document.getElementById('syncBtn').addEventListener('click', syncWithPC);

    // Botões de ferramentas
    document.getElementById('drawPolygonBtn').addEventListener('click', () => setDrawingMode('polygon'));
    document.getElementById('drawMarkerBtn').addEventListener('click', () => setDrawingMode('marker'));
    document.getElementById('drawLineBtn').addEventListener('click', () => setDrawingMode('polyline'));
    document.getElementById('editBtn').addEventListener('click', () => setDrawingMode('edit'));
    document.getElementById('deleteBtn').addEventListener('click', () => setDrawingMode('delete'));

    // Modal de obra
    document.getElementById('closeModal').addEventListener('click', hideWorkModal);
    document.getElementById('cancelWork').addEventListener('click', hideWorkModal);
    document.getElementById('saveWork').addEventListener('click', saveWorkInfo);

    // Modal de confirmação
    document.getElementById('cancelConfirm').addEventListener('click', hideConfirmModal);
    document.getElementById('confirmAction').addEventListener('click', confirmAction);

    // Botões de ação da obra
    document.getElementById('editWorkBtn').addEventListener('click', editSelectedWork);
    document.getElementById('deleteWorkBtn').addEventListener('click', deleteSelectedWork);
}

// Sincronizar com PC
async function syncWithPC() {
    try {
        showLoading(true);
        await loadWorksFromSupabase();
        showToast('Sincronização concluída!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showToast('Erro na sincronização: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
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
    document.querySelectorAll('.control-btn').forEach(btn => {
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
    
    // Atualizar painel de informações
    updateWorkInfoPanel();
    
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

// Atualizar painel de informações
function updateWorkInfoPanel() {
    const workInfoPanel = document.getElementById('workInfo');
    const workName = document.getElementById('workName');
    const workDescription = document.getElementById('workDescription');
    
    if (works.length === 0) {
        workInfoPanel.classList.remove('show');
        return;
    }
    
    // Mostrar painel se houver obras
    workInfoPanel.classList.add('show');
    
    // Atualizar informações
    workName.textContent = `${works.length} obra(s) cadastrada(s)`;
    workDescription.textContent = 'Toque em uma obra no mapa para ver os detalhes';
}

// Editar obra selecionada
function editSelectedWork() {
    if (selectedWork) {
        showWorkModal(selectedWork);
    } else {
        showToast('Selecione uma obra primeiro', 'warning');
    }
}

// Deletar obra selecionada
function deleteSelectedWork() {
    if (selectedWork) {
        showConfirmModal(
            `Tem certeza que deseja deletar a obra "${selectedWork.workName}"?`,
            () => {
                drawnItems.removeLayer(selectedWork);
                const index = works.findIndex(work => work.workId === selectedWork.workId);
                if (index !== -1) {
                    works.splice(index, 1);
                }
                selectedWork = null;
                updateWorkInfoPanel();
                showToast('Obra deletada com sucesso!', 'success');
            }
        );
    } else {
        showToast('Selecione uma obra primeiro', 'warning');
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
        
        updateWorkInfoPanel();
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
            
            // Adicionar evento de clique
            work.on('click', function() {
                selectWork(work);
            });
            
            updateWorkVisual(work);
        }
        
        return work;
    } catch (error) {
        console.error('Erro ao criar obra:', error);
        return null;
    }
}

// Selecionar obra
function selectWork(work) {
    // Remover seleção anterior
    works.forEach(w => w.isSelected = false);
    
    // Selecionar obra atual
    work.isSelected = true;
    selectedWork = work;
    
    // Atualizar painel de informações
    const workInfoPanel = document.getElementById('workInfo');
    const workName = document.getElementById('workName');
    const workDescription = document.getElementById('workDescription');
    
    workName.textContent = work.workName || 'Obra sem nome';
    workDescription.textContent = work.workDescription || 'Sem descrição';
    
    workInfoPanel.classList.add('show');
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
