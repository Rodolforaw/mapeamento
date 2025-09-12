# Teste de Debug - Sistema de Obras

## Problema
O sistema está enviando `id: null` para o Supabase, causando erro 23502.

## Arquivos de Teste Criados

### 1. `teste-simples.html`
- Testa se o CONFIG está sendo carregado
- Testa se a função `generateWorkId()` funciona
- **Como usar**: Abra no navegador e clique em "Testar"

### 2. `teste-supabase.html`
- Testa conexão completa com Supabase
- Tenta inserir dados de teste
- **Como usar**: Abra no navegador e clique em "Testar Conexão"

## Passos para Debug

### Passo 1: Testar Configuração
1. Abra `teste-simples.html` no navegador
2. Clique em "Testar"
3. Verifique se:
   - CONFIG está carregado
   - SUPABASE_URL está definida
   - SUPABASE_ANON_KEY está definida
   - ID está sendo gerado

### Passo 2: Testar Supabase
1. Abra `teste-supabase.html` no navegador
2. Clique em "Testar Conexão"
3. Verifique se:
   - Dados são inseridos com sucesso
   - Ou se há erro específico

### Passo 3: Verificar Console
1. Abra o Console do navegador (F12)
2. Procure por mensagens de erro
3. Verifique se os logs estão aparecendo

## Possíveis Problemas

### 1. CONFIG não carregado
- **Sintoma**: `CONFIG is not defined`
- **Solução**: Verificar se `config.js` está sendo carregado antes de `script.js`

### 2. Supabase não carregado
- **Sintoma**: `supabase is not defined`
- **Solução**: Verificar se o script do Supabase está sendo carregado

### 3. ID não gerado
- **Sintoma**: `id: null` nos logs
- **Solução**: Verificar se `generateWorkId()` está sendo chamada

### 4. Erro de permissão
- **Sintoma**: Erro 403 ou 400
- **Solução**: Verificar configurações do Supabase

## Logs Adicionados

O `script.js` agora tem logs detalhados:
- Configurações carregadas
- ID gerado
- Dados a serem salvos
- Tentativa de salvamento
- Resultado do salvamento

## Próximos Passos

1. Execute os testes
2. Verifique os logs no console
3. Identifique onde está o problema
4. Aplique a correção necessária
