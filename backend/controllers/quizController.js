import db from '../config/db.js';
import fetch from 'node-fetch';

// Funções utilitárias para acesso assíncrono à base de dados
// Estas funções convertem as operações de callback do 'sqlite3' em Promises
function dbQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}


const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODELOS = [
    "google/Gemma-3n-2B", "openrouter/sonoma-dusk-alpha", "openai/gpt-oss-120b",
    "mistralai/Mixtral-8x7B-Instruct-v0.1", "meta-llama/Llama-3-8B-Instruct",
    "nousresearch/Nous-Hermes-2-Mixtral-8x7B-DPO", "qwen/Qwen-7B-Chat"
];

async function fetchQuizFromAPI(tema, dificuldade) {
    for (const modelo of MODELOS) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: modelo,
                    messages: [{ role: "user", content: `Sua única resposta deve ser um array JSON de 7 objetos, cada um representando uma pergunta de quiz. A dificuldade deve ser **${dificuldade}** e o tema "${tema}". Não adicione nenhum texto introdutório, conclusivo, ou blocos de código (como \`\`\`json).

Cada objeto deve ter exatamente as seguintes chaves e formatos:
1. "pergunta" (string): A pergunta em si.
2. "opcoes" (array de 4 strings): As quatro opções de resposta.
3. "respostaCorreta" (string): A resposta correta, que deve ser idêntica a uma das opções.
4. "explicacao" (string): Uma breve explicação sobre a resposta.` }]
                })
            });
            if (!response.ok) continue;
            const rawData = await response.text();
            const conteudo = JSON.parse(rawData)?.choices?.[0]?.message?.content?.replace(/```json\s*/g, "").replace(/```/g, "").trim();
            const perguntas = JSON.parse(conteudo);
            const perguntasValidas = perguntas.filter(p => Array.isArray(p.opcoes) && p.opcoes.includes(p.respostaCorreta) && p.explicacao);
            if (perguntasValidas.length > 0) return perguntasValidas;
        } catch (err) {
            console.warn(`⚠️ Modelo ${modelo} falhou:`, err.message);
        }
    }
    throw new Error("Todos os modelos de IA falharam em gerar um quiz.");
}

export const gerarQuiz = async (req, res) => {
    const { tema, dificuldade = "Médio" } = req.body;
    if (!tema) return res.status(400).json({ erro: "Tema não informado" });

    try {
        let perguntas = await fetchQuizFromAPI(tema, dificuldade);
        // Embaralha as opções de cada pergunta antes de enviar
        perguntas.forEach(p => p.opcoes.sort(() => Math.random() - 0.5));
        
        res.json({ perguntas });
        
        // Salva o quiz gerado no banco de dados em segundo plano
        await dbRun("INSERT INTO quizzes_salvos (tema, perguntas) VALUES (?, ?)", [tema, JSON.stringify(perguntas)]);
    } catch (err) {
        console.error("Erro em gerarQuiz:", err);
        res.status(500).json({ erro: "Não foi possível gerar o quiz." });
    }
};

export const salvarResultado = async (req, res) => {
    const { tema, pontuacao, total } = req.body;
    const id_usuario = req.usuario.id;

    // Validação de segurança para evitar dados inválidos ou maliciosos
    if (typeof pontuacao !== 'number' || typeof total !== 'number' || !Number.isInteger(pontuacao) || !Number.isInteger(total)) {
        return res.status(400).json({ erro: "Dados de resultado inválidos." });
    }
    if (pontuacao < 0 || total <= 0) {
        return res.status(400).json({ erro: "Pontuação ou total inválido." });
    }

    try {
        const data = new Date().toISOString();
        await dbRun("INSERT INTO quizads (id_usuario, tema, pontuacao, total, data) VALUES (?, ?, ?, ?, ?)", [id_usuario, tema, pontuacao, total, data]);
        res.json({ mensagem: "Resultado salvo com sucesso!" });
    } catch (err) {
        console.error("Erro ao salvar resultado:", err);
        res.status(500).json({ erro: "Erro interno ao salvar resultado." });
    }
};

