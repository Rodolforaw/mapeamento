const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de dados
const getDataPath = () => {
  const tmpDir = process.env.NETLIFY ? '/tmp' : path.join(__dirname, '../../');
  return path.join(tmpDir, 'shared_data.json');
};

// Inicializar dados se não existirem
const initializeData = () => {
  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ markings: [], works: {} }));
  }
};

// Ler dados
const readData = () => {
  try {
    const dataPath = getDataPath();
    if (!fs.existsSync(dataPath)) {
      initializeData();
    }
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler dados:', error);
    return { markings: [], works: {} };
  }
};

// Salvar dados
const saveData = (data) => {
  try {
    const dataPath = getDataPath();
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return false;
  }
};

// Função de merge inteligente
const mergeData = (serverData, clientData) => {
  const merged = {
    markings: [...(serverData.markings || [])],
    works: { ...(serverData.works || {}) }
  };

  // Merge marcações
  const clientMarkings = clientData.markings || [];
  clientMarkings.forEach(clientMarking => {
    const existingIndex = merged.markings.findIndex(m => 
      m.timestamp === clientMarking.timestamp ||
      (m.lat === clientMarking.lat && m.lng === clientMarking.lng && m.type === clientMarking.type)
    );
    
    if (existingIndex >= 0) {
      // Manter a versão mais recente
      if (clientMarking.lastModified > merged.markings[existingIndex].lastModified) {
        merged.markings[existingIndex] = clientMarking;
      }
    } else {
      merged.markings.push(clientMarking);
    }
  });

  // Merge obras
  const clientWorks = clientData.works || {};
  Object.keys(clientWorks).forEach(workId => {
    if (!merged.works[workId] || 
        clientWorks[workId].lastModified > merged.works[workId].lastModified) {
      merged.works[workId] = clientWorks[workId];
    }
  });

  return merged;
};

// Função principal da Netlify
exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (event.httpMethod === 'POST') {
      const requestBody = JSON.parse(event.body || '{}');
      const clientData = requestBody.data || { markings: [], works: {} };
      
      // Ler dados do servidor
      const serverData = readData();
      
      // Fazer merge dos dados
      const mergedData = mergeData(serverData, clientData);
      
      // Salvar dados merged
      const saved = saveData(mergedData);
      
      if (saved) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Sincronização realizada com sucesso',
            data: mergedData,
            timestamp: Date.now(),
            stats: {
              markings: mergedData.markings.length,
              works: Object.keys(mergedData.works).length
            }
          })
        };
      } else {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Erro ao salvar dados sincronizados'
          })
        };
      }
    }

    // Método não suportado
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Método não permitido'
      })
    };

  } catch (error) {
    console.error('Erro na sincronização:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      })
    };
  }
};