import express from 'express';
import { body } from 'express-validator';
import { register, login, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { authLimiter } from '../config/security.js';

const router = express.Router();

router.post("/register",
    body('nome').notEmpty().withMessage('O nome é obrigatório.'),
    body('email').isEmail().withMessage('Formato de e-mail inválido.'),
    body('senha').isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres.'),
    register
);

router.post("/login", authLimiter,
    body('email').isEmail().withMessage('Formato de e-mail inválido.'),
    body('senha').notEmpty().withMessage('A senha é obrigatória.'),
    login
);

router.post("/esqueci-senha", authLimiter, requestPasswordReset);

router.post("/redefinir-senha", resetPassword);

export default router;