export const getRanking = async (req, res) => {
    const { periodo } = req.params;
    let dateFilter = "";
    if (periodo === 'semanal') dateFilter = "WHERE q.data >= date('now', '-7 days')";
    else if (periodo === 'mensal') dateFilter = "WHERE q.data >= date('now', '-30 days')";

    const query = `
      SELECT u.nome, SUM(q.pontuacao) AS pontuacaoTotal FROM usuarios u
      JOIN quizads q ON u.id = q.id_usuario ${dateFilter}
      GROUP BY u.id, u.nome ORDER BY pontuacaoTotal DESC LIMIT 10`;

    try {
        const ranking = await dbQuery(query);
        res.json({ ranking });
    } catch (err) {
        console.error("Erro ao buscar ranking:", err);
        res.status(500).json({ erro: "Erro ao buscar ranking." });
    }
};

export const getProfile = async (req, res) => {
    const id_usuario = req.usuario.id;
    try {
        const userInfo = await dbGet("SELECT nome, email, criado_em, avatar_url FROM usuarios WHERE id = ?", [id_usuario]);
        if (!userInfo) return res.status(404).json({ erro: "Usuário não encontrado." });

        const stats = await dbGet(`
            SELECT COUNT(*) as totalQuizzes, SUM(pontuacao) as totalPontos,
                   (SELECT tema FROM quizads WHERE id_usuario = ? GROUP BY tema ORDER BY COUNT(tema) DESC LIMIT 1) as temaFavorito
            FROM quizads WHERE id_usuario = ?`, [id_usuario, id_usuario]);

        const recentActivity = await dbQuery("SELECT tema, pontuacao, total, data FROM quizads WHERE id_usuario = ? ORDER BY data DESC LIMIT 5", [id_usuario]);

        res.json({
            nome: userInfo.nome,
            avatarUrl: userInfo.avatar_url,
            membroDesde: userInfo.criado_em,
            stats: {
                totalQuizzes: stats?.totalQuizzes || 0,
                totalPontos: stats?.totalPontos || 0,
                temaFavorito: stats?.temaFavorito || 'Nenhum'
            },
            recentActivity
        });
    } catch (error) {
        console.error("Erro em getProfile:", error);
        res.status(500).json({ erro: "Não foi possível carregar os dados do perfil." });
    }
};

export const setAvatar = async (req, res) => {
    const { avatarUrl } = req.body;
    if (!avatarUrl) return res.status(400).json({ erro: "URL do avatar não fornecida." });

    try {
        await dbRun("UPDATE usuarios SET avatar_url = ? WHERE id = ?", [avatarUrl, req.usuario.id]);
        res.json({ mensagem: "Avatar atualizado com sucesso!" });
    } catch (err) {
        console.error("Erro ao salvar avatar:", err);
        res.status(500).json({ erro: "Erro ao salvar avatar." });
    }
};

export const getHistorico = async (req, res) => {
    try {
        const historico = await dbQuery("SELECT tema, pontuacao, total, data FROM quizads WHERE id_usuario = ? ORDER BY data DESC", [req.usuario.id]);
        res.json({ historico });
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        res.status(500).json({ erro: "Erro ao buscar histórico." });
    }
};
export const getAleatorio = async (req, res) => {
    try {
        // Pede ao DB para selecionar APENAS UM quiz aleatoriamente. Muito mais eficiente.
        const randomQuiz = await dbGet("SELECT tema, perguntas FROM quizzes_salvos ORDER BY RANDOM() LIMIT 1");

        if (!randomQuiz) {
            return res.status(404).json({ erro: "Nenhum quiz salvo disponível." });
        }
        
        const perguntas = JSON.parse(randomQuiz.perguntas);
        res.json({ tema: randomQuiz.tema || "Aleatório", perguntas });

    } catch (err) {
        console.error("Erro ao gerar quiz aleatório:", err);
        res.status(500).json({ erro: "Erro ao processar o quiz aleatório." });
    }
};