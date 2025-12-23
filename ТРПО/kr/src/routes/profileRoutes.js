const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Получить профиль текущего пользователя
 *     tags: [Профиль]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Профиль пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const user = req.user;

        const userData = await db.get(
            'SELECT id, name, phone, email, role, created_at FROM users WHERE id = ?',
            [user.id]
        );

        if (!userData) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден',
            });
        }

        res.json(userData);
    } catch (error) {
        console.error('Ошибка при получении профиля:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Обновить профиль пользователя
 *     tags: [Профиль]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Иван Иванов"
 *               phone:
 *                 type: string
 *                 example: "+79161234567"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ivan@example.com"
 *     responses:
 *       200:
 *         description: Профиль успешно обновлен
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Конфликт данных (например, телефон или email уже заняты)
 */
router.put('/', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { name, phone, email } = req.body;

        // Проверяем, что есть хотя бы одно поле для обновления
        if (!name && !phone && !email) {
            return res.status(400).json({
                error: 'Нет данных для обновления',
                message:
                    'Укажите хотя бы одно поле для обновления (name, phone или email)',
            });
        }

        // Валидация телефона
        if (phone && !/^\+7\d{10}$/.test(phone)) {
            return res.status(400).json({
                error: 'Некорректный формат телефона',
                message: 'Телефон должен быть в формате +7XXXXXXXXXX',
            });
        }

        // Валидация email
        if (email && !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({
                error: 'Некорректный формат email',
                message: 'Введите корректный email адрес',
            });
        }

        // Проверяем уникальность телефона (кроме текущего пользователя)
        if (phone) {
            const existingPhone = await db.get(
                'SELECT id FROM users WHERE phone = ? AND id != ?',
                [phone, user.id]
            );
            if (existingPhone) {
                return res.status(409).json({
                    error: 'Phone already exists',
                    message:
                        'Пользователь с таким номером телефона уже существует',
                });
            }
        }

        // Проверяем уникальность email (кроме текущего пользователя)
        if (email) {
            const existingEmail = await db.get(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, user.id]
            );
            if (existingEmail) {
                return res.status(409).json({
                    error: 'Email already exists',
                    message: 'Пользователь с таким email уже существует',
                });
            }
        }

        // Формируем запрос на обновление
        const updateFields = [];
        const params = [];

        if (name) {
            updateFields.push('name = ?');
            params.push(name);
        }

        if (phone) {
            updateFields.push('phone = ?');
            params.push(phone);
        }

        if (email) {
            updateFields.push('email = ?');
            params.push(email);
        }

        // Добавляем ID пользователя в параметры
        params.push(user.id);

        // Выполняем обновление
        await db.run(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            params
        );

        // Получаем обновленные данные пользователя
        const updatedUser = await db.get(
            'SELECT id, name, phone, email, role, created_at FROM users WHERE id = ?',
            [user.id]
        );

        res.json({
            message: 'Профиль успешно обновлен',
            user: updatedUser,
        });
    } catch (error) {
        console.error('Ошибка при обновлении профиля:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/profile/password:
 *   put:
 *     summary: Сменить пароль
 *     tags: [Профиль]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: "OldPassword123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: "NewPassword123"
 *     responses:
 *       200:
 *         description: Пароль успешно изменен
 *       400:
 *         description: Неверный текущий пароль или некорректный новый пароль
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/password', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { currentPassword, newPassword } = req.body;

        // Проверка обязательных полей
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Не указаны пароли',
                message: 'Поля "currentPassword" и "newPassword" обязательны',
            });
        }

        // Получаем текущий хэш пароля из базы данных
        const userData = await db.get(
            'SELECT password FROM users WHERE id = ?',
            [user.id]
        );

        if (!userData) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Пользователь не найден',
            });
        }

        // Проверяем текущий пароль
        const isPasswordValid = bcrypt.compareSync(
            currentPassword,
            userData.password
        );
        if (!isPasswordValid) {
            return res.status(400).json({
                error: 'Invalid current password',
                message: 'Неверный текущий пароль',
            });
        }

        // Проверка нового пароля
        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'Password too short',
                message: 'Новый пароль должен содержать не менее 6 символов',
            });
        }

        // Хэшируем новый пароль
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        // Обновляем пароль в базе данных
        await db.run('UPDATE users SET password = ? WHERE id = ?', [
            hashedPassword,
            user.id,
        ]);

        res.json({
            message: 'Пароль успешно изменен',
        });
    } catch (error) {
        console.error('Ошибка при смене пароля:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/profile/statistics:
 *   get:
 *     summary: Получить статистику пользователя
 *     tags: [Профиль]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Статистика пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:
 *                   type: integer
 *                 role:
 *                   type: string
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     total_applications:
 *                       type: integer
 *                       description: Общее количество заявок
 *                     active_applications:
 *                       type: integer
 *                       description: Активные заявки
 *                     total_contracts:
 *                       type: integer
 *                       description: Общее количество договоров
 *                     active_contracts:
 *                       type: integer
 *                       description: Активные договоры
 *                     completed_contracts:
 *                       type: integer
 *                       description: Завершенные договоры
 *                     total_payments:
 *                       type: integer
 *                       description: Общее количество платежей
 *                     total_payments_amount:
 *                       type: number
 *                       description: Общая сумма платежей
 *                     owned_plots:
 *                       type: integer
 *                       description: Количество участков в собственности (для landlord)
 *                     rented_plots:
 *                       type: integer
 *                       description: Количество арендованных участков (для renter)
 */
router.get('/statistics', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const statistics = {};

        // Общие статистики для всех ролей
        const totalApplications = await db.get(
            'SELECT COUNT(*) as count FROM applications WHERE renter_id = ?',
            [user.id]
        );
        statistics.total_applications = totalApplications
            ? totalApplications.count
            : 0;

        const activeApplications = await db.get(
            `SELECT COUNT(*) as count FROM applications 
             WHERE renter_id = ? AND status IN ('pending', 'approved')`,
            [user.id]
        );
        statistics.active_applications = activeApplications
            ? activeApplications.count
            : 0;

        const totalContracts = await db.get(
            'SELECT COUNT(*) as count FROM contracts WHERE renter_id = ?',
            [user.id]
        );
        statistics.total_contracts = totalContracts ? totalContracts.count : 0;

        const activeContracts = await db.get(
            `SELECT COUNT(*) as count FROM contracts 
             WHERE renter_id = ? AND status = 'active'`,
            [user.id]
        );
        statistics.active_contracts = activeContracts
            ? activeContracts.count
            : 0;

        const completedContracts = await db.get(
            `SELECT COUNT(*) as count FROM contracts 
             WHERE renter_id = ? AND status IN ('completed', 'terminated')`,
            [user.id]
        );
        statistics.completed_contracts = completedContracts
            ? completedContracts.count
            : 0;

        const paymentsData = await db.get(
            `SELECT COUNT(*) as count, SUM(amount) as total 
             FROM payments 
             WHERE contract_id IN (SELECT id FROM contracts WHERE renter_id = ?)`,
            [user.id]
        );
        statistics.total_payments = paymentsData ? paymentsData.count : 0;
        statistics.total_payments_amount =
            paymentsData && paymentsData.total ? paymentsData.total : 0;

        // Статистики для арендодателей
        if (user.role === 'landlord') {
            const ownedPlots = await db.get(
                'SELECT COUNT(*) as count FROM plots WHERE owner_id = ?',
                [user.id]
            );
            statistics.owned_plots = ownedPlots ? ownedPlots.count : 0;

            const rentedPlots = await db.get(
                `SELECT COUNT(*) as count FROM plots 
                 WHERE owner_id = ? AND status = 'rented'`,
                [user.id]
            );
            statistics.rented_plots = rentedPlots ? rentedPlots.count : 0;
        }

        // Статистики для арендаторов
        if (user.role === 'renter') {
            const rentedPlotsCount = await db.get(
                `SELECT COUNT(*) as count FROM plots 
                 WHERE renter_id = ? AND status = 'rented'`,
                [user.id]
            );
            statistics.rented_plots = rentedPlotsCount
                ? rentedPlotsCount.count
                : 0;
        }

        res.json({
            user_id: user.id,
            role: user.role,
            statistics,
        });
    } catch (error) {
        console.error('Ошибка при получении статистики:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/profile/contracts:
 *   get:
 *     summary: Получить договоры пользователя с подробной информацией
 *     tags: [Профиль]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, terminated]
 *         description: Фильтр по статусу договора
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Количество возвращаемых договоров
 *     responses:
 *       200:
 *         description: Список договоров пользователя
 */
router.get('/contracts', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { status, limit = 5 } = req.query;

        let query = `
            SELECT 
                c.*,
                p.address as plot_address,
                p.area as plot_area,
                renter.name as renter_name,
                owner.name as owner_name,
                (julianday(c.end_date) - julianday(c.start_date)) as total_days,
                ((julianday(c.end_date) - julianday(c.start_date)) * c.price_per_day) as total_amount
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            JOIN users renter ON c.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            WHERE c.renter_id = ?
        `;

        const params = [user.id];

        if (status) {
            query += ' AND c.status = ?';
            params.push(status);
        }

        query += ' ORDER BY c.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const contracts = await db.query(query, params);

        res.json({
            data: contracts || [],
        });
    } catch (error) {
        console.error('Ошибка при получении договоров:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
