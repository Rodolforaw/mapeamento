// 🔧 SUAS CREDENCIAIS DO SUPABASE
// Obtenha em: https://supabase.com/dashboard > Settings > API
const SUPABASE_URL = 'https://etqcqbnhhpistlhzyutl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDM3MjQsImV4cCI6MjA3MzExOTcyNH0.7XkquFyx8NX0qAFUSpM-4eeNg00ZA6OT4tmG6HM1bCQ';

// Inicializar cliente Supabase
let supabaseClient = null;

// Função para inicializar Supabase
function initSupabase() {
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase inicializado com sucesso');
        return true;
    } else {
        console.error('Biblioteca Supabase não carregada');
        return false;
    }
}

// Função para salvar marcações no Supabase
async function saveMarkingsToSupabase(markings) {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase não inicializado');
        }

        // Preparar dados para inserção
        const markingsData = markings.map(marking => ({
            id: marking.id || generateId(),
            type: marking.type,
            coordinates: marking.coordinates || { lat: marking.lat, lng: marking.lng },
            properties: marking.properties || {},
            source: marking.properties?.source || 'manual', // 'manual' ou 'upload'
            timestamp: typeof marking.timestamp === 'string' ? new Date(marking.timestamp).getTime() : (marking.timestamp || Date.now()),
            last_modified: typeof marking.lastModified === 'string' ? new Date(marking.lastModified).getTime() : Date.now(),
            device_id: getDeviceId()
        }));

        // Usar upsert para inserir ou atualizar
        const { data, error } = await supabaseClient
            .from('markings')
            .upsert(markingsData, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            });

        if (error) {
            throw error;
        }

        console.log('Marcações salvas no Supabase:', data?.length || markingsData.length);
        return { success: true, data };

    } catch (error) {
        console.error('Erro ao salvar no Supabase:', error);
        return { success: false, error: error.message };
    }
}

// Função para carregar marcações do Supabase
async function loadMarkingsFromSupabase() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase não inicializado');
        }

        const { data, error } = await supabaseClient
            .from('markings')
            .select('*')
            .order('last_modified', { ascending: false });

        if (error) {
            throw error;
        }

        // Converter formato do Supabase para formato local
        const markings = data.map(item => ({
            id: item.id,
            type: item.type,
            lat: item.coordinates?.lat || item.lat,
            lng: item.coordinates?.lng || item.lng,
            coordinates: item.coordinates,
            properties: {
                ...item.properties,
                source: item.source || 'manual'
            },
            timestamp: typeof item.timestamp === 'string' ? new Date(item.timestamp).getTime() : item.timestamp,
            lastModified: typeof item.last_modified === 'string' ? new Date(item.last_modified).getTime() : item.last_modified
        }));

        console.log('Marcações carregadas do Supabase:', markings.length);
        return { success: true, markings };

    } catch (error) {
        console.error('Erro ao carregar do Supabase:', error);
        return { success: false, error: error.message, markings: [] };
    }
}

// Função para sincronizar com Supabase
async function syncWithSupabase() {
    try {
        console.log('🔄 Iniciando sincronização com Supabase...');
        
        // Verificar se as funções de status estão disponíveis
        if (typeof updateSyncStatus === 'function') {
            updateSyncStatus('syncing', 'Sincronizando com Supabase...');
        }

        // Carregar dados locais
        const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        console.log(`📱 Dados locais: ${localMarkings.length} marcações`);
        
        // Salvar dados locais no Supabase
        if (localMarkings.length > 0) {
            const saveResult = await saveMarkingsToSupabase(localMarkings);
            if (!saveResult.success) {
                throw new Error(saveResult.error);
            }
            console.log('✅ Dados locais salvos no Supabase');
        }

        // Carregar dados atualizados do Supabase
        const loadResult = await loadMarkingsFromSupabase();
        if (!loadResult.success) {
            throw new Error(loadResult.error);
        }
        
        console.log(`📡 Dados do Supabase: ${loadResult.markings.length} marcações`);

        // Fazer merge inteligente dos dados
        const mergedMarkings = mergeMarkings(localMarkings, loadResult.markings);
        console.log(`🔄 Dados mesclados: ${mergedMarkings.length} marcações`);

        // Atualizar localStorage com dados mesclados
        localStorage.setItem('controle_obra_markings', JSON.stringify(mergedMarkings));
        
        // Recarregar marcações no mapa se a função estiver disponível
        if (typeof drawnItems !== 'undefined' && drawnItems && typeof drawnItems.clearLayers === 'function') {
            drawnItems.clearLayers();
            if (typeof syncNewMarkings === 'function') {
                syncNewMarkings();
            }
        }
        
        // Atualizar dados de obras se a função estiver disponível
        if (typeof updateWorksData === 'function') {
            updateWorksData();
        }
        
        // Atualizar tabela se a função estiver disponível
        if (typeof refreshWorksTable === 'function') {
            refreshWorksTable();
        }
        
        if (typeof updateSyncStatus === 'function') {
            updateSyncStatus('synced', 'Sincronizado com Supabase');
        }
        
        if (typeof showSyncNotification === 'function') {
            showSyncNotification(`✅ Sincronização concluída! ${mergedMarkings.length} marcações`, 'success');
        }
        
        console.log('✅ Sincronização com Supabase concluída');
        return { success: true, count: mergedMarkings.length };

    } catch (error) {
        console.error('❌ Erro na sincronização com Supabase:', error);
        
        if (typeof updateSyncStatus === 'function') {
            updateSyncStatus('error', 'Erro na sincronização');
        }
        
        if (typeof showSyncNotification === 'function') {
            showSyncNotification(`❌ Erro: ${error.message}`, 'error');
        }
        
        return { success: false, error: error.message };
    }
}

