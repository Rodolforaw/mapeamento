# Controle de Obra - Maricá

Aplicativo PWA (Progressive Web App) para controle de obra com mapa interativo focado na cidade de Maricá, RJ.

## 🚀 Funcionalidades

### 📍 Mapa Interativo
- **Visualização em tela cheia** do mapa de Maricá
- **Modo satélite** - Alterne entre visualização de rua e satélite
- **Zoom automático** na região de Maricá
- **Controles de navegação** intuitivos

### ✏️ Ferramentas de Desenho
- **Marcadores** - Adicione pontos específicos
- **Linhas** - Desenhe trajetos e limites
- **Polígonos** - Delimite áreas de trabalho
- **Retângulos** - Marque áreas retangulares
- **Círculos** - Defina áreas circulares com raio específico
- **Edição** - Modifique formas já criadas
- **Exclusão** - Remova marcações desnecessárias

### 📤 Exportação de Dados
- **KMZ** - Exporte para Google Earth e outros aplicativos GIS
- **Excel** - Planilha com coordenadas e informações das marcações
- **Compatibilidade** - Arquivos prontos para uso no MyMaps do Google

### 📥 Importação de Dados
- **KMZ/KML** - Importe marcações existentes
- **Visualização** - Veja marcações importadas no mapa
- **Integração** - Combine dados novos com existentes

### 📱 PWA (Progressive Web App)
- **Instalação** - Instale como aplicativo no dispositivo
- **Offline** - Funciona sem conexão com internet
- **Responsivo** - Otimizado para celular, tablet e desktop
- **Rápido** - Carregamento instantâneo após primeira visita

## 🛠️ Como Usar

### Iniciando o Aplicativo
1. Abra o terminal na pasta do projeto
2. Execute: `node server.js`
3. Acesse: `http://localhost:8000`
4. O mapa será carregado automaticamente focado em Maricá

### Navegação no Mapa
- **Zoom**: Use a roda do mouse ou os botões +/-
- **Mover**: Clique e arraste o mapa
- **Satélite**: Clique no botão "Satélite" no painel de controle

### Desenhando no Mapa
1. Use a barra de ferramentas à esquerda do mapa
2. Selecione a ferramenta desejada (marcador, linha, polígono, etc.)
3. Clique no mapa para começar a desenhar
4. Para polígonos e linhas, clique em vários pontos
5. Finalize clicando no primeiro ponto (polígonos) ou dê duplo clique (linhas)

### Editando Marcações
1. Clique no ícone de edição na barra de ferramentas
2. Selecione a marcação que deseja editar
3. Arraste os pontos de controle para modificar
4. Clique em "Salvar" quando terminar

### Exportando Dados

#### Para KMZ (Google Earth/MyMaps):
1. Clique em "Exportar KMZ" no painel de controle
2. O arquivo será baixado automaticamente
3. Importe no Google Earth ou MyMaps do Google

#### Para Excel:
1. Clique em "Exportar Excel" no painel de controle
2. Planilha será baixada com todas as coordenadas
3. Use para análises ou relatórios

### Importando Dados
1. Clique em "Importar KMZ" no painel de controle
2. Selecione um arquivo KMZ ou KML
3. As marcações aparecerão automaticamente no mapa
4. O mapa se ajustará para mostrar todas as marcações

## 📋 Requisitos

- **Node.js** (para executar o servidor local)
- **Navegador moderno** (Chrome, Firefox, Safari, Edge)
- **Conexão com internet** (para carregar tiles do mapa)

## 🔧 Instalação

### Opção 1: Deploy no Netlify (Recomendado)
1. **Configure o Supabase:** Siga o guia em `CONFIGURAR_SUPABASE.md`
2. **Faça o deploy:** Siga o guia em `NETLIFY_DEPLOY.md`
3. **Documentação completa:** Consulte `SUPABASE_SETUP.md`
4. Acesse sua URL do Netlify

### Opção 2: Servidor Local
1. Baixe todos os arquivos do projeto
2. Certifique-se de que o Node.js está instalado
3. Execute `node server.js` no terminal
4. Acesse `http://localhost:8000`

## 📱 Instalação como PWA

### No Chrome (Desktop):
1. Acesse o aplicativo no navegador
2. Clique no ícone de instalação na barra de endereços
3. Confirme a instalação

### No Mobile:
1. Acesse o aplicativo no navegador
2. Toque no menu do navegador
3. Selecione "Adicionar à tela inicial"
4. Confirme a instalação

## 🗂️ Estrutura de Arquivos

```
Controle de obra/
├── index.html          # Página principal
├── styles.css          # Estilos do aplicativo
├── app.js             # Lógica principal
├── manifest.json      # Configuração PWA
├── sw.js             # Service Worker
├── server.js         # Servidor local
└── README.md         # Este arquivo
```

## 🌐 Tecnologias Utilizadas

- **Leaflet.js** - Biblioteca de mapas interativos
- **Leaflet Draw** - Plugin para ferramentas de desenho
- **JSZip** - Manipulação de arquivos ZIP/KMZ
- **SheetJS** - Exportação para Excel
- **Service Worker** - Funcionalidade offline
- **Supabase** - Banco de dados e sincronização em tempo real
- **Netlify Functions** - APIs serverless
- **HTML5/CSS3/JavaScript** - Tecnologias web modernas

## 🎯 Casos de Uso

- **Controle de obra** - Marque áreas de trabalho e progresso
- **Planejamento urbano** - Delimite zonas e projetos
- **Levantamento topográfico** - Registre pontos de interesse
- **Gestão de projetos** - Acompanhe diferentes fases
- **Relatórios** - Exporte dados para documentação

## 🔄 Atualizações

O aplicativo se atualiza automaticamente quando há novas versões disponíveis, graças ao Service Worker.

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique se o servidor está rodando
2. Confirme se há conexão com internet
3. Teste em um navegador diferente
4. Limpe o cache do navegador se necessário

---

**Desenvolvido para controle eficiente de obras em Maricá, RJ** 🏗️📍
