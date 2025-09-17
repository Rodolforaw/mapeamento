-- Script de migração segura para o Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar colunas se não existirem
DO $$ 
BEGIN
    -- Adicionar coluna work_number se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'work_number') THEN
        ALTER TABLE works ADD COLUMN work_number TEXT;
        RAISE NOTICE 'Coluna work_number adicionada';
    ELSE
        RAISE NOTICE 'Coluna work_number já existe';
    END IF;
    
    -- Adicionar coluna product se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'product') THEN
        ALTER TABLE works ADD COLUMN product TEXT;
        RAISE NOTICE 'Coluna product adicionada';
    ELSE
        RAISE NOTICE 'Coluna product já existe';
    END IF;
    
    -- Adicionar coluna measure se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'measure') THEN
        ALTER TABLE works ADD COLUMN measure TEXT;
        RAISE NOTICE 'Coluna measure adicionada';
    ELSE
        RAISE NOTICE 'Coluna measure já existe';
    END IF;
    
    -- Adicionar coluna observation se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'observation') THEN
        ALTER TABLE works ADD COLUMN observation TEXT;
        RAISE NOTICE 'Coluna observation adicionada';
    ELSE
        RAISE NOTICE 'Coluna observation já existe';
    END IF;
END $$;

-- 2. Criar função (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Criar trigger (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_works_updated_at') THEN
        CREATE TRIGGER update_works_updated_at 
            BEFORE UPDATE ON works 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_works_updated_at criado';
    ELSE
        RAISE NOTICE 'Trigger update_works_updated_at já existe';
    END IF;
END $$;

-- 4. Verificar estrutura final da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'works' 
ORDER BY ordinal_position;