// Função para mesclar marcações (evitar duplicatas)
function mergeMarkings(localMarkings, serverMarkings) {
    const merged = [...localMarkings];
    
    serverMarkings.forEach(serverMarking => {
        // Procurar por correspondência por ID primeiro
        let existingIndex = merged.findIndex(local => local.id === serverMarking.id);
        
        // Se não encontrar por ID, procurar por coordenadas e tipo
        if (existingIndex === -1) {
            existingIndex = merged.findIndex(local => 
                local.timestamp === serverMarking.timestamp ||
                (Math.abs(local.lat - serverMarking.lat) < 0.0001 && 
                 Math.abs(local.lng - serverMarking.lng) < 0.0001 && 
                 local.type === serverMarking.type)
            );
        }
        
        if (existingIndex >= 0) {
            // Manter a versão mais recente baseada em lastModified ou timestamp
            const localTime = typeof merged[existingIndex].lastModified === 'string' ? 
                new Date(merged[existingIndex].lastModified).getTime() : 
                (merged[existingIndex].lastModified || merged[existingIndex].timestamp || 0);
            const serverTime = typeof serverMarking.lastModified === 'string' ? 
                new Date(serverMarking.lastModified).getTime() : 
                (serverMarking.lastModified || serverMarking.timestamp || 0);
            
            if (serverTime > localTime) {
                console.log(`🔄 Atualizando marcação ${serverMarking.id} do servidor`);
                merged[existingIndex] = serverMarking;
            }
        } else {
            console.log(`➕ Adicionando nova marcação ${serverMarking.id} do servidor`);
            merged.push(serverMarking);
        }
    });
    
    // Ordenar por timestamp (garantir que são números)
    merged.sort((a, b) => {
        const aTime = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : (a.timestamp || 0);
        const bTime = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : (b.timestamp || 0);
        return bTime - aTime;
    });
    
    return merged;
}

// Função para deletar marcação no Supabase
async function deleteMarkingFromSupabase(markingId) {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase não inicializado');
        }

        const { error } = await supabaseClient
            .from('markings')
            .delete()
            .eq('id', markingId);

        if (error) {
            throw error;
        }

        console.log('Marcação deletada do Supabase:', markingId);
        return { success: true };

    } catch (error) {
        console.error('Erro ao deletar do Supabase:', error);
        return { success: false, error: error.message };
    }
}

// Função para gerar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Função para obter ID do dispositivo
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + generateId();
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Função para configurar sincronização automática com Supabase
function setupSupabaseSync() {
    console.log('🔄 Configurando sincronização automática com Supabase...');
    
    // Sincronização inicial
    if (supabaseClient) {
        // Sincronização automática a cada 15 segundos
        setInterval(async () => {
            if (navigator.onLine) {
                try {
                    await syncWithSupabase();
                } catch (error) {
                    console.error('❌ Erro na sincronização automática:', error);
                }
            }
        }, 15000);
        
        // Sincronizar quando voltar online
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada, sincronizando com Supabase...');
            setTimeout(async () => {
                try {
                    await syncWithSupabase();
                } catch (error) {
                    console.error('❌ Erro na sincronização após reconexão:', error);
                }
            }, 1000);
        });
        
        // Sincronizar quando a página ganha foco
        window.addEventListener('focus', () => {
            if (navigator.onLine) {
                console.log('👁️ Página em foco, verificando sincronização...');
                setTimeout(async () => {
                    try {
                        await syncWithSupabase();
                    } catch (error) {
                        console.error('❌ Erro na sincronização ao ganhar foco:', error);
                    }
                }, 500);
            }
        });
        
        console.log('✅ Sincronização automática configurada');
    } else {
        console.log('⚠️ Supabase não inicializado, sincronização não configurada');
    }
}

// Exportar funções para uso global
window.supabaseConfig = {
    init: initSupabase,
    sync: syncWithSupabase,
    saveMarkings: saveMarkingsToSupabase,
    loadMarkings: loadMarkingsFromSupabase,
    deleteMarking: deleteMarkingFromSupabase,
    setupSync: setupSupabaseSync,
    get supabaseClient() { return supabaseClient; }
};