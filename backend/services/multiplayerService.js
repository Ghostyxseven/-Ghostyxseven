import db from '../config/db.js';
import Redis from 'ioredis';

// --- 1. CONFIGURAÇÃO E CONEXÃO COM O REDIS ---
const redis = new Redis();

// --- 2. CONFIGURAÇÕES GLOBAIS DO JOGO ---
const QUESTIONS_PER_MATCH = 10;
const ROUND_TIME_MS = 16000;
const RESULT_DELAY_MS = 4000;
const ELO_K_FACTOR = 32;
const QUIZ_CACHE_REFRESH_MS = 5 * 60 * 1000;
const POINTS_QUICK = 12;
const POINTS_MEDIUM = 8;
const QUICK_THRESHOLD_MS = 8000;

// --- 3. GESTÃO DO CACHE DE PERGUNTAS ---
// (Nenhuma alteração nesta seção, mantida igual)
let quizCache = [];
let cacheIndex = 0;
async function dbAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}
function sanitizeString(s, maxLen = 100) {
    if (!s) return '';
    return String(s).replace(/<[^>]*>?/gm, '').trim().slice(0, maxLen);
}
async function loadQuizCache() {
    try {
        const rows = await dbAllAsync(`SELECT tema, pergunta, opcoes, respostaCorreta FROM perguntas`);
        
        quizCache = rows
            .map(q => ({
                tema: q.tema || 'Quiz',
                pergunta: sanitizeString(q.pergunta, 300),
                opcoes: JSON.parse(q.opcoes).map(o => sanitizeString(o, 200)),
                respostaCorreta: sanitizeString(q.respostaCorreta, 200)
            }))
            .filter(q => q && q.pergunta && Array.isArray(q.opcoes) && q.respostaCorreta);
        
        for (let i = quizCache.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [quizCache[i], quizCache[j]] = [quizCache[j], quizCache[i]];
        }
        
        cacheIndex = 0;
        console.log(`[INFO] Cache de quizzes recarregado com ${quizCache.length} perguntas.`);
    } catch (err) {
        console.error("[ERRO] Erro crítico ao carregar o cache de quizzes:", err.message);
    }
}
function getQuestionsForMatch() {
    if (cacheIndex + QUESTIONS_PER_MATCH > quizCache.length) {
        console.log("[INFO] Fim do baralho de cache, a reembaralhar.");
        for (let i = quizCache.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [quizCache[i], quizCache[j]] = [quizCache[j], quizCache[i]];
        }
        cacheIndex = 0;
    }
    if (quizCache.length < QUESTIONS_PER_MATCH) {
        throw new Error(`Não há perguntas suficientes. Necessárias: ${QUESTIONS_PER_MATCH}, Disponíveis: ${quizCache.length}`);
    }
    const selected = quizCache.slice(cacheIndex, cacheIndex + QUESTIONS_PER_MATCH);
    cacheIndex += QUESTIONS_PER_MATCH;
    return selected;
}
loadQuizCache();
setInterval(loadQuizCache, QUIZ_CACHE_REFRESH_MS);

// --- 4. FUNÇÕES UTILITÁRIAS ---
// (Nenhuma alteração nesta seção, mantida igual)
function dbRun(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function calculateElo(playerElo, opponentElo, score) {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    return Math.round(playerElo + ELO_K_FACTOR * (score - expectedScore));
}
function computePoints(timeTakenMs) {
    if (timeTakenMs <= QUICK_THRESHOLD_MS) return POINTS_QUICK;
    return POINTS_MEDIUM;
}
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    let code = '';
    code += chars[Math.floor(Math.random() * chars.length)];
    code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    code += nums[Math.floor(Math.random() * nums.length)];
    code += nums[Math.floor(Math.random() * nums.length)];
    code += nums[Math.floor(Math.random() * nums.length)];
    return code;
}


// --- 5. LÓGICA PRINCIPAL DO JOGO ---

