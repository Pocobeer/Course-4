const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Подать заявку на аренду участка (UC 2)
 *     tags: [Заявки]
 *     description: Создание новой заявки на аренду участка
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plot_id
 *               - start_date
 *               - end_date
 *             properties:
 *               plot_id:
 *                 type: integer
 *                 example: 1
 *               start_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-02-15"
 *     responses:
 *       201:
 *         description: Заявка успешно создана
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authenticate, authorize(['renter']), async (req, res) => {
    try {
        const { plot_id, start_date, end_date, comment } = req.body;
        const renter_id = req.user.id;

        if (!plot_id) {
            return res.status(400).json({
                error: 'Не указан участок',
                message: 'Поле "plot_id" обязательно для заполнения',
            });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({
                error: 'Не указаны даты',
                message: 'Поля "start_date" и "end_date" обязательны',
            });
        }

        const plot = await db.get('SELECT * FROM plots WHERE id = ?', [
            plot_id,
        ]);
        if (!plot) {
            return res.status(404).json({
                error: 'Участок не найден',
                message: 'Участок с указанным ID не существует',
            });
        }

        if (plot.status !== 'available') {
            return res.status(400).json({
                error: 'Участок недоступен',
                message: 'Участок уже арендован или забронирован',
            });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);
        const today = new Date();

        if (start < today) {
            return res.status(400).json({
                error: 'Некорректная дата начала',
                message: 'Дата начала не может быть в прошлом',
            });
        }

        if (end <= start) {
            return res.status(400).json({
                error: 'Некорректные даты',
                message: 'Дата окончания должна быть позже даты начала',
            });
        }

        const overlappingApplications = await db.get(
            `
            SELECT COUNT(*) as count 
            FROM applications 
            WHERE plot_id = ? 
            AND status = 'approved'
            AND NOT (end_date < ? OR start_date > ?)
        `,
            [plot_id, start_date, end_date]
        );

        if (overlappingApplications.count > 0) {
            return res.status(400).json({
                error: 'Конфликт дат',
                message: 'На указанные даты уже есть одобренная заявка',
            });
        }

        const result = await db.run(
            `
            INSERT INTO applications (plot_id, renter_id, start_date, end_date, status)
            VALUES (?, ?, ?, ?, 'pending')
        `,
            [plot_id, renter_id, start_date, end_date]
        );

        const newApplication = await db.get(
            'SELECT * FROM applications WHERE id = ?',
            [result.id]
        );

        res.status(201).json({
            message: 'Заявка успешно создана',
            application: newApplication,
        });
    } catch (error) {
        console.error('Ошибка при создании заявки:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Получить список заявок (UC 7.1)
 *     tags: [Заявки]
 *     description: |
 *       Получение списка заявок с фильтрацией.
 *       Арендатор видит только свои заявки.
 *       Арендодатель видит заявки на свои участки.
 *       Председатель видит все заявки.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, contract_created]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: plot_id
 *         schema:
 *           type: integer
 *         description: Фильтр по участку
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Количество записей на странице
 *     responses:
 *       200:
 *         description: Список заявок
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, plot_id, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const user = req.user;

        let query = `
            SELECT 
                a.*,
                p.address as plot_address,
                p.area as plot_area,
                renter.name as renter_name,
                renter.phone as renter_phone,
                owner.name as owner_name
            FROM applications a
            JOIN plots p ON a.plot_id = p.id
            JOIN users renter ON a.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            WHERE 1=1
        `;
        const params = [];

        if (user.role === 'renter') {
            query += ' AND a.renter_id = ?';
            params.push(user.id);
        } else if (user.role === 'landlord') {
            query += ' AND p.owner_id = ?';
            params.push(user.id);
        }

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        if (plot_id) {
            query += ' AND a.plot_id = ?';
            params.push(plot_id);
        }

        query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const applications = await db.query(query, params);

        res.json({
            data: applications,
        });
    } catch (error) {
        console.error('Ошибка при получении заявок:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/applications/{id}/approve:
 *   put:
 *     summary: Одобрить заявку (UC 7.2)
 *     tags: [Заявки]
 *     description: Одобрение заявки на аренду участка
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Заявка одобрена
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Заявка не найдена
 */
router.put(
    '/:id/approve',
    authenticate,
    authorize(['landlord']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const user = req.user;

            // Получение заявки с проверкой прав
            const application = await db.get(
                `
            SELECT a.*, p.owner_id 
            FROM applications a
            JOIN plots p ON a.plot_id = p.id
            WHERE a.id = ?
        `,
                [id]
            );

            if (!application) {
                return res.status(404).json({
                    error: 'Application not found',
                    message: 'Заявка с указанным ID не существует',
                });
            }

            // Проверка прав (только владелец участка может одобрять)
            if (application.owner_id !== user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            // Проверка статуса
            if (application.status !== 'pending') {
                return res.status(400).json({
                    error: 'Invalid application status',
                    message: 'Можно одобрить только заявку в статусе "pending"',
                });
            }

            // Обновление статуса
            await db.run('UPDATE applications SET status = ? WHERE id = ?', [
                'approved',
                id,
            ]);

            const updatedApplication = await db.get(
                'SELECT * FROM applications WHERE id = ?',
                [id]
            );

            res.json({
                message: 'Заявка одобрена',
                application: updatedApplication,
            });
        } catch (error) {
            console.error('Ошибка при одобрении заявки:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

/**
 * @swagger
 * /api/applications/{id}/reject:
 *   put:
 *     summary: Отклонить заявку (UC 7.3)
 *     tags: [Заявки]
 *     description: Отклонение заявки на аренду участка с указанием причины
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Причина отклонения
 *     responses:
 *       200:
 *         description: Заявка отклонена
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Заявка не найдена
 */
router.put(
    '/:id/reject',
    authenticate,
    authorize(['landlord']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const user = req.user;

            const application = await db.get(
                `
            SELECT a.*, p.owner_id 
            FROM applications a
            JOIN plots p ON a.plot_id = p.id
            WHERE a.id = ?
        `,
                [id]
            );

            if (!application) {
                return res.status(404).json({
                    error: 'Application not found',
                    message: 'Заявка с указанным ID не существует',
                });
            }

            if (application.owner_id !== user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            if (application.status !== 'pending') {
                return res.status(400).json({
                    error: 'Invalid application status',
                    message:
                        'Можно отклонить только заявку в статусе "pending"',
                });
            }

            await db.run(
                'UPDATE applications SET status = ?, rejection_reason = ? WHERE id = ?',
                ['rejected', reason, id]
            );

            const updatedApplication = await db.get(
                'SELECT * FROM applications WHERE id = ?',
                [id]
            );

            res.json({
                message: 'Заявка отклонена',
                application: updatedApplication,
            });
        } catch (error) {
            console.error('Ошибка при отклонении заявки:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

module.exports = router;
