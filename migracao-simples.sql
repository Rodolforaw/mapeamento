-- Script de migração SIMPLES - apenas adiciona as colunas necessárias
-- Execute este script no SQL Editor do Supabase

-- Adicionar colunas se não existirem
ALTER TABLE works ADD COLUMN IF NOT EXISTS work_number TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS measure TEXT;
ALTER TABLE works ADD COLUMN IF NOT EXISTS observation TEXT;

-- Verificar estrutura da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'works' 
ORDER BY ordinal_position;
