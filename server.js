const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 8000;
const dataFile = path.join(__dirname, 'shared_data.json');

// Inicializar arquivo de dados compartilhados se não existir
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ markings: [], works: {} }));
}

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Configurar CORS para todas as respostas
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API Routes
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname);
        return;
    }
    
    // Static file serving
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read file
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Arquivo não encontrado</h1>', 'utf-8');
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Erro do servidor: ${error.code}`);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(content, 'utf-8');
        }
    });
});

// Função para lidar com requisições da API
function handleApiRequest(req, res, pathname) {
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = body ? JSON.parse(body) : {};
            
            switch (pathname) {
                case '/api/markings':
                    if (req.method === 'GET') {
                        getMarkings(res);
                    } else if (req.method === 'POST') {
                        saveMarkings(res, data);
                    }
                    break;
                    
                case '/api/sync':
                    if (req.method === 'POST') {
                        syncData(res, data);
                    }
                    break;
                    
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Endpoint não encontrado' }));
            }
        } catch (error) {
            console.error('Erro na API:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Erro interno do servidor' }));
        }
    });
}

// Obter todas as marcações
function getMarkings(res) {
    try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (error) {
        console.error('Erro ao ler dados:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao ler dados' }));
    }
}

// Salvar marcações
function saveMarkings(res, newData) {
    try {
        const currentData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        // Mesclar dados
        if (newData.markings) {
            currentData.markings = newData.markings;
        }
        if (newData.works) {
            currentData.works = newData.works;
        }
        
        // Adicionar timestamp
        currentData.lastSync = new Date().toISOString();
        
        fs.writeFileSync(dataFile, JSON.stringify(currentData, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Dados salvos com sucesso' }));
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao salvar dados' }));
    }
}

// Sincronizar dados (merge inteligente)
function syncData(res, clientData) {
    try {
        const serverData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        // Merge das marcações por ID (evita duplicatas)
        const mergedMarkings = [...serverData.markings || []];
        const existingIds = new Set(mergedMarkings.map(m => m.id));
        
        if (clientData.markings) {
            clientData.markings.forEach(marking => {
                if (!existingIds.has(marking.id)) {
                    mergedMarkings.push(marking);
                }
            });
        }
        
        // Merge dos dados de obras
        const mergedWorks = { ...serverData.works, ...clientData.works };
        
        const finalData = {
            markings: mergedMarkings,
            works: mergedWorks,
            lastSync: new Date().toISOString()
        };
        
        fs.writeFileSync(dataFile, JSON.stringify(finalData, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: finalData,
            message: `Sincronização concluída. ${mergedMarkings.length} marcações no total.`
        }));
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro na sincronização' }));
    }
}

server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Pressione Ctrl+C para parar o servidor');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nParando servidor...');
    server.close(() => {
        console.log('Servidor parado.');
        process.exit(0);
    });
});