async function startGame(room, io) {
    try {
        const gameJSON = await redis.get(`room:${room}`);
        if (!gameJSON) throw new Error("Sala não encontrada no Redis.");
        const game = JSON.parse(gameJSON);

        game.questions = getQuestionsForMatch();
        game.currentQuestion = 0;
        game.state = 'IN_GAME';
        
        // Reinicia a pontuação para o caso de ser um rematch
        game.players.forEach(p => p.score = 0);

        await redis.set(`room:${room}`, JSON.stringify(game));

        io.to(room).emit('matchStarting', { players: game.players });
        
        // Inicia o loop do jogo após 3 segundos
        setTimeout(() => iniciarNovaRodada(room, io), 3000);

    } catch (err) {
        console.error(`[ERRO] Erro ao iniciar jogo na sala ${room}:`, err);
        io.to(room).emit('gameError', { message: 'Não foi possível iniciar a partida.' });
        await redis.del(`room:${room}`);
    }
}

/**
 * **FUNÇÃO CENTRALIZADORA (ANTIGA sendQuestion)**
 * Esta função agora controla o início de cada rodada.
 */
async function iniciarNovaRodada(room, io) {
    const gameJSON = await redis.get(`room:${room}`);
    if (!gameJSON) return; // O jogo pode ter sido encerrado
    const game = JSON.parse(gameJSON);

    // Se não houver mais perguntas, encerra o jogo
    if (game.currentQuestion >= game.questions.length) {
        return await endGame(room, io);
    }

    // Limpa o timer da rodada anterior para garantir que não haja sobreposição
    if (game.roundTimer) {
        clearTimeout(game.roundTimer);
    }

    const q = game.questions[game.currentQuestion];
    const questionToSend = {
        pergunta: q.pergunta,
        opcoes: [...q.opcoes].sort(() => Math.random() - 0.5),
        questionNumber: game.currentQuestion + 1,
        totalQuestions: game.questions.length
    };
    
    game.questionSentAt = Date.now();
    game.answers = {};
    game.state = 'AWAITING_ANSWERS';

    io.to(room).emit('newQuestion', questionToSend);

    // Cria um temporizador SEGURO e ATUALIZADO para a rodada atual
    const roundTimeout = setTimeout(() => {
        console.log(`[INFO] Tempo esgotado para a rodada ${game.currentQuestion + 1} na sala ${room}`);
        processarRodada(room, io);
    }, ROUND_TIME_MS);
    
    // Armazena a referência do timer no estado do jogo
    // ATENÇÃO: setTimeout retorna um objeto no Node.js, não um número. Não podemos serializá-lo no JSON.
    // Em vez de salvar o timer no Redis, vamos gerenciá-lo em memória. Isso requer que a sala seja gerenciada pelo mesmo processo do servidor.
    // Para simplificar e manter seu código atual, vamos remover a persistência do timer no Redis.
    
    // Apenas atualiza o estado do jogo no Redis
    await redis.set(`room:${room}`, JSON.stringify(game), 'EX', 600); 

    // O timer é gerenciado em memória pelo processo Node.js que executou esta função.
    // A lógica de `clearTimeout` no `submitAnswer` se torna crucial.
}

