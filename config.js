// Configuração gratuita para o sistema de controle de obras
// SEM necessidade de API keys - 100% gratuito

const CONFIG = {
    // Configurações do Supabase (já configuradas)
    SUPABASE_URL: 'https://etqcqbnhhpistlhzyutl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDM3MjQsImV4cCI6MjA3MzExOTcyNH0.7XkquFyx8NX0qAFUSpM-4eeNg00ZA6OT4tmG6HM1bCQ',
    
    // Configurações do mapa (coordenadas de Maricá, RJ)
    MAP_CENTER: [-22.9194, -42.8186],
    MAP_ZOOM: 13,
    
    // Camadas de mapa gratuitas
    MAP_LAYERS: {
        // OpenStreetMap - Ruas e nomes
        streets: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors',
            name: 'Ruas'
        },
        // Esri Satellite - Imagens de satélite
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '© Esri',
            name: 'Satélite'
        },
        // OpenTopoMap - Topografia
        topo: {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution: '© OpenTopoMap contributors',
            name: 'Topografia'
        }
    },
    
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
    },
    
    // Configurações do PWA
    PWA: {
        name: 'Obras Maricá',
        shortName: 'Obras',
        description: 'Sistema de Controle de Obras - Maricá/RJ',
        themeColor: '#6d28d9',
        backgroundColor: '#6d28d9'
    }
};

// Exportar configuração
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
