import jwt from 'jsonwebtoken';
import db from '../config/db.js'; // Importa a conexão com o banco de dados

const JWT_SECRET = process.env.JWT_SECRET;

// NOME CORRIGIDO para 'authenticateToken' e adicionado 'export'
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Pega o token do "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ erro: "Token de acesso ausente." });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ erro: "Token inválido ou expirado." });
        }

        // BUSCA NO DB para pegar dados atuais e a ROLE do usuário
        // Isso é mais seguro do que confiar apenas nos dados do token.
        db.get("SELECT id, nome, email, role FROM usuarios WHERE id = ?", [decoded.id], (dbErr, user) => {
            if (dbErr || !user) {
                return res.status(404).json({ erro: "Usuário do token não encontrado." });
            }
            
            // Anexa o objeto completo do usuário (com a role) ao objeto da requisição
            req.usuario = user;
            next(); // Prossegue para a rota protegida
        });
    });
};