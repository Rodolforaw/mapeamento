// ===== EXEMPLO DE CONFIGURAÇÃO DO SUPABASE =====
// Copie este arquivo para 'supabase-config.js' e substitua pelas suas credenciais

// 🔧 SUAS CREDENCIAIS DO SUPABASE
// Obtenha em: https://supabase.com/dashboard > Settings > API
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA-CHAVE-ANONIMA-AQUI';

// ===== EXEMPLO REAL =====
// const SUPABASE_URL = 'https://abcdefghijk.supabase.co';
// const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk2MjQwMDAsImV4cCI6MjAwNTE5OTk5OX0.exemplo-de-token-jwt';

// ===== NÃO ALTERE O CÓDIGO ABAIXO =====

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
            timestamp: marking.timestamp || Date.now(),
            last_modified: Date.now(),
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
            properties: item.properties || {},
            timestamp: item.timestamp,
            lastModified: item.last_modified
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
        updateSyncStatus('syncing', 'Sincronizando com Supabase...');

        // Carregar dados locais
        const localMarkings = JSON.parse(localStorage.getItem('controle_obra_markings') || '[]');
        
        // Salvar dados locais no Supabase
        if (localMarkings.length > 0) {
            const saveResult = await saveMarkingsToSupabase(localMarkings);
            if (!saveResult.success) {
                throw new Error(saveResult.error);
            }
        }

        // Carregar dados atualizados do Supabase
        const loadResult = await loadMarkingsFromSupabase();
        if (!loadResult.success) {
            throw new Error(loadResult.error);
        }

        // Atualizar localStorage com dados do Supabase
        localStorage.setItem('controle_obra_markings', JSON.stringify(loadResult.markings));
        
        // Recarregar marcações no mapa
        drawnItems.clearLayers();
        const newMarkings = syncNewMarkings();
        
        updateSyncStatus('synced', 'Sincronizado com Supabase');
        showSyncNotification(`✅ Sincronização concluída! ${loadResult.markings.length} marcações`, 'success');
        
        return { success: true, count: loadResult.markings.length };

    } catch (error) {
        console.error('Erro na sincronização com Supabase:', error);
        updateSyncStatus('error', 'Erro na sincronização');
        showSyncNotification(`❌ Erro: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
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
    // Sincronização inicial
    if (supabaseClient) {
        syncWithSupabase();
        
        // Sincronização automática a cada 30 segundos
        setInterval(() => {
            if (navigator.onLine) {
                syncWithSupabase();
            }
        }, 30000);
        
        // Sincronizar quando voltar online
        window.addEventListener('online', () => {
            setTimeout(() => syncWithSupabase(), 1000);
        });
    }
}

// Exportar funções para uso global
window.supabaseConfig = {
    init: initSupabase,
    sync: syncWithSupabase,
    saveMarkings: saveMarkingsToSupabase,
    loadMarkings: loadMarkingsFromSupabase,
    deleteMarking: deleteMarkingFromSupabase,
    setupSync: setupSupabaseSync
};