# 🔄 Sistema de Sincronização Manual e Offline

## 📋 Visão Geral

O sistema agora possui dois modos de operação distintos:

- **Modo PC (Desktop)**: Sincronização manual sob demanda
- **Modo PWA (Mobile)**: Trabalho offline com sincronização posterior

## 🖥️ Modo PC (Desktop)

### Botão "🔄 Sincronizar Agora"
- **Função**: Sincronização manual imediata
- **Quando usar**: Quando quiser atualizar os dados sem esperar a sincronização automática
- **Frequência**: Sempre que necessário

### Como Funciona
1. Clique no botão "🔄 Sincronizar Agora"
2. O sistema baixa todas as marcações do servidor
3. Atualiza o mapa com os dados mais recentes
4. Mostra status de sucesso/erro

## 📱 Modo PWA (Mobile)

### Botão "📥 Baixar Dados"
- **Função**: Baixa todos os dados para trabalho offline
- **Quando usar**: Antes de sair para campo (onde não há sinal)
- **Frequência**: Uma vez por dia ou antes de cada saída

### Botão "📤 Enviar Dados"
- **Função**: Envia dados coletados offline para o servidor
- **Quando usar**: Quando voltar para área com sinal
- **Frequência**: Sempre que tiver dados para enviar

### Contador de Itens Offline
- **Indicador**: Número vermelho no botão "📤 Enviar Dados"
- **Significado**: Quantos itens estão aguardando sincronização
- **Atualização**: Automática quando adiciona/remove marcações

## 🔄 Sistema de Fila Offline

### Funcionamento Automático
- **Criação de marcações**: Adicionadas à fila se estiver offline
- **Remoção de marcações**: Adicionadas à fila se estiver offline
- **Sincronização**: Processa fila automaticamente quando voltar online

### Persistência
- **Armazenamento**: localStorage do navegador
- **Duração**: Até ser sincronizada com sucesso
- **Backup**: Dados mantidos mesmo se fechar o app

## 📊 Indicadores Visuais

### Status de Sincronização
- **🔄 Sincronizando**: Processo em andamento
- **✅ Sucesso**: Operação concluída
- **❌ Erro**: Falha na operação
- **📱 Offline**: Modo offline ativo

### Cores dos Botões
- **Verde**: Sincronização manual (PC)
- **Laranja/Rosa**: Operações offline (PWA)
- **Cinza**: Botão desabilitado/carregando

## 🚀 Fluxo de Trabalho Recomendado

### Para Trabalhadores de Campo (PWA)
1. **Antes de sair**:
   - Conectar à internet
   - Clicar em "📥 Baixar Dados"
   - Aguardar confirmação de sucesso

2. **No campo**:
   - Trabalhar normalmente (sem internet)
   - Criar/editar marcações
   - Dados ficam na fila offline

3. **Ao voltar**:
   - Conectar à internet
   - Clicar em "📤 Enviar Dados"
   - Aguardar confirmação de sucesso

### Para Supervisores (PC)
1. **Durante o dia**:
   - Clicar em "🔄 Sincronizar Agora" quando necessário
   - Acompanhar progresso dos trabalhadores
   - Verificar dados em tempo real

2. **No final do dia**:
   - Sincronizar uma última vez
   - Verificar se todos os dados foram recebidos

## ⚠️ Considerações Importantes

### Modo Offline
- **Duração**: Funciona indefinidamente offline
- **Limitações**: Não recebe atualizações de outros usuários
- **Sincronização**: Automática quando voltar online

### Conflitos de Dados
- **Resolução**: Sistema prioriza dados mais recentes
- **Backup**: Dados antigos são preservados
- **Logs**: Todas as operações são registradas

### Performance
- **Cache**: Dados ficam em cache local
- **Sincronização**: Apenas dados modificados são enviados
- **Otimização**: Processamento em lotes

## 🔧 Solução de Problemas

### Botão "📤 Enviar Dados" não funciona
1. Verificar conexão com internet
2. Aguardar alguns segundos
3. Tentar novamente
4. Verificar logs no console

### Dados não aparecem no PC
1. Clicar em "🔄 Sincronizar Agora"
2. Aguardar processamento
3. Verificar se PWA enviou os dados
4. Verificar logs no console

### Contador offline não atualiza
1. Recarregar a página
2. Verificar localStorage
3. Limpar cache se necessário

## 📱 Compatibilidade

### Navegadores Suportados
- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

### Dispositivos
- **Android**: 7.0+
- **iOS**: 13.0+
- **Desktop**: Windows 10+, macOS 10.15+, Linux

## 🎯 Benefícios

### Para Trabalhadores
- ✅ Trabalho sem dependência de internet
- ✅ Dados sempre salvos localmente
- ✅ Sincronização automática quando possível
- ✅ Interface intuitiva e responsiva

### Para Supervisores
- ✅ Controle total sobre sincronização
- ✅ Visibilidade em tempo real
- ✅ Dados sempre atualizados
- ✅ Relatórios precisos

### Para a Empresa
- ✅ Redução de perda de dados
- ✅ Aumento da produtividade
- ✅ Melhor controle de qualidade
- ✅ Relatórios mais precisos
