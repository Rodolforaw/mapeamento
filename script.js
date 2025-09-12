// Script super simples - apenas mapa nativo
// SEM Google Maps - apenas Leaflet gratuito

let map;
let drawnItems;
let mapLayers = {};
let currentWork = null;
let syncInterval = null;
let lastSyncTime = null;
let isSyncing = false;

// Configuração do Supabase
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

// Configurações carregadas com sucesso

// Coordenadas de Maricá, RJ
const MARICA_CENTER = CONFIG.MAP_CENTER;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadWorksFromSupabase(); // Carregar obras salvas
    
    // Iniciar sincronização automática
    startAutoSync();
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

    // Eventos de desenho - Sistema completo de persistência
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        const type = event.layerType;
        
        // Adicionar propriedades personalizadas
        layer.workId = generateWorkId();
        layer.workType = type;
        layer.workName = `Obra ${drawnItems.getLayers().length + 1}`;
        layer.workDescription = '';
        layer.workStatus = 'planejamento';
        layer.workCategory = 'outros';
        layer.workDate = new Date().toISOString().split('T')[0];
        layer.isSelected = false;

        // Adicionar à camada de desenhos
        drawnItems.addLayer(layer);
        
        // Salvar automaticamente no Supabase
        saveDrawingToSupabase(layer);
        
        // Detectar mudanças para sincronização
        changeDetector();
        
        // Mostrar modal para preencher informações
        currentWork = layer;
        showWorkModal();
    });

    // Evento de edição - Salvar alterações
    map.on(L.Draw.Event.EDITED, function(event) {
        const layers = event.layers;
        let updatedCount = 0;
        
        layers.eachLayer(function(layer) {
            if (layer.workId) {
                updateDrawingInSupabase(layer);
                updatedCount++;
            }
        });
        
        showToast(`${updatedCount} obra(s) editada(s) e salva(s)!`, 'success');
        
        // Detectar mudanças para sincronização
        changeDetector();
    });

    // Evento de exclusão - Remover do Supabase
    map.on(L.Draw.Event.DELETED, function(event) {
        const layers = event.layers;
        let deletedCount = 0;
        
        layers.eachLayer(function(layer) {
            if (layer.workId) {
                deleteDrawingFromSupabase(layer.workId);
                deletedCount++;
            }
        });
        
        showToast(`${deletedCount} obra(s) excluída(s)!`, 'success');
        
        // Detectar mudanças para sincronização
        changeDetector();
    });

    // Evento de cancelamento de desenho
    map.on(L.Draw.Event.DRAWSTART, function(event) {
        console.log('Iniciando desenho:', event.layerType);
    });

    // Evento de finalização de desenho
    map.on(L.Draw.Event.DRAWSTOP, function(event) {
        console.log('Finalizando desenho:', event.layerType);
    });


    // Evento de clique em obra - Mostrar informações
    map.on('click', function(e) {
        // Lógica de clique será implementada se necessário
    });

    // Evento de clique em obra específica
    drawnItems.on('click', function(e) {
        const layer = e.layer;
        if (layer.workId) {
            // Atualizar obra atual para edição
            currentWork = layer;
            
            // Preencher modal com dados existentes
            document.getElementById('workNumber').value = layer.workNumber || '';
            document.getElementById('workProduct').value = layer.workProduct || '';
            document.getElementById('workMeasure').value = layer.workMeasure || '';
            document.getElementById('workObservation').value = layer.workObservation || '';
            
            // Mostrar modal
            showWorkModal();
        }
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
    
    // Botões de sincronização
    document.getElementById('syncBtn').addEventListener('click', manualSync);
    document.getElementById('clearBtn').addEventListener('click', clearMap);
    
    // Botões de gestão de dados
    document.getElementById('clearSectionBtn').addEventListener('click', clearSectionWithBackup);
    document.getElementById('backupBtn').addEventListener('click', downloadCompleteBackup);
    
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

// Salvar desenho automaticamente no Supabase
async function saveDrawingToSupabase(layer) {
    try {
        // Preparar dados da geometria
        let geometry;
        let workType;
        
        if (layer instanceof L.Marker) {
            workType = 'marker';
            geometry = {
                lat: layer.getLatLng().lat,
                lng: layer.getLatLng().lng
            };
        } else if (layer instanceof L.Polygon) {
            workType = 'polygon';
            geometry = {
                paths: layer.getLatLngs()[0].map(latlng => ({
                    lat: latlng.lat,
                    lng: latlng.lng
                }))
            };
        } else if (layer instanceof L.Polyline) {
            workType = 'polyline';
            geometry = {
                path: layer.getLatLngs().map(latlng => ({
                    lat: latlng.lat,
                    lng: latlng.lng
                }))
            };
        }
        
        const workData = {
            id: layer.workId,
            name: layer.workName,
            description: layer.workDescription || '',
            type: workType,
            geometry: JSON.stringify(geometry),
            work_number: '',
            product: '',
            measure: '',
            observation: '',
            status: 'planejamento',
            date: new Date().toISOString()
        };
        
        // Salvar no Supabase
        const saved = await saveWorkToSupabase(workData);
        if (saved) {
            console.log('Desenho salvo automaticamente:', layer.workName);
        } else {
            console.warn('Falha ao salvar desenho automaticamente');
        }
        
        return saved;
    } catch (error) {
        console.error('Erro ao salvar desenho automaticamente:', error);
        return false;
    }
}

// Atualizar obra no Supabase
async function updateWorkInSupabase(workData) {
    try {
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            console.warn('Supabase não carregado');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('works')
            .update(workData)
            .eq('id', workData.id);

        if (error) {
            console.error('Erro ao atualizar no Supabase:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
        return false;
    }
}

// Atualizar desenho no Supabase (para edições)
async function updateDrawingInSupabase(layer) {
    try {
        // Preparar dados da geometria atualizada
        let geometry;
        let workType;
        
        if (layer instanceof L.Marker) {
            workType = 'marker';
            geometry = {
                lat: layer.getLatLng().lat,
                lng: layer.getLatLng().lng
            };
        } else if (layer instanceof L.Polygon) {
            workType = 'polygon';
            geometry = {
                paths: layer.getLatLngs()[0].map(latlng => ({
                    lat: latlng.lat,
                    lng: latlng.lng
                }))
            };
        } else if (layer instanceof L.Polyline) {
            workType = 'polyline';
            geometry = {
                path: layer.getLatLngs().map(latlng => ({
                    lat: latlng.lat,
                    lng: latlng.lng
                }))
            };
        }
        
        const workData = {
            id: layer.workId,
            name: layer.workName || 'Obra Editada',
            description: layer.workDescription || '',
            type: workType,
            geometry: JSON.stringify(geometry),
            work_number: layer.workNumber || '',
            product: layer.workProduct || '',
            measure: layer.workMeasure || '',
            observation: layer.workObservation || '',
            status: layer.workStatus || 'planejamento',
            date: new Date().toISOString()
        };
        
        // Atualizar no Supabase
        const updated = await updateWorkInSupabase(workData);
        if (updated) {
            console.log('Desenho atualizado no Supabase:', layer.workName);
        } else {
            console.warn('Falha ao atualizar desenho no Supabase');
        }
        
        return updated;
    } catch (error) {
        console.error('Erro ao atualizar desenho no Supabase:', error);
        return false;
    }
}

// Excluir desenho do Supabase
async function deleteDrawingFromSupabase(workId) {
    try {
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            console.warn('Supabase não carregado');
            return false;
        }
        
        const { data, error } = await supabaseClient
            .from('works')
            .delete()
            .eq('id', workId);

        if (error) {
            console.error('Erro ao excluir do Supabase:', error);
            return false;
        }

        console.log('Desenho excluído do Supabase:', workId);
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
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar do Supabase:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log(`Carregando ${data.length} obras do Supabase...`);
            data.forEach(workData => {
                const work = createWorkFromData(workData);
                if (work) {
                    drawnItems.addLayer(work);
                }
            });
            console.log('Obras carregadas com sucesso!');
        } else {
            console.log('Nenhuma obra encontrada no Supabase');
        }
    } catch (error) {
        console.error('Erro ao conectar com Supabase:', error);
    }
}

// Sincronizar estado do mapa com Supabase
async function syncMapWithSupabase() {
    try {
        console.log('Sincronizando mapa com Supabase...');
        showToast('Sincronizando mapa...', 'info');
        
        // Limpar obras existentes
        drawnItems.clearLayers();
        
        // Carregar obras do Supabase
        await loadWorksFromSupabase();
        
        console.log('Sincronização concluída!');
        showToast('Mapa sincronizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
        showToast('Erro na sincronização', 'error');
    }
}

// Limpar mapa (apenas visualmente)
function clearMap() {
    if (confirm('Tem certeza que deseja limpar o mapa? Esta ação não exclui as obras do banco de dados.')) {
        drawnItems.clearLayers();
        showToast('Mapa limpo!', 'success');
    }
}

// Limpar seção com backup automático
async function clearSectionWithBackup() {
    const layers = drawnItems.getLayers();
    
    if (layers.length === 0) {
        showToast('Nenhuma obra para limpar!', 'warning');
        return;
    }
    
    // Mostrar diálogo de confirmação
    const confirmMessage = `
        ⚠️ ATENÇÃO: Esta ação irá:
        
        ✅ Fazer backup automático (download KMZ)
        ❌ Excluir TODAS as ${layers.length} obras do banco de dados
        ❌ Limpar o mapa completamente
        
        Esta ação NÃO PODE ser desfeita!
        
        Deseja continuar?
    `;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        showToast('Iniciando limpeza de seção...', 'info');
        
        // 1. Fazer backup automático
        showToast('Fazendo backup automático...', 'info');
        await downloadCompleteBackup();
        
        // Aguardar um pouco para o download
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. Excluir todas as obras do Supabase
        showToast('Excluindo obras do banco de dados...', 'info');
        const deletedCount = await deleteAllWorksFromSupabase();
        
        // 3. Limpar mapa
        drawnItems.clearLayers();
        
        showToast(`Seção limpa! ${deletedCount} obras excluídas e backup salvo.`, 'success');
        
    } catch (error) {
        console.error('Erro ao limpar seção:', error);
        showToast('Erro ao limpar seção: ' + error.message, 'error');
    }
}

// Download de backup completo
async function downloadCompleteBackup() {
    try {
        const layers = drawnItems.getLayers();
        
        if (layers.length === 0) {
            showToast('Nenhuma obra para fazer backup!', 'warning');
            return;
        }
        
        showToast('Gerando backup completo...', 'info');
        
        // Gerar KMZ com timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const kmlContent = generateKML();
        const zip = new JSZip();
        
        zip.file('doc.kml', kmlContent);
        
        // Adicionar arquivo de metadados
        const metadata = {
            exportDate: new Date().toISOString(),
            totalWorks: layers.length,
            works: layers.map(layer => ({
                id: layer.workId,
                name: layer.workName,
                type: layer.workType,
                workNumber: layer.workNumber,
                workProduct: layer.workProduct,
                workMeasure: layer.workMeasure,
                workObservation: layer.workObservation
            }))
        };
        
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));
        
        const blob = await zip.generateAsync({ type: 'blob' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_obras_${timestamp}.kmz`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`Backup completo salvo! ${layers.length} obras exportadas.`, 'success');
        
    } catch (error) {
        console.error('Erro ao gerar backup:', error);
        showToast('Erro ao gerar backup: ' + error.message, 'error');
    }
}

// Excluir todas as obras do Supabase
async function deleteAllWorksFromSupabase() {
    try {
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            throw new Error('Supabase não carregado');
        }
        
        // Buscar todas as obras
        const { data: works, error: fetchError } = await supabaseClient
            .from('works')
            .select('id');
            
        if (fetchError) {
            throw new Error('Erro ao buscar obras: ' + fetchError.message);
        }
        
        if (!works || works.length === 0) {
            return 0;
        }
        
        // Excluir todas as obras
        const { error: deleteError } = await supabaseClient
            .from('works')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Excluir todas (truque para excluir tudo)
            
        if (deleteError) {
            throw new Error('Erro ao excluir obras: ' + deleteError.message);
        }
        
        console.log(`${works.length} obras excluídas do Supabase`);
        return works.length;
        
    } catch (error) {
        console.error('Erro ao excluir obras do Supabase:', error);
        throw error;
    }
}

// ==================== SISTEMA DE SINCRONIZAÇÃO EM TEMPO REAL ====================

// Iniciar sincronização automática
function startAutoSync() {
    // Sincronizar a cada 30 segundos
    syncInterval = setInterval(async () => {
        if (!isSyncing) {
            await smartSync();
        }
    }, 30000); // 30 segundos
    
    // Sincronizar quando a página ganha foco
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && !isSyncing) {
            await smartSync();
        }
    });
    
    // Sincronizar quando a janela ganha foco
    window.addEventListener('focus', async () => {
        if (!isSyncing) {
            await smartSync();
        }
    });
    
    updateSyncStatus('connected', 'Conectado');
}

// Parar sincronização automática
function stopAutoSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    updateSyncStatus('error', 'Desconectado');
}

// Atualizar status de sincronização
function updateSyncStatus(status, text) {
    const statusElement = document.getElementById('syncStatus');
    const statusTextElement = document.getElementById('syncStatusText');
    const lastSyncElement = document.getElementById('lastSync');
    
    if (statusElement) {
        statusElement.className = `status-indicator ${status}`;
    }
    
    if (statusTextElement) {
        statusTextElement.textContent = text;
    }
    
    if (lastSyncElement && lastSyncTime) {
        const timeAgo = getTimeAgo(lastSyncTime);
        lastSyncElement.textContent = `Última sincronização: ${timeAgo}`;
    }
}

// Calcular tempo decorrido
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes}m atrás`;
    } else {
        return `${seconds}s atrás`;
    }
}

// Sincronização inteligente (detecta mudanças)
async function smartSync() {
    if (isSyncing) return;
    
    try {
        isSyncing = true;
        updateSyncStatus('syncing', 'Sincronizando...');
        
        // 1. Buscar obras do Supabase
        const supabaseClient = createSupabaseClient();
        if (!supabaseClient) {
            throw new Error('Supabase não carregado');
        }
        
        const { data: works, error } = await supabaseClient
            .from('works')
            .select('*')
            .order('updated_at', { ascending: false });
            
        if (error) {
            throw new Error('Erro ao buscar obras: ' + error.message);
        }
        
        // 2. Comparar com obras locais
        const localWorks = drawnItems.getLayers();
        const localWorkIds = new Set(localWorks.map(layer => layer.workId));
        const remoteWorkIds = new Set(works.map(work => work.id));
        
        // 3. Adicionar obras novas do servidor
        for (const workData of works) {
            if (!localWorkIds.has(workData.id)) {
                console.log('Adicionando obra do servidor:', workData.name);
                const work = createWorkFromData(workData);
                if (work) {
                    drawnItems.addLayer(work);
                }
            }
        }
        
        // 4. Remover obras que não existem mais no servidor
        for (const layer of localWorks) {
            if (!remoteWorkIds.has(layer.workId)) {
                console.log('Removendo obra obsoleta:', layer.workName);
                drawnItems.removeLayer(layer);
            }
        }
        
        lastSyncTime = new Date();
        updateSyncStatus('connected', 'Sincronizado');
        
        console.log(`Sincronização concluída: ${works.length} obras no servidor`);
        
    } catch (error) {
        console.error('Erro na sincronização:', error);
        updateSyncStatus('error', 'Erro na sincronização');
        showToast('Erro na sincronização: ' + error.message, 'error');
    } finally {
        isSyncing = false;
    }
}

// Sincronização manual (botão)
async function manualSync() {
    if (isSyncing) {
        showToast('Sincronização já em andamento...', 'warning');
        return;
    }
    
    showToast('Iniciando sincronização manual...', 'info');
    await smartSync();
    showToast('Sincronização manual concluída!', 'success');
}

// Detectar mudanças locais e sincronizar
function detectAndSyncChanges() {
    // Sincronizar após 5 segundos de inatividade
    let timeoutId;
    
    return function() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
            if (!isSyncing) {
                await smartSync();
            }
        }, 5000);
    };
}

