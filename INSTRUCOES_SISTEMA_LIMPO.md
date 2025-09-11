# 🗺️ Sistema de Controle de Obras - Versão Limpa

## 📱 Duas Versões do Sistema

### **Versão PC** (`index-pc.html`)
- **Mapa limpo** com menu hambúrguer lateral
- **Ferramentas de desenho** completas
- **Importação/Exportação KMZ**
- **Gestão de obras** com lista lateral
- **Menu hambúrguer** para economizar espaço

### **Versão PWA** (`index-pwa.html`)
- **Apenas o mapa** com ferramentas de desenho
- **Interface minimalista** para uso em campo
- **Controles flutuantes** para desenho
- **Sincronização** com o sistema PC
- **Instalável** como app no celular

## 🆓 Sistema Gratuito

### **Mapas Gratuitos**
- ✅ **OpenStreetMap** - Ruas e nomes
- ✅ **Esri Satellite** - Imagens de satélite
- ✅ **Sem necessidade de API Key**
- ✅ **Funciona offline** (PWA)

### **Funcionalidades**
- ✅ **Desenho de polígonos, linhas e marcadores**
- ✅ **Importação/Exportação KMZ**
- ✅ **Sincronização via Supabase**
- ✅ **Interface responsiva**
- ✅ **PWA instalável**

## 🚀 Como Usar

### **1. Versão PC (Escritório)**
1. Abra `index-pc.html` no navegador
2. Clique no menu hambúrguer (☰) para abrir/fechar o painel lateral
3. Use as ferramentas de desenho para criar obras
4. Importe/exporte arquivos KMZ
5. Gerencie as obras na lista lateral

### **2. Versão PWA (Campo)**
1. Abra `index-pwa.html` no celular
2. Adicione à tela inicial (instalar como app)
3. Use os controles flutuantes para desenhar
4. Toque nas obras para ver informações
5. Sincronize com o sistema PC

## 🔧 Configuração

### **1. Banco de Dados (Supabase)**
```sql
-- Execute no SQL Editor do Supabase
-- (Use o arquivo supabase-setup.sql)
```

### **2. Deploy no Netlify**
1. Faça upload dos arquivos
2. Configure as variáveis de ambiente:
   ```
   SUPABASE_URL=https://etqcqbnhhpistlhzyutl.supabase.co
   SUPABASE_ANON_KEY=sua_chave_aqui
   ```

### **3. Acessar as Versões**
- **PC**: `https://seu-site.netlify.app/index-pc.html`
- **PWA**: `https://seu-site.netlify.app/index-pwa.html`

## 📱 Instalação PWA

### **No Android:**
1. Abra `index-pwa.html` no Chrome
2. Toque no menu (⋮) > "Adicionar à tela inicial"
3. Confirme a instalação

### **No iOS:**
1. Abra `index-pwa.html` no Safari
2. Toque no botão de compartilhar (□↑)
3. Selecione "Adicionar à Tela de Início"

## 🎯 Fluxo de Trabalho

### **1. Planejamento (PC)**
- Abra a versão PC
- Importe arquivos KMZ existentes
- Planeje novas obras no mapa
- Exporte para compartilhar

### **2. Execução (PWA)**
- Abra a versão PWA no celular
- Sincronize com o PC
- Marque obras no campo
- Sincronize de volta

### **3. Acompanhamento (PC)**
- Abra a versão PC
- Sincronize com o campo
- Visualize todas as obras
- Exporte relatórios KMZ

## 🛠️ Ferramentas Disponíveis

### **Desenho**
- **Polígono** - Para áreas de obra
- **Linha** - Para vias e dutos
- **Marcador** - Para pontos específicos

### **Edição**
- **Editar** - Modificar geometrias
- **Deletar** - Remover obras
- **Informações** - Detalhes da obra

### **Camadas**
- **Satélite** - Imagens aéreas
- **Ruas** - Mapa de ruas com nomes

## 📊 Informações das Obras

### **Campos Obrigatórios**
- **Nome** - Identificação da obra
- **Status** - Planejamento, Em Andamento, Pausada, Concluída
- **Tipo** - Pavimentação, Drenagem, Iluminação, Saneamento, Outros
- **Data** - Data de início

### **Campos Opcionais**
- **Descrição** - Detalhes adicionais

## 🔄 Sincronização

### **Automática**
- As obras são salvas automaticamente no Supabase
- Sincronização em tempo real entre PC e PWA

### **Manual**
- Use o botão "Sincronizar" no PWA
- Recarregue a página no PC

## 📁 Estrutura de Arquivos

```
sistema-obras/
├── index-pc.html          # Versão PC
├── index-pwa.html         # Versão PWA
├── styles-pc.css          # Estilos PC
├── styles-pwa.css         # Estilos PWA
├── script-pc.js           # Script PC
├── script-pwa.js          # Script PWA
├── config.js              # Configurações
├── manifest.json          # Manifesto PWA
├── sw.js                  # Service Worker
└── supabase-setup.sql     # Script do banco
```

## 🎨 Personalização

### **Cores**
Edite o arquivo `config.js`:
```javascript
COLORS: {
    primary: '#6d28d9',    // Cor principal
    success: '#10b981',    // Sucesso
    warning: '#f59e0b',    // Aviso
    error: '#ef4444',      // Erro
}
```

### **Localização**
Altere as coordenadas em `script-pc.js` e `script-pwa.js`:
```javascript
const MARICA_CENTER = [-22.9194, -42.8186]; // Maricá/RJ
```

## ✅ Vantagens do Sistema

- **🆓 Totalmente gratuito** - Sem custos de API
- **📱 PWA nativo** - Funciona como app
- **🗺️ Mapas offline** - Funciona sem internet
- **🔄 Sincronização** - PC e campo integrados
- **📊 KMZ** - Compatível com Google Earth
- **🎯 Focado** - Interface limpa e objetiva

---

**Sistema criado para a Prefeitura de Maricá/RJ** 🏛️
