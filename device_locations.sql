-- ==============================================
-- SCRIPT SEGURO PARA CRIAÇÃO DA TABELA DEVICE_LOCATIONS
-- Execute este script no Supabase SQL Editor
-- ==============================================

-- 1. Criar tabela (apenas se não existir)
CREATE TABLE IF NOT EXISTS device_locations (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp BIGINT NOT NULL,
    is_pwa BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices (apenas se não existirem)
CREATE INDEX IF NOT EXISTS idx_device_locations_device_id ON device_locations(device_id);
CREATE INDEX IF NOT EXISTS idx_device_locations_timestamp ON device_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_device_locations_is_pwa ON device_locations(is_pwa);

-- 3. Criar função para atualizar updated_at (apenas se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Criar trigger (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_device_locations_updated_at'
    ) THEN
        CREATE TRIGGER update_device_locations_updated_at
            BEFORE UPDATE ON device_locations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 5. Habilitar RLS (apenas se não estiver habilitado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'device_locations' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE device_locations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 6. Criar política (apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'device_locations' 
        AND policyname = 'Allow all operations on device_locations'
    ) THEN
        CREATE POLICY "Allow all operations on device_locations" ON device_locations
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
-- WHERE table_name = 'device_locations' 
-- ORDER BY ordinal_position;
