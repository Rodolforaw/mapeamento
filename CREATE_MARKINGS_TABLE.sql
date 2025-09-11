-- ==============================================
-- SCRIPT SIMPLES PARA CRIAR TABELA MARKINGS
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- 1. Criar tabela markings
CREATE TABLE markings (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    coordinates JSONB,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    properties JSONB DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'manual',
    timestamp BIGINT NOT NULL,
    last_modified BIGINT NOT NULL,
    device_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices
CREATE INDEX idx_markings_type ON markings(type);
CREATE INDEX idx_markings_timestamp ON markings(timestamp);
CREATE INDEX idx_markings_last_modified ON markings(last_modified);
CREATE INDEX idx_markings_device_id ON markings(device_id);

-- 3. Habilitar RLS
ALTER TABLE markings ENABLE ROW LEVEL SECURITY;

-- 4. Criar política para permitir todas as operações
CREATE POLICY "Allow all operations on markings" ON markings
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Verificar se foi criada
SELECT 'Tabela markings criada com sucesso!' as status;
