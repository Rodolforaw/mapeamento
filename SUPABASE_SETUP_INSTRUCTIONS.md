# Instruções de Configuração do Supabase

## 🗄️ Configuração do Banco de Dados

### 1. Acesse o Supabase
- Vá para [supabase.com](https://supabase.com)
- Faça login na sua conta
- Acesse o projeto: `etqcqbnhhpistlhzyutl`

### 2. Execute o Script SQL
1. No painel do Supabase, vá para **SQL Editor**
2. Clique em **New Query**
3. Copie e cole o conteúdo do arquivo `supabase-setup.sql`
4. Clique em **Run** para executar o script

### 3. Verifique a Tabela
Após executar o script, você deve ver:
- Tabela `works` criada
- Índices configurados
- Dados de exemplo inseridos
- Trigger para atualização automática

### 4. Configure as Políticas de Segurança (Opcional)
Se quiser restringir o acesso, vá para **Authentication > Policies** e configure:

```sql
-- Permitir leitura pública
CREATE POLICY "Permitir leitura pública" ON works
    FOR SELECT USING (true);

-- Permitir inserção pública
CREATE POLICY "Permitir inserção pública" ON works
    FOR INSERT WITH CHECK (true);

-- Permitir atualização pública
CREATE POLICY "Permitir atualização pública" ON works
    FOR UPDATE USING (true);

-- Permitir exclusão pública
CREATE POLICY "Permitir exclusão pública" ON works
    FOR DELETE USING (true);
```

## 🔧 Configuração das APIs

### 1. Google Maps API
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a **Maps JavaScript API**
4. Crie uma chave de API
5. Configure restrições de domínio (opcional)

### 2. Atualizar o Sistema
1. Substitua `YOUR_GOOGLE_MAPS_API_KEY` no arquivo `config-production.js`
2. Ou use o arquivo `config-production.js` diretamente
3. Atualize o HTML para usar a chave correta

## 🚀 Deploy no Netlify

### 1. Upload dos Arquivos
1. Acesse [netlify.com](https://netlify.com)
2. Crie um novo site
3. Faça upload dos arquivos do projeto

### 2. Configurar Variáveis de Ambiente
No painel do Netlify, vá para **Site settings > Environment variables** e adicione:

```
GOOGLE_MAPS_API_KEY=sua_chave_do_google_maps
SUPABASE_URL=https://etqcqbnhhpistlhzyutl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDM3MjQsImV4cCI6MjA3MzExOTcyNH0.7XkquFyx8NX0qAFUSpM-4eeNg00ZA6OT4tmG6HM1bCQ
```

### 3. Atualizar o HTML
No arquivo `index.html`, substitua:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=drawing,geometry"></script>
```

Por:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry"></script>
```

## ✅ Teste do Sistema

### 1. Teste Local
1. Abra o arquivo `index.html` no navegador
2. Configure a chave do Google Maps no `config-production.js`
3. Teste a criação de uma obra
4. Verifique se os dados são salvos no Supabase

### 2. Teste em Produção
1. Acesse a URL do Netlify
2. Teste todas as funcionalidades
3. Verifique se os dados persistem

## 🐛 Solução de Problemas

### Erro de Conexão com Supabase
- Verifique se a URL e chave estão corretas
- Confirme se a tabela `works` foi criada
- Verifique as políticas RLS

### Erro do Google Maps
- Verifique se a API Key está correta
- Confirme se a Maps JavaScript API está ativada
- Verifique as restrições de domínio

### Problemas de Deploy
- Verifique se todas as variáveis de ambiente estão configuradas
- Confirme se todos os arquivos foram enviados
- Verifique os logs de build

## 📊 Monitoramento

### 1. Supabase Dashboard
- Monitore o uso do banco de dados
- Verifique os logs de API
- Configure alertas se necessário

### 2. Netlify Analytics
- Monitore o tráfego do site
- Verifique a performance
- Configure alertas de erro

---

**Pronto!** Seu sistema estará funcionando com o Supabase configurado! 🎉
