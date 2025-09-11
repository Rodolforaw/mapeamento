# 🔧 CONFIGURAR SUPABASE

## 1. Criar Tabela
Execute este SQL no Supabase SQL Editor:

```sql
-- Criar tabela markings
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

-- Criar índices
CREATE INDEX idx_markings_type ON markings(type);
CREATE INDEX idx_markings_timestamp ON markings(timestamp);
CREATE INDEX idx_markings_last_modified ON markings(last_modified);
CREATE INDEX idx_markings_device_id ON markings(device_id);

-- Habilitar RLS
ALTER TABLE markings ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir todas as operações
CREATE POLICY "Allow all operations on markings" ON markings
    FOR ALL USING (true) WITH CHECK (true);
```

## 2. Verificar Credenciais
No arquivo `supabase-config.js`, verifique se:

- **SUPABASE_URL**: Está correto
- **SUPABASE_ANON_KEY**: Está correto

## 3. Testar Conexão
Após configurar, teste:
1. Abra o aplicativo
2. Tente fazer uma marcação
3. Verifique se sincroniza

## ❌ Se der erro 401:
- Verifique se a chave da API está correta
- Verifique se a tabela foi criada
- Verifique se as políticas RLS estão corretas
