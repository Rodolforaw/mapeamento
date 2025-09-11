# 🚀 Deploy no Netlify - Controle de Obra Maricá

## 📋 Pré-requisitos

- Conta no [Netlify](https://netlify.com)
- Todos os arquivos do projeto
- Conexão com internet

## 🔧 Configuração do Projeto

O projeto foi adaptado para funcionar no Netlify com as seguintes configurações:

### Arquivos de Configuração
- `netlify.toml` - Configurações principais do Netlify
- `_redirects` - Redirecionamentos para as Functions
- `package.json` - Dependências do projeto
- `netlify/functions/` - Serverless Functions

### Netlify Functions
- **markings.js** - Gerencia as marcações do mapa
- **sync.js** - Sincronização entre dispositivos

## 📤 Como Fazer o Deploy

### Método 1: Drag & Drop (Mais Fácil)

1. **Acesse o Netlify**
   - Vá para [netlify.com](https://netlify.com)
   - Faça login ou crie uma conta

2. **Deploy Manual**
   - Na dashboard, clique em "Add new site"
   - Selecione "Deploy manually"
   - Arraste toda a pasta do projeto para a área de upload
   - Aguarde o deploy ser concluído

3. **Configurar Domínio (Opcional)**
   - Clique no site criado
   - Vá em "Site settings" > "Domain management"
   - Configure um domínio personalizado se desejar

### Método 2: Git Integration (Recomendado)

1. **Subir para o GitHub**
   - Crie um repositório no GitHub
   - Faça upload de todos os arquivos

2. **Conectar ao Netlify**
   - No Netlify, clique em "Add new site"
   - Selecione "Import an existing project"
   - Conecte com GitHub e selecione o repositório
   - Configure:
     - **Build command**: `echo 'Build completed'`
     - **Publish directory**: `.` (raiz)
   - Clique em "Deploy site"

## ⚙️ Configurações Importantes

### Environment Variables (Se necessário)
No painel do Netlify:
- Vá em "Site settings" > "Environment variables"
- Adicione variáveis se necessário (não há nenhuma por padrão)

### Functions
As Netlify Functions estão em `netlify/functions/` e são automaticamente detectadas.

## 🔄 Sincronização Entre Dispositivos

### Como Funciona
- Os dados são armazenados temporariamente nas Functions
- Cada dispositivo sincroniza automaticamente a cada 30 segundos
- As marcações são compartilhadas entre todos os dispositivos

### Limitações do Netlify
- **Armazenamento temporário**: Os dados são perdidos quando a Function "hiberna"
- **Recomendação**: Para uso em produção, considere integrar com um banco de dados (Firebase, Supabase, etc.)

## 📱 PWA no Netlify

O aplicativo funciona como PWA no Netlify:
- **Instalável** em dispositivos móveis e desktop
- **Funciona offline** (dados locais)
- **Atualizações automáticas** quando há nova versão

## 🌐 URLs de Acesso

Após o deploy:
- **URL principal**: `https://[nome-do-site].netlify.app`
- **Functions**:
  - `https://[nome-do-site].netlify.app/.netlify/functions/markings`
  - `https://[nome-do-site].netlify.app/.netlify/functions/sync`

## 🐛 Resolução de Problemas

### Deploy Falhou
1. Verifique se todos os arquivos estão presentes
2. Confirme que `netlify.toml` está na raiz
3. Verifique os logs de build no painel do Netlify

### Functions Não Funcionam
1. Verifique se a pasta `netlify/functions/` existe
2. Confirme que os arquivos `.js` estão na pasta correta
3. Verifique os logs das Functions no painel

### Sincronização Não Funciona
1. Abra o console do navegador (F12)
2. Verifique se há erros de CORS
3. Teste as URLs das Functions diretamente

### PWA Não Instala
1. Verifique se `manifest.json` está acessível
2. Confirme que o site está sendo servido via HTTPS
3. Teste em diferentes navegadores

## 📊 Monitoramento

### Analytics (Opcional)
No painel do Netlify:
- Vá em "Site settings" > "Analytics"
- Ative o Netlify Analytics se desejar

### Logs
- **Build logs**: Disponíveis na aba "Deploys"
- **Function logs**: Disponíveis na aba "Functions"
- **Site logs**: Disponíveis na aba "Analytics"

## 🔄 Atualizações

### Deploy Manual
1. Faça as alterações nos arquivos
2. Arraste a pasta atualizada para o Netlify
3. O site será atualizado automaticamente

### Deploy via Git
1. Faça commit das alterações
2. Push para o repositório
3. O Netlify fará deploy automaticamente

## 💡 Dicas Importantes

1. **Backup**: Sempre mantenha backup dos dados importantes
2. **Teste**: Teste todas as funcionalidades após o deploy
3. **HTTPS**: O Netlify fornece HTTPS automaticamente
4. **Cache**: O Netlify faz cache automático dos arquivos estáticos
5. **Limites**: Verifique os limites do plano gratuito do Netlify

## 📞 Suporte

Se encontrar problemas:
1. Verifique a documentação do [Netlify](https://docs.netlify.com)
2. Consulte os logs no painel do Netlify
3. Teste localmente com `netlify dev` (se tiver o CLI instalado)

---

**✅ Projeto configurado e pronto para deploy no Netlify!**