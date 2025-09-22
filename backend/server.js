import 'dotenv/config'; 
import express from "express";
import cors from "cors";
import helmet from 'helmet';
import http from 'http';
import { Server } from "socket.io";
import path from 'path'; // Necessário para lidar com caminhos de arquivo
import { fileURLToPath } from 'url'; // Necessário para lidar com caminhos de arquivo

// Rotas
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Serviços
import initializeMultiplayer from './services/multiplayerService.js';

const app = express();
const server = http.createServer(app);

// --- MELHORIA: Configuração de CORS centralizada e flexível ---
// Lista de endereços (origens) que têm permissão para se conectar à sua API
const allowedOrigins = [ // Seu site em produção
    "http://localhost:3000",     // Endereço comum de desenvolvimento
    "http://localhost:5173",     // Endereço padrão do Vite
    "http://localhost:5174",     // Portas alternativas do Vite
    "http://localhost:5175",
     // Seu IP de rede local para testes no telemóvel
];

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições se a origem estiver na lista ou se não houver origem (ex: Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origem não permitida pelo CORS'));
    }
  },
  methods: ["GET", "POST"]
};


// --- AJUSTE: Aplicando a configuração de CORS ao Socket.IO ---
const io = new Server(server, {
  cors: corsOptions // Usa as mesmas opções de CORS para o Socket.IO
});

initializeMultiplayer(io);

app.set('trust proxy', 1);
const port = 3000;

// Middlewares
app.use(helmet());
app.use(cors(corsOptions)); // AJUSTE: Usa a configuração de CORS específica em vez da geral
app.use(express.json());

// --- SERVIR ARQUIVOS ESTÁTICOS DO PAINEL ADMIN ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));


// --- ROTAS DA API ---
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Rota raiz da API
app.get("/", (req, res) => {
  res.send("🧠 API de geração de quiz com login está ativa e estruturada!");
});

// Inicia o servidor
server.listen(port, () => {
  console.log(`🚀 Servidor completo rodando em http://localhost:${port}`);
});