async function processarRodada(room, io) {
    const gameJSON = await redis.get(`room:${room}`);
    if (!gameJSON) return;
    const game = JSON.parse(gameJSON);

    // Proteção para evitar processamento duplo
    if (game.state !== 'AWAITING_ANSWERS') return;
    
    game.state = 'PROCESSING';
    // O timer da rodada já terminou ou foi limpo, não precisa de clearTimeout aqui

    const question = game.questions[game.currentQuestion];
    const [p1, p2] = game.players;

    const a1 = game.answers[p1.socketId];
    const a2 = game.answers[p2.socketId];

    const isCorrect1 = a1 && a1.answer === question.respostaCorreta;
    const isCorrect2 = a2 && a2.answer === question.respostaCorreta;

    let roundWinnerId = null;

    if (isCorrect1 && !isCorrect2) {
        p1.score += computePoints(a1.time);
        roundWinnerId = p1.socketId;
    } else if (!isCorrect1 && isCorrect2) {
        p2.score += computePoints(a2.time);
        roundWinnerId = p2.socketId;
    } else if (isCorrect1 && isCorrect2) {
        if (a1.time < a2.time) {
            p1.score += computePoints(a1.time);
            roundWinnerId = p1.socketId;
        } else {
            p2.score += computePoints(a2.time);
            roundWinnerId = p2.socketId;
        }
    }
    
    io.to(room).emit('roundResult', {
        scores: { [p1.socketId]: p1.score, [p2.socketId]: p2.score },
        correctAnswer: question.respostaCorreta,
        roundWinnerId: roundWinnerId,
        chosenAnswers: {
            [p1.socketId]: a1 ? a1.answer : null,
            [p2.socketId]: a2 ? a2.answer : null
        }
    });

    game.currentQuestion++;
    game.state = 'IN_GAME';
    await redis.set(`room:${room}`, JSON.stringify(game));

    // **MUDANÇA CRÍTICA:** Agenda o início da próxima rodada, completando o loop
    setTimeout(() => iniciarNovaRodada(room, io), RESULT_DELAY_MS);
}

// A função endGame permanece a mesma
async function endGame(room, io, disconnectedPlayerId = null) {
    // ... (código igual ao original)
    const gameJSON = await redis.get(`room:${room}`);
    if (!gameJSON) return;
    const game = JSON.parse(gameJSON);
    
    if (game.state === 'ENDED') return;
    game.state = 'ENDED';

    const [p1, p2] = game.players;
    let p1_score_result, p2_score_result;

    if(disconnectedPlayerId) {
        p1_score_result = (p1.socketId === disconnectedPlayerId) ? 0 : 1;
        p2_score_result = (p2.socketId === disconnectedPlayerId) ? 0 : 1;
    } else {
        if (p1.score > p2.score) { p1_score_result = 1; p2_score_result = 0; }
        else if (p2.score > p1.score) { p1_score_result = 0; p2_score_result = 1; }
        else { p1_score_result = 0.5; p2_score_result = 0.5; }
    }

    const newP1Elo = calculateElo(p1.elo, p2.elo, p1_score_result);
    const newP2Elo = calculateElo(p2.elo, p1.elo, p2_score_result);

    try {
        await Promise.all([
            dbRun("UPDATE usuarios SET elo_score = ? WHERE id = ?", [newP1Elo, p1.userId]),
            dbRun("UPDATE usuarios SET elo_score = ? WHERE id = ?", [newP2Elo, p2.userId]),
            dbRun("INSERT INTO quizads (id_usuario, tema, pontuacao, total, data) VALUES (?, ?, ?, ?, ?)", [p1.userId, 'Multiplayer', p1.score, game.questions.length, new Date().toISOString()]),
            dbRun("INSERT INTO quizads (id_usuario, tema, pontuacao, total, data) VALUES (?, ?, ?, ?, ?)", [p2.userId, 'Multiplayer', p2.score, game.questions.length, new Date().toISOString()])
        ]);
    } catch(err) {
        console.error("Erro ao salvar resultados do jogo:", err);
    }
    
    const rematchInfo = {
        roomName: room,
        players: [p1, p2]
    };
    await redis.set(`rematch:${room}`, JSON.stringify(rematchInfo), 'EX', 120);

    io.to(room).emit('gameOver', {
        players: game.players,
        eloChanges: {
            [p1.socketId]: { old: p1.elo, new: newP1Elo },
            [p2.socketId]: { old: p2.elo, new: newP2Elo }
        },
        disconnectedPlayerId,
        rematchAvailable: true,
        roomName: room
    });
}


// --- 6. GESTÃO DE EVENTOS SOCKET.IO ---
// Criamos um mapa para guardar os timers em memória, associados a cada sala
const roomTimers = new Map();

