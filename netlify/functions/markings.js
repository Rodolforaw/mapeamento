const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de dados (será criado no diretório temporário do Netlify)
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
    const data = readData();

    if (event.httpMethod === 'GET') {
      // Retornar marcações
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          markings: data.markings || [],
          timestamp: Date.now()
        })
      };
    }

    if (event.httpMethod === 'POST') {
      // Salvar marcações
      const requestBody = JSON.parse(event.body || '{}');
      const newMarkings = requestBody.markings || [];

      // Merge com dados existentes (evitar duplicatas por timestamp)
      const existingMarkings = data.markings || [];
      const mergedMarkings = [...existingMarkings];

      newMarkings.forEach(newMarking => {
        const existingIndex = mergedMarkings.findIndex(m => 
          m.timestamp === newMarking.timestamp ||
          (m.lat === newMarking.lat && m.lng === newMarking.lng && m.type === newMarking.type)
        );
        
        if (existingIndex >= 0) {
          mergedMarkings[existingIndex] = newMarking;
        } else {
          mergedMarkings.push(newMarking);
        }
      });

      data.markings = mergedMarkings;
      const saved = saveData(data);

      return {
        statusCode: saved ? 200 : 500,
        headers,
        body: JSON.stringify({
          success: saved,
          message: saved ? 'Marcações salvas com sucesso' : 'Erro ao salvar marcações',
          count: mergedMarkings.length,
          timestamp: Date.now()
        })
      };
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
    console.error('Erro na função:', error);
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