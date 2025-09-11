# 🚀 Início Rápido - Sistema de Controle de Obras

## ⚡ Configuração em 5 Minutos

### 1. Configure o Banco de Dados (2 minutos)
1. Acesse [supabase.com](https://supabase.com) e faça login
2. Vá para o projeto: `etqcqbnhhpistlhzyutl`
3. Clique em **SQL Editor** > **New Query**
4. Copie e cole o conteúdo do arquivo `supabase-setup.sql`
5. Clique em **Run**

### 2. Obtenha a Chave do Google Maps (2 minutos)
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a **Maps JavaScript API**
4. Crie uma chave de API
5. Copie a chave

### 3. Configure o Sistema (1 minuto)
1. Abra o arquivo `config-production.js`
2. Substitua `YOUR_GOOGLE_MAPS_API_KEY` pela sua chave
3. Salve o arquivo

### 4. Teste Local
1. Abra o arquivo `index-production.html` no navegador
2. Teste criando uma obra no mapa
3. Verifique se os dados são salvos

## 🌐 Deploy no Netlify

### 1. Upload dos Arquivos
1. Acesse [netlify.com](https://netlify.com)
2. Crie um novo site
3. Faça upload dos arquivos

### 2. Configure as Variáveis
No painel do Netlify, vá para **Site settings > Environment variables**:

```
GOOGLE_MAPS_API_KEY=sua_chave_aqui
SUPABASE_URL=https://etqcqbnhhpistlhzyutl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNxYm5oaHBpc3RsaHp5dXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NDM3MjQsImV4cCI6MjA3MzExOTcyNH0.7XkquFyx8NX0qAFUSpM-4eeNg00ZA6OT4tmG6HM1bCQ
```

### 3. Atualize o HTML
No arquivo `index-production.html`, substitua:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=drawing,geometry"></script>
```

Por:
```html
<script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry"></script>
```

## ✅ Pronto!

Seu sistema estará funcionando e você poderá:
- ✅ Criar obras no mapa
- ✅ Salvar dados no Supabase
- ✅ Importar/exportar KMZ
- ✅ Usar em campo e escritório

## 🆘 Precisa de Ajuda?

- **Erro do Google Maps**: Verifique se a API Key está correta
- **Erro do Supabase**: Confirme se executou o script SQL
- **Problemas de Deploy**: Verifique as variáveis de ambiente

---

**Sistema criado para a Prefeitura de Maricá/RJ** 🏛️
