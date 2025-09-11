# 🔑 Como Configurar as Credenciais do Supabase

## ✅ Passo 1: Encontrar sua Chave Anônima (Anon Key)

Você já tem a URL do projeto configurada: `https://etqcqbnhhpistlhzyutl.supabase.co`

Agora precisa encontrar sua **Chave Anônima (Anon Key)**:

### 📍 Onde Encontrar:

1. **Acesse o Dashboard do Supabase:**
   - Vá para: https://supabase.com/dashboard
   - Faça login na sua conta

2. **Navegue até as Configurações da API:**
   - No seu projeto, clique em **"Settings"** (Configurações) no menu lateral
   - Clique em **"API"** na seção de configurações

3. **Copie a Chave Anônima:**
   - Procure pela seção **"Project API keys"**
   - Encontre a chave **"anon public"**
   - Clique no ícone de **"copiar"** ao lado da chave

### 🔍 Como a Chave se Parece:

A chave anônima é um JWT (JSON Web Token) longo que se parece com isto:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk2MjQwMDAsImV4cCI6MjAwNTE5OTk5OX0.exemplo-de-assinatura-jwt
```

## ✅ Passo 2: Atualizar o Arquivo de Configuração

1. **Abra o arquivo:** `supabase-config.js`

2. **Substitua a linha:**
   ```javascript
   const SUPABASE_ANON_KEY = 'SUA-CHAVE-ANONIMA-AQUI';
   ```

3. **Por:**
   ```javascript
   const SUPABASE_ANON_KEY = 'sua-chave-copiada-aqui';
   ```

## ✅ Passo 3: Criar a Tabela no Supabase

Agora você precisa criar a tabela para armazenar as marcações:

### 📊 Estrutura da Tabela:

1. **Acesse o Editor SQL:**
   - No Dashboard do Supabase, clique em **"SQL Editor"**
   - Clique em **"New query"**

2. **Execute este SQL:**
   ```sql
   -- Criar tabela para marcações
   CREATE TABLE public.markings (
       id TEXT PRIMARY KEY,
       type TEXT NOT NULL,
       coordinates JSONB NOT NULL,
       properties JSONB DEFAULT '{}',
       timestamp BIGINT NOT NULL,
       last_modified BIGINT NOT NULL,
       device_id TEXT NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Habilitar Row Level Security
   ALTER TABLE public.markings ENABLE ROW LEVEL SECURITY;

   -- Política para permitir leitura pública
   CREATE POLICY "Permitir leitura pública" ON public.markings
       FOR SELECT USING (true);

   -- Política para permitir inserção pública
   CREATE POLICY "Permitir inserção pública" ON public.markings
       FOR INSERT WITH CHECK (true);

   -- Política para permitir atualização pública
   CREATE POLICY "Permitir atualização pública" ON public.markings
       FOR UPDATE USING (true);

   -- Política para permitir deleção pública
   CREATE POLICY "Permitir deleção pública" ON public.markings
       FOR DELETE USING (true);
   ```

3. **Clique em "Run"** para executar o SQL

## ✅ Passo 4: Testar a Configuração

1. **Abra sua aplicação** no navegador
2. **Abra o Console do Navegador** (F12)
3. **Procure por mensagens como:**
   - ✅ `"Supabase inicializado com sucesso"`
   - ✅ `"Configuração do Supabase detectada"`

4. **Teste criando uma marcação:**
   - Desenhe algo no mapa
   - Verifique se aparece mensagem de sincronização
   - Vá no Dashboard do Supabase > Table Editor > markings
   - Deve aparecer sua marcação lá!

## 🔧 Exemplo de Configuração Final

Seu arquivo `supabase-config.js` deve ficar assim:

```javascript
// 🔧 SUAS CREDENCIAIS DO SUPABASE
const SUPABASE_URL = 'https://etqcqbnhhpistlhzyutl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk2MjQwMDAsImV4cCI6MjAwNTE5OTk5OX0.sua-assinatura-jwt-aqui';

// ... resto do código permanece igual
```

## 🚨 Importante:

- ✅ A **chave anônima é segura** para usar no frontend
- ✅ Ela permite apenas operações **autorizadas pelas políticas RLS**
- ✅ **Nunca** compartilhe a **service_role key** (chave de serviço)
- ✅ A URL e anon key podem ser **públicas** no seu código

## 🎯 Próximos Passos:

1. Configure as credenciais seguindo este guia
2. Teste a sincronização
3. Faça o deploy no Netlify seguindo o `NETLIFY_DEPLOY.md`
4. Aproveite a sincronização automática! 🚀

---

**💡 Dica:** Se tiver problemas, verifique o Console do navegador (F12) para mensagens de erro detalhadas.