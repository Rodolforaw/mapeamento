# Migração do Banco de Dados Supabase

## Problema
A tabela `works` no Supabase não possui as colunas necessárias para o sistema funcionar corretamente.

## Solução
Execute o script SQL do arquivo `migracao-simples.sql` no SQL Editor do Supabase.

**OU** execute o seguinte SQL diretamente:

```sql
-- Adicionar colunas se não existirem (sintaxe simples)
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
```

## Como Executar

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Cole o código SQL acima
5. Clique em **Run** para executar

## Verificação

Após executar a migração, verifique se as colunas foram adicionadas:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'works' 
ORDER BY ordinal_position;
```

## Resultado Esperado

A tabela `works` deve ter as seguintes colunas:
- id (TEXT)
- name (TEXT)
- description (TEXT)
- status (TEXT)
- type (TEXT)
- date (DATE)
- geometry (JSONB)
- **work_number (TEXT)** ← Nova
- **product (TEXT)** ← Nova
- **measure (TEXT)** ← Nova
- **observation (TEXT)** ← Nova
- created_at (TIMESTAMP WITH TIME ZONE)
- updated_at (TIMESTAMP WITH TIME ZONE)

Após executar a migração, o sistema funcionará corretamente!
