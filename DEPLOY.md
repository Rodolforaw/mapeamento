# Guia de Deploy - Sistema de Controle de Obras

Este guia explica como fazer o deploy do sistema no Netlify e configurar todas as integrações necessárias.

## 🚀 Deploy no Netlify

### Método 1: Deploy via Interface Web

1. **Acesse o Netlify**
   - Vá para [netlify.com](https://netlify.com)
   - Faça login ou crie uma conta

2. **Crie um novo site**
   - Clique em "New site from files"
   - Arraste e solte a pasta do projeto ou selecione os arquivos

3. **Configure o site**
   - Nome do site: `sistema-controle-obras-marica`
   - Deploy settings: Deixe como padrão

### Método 2: Deploy via Git

1. **Crie um repositório no GitHub**
   - Faça upload dos arquivos para um repositório

2. **Conecte ao Netlify**
   - No Netlify, clique em "New site from Git"
   - Conecte sua conta do GitHub
   - Selecione o repositório

3. **Configure o build**
   - Build command: `echo "No build required"`
   - Publish directory: `.` (raiz do projeto)

## ⚙️ Configuração das Variáveis de Ambiente

### 1. Google Maps API

1. **Obtenha a API Key**
   - Acesse [Google Cloud Console](https://console.cloud.google.com/)
   - Crie um projeto ou selecione um existente
   - Ative a "Maps JavaScript API"
   - Crie uma chave de API

2. **Configure no Netlify**
   - Vá para Site settings > Environment variables
   - Adicione: `GOOGLE_MAPS_API_KEY` = sua chave

### 2. Supabase

1. **Configure o banco de dados**
   - Acesse [supabase.com](https://supabase.com)
   - Crie um novo projeto
   - Execute o script `supabase-setup.sql` no SQL Editor

2. **Obtenha as credenciais**
   - Vá para Settings > API
   - Copie a URL e a chave anônima

3. **Configure no Netlify**
   - Adicione: `SUPABASE_URL` = sua URL
   - Adicione: `SUPABASE_ANON_KEY` = sua chave anônima

## 🔧 Configuração Final

### 1. Atualizar o arquivo config.js

Após configurar as variáveis de ambiente no Netlify, você pode usar as variáveis de ambiente no arquivo `config.js`:

```javascript
const CONFIG = {
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY',
    SUPABASE_URL: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
    // ... resto da configuração
};
```

### 2. Atualizar o HTML

No arquivo `index.html`, substitua a chave do Google Maps:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=drawing,geometry"></script>
```

Por:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=drawing,geometry"></script>
```

## 🌐 Configuração de Domínio

### 1. Domínio Personalizado (Opcional)

1. **No painel do Netlify**
   - Vá para Domain settings
   - Clique em "Add custom domain"
   - Digite seu domínio

2. **Configure o DNS**
   - Adicione um registro CNAME apontando para o Netlify
   - Ou configure conforme as instruções fornecidas

### 2. HTTPS

- O Netlify fornece HTTPS automaticamente
- Certificados SSL são gerenciados automaticamente

## 🔒 Configurações de Segurança

### 1. Restrições de API

**Google Maps API:**
- Configure restrições de domínio no Google Cloud Console
- Adicione apenas os domínios que usarão a API

**Supabase:**
- Configure as políticas RLS (Row Level Security) conforme necessário
- Use as políticas de segurança do Supabase

### 2. Headers de Segurança

O arquivo `netlify.toml` já inclui headers de segurança básicos. Ajuste conforme necessário.

## 📱 Teste do Sistema

### 1. Teste Local

1. **Configure as variáveis**
   - Edite o arquivo `config.js` com suas credenciais
   - Abra o `index.html` em um navegador

2. **Teste as funcionalidades**
   - Crie uma obra
   - Teste a importação/exportação KMZ
   - Verifique se os dados são salvos no Supabase

### 2. Teste em Produção

1. **Acesse o site**
   - Vá para a URL fornecida pelo Netlify
   - Teste todas as funcionalidades

2. **Verifique os logs**
   - Use o console do navegador para verificar erros
   - Monitore os logs do Netlify

## 🐛 Solução de Problemas

### Erro 403 - Google Maps API
- Verifique se a API Key está correta
- Confirme se a Maps JavaScript API está ativada
- Verifique as restrições de domínio

### Erro de Conexão com Supabase
- Verifique se a URL e chave estão corretas
- Confirme se a tabela `works` foi criada
- Verifique as políticas RLS

### Problemas de Deploy
- Verifique se todos os arquivos foram enviados
- Confirme se as variáveis de ambiente estão configuradas
- Verifique os logs de build no Netlify

## 📊 Monitoramento

### 1. Analytics do Netlify
- Use o Analytics do Netlify para monitorar o uso
- Configure alertas para problemas de performance

### 2. Logs do Supabase
- Monitore os logs do Supabase para erros de banco
- Configure alertas para uso excessivo

## 🔄 Atualizações

### 1. Deploy de Atualizações
- Faça as alterações nos arquivos
- Faça commit e push (se usando Git)
- Ou faça upload manual dos arquivos atualizados

### 2. Backup
- Faça backup regular dos dados do Supabase
- Mantenha cópias dos arquivos de configuração

---

**Pronto!** Seu sistema estará online e funcionando. 🎉
