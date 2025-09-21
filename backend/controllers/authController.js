import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { validationResult } from 'express-validator';
import db from '../config/db.js';

// JWT_SECRET seguro
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não definido no arquivo .env");
}

// Transporter para emails
const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
});

export const register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erro: errors.array()[0].msg });

    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos" });

    try {
        const hash = await bcrypt.hash(senha, 10);
        await db.run("INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)", [nome, email, hash]);
        res.status(201).json({ mensagem: "Usuário cadastrado com sucesso!", nome });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
        console.error("Erro no registro:", err);
        return res.status(500).json({ erro: "Erro interno ao tentar registrar usuário." });
    }
};

export const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ erro: errors.array()[0].msg });

    const { email, senha } = req.body;
    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, usuario) => {
        if (err || !usuario) return res.status(401).json({ erro: "Credenciais inválidas" });

        const valido = await bcrypt.compare(senha, usuario.senha);
        if (!valido) return res.status(401).json({ erro: "Senha incorreta" });

        const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, nome: usuario.nome });
    });
};

// Reset de senha
export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "E-mail não fornecido" });

    db.get("SELECT * FROM usuarios WHERE email = ?", [email], async (err, usuario) => {
        const genericResponse = { mensagem: "Se o e-mail estiver cadastrado, um link de redefinição será enviado." };
        if (err || !usuario) return res.json(genericResponse);

        const token = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 15*60*1000);

        db.run("REPLACE INTO reset_tokens (email, token, expires_at) VALUES (?, ?, ?)",
            [email, token, expires.toISOString()],
            async (err) => {
                if (err) return res.status(500).json({ erro: "Erro interno ao solicitar redefinição." });

                const resetLink = `https://usermicael.online/redefinir-senha?token=${token}`;
                try {
                    await transporter.sendMail({
                        from: process.env.MAIL_FROM,
                        to: email,
                        subject: "Redefinição de Senha",
                        html: `<p>Clique aqui para redefinir sua senha: <a href="${resetLink}">${resetLink}</a></p>
                               <p>Link válido por 15 minutos.</p>`
                    });
                    res.json(genericResponse);
                } catch (emailError) {
                    console.error("Erro ao enviar e-mail:", emailError);
                    res.status(500).json({ erro: "Não foi possível enviar o e-mail de redefinição." });
                }
            });
    });
};

export const resetPassword = async (req, res) => {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) return res.status(400).json({ erro: "Token e nova senha são obrigatórios." });

    db.get("SELECT * FROM reset_tokens WHERE token = ?", [token], async (err, resetInfo) => {
        if (err || !resetInfo) return res.status(400).json({ erro: "Token inválido ou expirado." });
        if (new Date(resetInfo.expires_at) < new Date()) {
            db.run("DELETE FROM reset_tokens WHERE token = ?", [token]);
            return res.status(400).json({ erro: "Token expirado." });
        }

        const hashNova = await bcrypt.hash(novaSenha, 10);
        db.run("UPDATE usuarios SET senha = ? WHERE email = ?", [hashNova, resetInfo.email], (updateErr) => {
            if (updateErr) return res.status(500).json({ erro: "Erro ao atualizar a senha." });

            db.run("DELETE FROM reset_tokens WHERE token = ?", [token]);
            res.json({ mensagem: "Senha redefinida com sucesso!" });
        });
    });
};
