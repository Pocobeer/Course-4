const jwt = require('jsonwebtoken');
const db = require('../models/database');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'Не авторизован',
                message: ' Требуется авторизация',
            });
        }

        const parts = authHeader.split(' ');
        const token = parts[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [
            decoded.id,
        ]);

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                error: 'Неверный формат токена',
                message: ' Требуется авторизация',
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(401).json({
                error: 'JWT_SECRET is not defined',
                message: ' Требуется авторизация',
            });
        }

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                error: 'Неверный токен',
                message: 'Токен невалиден',
            });
        }

        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                error: 'Токен истек',
                message: 'Срок действия токена истек. Авторизуйтесь снова',
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
};

const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Требуется аутентификация',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Доступ запрещен',
            });
        }

        next();
    };
};

module.exports = { authenticate, authorize };