// Criar detector de mudanças
const changeDetector = detectAndSyncChanges();

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
        work.workId = workData.id || generateWorkId(); // Usar ID do banco ou gerar novo
        work.workNumber = workData.work_number || '';
        work.workProduct = workData.product || '';
        work.workMeasure = workData.measure || '';
        work.workObservation = workData.observation || '';
        work.workName = workData.name || 'Obra sem nome';
        work.workDescription = workData.description || '';
        work.workStatus = workData.status || 'planejamento';
        work.workType = workData.type || 'marker';
        work.workCategory = 'outros';
        work.workDate = workData.date || new Date().toISOString().split('T')[0];
        work.isSelected = false;
        
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
        id: currentWork.workId, // Usar ID existente
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
    
    // Atualizar no Supabase
    const updated = await updateWorkInSupabase(workData);
    if (updated) {
        showToast('Obra atualizada com sucesso!', 'success');
    } else {
        showToast('Obra atualizada localmente (erro ao conectar com servidor)', 'warning');
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
        
        // Adicionar obras importadas e salvar no Supabase
        let importedCount = 0;
        let savedCount = 0;
        
        for (const workData of kmlData) {
            const work = createWorkFromKMLData(workData);
            if (work) {
                drawnItems.addLayer(work);
                importedCount++;
                
                // Preparar dados para Supabase
                const supabaseData = prepareKMLDataForSupabase(workData);
                if (supabaseData) {
                    // Salvar no Supabase
                    const saved = await saveWorkToSupabase(supabaseData);
                    if (saved) {
                        savedCount++;
                    }
                }
            }
        }
        
        if (savedCount === importedCount) {
            showToast(`${importedCount} obras importadas e salvas com sucesso!`, 'success');
        } else {
            showToast(`${importedCount} obras importadas, ${savedCount} salvas no banco`, 'warning');
        }
        
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

// Preparar dados KML para salvamento no Supabase
function prepareKMLDataForSupabase(workData) {
    try {
        let geometry;
        let workType;
        
        if (workData.workType === 'marker') {
            workType = 'marker';
            geometry = {
                lat: workData.position.lat,
                lng: workData.position.lng
            };
        } else if (workData.workType === 'polygon') {
            workType = 'polygon';
            geometry = {
                paths: workData.paths.map(coord => ({
                    lat: coord.lat,
                    lng: coord.lng
                }))
            };
        } else if (workData.workType === 'polyline') {
            workType = 'polyline';
            geometry = {
                path: workData.path.map(coord => ({
                    lat: coord.lat,
                    lng: coord.lng
                }))
            };
        }
        
        return {
            id: generateWorkId(),
            name: workData.name || 'Obra Importada',
            description: workData.description || '',
            type: workType,
            geometry: JSON.stringify(geometry),
            work_number: workData.workNumber || '',
            product: workData.workProduct || '',
            measure: workData.workMeasure || '',
            observation: workData.workObservation || '',
            status: 'planejamento',
            date: new Date().toISOString()
        };
    } catch (error) {
        console.error('Erro ao preparar dados KML para Supabase:', error);
        return null;
    }
}

// Gerar ID único para obra
function generateWorkId() {
    return 'work_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}