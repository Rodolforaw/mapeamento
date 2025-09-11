-- ==============================================
-- SCRIPT SEGURO PARA CRIAÇÃO DA TABELA MARKINGS
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- 1. Criar tabela markings (apenas se não existir)
CREATE TABLE IF NOT EXISTS markings (
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

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_markings_type ON markings(type);
CREATE INDEX IF NOT EXISTS idx_markings_timestamp ON markings(timestamp);
CREATE INDEX IF NOT EXISTS idx_markings_last_modified ON markings(last_modified);
CREATE INDEX IF NOT EXISTS idx_markings_device_id ON markings(device_id);
CREATE INDEX IF NOT EXISTS idx_markings_source ON markings(source);

-- 3. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_markings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_modified = EXTRACT(EPOCH FROM NOW()) * 1000;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Criar trigger para atualizar updated_at (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_markings_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_markings_updated_at_trigger
            BEFORE UPDATE ON markings
            FOR EACH ROW
            EXECUTE FUNCTION update_markings_updated_at();
    END IF;
END $$;

-- 5. Habilitar RLS (apenas se não estiver habilitado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'markings' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE markings ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 6. Criar política para permitir todas as operações (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'markings' 
        AND policyname = 'Allow all operations on markings'
    ) THEN
        CREATE POLICY "Allow all operations on markings" ON markings
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================
-- VERIFICAÇÃO FINAL
-- ==============================================
-- Execute esta consulta para verificar se tudo foi criado corretamente:
-- SELECT 
--     table_name, 
--     column_name, 
--     data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'markings' 
-- ORDER BY ordinal_position;
