// ==============================================
// SUPABASE SIMPLIFICADO - CONTROLE DE OBRA
// Versão limpa e direta
// ==============================================

// Configuração do Supabase
const SUPABASE_URL = 'https://etqcqbnhhpistlhzyutl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzQ4MDAsImV4cCI6MjA1MDU1MDgwMH0.etqcqbnhhpistlhzyutl';

let supabaseClient = null;

// Inicializar Supabase
function initSupabase() {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inicializado');
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar Supabase:', error);
        return false;
    }
}

// Carregar marcações do Supabase
async function loadMarkings() {
    if (!supabaseClient) {
        if (!initSupabase()) {
            return { success: false, error: 'Supabase não inicializado' };
        }
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('markings')
            .select('*')
            .order('timestamp', { ascending: false });
        
        if (error) {
            console.error('Erro ao carregar marcações:', error);
            return { success: false, error: error.message };
        }
        
        console.log(`📡 Carregadas ${data.length} marcações do Supabase`);
        return { success: true, markings: data || [] };
    } catch (error) {
        console.error('Erro ao carregar marcações:', error);
        return { success: false, error: error.message };
    }
}

// Salvar marcações no Supabase
async function saveMarkings(markings) {
    if (!supabaseClient) {
        if (!initSupabase()) {
            return { success: false, error: 'Supabase não inicializado' };
        }
    }
    
    try {
        // Converter marcações para formato do Supabase
        const supabaseMarkings = markings.map(marking => ({
            id: marking.id,
            type: marking.type,
            coordinates: marking.coordinates,
            lat: marking.coordinates?.lat || null,
            lng: marking.coordinates?.lng || null,
            properties: marking.properties || {},
            timestamp: marking.timestamp,
            last_modified: marking.timestamp,
            device_id: 'web-app',
            source: 'manual'
        }));
        
        const { data, error } = await supabaseClient
            .from('markings')
            .upsert(supabaseMarkings, { 
                onConflict: 'id',
                ignoreDuplicates: false 
            });
        
        if (error) {
            console.error('Erro ao salvar marcações:', error);
            return { success: false, error: error.message };
        }
        
        console.log(`💾 Salvas ${markings.length} marcações no Supabase`);
        return { success: true, data };
    } catch (error) {
        console.error('Erro ao salvar marcações:', error);
        return { success: false, error: error.message };
    }
}

// Deletar marcação do Supabase
async function deleteMarking(markingId) {
    if (!supabaseClient) {
        if (!initSupabase()) {
            return { success: false, error: 'Supabase não inicializado' };
        }
    }
    
    try {
        const { error } = await supabaseClient
            .from('markings')
            .delete()
            .eq('id', markingId);
        
        if (error) {
            console.error('Erro ao deletar marcação:', error);
            return { success: false, error: error.message };
        }
        
        console.log(`🗑️ Marcação ${markingId} deletada do Supabase`);
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar marcação:', error);
        return { success: false, error: error.message };
    }
}

// Exportar para uso global
window.supabaseConfig = {
    init: initSupabase,
    loadMarkings,
    saveMarkings,
    deleteMarking
};

// Inicializar automaticamente
document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
});
