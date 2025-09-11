# 🎯 Controle de Obra - Sistema Simplificado

## 📋 O que é
Sistema simples para acompanhar marcações de obras em campo.

## 👥 Como Funciona

### Pessoal de Campo (PWA)
1. Abre o app no celular
2. Faz marcações das obras
3. Clica "📤 Enviar Dados" quando terminar

### Pessoal do PC (4 pessoas)
1. Abre o app no computador
2. Clica "🔄 Sincronizar Agora" para ver marcações
3. Clica "📦 Exportar KMZ" para baixar
4. Clica "📊 Exportar Excel" para relatórios

## 🚀 Como Usar

### 1. Configurar Supabase
- Execute o arquivo `CREATE_MARKINGS_TABLE.sql` no Supabase
- Configure as credenciais no `supabase-config.js`

### 2. Usar o Sistema
- Abra `index.html` no navegador
- Faça marcações no mapa
- Sincronize quando necessário

## 📁 Arquivos Essenciais
- `index.html` - Interface principal
- `app.js` - Lógica do aplicativo
- `supabase-config.js` - Configuração do banco
- `CREATE_MARKINGS_TABLE.sql` - Script para criar tabela
- `vendor/` - Bibliotecas necessárias

## ✅ Pronto para Usar!
Sistema limpo, simples e funcional.