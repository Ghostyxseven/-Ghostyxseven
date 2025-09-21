import express from 'express';
// CORREÇÃO: Nomes corretos das funções importadas
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    gerarQuiz,
    salvarResultado,
    getRanking,
    getProfile, // << NOME CORRIGIDO AQUI
    getHistorico,
    getAleatorio,
    setAvatar
} from '../controllers/quizController.js';

const router = express.Router();

// Rotas que não precisam de login
router.post('/gerar', gerarQuiz);

// Rotas protegidas que precisam de login
router.post('/salvar', authenticateToken, salvarResultado);
router.get('/aleatorio', authenticateToken, getAleatorio);
router.get('/ranking/:periodo', authenticateToken, getRanking);
router.get('/perfil', authenticateToken, getProfile); // << NOME CORRIGIDO AQUI
router.post('/perfil/avatar', authenticateToken, setAvatar);
router.get('/historico', authenticateToken, getHistorico);

export default router;