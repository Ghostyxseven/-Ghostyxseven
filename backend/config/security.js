import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 15,
    message: 'Muitas tentativas de autenticação deste IP, tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
});