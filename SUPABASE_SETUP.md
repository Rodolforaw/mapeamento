# 🚀 Configuração do Supabase - Controle de Obra Maricá

## 📋 Por que usar Supabase?

O **Supabase** resolve completamente o problema de sincronização entre dispositivos:

✅ **Dados permanentes** - Nunca mais perder marcações  
✅ **Sincronização em tempo real** - Mudanças aparecem instantaneamente  
✅ **Backup automático** - Dados seguros na nuvem  
✅ **Acesso offline** - Funciona sem internet e sincroniza depois  
✅ **Múltiplos dispositivos** - PC, tablet, celular sincronizados  
✅ **Histórico completo** - Todas as marcações do dia salvas  

## 🎯 Configuração Passo a Passo

### 1. Criar Conta no Supabase

1. **Acesse**: [supabase.com](https://supabase.com)
2. **Clique em**: "Start your project"
3. **Faça login** com GitHub, Google ou email
4. **Crie um novo projeto**:
   - Nome: `controle-obra-marica`
   - Senha do banco: `escolha uma senha forte`
   - Região: `South America (São Paulo)` (mais próximo do Brasil)

### 2. Configurar Tabela no Supabase

1. **Acesse o Dashboard** do seu projeto
2. **Vá em**: "Table Editor" (no menu lateral)
3. **Clique em**: "Create a new table"
4. **Configure a tabela**:
   - **Nome**: `markings`
   - **Descrição**: `Marcações do mapa de controle de obra`

5. **Adicione as colunas**:

| Nome | Tipo | Configurações |
|------|------|---------------|
| `id` | `text` | Primary Key, Unique |
| `type` | `text` | Not null |
| `coordinates` | `jsonb` | Nullable |
| `properties` | `jsonb` | Nullable |
| `timestamp` | `bigint` | Not null |
| `last_modified` | `bigint` | Not null |
| `device_id` | `text` | Nullable |
| `created_at` | `timestamp` | Default: now() |

6. **Clique em**: "Save"

### 3. Configurar Políticas de Segurança (RLS)

1. **Na tabela `markings`**, clique no ícone de **cadeado**
2. **Ative**: "Enable RLS" (Row Level Security)
3. **Adicione políticas**:

**Política de Leitura (SELECT):**
```sql
CREATE POLICY "Permitir leitura pública" ON markings
FOR SELECT USING (true);
```

**Política de Inserção (INSERT):**
```sql
CREATE POLICY "Permitir inserção pública" ON markings
FOR INSERT WITH CHECK (true);
```

**Política de Atualização (UPDATE):**
```sql
CREATE POLICY "Permitir atualização pública" ON markings
FOR UPDATE USING (true);
```

**Política de Exclusão (DELETE):**
```sql
CREATE POLICY "Permitir exclusão pública" ON markings
FOR DELETE USING (true);
```

### 4. Obter Credenciais

1. **Vá em**: "Settings" > "API"
2. **Copie**:
   - **Project URL**: `https://seu-projeto.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5. Configurar no Projeto

1. **Abra o arquivo**: `supabase-config.js`
2. **Substitua as credenciais**:

```javascript
// Substitua pelas suas credenciais do Supabase
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anonima-aqui';
```

**Exemplo real:**
```javascript
const SUPABASE_URL = 'https://abcdefghijk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk2MjQwMDAsImV4cCI6MjAwNTE5OTk5OX0.exemplo-de-token-jwt';
```

## 🧪 Testar a Configuração

### 1. Abrir o Aplicativo
1. **Abra**: `index.html` no navegador
2. **Pressione F12** para abrir o console
3. **Procure por**: `✅ Supabase configurado com sucesso!`

### 2. Testar Sincronização
1. **Desenhe** algumas marcações no mapa
2. **Clique** no botão de sincronização (🔄)
3. **Verifique** se aparece: `✅ Sincronização concluída!`

### 3. Verificar no Supabase
1. **Vá** para o Dashboard do Supabase
2. **Acesse**: "Table Editor" > `markings`
3. **Confirme** que as marcações aparecem na tabela

### 4. Testar Entre Dispositivos
1. **Abra** o aplicativo em outro dispositivo/navegador
2. **Aguarde** a sincronização automática (30 segundos)
3. **Verifique** se as marcações aparecem automaticamente

## 🔄 Como Funciona a Sincronização

### Automática
- **A cada 30 segundos** quando online
- **Ao voltar online** após ficar offline
- **Na inicialização** do aplicativo

### Manual
- **Clique no botão** 🔄 "Sincronizar"
- **Força** a sincronização imediata

### Inteligente
- **Merge automático** de dados de diferentes dispositivos
- **Resolve conflitos** mantendo a versão mais recente
- **Evita duplicatas** usando IDs únicos

## 📊 Vantagens do Supabase

### Para o Trabalho Diário
- ✅ **Equipe sincronizada**: Todos veem as mesmas marcações
- ✅ **Backup automático**: Dados nunca se perdem
- ✅ **Histórico completo**: Acompanhe o progresso da obra
- ✅ **Acesso remoto**: Trabalhe de qualquer lugar

### Para Relatórios
- ✅ **Dados centralizados**: Todas as marcações em um lugar
- ✅ **Exportação completa**: KMZ e Excel com todos os dados
- ✅ **Análise temporal**: Veja a evolução da obra
- ✅ **Compartilhamento**: Envie relatórios atualizados

## 🛠️ Resolução de Problemas

### Erro: "Supabase não inicializado"
**Solução:**
1. Verifique se as credenciais estão corretas
2. Confirme se a internet está funcionando
3. Teste as credenciais no Dashboard do Supabase

### Erro: "Política de segurança"
**Solução:**
1. Verifique se RLS está ativado
2. Confirme se as políticas foram criadas
3. Teste com políticas mais permissivas primeiro

### Sincronização não funciona
**Solução:**
1. Abra o console (F12) e verifique erros
2. Teste a conexão com internet
3. Clique em sincronização manual
4. Verifique se a tabela existe no Supabase

### Dados não aparecem
**Solução:**
1. Aguarde até 30 segundos para sincronização automática
2. Force sincronização manual
3. Verifique se os dados estão na tabela do Supabase
4. Limpe o cache do navegador

## 💰 Custos

### Plano Gratuito (Suficiente para a maioria dos casos)
- ✅ **500MB** de banco de dados
- ✅ **2GB** de transferência mensal
- ✅ **50MB** de armazenamento de arquivos
- ✅ **Até 50.000** requisições por mês

### Para Obras Grandes
- Se exceder o limite gratuito, planos pagos começam em **$25/mês**
- Inclui recursos avançados e suporte prioritário

## 🔒 Segurança

- ✅ **Dados criptografados** em trânsito e em repouso
- ✅ **Backup automático** diário
- ✅ **Conformidade** com GDPR e SOC2
- ✅ **Controle de acesso** granular

## 📞 Suporte

### Documentação Oficial
- [Supabase Docs](https://supabase.com/docs)
- [JavaScript Client](https://supabase.com/docs/reference/javascript)

### Comunidade
- [Discord do Supabase](https://discord.supabase.com)
- [GitHub Discussions](https://github.com/supabase/supabase/discussions)

---

**🎉 Com o Supabase configurado, sua equipe terá sincronização perfeita e dados sempre seguros!**