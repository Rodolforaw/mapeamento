-- Script de configuração do banco de dados Supabase
-- Execute este script no SQL Editor do Supabase

-- Criar tabela para armazenar as obras
CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planejamento',
    type TEXT NOT NULL DEFAULT 'outros',
    date DATE,
    geometry JSONB NOT NULL,
    work_number TEXT,
    product TEXT,
    measure TEXT,
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
CREATE INDEX IF NOT EXISTS idx_works_type ON works(type);
CREATE INDEX IF NOT EXISTS idx_works_created_at ON works(created_at);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_works_updated_at') THEN
        CREATE TRIGGER update_works_updated_at 
            BEFORE UPDATE ON works 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Inserir dados de exemplo (opcional)
INSERT INTO works (id, name, description, status, type, date, geometry) VALUES
(
    'work_example_1',
    'Pavimentação da Rua das Flores',
    'Pavimentação asfáltica da Rua das Flores, trecho entre a Av. Central e a Rua do Comércio',
    'em_andamento',
    'pavimentacao',
    '2024-01-15',
    '{"type": "polygon", "coordinates": [[[-42.8186, -22.9194], [-42.8180, -22.9194], [-42.8180, -22.9200], [-42.8186, -22.9200], [-42.8186, -22.9194]]]}'
),
(
    'work_example_2',
    'Poste de Iluminação - Praça Central',
    'Instalação de poste de iluminação LED na Praça Central',
    'planejamento',
    'iluminacao',
    '2024-02-01',
    '{"type": "marker", "coordinates": [-42.8186, -22.9194]}'
)
ON CONFLICT (id) DO NOTHING;

-- Adicionar colunas se não existirem (para tabelas já criadas)
DO $$ 
BEGIN
    -- Adicionar coluna work_number se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'work_number') THEN
        ALTER TABLE works ADD COLUMN work_number TEXT;
    END IF;
    
    -- Adicionar coluna product se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'product') THEN
        ALTER TABLE works ADD COLUMN product TEXT;
    END IF;
    
    -- Adicionar coluna measure se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'measure') THEN
        ALTER TABLE works ADD COLUMN measure TEXT;
    END IF;
    
    -- Adicionar coluna observation se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'observation') THEN
        ALTER TABLE works ADD COLUMN observation TEXT;
    END IF;
END $$;

-- Configurar RLS (Row Level Security) se necessário
-- ALTER TABLE works ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso (ajuste conforme necessário)
-- CREATE POLICY "Permitir acesso público às obras" ON works
--     FOR ALL USING (true);

-- Comentários sobre a estrutura
COMMENT ON TABLE works IS 'Tabela para armazenar informações sobre obras de infraestrutura';
COMMENT ON COLUMN works.id IS 'Identificador único da obra';
COMMENT ON COLUMN works.name IS 'Nome da obra';
COMMENT ON COLUMN works.description IS 'Descrição detalhada da obra';
COMMENT ON COLUMN works.status IS 'Status atual da obra (planejamento, em_andamento, pausada, concluida)';
COMMENT ON COLUMN works.type IS 'Tipo da obra (pavimentacao, drenagem, iluminacao, saneamento, outros)';
COMMENT ON COLUMN works.date IS 'Data de início da obra';
COMMENT ON COLUMN works.geometry IS 'Geometria da obra no formato GeoJSON';
COMMENT ON COLUMN works.work_number IS 'Número da Ordem de Serviço (OS)';
COMMENT ON COLUMN works.product IS 'Produto utilizado na obra';
COMMENT ON COLUMN works.measure IS 'Medida/quantidade do produto';
COMMENT ON COLUMN works.observation IS 'Observações adicionais sobre a obra';
COMMENT ON COLUMN works.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN works.updated_at IS 'Data da última atualização do registro';