export default function initializeMultiplayer(io) {
    io.on('connection', (socket) => {
        // ... (eventos 'findMatch', 'createPrivateRoom', 'joinPrivateRoom', 'requestRematch' permanecem iguais)
        
        socket.on('findMatch', async (data) => {
            const playerInfo = { socketId: socket.id, userId: data.userId, name: data.name, elo: data.elo, avatarUrl: data.avatarUrl, score: 0 };
            const opponentJSON = await redis.lpop('waiting_players');
            
            if (opponentJSON) {
                const opponentInfo = JSON.parse(opponentJSON);
                if (opponentInfo.socketId === socket.id) { await redis.rpush('waiting_players', opponentJSON); return; }

                const roomName = `room-${socket.id}-${opponentInfo.socketId}`;
                socket.currentRoom = roomName;
                const opponentSocket = io.sockets.sockets.get(opponentInfo.socketId);
                
                if (opponentSocket) {
                    opponentSocket.currentRoom = roomName;
                    const game = { players: [playerInfo, opponentInfo], state: 'STARTING' };
                    await redis.set(`room:${roomName}`, JSON.stringify(game));
                    
                    opponentSocket.join(roomName);
                    socket.join(roomName);
                    io.to(roomName).emit('matchFound', { room: roomName, players: game.players });
                    await startGame(roomName, io);
                } else {
                    await redis.lpush('waiting_players', JSON.stringify(playerInfo));
                    socket.emit('waitingForOpponent');
                }
            } else {
                await redis.rpush('waiting_players', JSON.stringify(playerInfo));
                socket.emit('waitingForOpponent');
            }
        });
        
        socket.on('createPrivateRoom', async (data) => {
            const playerInfo = { socketId: socket.id, userId: data.userId, name: data.name, elo: data.elo, avatarUrl: data.avatarUrl, score: 0 };
            const roomCode = generateRoomCode();
            
            await redis.set(`private_room:${roomCode}`, JSON.stringify(playerInfo), 'EX', 300);
            
            socket.emit('privateRoomCreated', { roomCode });
        });

        socket.on('joinPrivateRoom', async (data) => {
            const { roomCode } = data;
            const playerInfo = { socketId: socket.id, userId: data.userId, name: data.name, elo: data.elo, avatarUrl: data.avatarUrl, score: 0 };

            const creatorJSON = await redis.get(`private_room:${roomCode}`);
            if (!creatorJSON) {
                socket.emit('gameError', { message: 'Sala privada não encontrada ou expirou.' });
                return;
            }
            const creatorInfo = JSON.parse(creatorJSON);
            const creatorSocket = io.sockets.sockets.get(creatorInfo.socketId);

            if (!creatorSocket) {
                socket.emit('gameError', { message: 'O anfitrião da sala desconectou-se.' });
                return;
            }

            await redis.del(`private_room:${roomCode}`);

            const roomName = `room-${socket.id}-${creatorInfo.socketId}`;
            socket.currentRoom = roomName;
            creatorSocket.currentRoom = roomName;

            const game = { players: [playerInfo, creatorInfo], state: 'STARTING' };
            await redis.set(`room:${roomName}`, JSON.stringify(game));
            
            creatorSocket.join(roomName);
            socket.join(roomName);
            io.to(roomName).emit('matchFound', { room: roomName, players: game.players });
            await startGame(roomName, io);
        });
        
        socket.on('requestRematch', async ({ roomName }) => {
            await redis.set(`rematch_request:${roomName}:${socket.id}`, 'true', 'EX', 60);

            const rematchInfoJSON = await redis.get(`rematch:${roomName}`);
            if(!rematchInfoJSON) return;
            
            const rematchInfo = JSON.parse(rematchInfoJSON);
            const opponent = rematchInfo.players.find(p => p.socketId !== socket.id);

            if (opponent) {
                const opponentWantsRematch = await redis.get(`rematch_request:${roomName}:${opponent.socketId}`);

                if (opponentWantsRematch) {
                    const p1 = rematchInfo.players[0];
                    const p2 = rematchInfo.players[1];

                    await redis.del(`rematch:${roomName}`);
                    await redis.del(`rematch_request:${roomName}:${p1.socketId}`);
                    await redis.del(`rematch_request:${roomName}:${p2.socketId}`);

                    const newRoomName = `room-${p1.socketId}-${p2.socketId}-${Date.now()}`;
                    const p1Socket = io.sockets.sockets.get(p1.socketId);
                    const p2Socket = io.sockets.sockets.get(p2.socketId);

                    if(p1Socket && p2Socket) {
                        p1Socket.currentRoom = newRoomName;
                        p2Socket.currentRoom = newRoomName;

                        const game = { players: rematchInfo.players, state: 'STARTING' };
                        await redis.set(`room:${newRoomName}`, JSON.stringify(game));

                        p1Socket.join(newRoomName);
                        p2Socket.join(newRoomName);

                        io.to(newRoomName).emit('matchFound', { room: newRoomName, players: game.players });
                        await startGame(newRoomName, io);
                    }
                } else {
                    io.to(opponent.socketId).emit('rematchRequestedByOpponent');
                }
            }
        });


        socket.on('submitAnswer', async (data) => {
            const { room, answer } = data;
            const gameJSON = await redis.get(`room:${room}`);
            if (!gameJSON) return;
            const game = JSON.parse(gameJSON);

            // Se o jogador já respondeu ou a rodada acabou, ignora
            if (game.answers[socket.id] || game.state !== 'AWAITING_ANSWERS') return;

            const timeTakenMs = Date.now() - game.questionSentAt;
            game.answers[socket.id] = { answer, time: timeTakenMs };
            
            io.to(room).emit('opponentAnswered', { socketId: socket.id });

            // Se todos os jogadores responderam
            if (Object.keys(game.answers).length === game.players.length) {
                // **MUDANÇA IMPORTANTE:** Limpa o timer da rodada que está em memória
                const timer = roomTimers.get(room);
                if (timer) {
                    clearTimeout(timer);
                    roomTimers.delete(room);
                }
                // Inicia o processamento da rodada imediatamente
                processarRodada(room, io);
            }

            // Salva o estado atualizado com a nova resposta
            await redis.set(`room:${room}`, JSON.stringify(game));
        });

        socket.on('disconnect', async () => {
            // Remove da fila de espera
            const waitingPlayers = await redis.lrange('waiting_players', 0, -1);
            for(const player of waitingPlayers) {
                if(player.includes(socket.id)) {
                    await redis.lrem('waiting_players', 0, player);
                }
            }
            
            // Se estiver em uma sala, encerra o jogo
            if (socket.currentRoom) {
                // Limpa qualquer timer pendente para esta sala
                const timer = roomTimers.get(socket.currentRoom);
                if (timer) {
                    clearTimeout(timer);
                    roomTimers.delete(socket.currentRoom);
                }
                endGame(socket.currentRoom, io, socket.id);
            }
        });
    });
    
    // **NOVA FUNÇÃO para sobrepor a `iniciarNovaRodada` com gerenciamento de timer em memória**
    const originalIniciarNovaRodada = iniciarNovaRodada;
    iniciarNovaRodada = async (room, io) => {
        const gameJSON = await redis.get(`room:${room}`);
        if (!gameJSON) return;
        const game = JSON.parse(gameJSON);

        if (game.currentQuestion >= game.questions.length) {
            return await endGame(room, io);
        }

        // Limpa timer anterior, se houver
        if (roomTimers.has(room)) {
            clearTimeout(roomTimers.get(room));
            roomTimers.delete(room);
        }

        const roundTimeout = setTimeout(() => {
            console.log(`[INFO] Tempo esgotado para a rodada ${game.currentQuestion + 1} na sala ${room}`);
            processarRodada(room, io);
            roomTimers.delete(room); // Limpa o timer do mapa após ser executado
        }, ROUND_TIME_MS);

        roomTimers.set(room, roundTimeout); // Armazena o novo timer
        
        // Chama a lógica original de enviar a pergunta
        await originalIniciarNovaRodada(room, io);
    };
}