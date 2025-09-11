// Arquivo de configuração para o sistema de controle de obras
// Substitua os valores pelos seus próprios antes de fazer o deploy

const CONFIG = {
    // Configurações do Google Maps
    GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',
    
    // Configurações do Supabase
    SUPABASE_URL: 'https://etqcqbnhhpistlhzyutl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDM3MjQsImV4cCI6MjA3MzExOTcyNH0.7XkquFyx8NX0qAFUSpM-4eeNg00ZA6OT4tmG6HM1bCQ',
    
    // Configurações do mapa
    MAP_CENTER: {
        lat: -22.9194,  // Latitude de Maricá
        lng: -42.8186   // Longitude de Maricá
    },
    MAP_ZOOM: 13,
    MAP_TYPE: 'satellite',
    
    // Configurações de cores
    COLORS: {
        primary: '#6d28d9',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6'
    },
    
    // Status das obras
    WORK_STATUS: {
        planejamento: {
            label: 'Planejamento',
            color: '#f59e0b'
        },
        em_andamento: {
            label: 'Em Andamento',
            color: '#3b82f6'
        },
        pausada: {
            label: 'Pausada',
            color: '#ef4444'
        },
        concluida: {
            label: 'Concluída',
            color: '#10b981'
        }
    },
    
    // Tipos de obras
    WORK_TYPES: {
        pavimentacao: 'Pavimentação',
        drenagem: 'Drenagem',
        iluminacao: 'Iluminação',
        saneamento: 'Saneamento',
        outros: 'Outros'
    },
    
    // Configurações de exportação
    EXPORT: {
        filename: 'obras_marica',
        dateFormat: 'YYYY-MM-DD'
    }
};

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
