const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/database');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Аутентификация]
 *     description: Создание нового пользователя в системе
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Иван Иванов"
 *                 description: ФИО пользователя
 *               phone:
 *                 type: string
 *                 example: "+79161234567"
 *                 description: Номер телефона в формате +7XXXXXXXXXX
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ivan@example.com"
 *                 description: Email адрес (необязательно)
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Secret123!"
 *                 description: Пароль (минимум 6 символов)
 *               role:
 *                 type: string
 *                 enum: [renter, landlord, chairman]
 *                 example: "renter"
 *                 description: Роль пользователя в системе
 *     responses:
 *       201:
 *         description: Пользователь успешно зарегистрирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Пользователь зарегистрирован"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Ошибка валидации или пользователь уже существует
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post('/register', async (req, res) => {
    try {
        const { name, phone, email, password, role } = req.body;
        const validRoles = ['renter', 'landlord', 'chairman'];
        const passwordStr = String(password);

        if (!name) {
            return res.status(400).json({
                error: 'Не указано имя',
                message: 'Поле "name" обязательно для заполнения',
            });
        }

        if (!phone) {
            return res.status(400).json({
                error: 'Не указан телефон',
                message: 'Поле "phone" обязательно для заполнения',
            });
        }

        if (!password) {
            return res.status(400).json({
                error: 'Не указан пароль',
                message: 'Поле "password" обязательно для заполнения',
            });
        }

        if (!role) {
            return res.status(400).json({
                error: 'Не указана роль',
                message: 'Поле "role" обязательно для заполнения',
            });
        }

        if (!phone || !/^\+7\d{10}$/.test(phone)) {
            return res.status(400).json({
                message: 'Номер телефона должен быть в формате +7XXXXXXXXXX',
            });
        }

        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            return res
                .status(400)
                .json({ message: 'Некорректный формат email' });
        }

        if (!password || passwordStr.length < 6) {
            return res.status(400).json({
                message: 'Пароль должен содержать не менее 6 символов',
            });
        }

        if (!role || !validRoles.includes(role)) {
            return res
                .status(400)
                .json({ message: 'Некорректная роль пользователя' });
        }

        const existingUser = await db.get(
            'SELECT * FROM users WHERE phone = ? OR email = ?',
            [phone, email]
        );

        if (existingUser) {
            return res.status(400).json({
                error: 'User already exists',
                message:
                    'Пользователь с таким номером телефона или email уже существует',
            });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        const result = await db.run(
            'INSERT INTO users (name, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, phone, email, hashedPassword, role]
        );

        const newUser = await db.get('SELECT * FROM users WHERE id = ?', [
            result.id,
        ]);

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role, name: newUser.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Пользователь зарегистрирован',
            token,
            user: newUser,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Аутентификация]
 *     description: Аутентификация пользователя и получение JWT токена
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+79161234567"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Secret123!"
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Неверные учетные данные
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Неверные учетные данные"
 */
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const phoneStr = phone.toString();
        const passwordStr = password.toString();

        if (!phone || !password) {
            return res.status(400).json({
                error: 'Некорректные данные',
                message: 'Поле email и password обязательны для заполнения',
            });
        }

        const user = await db.get('SELECT * FROM users WHERE phone = ?', [
            phoneStr,
        ]);

        if (!user) {
            return res.status(401).json({
                error: 'Неверные учетные данные',
                message: 'Пользователь не найден',
            });
        }

        const isPasswordValid = bcrypt.compareSync(passwordStr, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                error: 'Неверные учетные данные',
                message: 'Неверный пароль',
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: 'Успешный вход',
            token,
            user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить текущего пользователя
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о текущем пользователе
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/me', async (req, res) => {
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
        const { password, ...userWithoutPassword } = user;

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                error: 'Неверный формат токена',
                message: ' Требуется авторизация',
            });
        }

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден',
            });
        }

        res.json(userWithoutPassword);
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

        // Общая ошибка сервера
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
