# Sistema de Controle de Obras - Maricá

Sistema web para controle e mapeamento de obras de infraestrutura na cidade de Maricá/RJ, com funcionalidades de importação/exportação KMZ e integração com Supabase.

## 🚀 Funcionalidades

- **Mapa Interativo**: Visualização em modo satélite com foco em Maricá/RJ
- **Desenho de Obras**: Criação de polígonos, marcadores e linhas para demarcar obras
- **Gestão de Obras**: Cadastro, edição e exclusão de informações das obras
- **Importação/Exportação KMZ**: Compatível com Google Earth e outros sistemas GIS
- **Armazenamento em Nuvem**: Integração com Supabase para persistência dos dados
- **Interface Responsiva**: Funciona em desktop e dispositivos móveis

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapas**: Google Maps JavaScript API
- **Banco de Dados**: Supabase (PostgreSQL)
- **Hospedagem**: Netlify
- **Bibliotecas**: JSZip, xml2js

## 📋 Pré-requisitos

1. **Conta no Google Cloud Platform** para obter a API Key do Google Maps
2. **Conta no Supabase** para o banco de dados
3. **Conta no Netlify** para hospedagem (opcional)

## ⚙️ Configuração

### 1. Google Maps API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Maps JavaScript API**
4. Crie uma chave de API
5. Configure as restrições de domínio conforme necessário

### 2. Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Execute o script `supabase-setup.sql` no SQL Editor
4. Obtenha a URL e a chave anônima do projeto

### 3. Configuração Local

1. Clone ou baixe os arquivos do projeto
2. Abra o arquivo `config.js`
3. Substitua os valores pelos seus próprios:
   ```javascript
   GOOGLE_MAPS_API_KEY: 'sua_chave_do_google_maps',
   SUPABASE_URL: 'sua_url_do_supabase',
   SUPABASE_ANON_KEY: 'sua_chave_anonima_do_supabase'
   ```

### 4. Deploy no Netlify

1. Faça upload dos arquivos para o Netlify
2. Configure as variáveis de ambiente no painel do Netlify:
   - `GOOGLE_MAPS_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. O site estará disponível automaticamente

## 📖 Como Usar

### Criando uma Obra

1. **Selecione a ferramenta**: Escolha entre Polígono, Marcador ou Linha
2. **Desenhe no mapa**: Clique e arraste para criar a geometria
3. **Preencha as informações**: Nome, descrição, status, tipo e data
4. **Salve**: Clique em "Salvar Obra" para persistir no banco

### Gerenciando Obras

- **Visualizar**: Clique na obra na lista lateral
- **Editar**: Use o botão de edição na lista
- **Deletar**: Use o botão de exclusão na lista

### Importação/Exportação

- **Exportar KMZ**: Clique em "Exportar KMZ" para baixar todas as obras
- **Importar KMZ**: Clique em "Importar KMZ" e selecione o arquivo

## 🗂️ Estrutura do Projeto

```
sistema-controle-obras/
├── index.html              # Página principal
├── styles.css              # Estilos CSS
├── script.js               # Lógica JavaScript
├── config.js               # Configurações
├── supabase-setup.sql      # Script do banco de dados
├── netlify.toml            # Configuração do Netlify
└── README.md               # Documentação
```

## 🔧 Personalização

### Cores e Tema

Edite o arquivo `config.js` para alterar as cores do sistema:

```javascript
COLORS: {
    primary: '#6d28d9',    // Cor principal
    success: '#10b981',    // Sucesso
    warning: '#f59e0b',    // Aviso
    error: '#ef4444',      // Erro
    info: '#3b82f6'        // Informação
}
```

### Status e Tipos de Obras

Adicione novos status ou tipos editando o arquivo `config.js`:

```javascript
WORK_STATUS: {
    novo_status: {
        label: 'Novo Status',
        color: '#cor_hex'
    }
}
```

## 🐛 Solução de Problemas

### Erro de API do Google Maps
- Verifique se a API Key está correta
- Confirme se a Maps JavaScript API está ativada
- Verifique as restrições de domínio

### Erro de Conexão com Supabase
- Verifique se a URL e chave estão corretas
- Confirme se a tabela `works` foi criada
- Verifique as políticas de RLS (Row Level Security)

### Problemas de Importação KMZ
- Verifique se o arquivo é um KMZ válido
- Confirme se contém um arquivo `doc.kml`
- Verifique se as geometrias estão no formato correto

## 📝 Licença

Este projeto é de código aberto e está disponível sob a licença MIT.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer um fork do projeto
2. Criar uma branch para sua feature
3. Fazer commit das mudanças
4. Abrir um Pull Request

## 📞 Suporte

Para suporte ou dúvidas, entre em contato através dos canais oficiais do projeto.

---

**Desenvolvido para a Prefeitura de Maricá/RJ** 🏛️
