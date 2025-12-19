// src/routes/contractRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Получить список договоров
 *     tags: [Договоры]
 *     description: |
 *       Получение списка договоров с фильтрацией.
 *       Арендатор видит только свои договоры.
 *       Арендодатель видит договоры по своим участкам.
 *       Председатель видит все договоры.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, completed, terminated]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: plot_id
 *         schema:
 *           type: integer
 *         description: Фильтр по участку
 *       - in: query
 *         name: renter_id
 *         schema:
 *           type: integer
 *         description: Фильтр по арендатору
 *       - in: query
 *         name: start_date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Начало периода (дата начала договора)
 *       - in: query
 *         name: start_date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Конец периода (дата начала договора)
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
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ContractDetails'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const {
            status,
            plot_id,
            renter_id,
            start_date_from,
            start_date_to,
            page = 1,
            limit = 10,
        } = req.query;

        const offset = (page - 1) * limit;
        const user = req.user;

        console.log('User role:', user.role);
        console.log('User ID:', user.id);

        // Создаем базовые условия WHERE
        let whereConditions = [];
        let params = [];

        // Фильтрация по роли пользователя
        if (user.role === 'renter') {
            whereConditions.push('c.renter_id = ?');
            params.push(user.id);
        } else if (user.role === 'landlord') {
            whereConditions.push('p.owner_id = ?');
            params.push(user.id);
        }
        // Председатель видит все, поэтому не добавляем условия

        // Фильтр по статусу
        if (status) {
            whereConditions.push('c.status = ?');
            params.push(status);
        }

        // Фильтр по участку
        if (plot_id) {
            whereConditions.push('c.plot_id = ?');
            params.push(plot_id);
        }

        // Фильтр по арендатору
        if (renter_id) {
            whereConditions.push('c.renter_id = ?');
            params.push(renter_id);
        }

        // Фильтр по дате начала
        if (start_date_from) {
            whereConditions.push('c.start_date >= ?');
            params.push(start_date_from);
        }

        if (start_date_to) {
            whereConditions.push('c.start_date <= ?');
            params.push(start_date_to);
        }

        // Формируем WHERE часть запроса
        const whereClause =
            whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

        // Запрос для подсчета общего количества
        let countQuery = `
            SELECT COUNT(*) as total
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            JOIN users renter ON c.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            ${whereClause}
        `;

        console.log('Count query:', countQuery);
        console.log('Count params:', params);

        // Выполняем запрос для подсчета
        const countResult = await db.get(countQuery, params);
        console.log('Count result:', countResult);

        // Обрабатываем результат подсчета
        let total = 0;
        if (countResult && countResult.total !== undefined) {
            total = countResult.total;
        } else if (countResult && countResult['COUNT(*)'] !== undefined) {
            // Если SQLite вернул COUNT(*) как 'COUNT(*)'
            total = countResult['COUNT(*)'];
        }

        // Основной запрос с данными
        let query = `
            SELECT 
                c.*,
                p.address as plot_address,
                p.area as plot_area,
                renter.name as renter_name,
                renter.phone as renter_phone,
                owner.name as owner_name,
                (julianday(c.end_date) - julianday(c.start_date)) as total_days,
                ((julianday(c.end_date) - julianday(c.start_date)) * c.price_per_day) as total_amount
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            JOIN users renter ON c.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            ${whereClause}
            ORDER BY c.created_at DESC 
            LIMIT ? OFFSET ?
        `;

        // Добавляем параметры для пагинации
        const queryParams = [...params, parseInt(limit), parseInt(offset)];

        console.log('Main query:', query);
        console.log('Main params:', queryParams);

        const contracts = await db.query(query, queryParams);

        res.json({
            data: contracts || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Полная ошибка при получении договоров:');
        console.error('Сообщение:', error.message);
        console.error('Стек:', error.stack);

        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Получить договор по ID
 *     tags: [Договоры]
 *     description: Получение подробной информации о договоре по его ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractDetails'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для просмотра договора
 *       404:
 *         description: Договор не найден
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const contract = await db.get(
            `
            SELECT 
                c.*,
                p.address as plot_address,
                p.area as plot_area,
                p.description as plot_description,
                renter.name as renter_name,
                renter.phone as renter_phone,
                renter.email as renter_email,
                owner.name as owner_name,
                owner.phone as owner_phone,
                owner.email as owner_email,
                (julianday(c.end_date) - julianday(c.start_date)) as total_days,
                ((julianday(c.end_date) - julianday(c.start_date)) * c.price_per_day) as total_amount
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            JOIN users renter ON c.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            WHERE c.id = ?
            `,
            [id]
        );

        if (!contract) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'Договор с указанным ID не найден',
            });
        }

        // Проверка прав доступа
        if (user.role === 'renter' && contract.renter_id !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'У вас нет прав для просмотра этого договора',
            });
        }

        if (user.role === 'landlord' && contract.owner_id !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'У вас нет прав для просмотра этого договора',
            });
        }

        res.json(contract);
    } catch (error) {
        console.error('Ошибка при получении договора:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Создать договор на основе заявки
 *     tags: [Договоры]
 *     description: Создание договора аренды на основе одобренной заявки
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *             properties:
 *               application_id:
 *                 type: integer
 *                 description: ID заявки для создания договора
 *                 example: 1
 *     responses:
 *       201:
 *         description: Договор успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Договор успешно создан"
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Невозможно создать договор
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для создания договора
 */
router.post(
    '/',
    authenticate,
    authorize(['landlord', 'chairman']),
    async (req, res) => {
        try {
            const { application_id } = req.body;
            const user = req.user;

            if (!application_id) {
                return res.status(400).json({
                    error: 'Не указана заявка',
                    message: 'Поле "application_id" обязательно для заполнения',
                });
            }

            // Получаем заявку с проверкой
            const application = await db.get(
                `
            SELECT a.*, p.owner_id, p.price_item_id, pi.price_per_day
            FROM applications a
            JOIN plots p ON a.plot_id = p.id
            LEFT JOIN price_items pi ON p.price_item_id = pi.id
            WHERE a.id = ?
            `,
                [application_id]
            );

            if (!application) {
                return res.status(404).json({
                    error: 'Заявка не найдена',
                    message: 'Заявка с указанным ID не существует',
                });
            }

            // Проверка прав (только владелец участка или председатель)
            if (user.role === 'landlord' && application.owner_id !== user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            // Проверка статуса заявки
            if (application.status !== 'approved') {
                return res.status(400).json({
                    error: 'Некорректный статус заявки',
                    message:
                        'Договор можно создать только на основе одобренной заявки',
                });
            }

            // Проверяем, нет ли уже активного договора на этот участок в эти даты
            const overlappingContract = await db.get(
                `
            SELECT COUNT(*) as count 
            FROM contracts 
            WHERE plot_id = ? 
            AND status = 'active'
            AND NOT (end_date < ? OR start_date > ?)
            `,
                [
                    application.plot_id,
                    application.start_date,
                    application.end_date,
                ]
            );

            if (overlappingContract && overlappingContract.count > 0) {
                return res.status(400).json({
                    error: 'Конфликт дат',
                    message: 'На указанные даты уже есть активный договор',
                });
            }

            // Начинаем транзакцию
            await db.run('BEGIN TRANSACTION');

            try {
                // Создаем договор
                const contractResult = await db.run(
                    `
                INSERT INTO contracts (
                    application_id, plot_id, renter_id, 
                    start_date, end_date, price_per_day, 
                    status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'draft', CURRENT_TIMESTAMP)
                `,
                    [
                        application.id,
                        application.plot_id,
                        application.renter_id,
                        application.start_date,
                        application.end_date,
                        application.price_per_day || 0,
                    ]
                );

                // Обновляем статус заявки
                await db.run(
                    'UPDATE applications SET status = ? WHERE id = ?',
                    ['contract_created', application.id]
                );

                // Обновляем статус участка
                await db.run(
                    'UPDATE plots SET status = ?, renter_id = ? WHERE id = ?',
                    ['rented', application.renter_id, application.plot_id]
                );

                // Получаем созданный договор
                const newContract = await db.get(
                    'SELECT * FROM contracts WHERE id = ?',
                    [contractResult.id]
                );

                await db.run('COMMIT');

                res.status(201).json({
                    message: 'Договор успешно создан',
                    contract: newContract,
                });
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Ошибка при создании договора:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   put:
 *     summary: Подписать договор
 *     tags: [Договоры]
 *     description: Подписание договора обеими сторонами
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signed_at:
 *                 type: string
 *                 format: date-time
 *                 description: Дата подписания (если не указана, используется текущая дата)
 *                 example: "2024-01-10T12:00:00Z"
 *     responses:
 *       200:
 *         description: Договор успешно подписан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Договор успешно подписан"
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Невозможно подписать договор
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для подписания
 *       404:
 *         description: Договор не найден
 */
router.put('/:id/sign', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { signed_at } = req.body;
        const user = req.user;

        const contract = await db.get(
            `
            SELECT c.*, p.owner_id 
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            WHERE c.id = ?
            `,
            [id]
        );

        if (!contract) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'Договор с указанным ID не найден',
            });
        }

        // Проверка прав (только стороны договора могут подписывать)
        const isRenter = contract.renter_id === user.id;
        const isOwner = contract.owner_id === user.id;

        if (!isRenter && !isOwner && user.role !== 'chairman') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Вы не являетесь стороной этого договора',
            });
        }

        // Проверка статуса
        if (contract.status !== 'draft') {
            return res.status(400).json({
                error: 'Некорректный статус договора',
                message: 'Можно подписать только договор в статусе "draft"',
            });
        }

        // Обновляем договор
        await db.run(
            'UPDATE contracts SET status = ?, signed_at = ? WHERE id = ?',
            ['active', signed_at || new Date().toISOString(), id]
        );

        const updatedContract = await db.get(
            'SELECT * FROM contracts WHERE id = ?',
            [id]
        );

        res.json({
            message: 'Договор успешно подписан',
            contract: updatedContract,
        });
    } catch (error) {
        console.error('Ошибка при подписании договора:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts/{id}/terminate:
 *   put:
 *     summary: Расторгнуть договор
 *     tags: [Договоры]
 *     description: Досрочное расторжение договора аренды
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               termination_reason:
 *                 type: string
 *                 description: Причина расторжения
 *                 example: "Досрочное прекращение аренды"
 *               termination_date:
 *                 type: string
 *                 format: date
 *                 description: Дата расторжения (если не указана, используется текущая дата)
 *                 example: "2024-01-20"
 *     responses:
 *       200:
 *         description: Договор успешно расторгнут
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Договор успешно расторгнут"
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Невозможно расторгнуть договор
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для расторжения
 *       404:
 *         description: Договор не найден
 */
router.put('/:id/terminate', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { termination_reason, termination_date } = req.body;
        const user = req.user;

        const contract = await db.get(
            `
            SELECT c.*, p.owner_id 
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            WHERE c.id = ?
            `,
            [id]
        );

        if (!contract) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'Договор с указанным ID не найден',
            });
        }

        // Проверка прав (только стороны договора или председатель)
        const isRenter = contract.renter_id === user.id;
        const isOwner = contract.owner_id === user.id;

        if (!isRenter && !isOwner && user.role !== 'chairman') {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Вы не являетесь стороной этого договора',
            });
        }

        // Проверка статуса
        if (contract.status !== 'active') {
            return res.status(400).json({
                error: 'Некорректный статус договора',
                message: 'Можно расторгнуть только активный договор',
            });
        }

        // Начинаем транзакцию
        await db.run('BEGIN TRANSACTION');

        try {
            // Обновляем статус договора
            await db.run(
                `
                UPDATE contracts 
                SET status = 'terminated', 
                    termination_reason = ?,
                    termination_date = ?
                WHERE id = ?
                `,
                [
                    termination_reason || 'Расторгнут по соглашению сторон',
                    termination_date || new Date().toISOString().split('T')[0],
                    id,
                ]
            );

            // Освобождаем участок
            await db.run(
                'UPDATE plots SET status = ?, renter_id = NULL WHERE id = ?',
                ['available', contract.plot_id]
            );

            await db.run('COMMIT');

            const updatedContract = await db.get(
                'SELECT * FROM contracts WHERE id = ?',
                [id]
            );

            res.json({
                message: 'Договор успешно расторгнут',
                contract: updatedContract,
            });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Ошибка при расторжении договора:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts/{id}/complete:
 *   put:
 *     summary: Завершить договор
 *     tags: [Договоры]
 *     description: Завершение договора аренды после окончания срока
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *     responses:
 *       200:
 *         description: Договор успешно завершен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Договор успешно завершен"
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Невозможно завершить договор
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для завершения
 *       404:
 *         description: Договор не найден
 */
router.put(
    '/:id/complete',
    authenticate,
    authorize(['landlord', 'chairman']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const user = req.user;

            const contract = await db.get(
                `
            SELECT c.*, p.owner_id 
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            WHERE c.id = ?
            `,
                [id]
            );

            if (!contract) {
                return res.status(404).json({
                    error: 'Contract not found',
                    message: 'Договор с указанным ID не найден',
                });
            }

            // Проверка прав
            if (user.role === 'landlord' && contract.owner_id !== user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            // Проверка статуса
            if (contract.status !== 'active') {
                return res.status(400).json({
                    error: 'Некорректный статус договора',
                    message: 'Можно завершить только активный договор',
                });
            }

            // Проверяем, истек ли срок договора
            const today = new Date();
            const endDate = new Date(contract.end_date);

            if (today < endDate) {
                return res.status(400).json({
                    error: 'Срок договора не истек',
                    message:
                        'Договор можно завершить только после окончания срока аренды',
                });
            }

            // Начинаем транзакцию
            await db.run('BEGIN TRANSACTION');

            try {
                // Обновляем статус договора
                await db.run('UPDATE contracts SET status = ? WHERE id = ?', [
                    'completed',
                    id,
                ]);

                // Освобождаем участок
                await db.run(
                    'UPDATE plots SET status = ?, renter_id = NULL WHERE id = ?',
                    ['available', contract.plot_id]
                );

                await db.run('COMMIT');

                const updatedContract = await db.get(
                    'SELECT * FROM contracts WHERE id = ?',
                    [id]
                );

                res.json({
                    message: 'Договор успешно завершен',
                    contract: updatedContract,
                });
            } catch (error) {
                await db.run('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Ошибка при завершении договора:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

/**
 * @swagger
 * /api/contracts/{id}/payments:
 *   get:
 *     summary: Получить платежи по договору
 *     tags: [Договоры]
 *     description: Получение списка платежей по конкретному договору
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed]
 *         description: Фильтр по статусу платежа
 *     responses:
 *       200:
 *         description: Список платежей
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 contract:
 *                   $ref: '#/components/schemas/ContractDetails'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для просмотра платежей
 *       404:
 *         description: Договор не найден
 */
router.get('/:id/payments', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;
        const user = req.user;

        // Проверяем существование договора и права доступа
        const contract = await db.get(
            `
            SELECT c.*, p.owner_id 
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            WHERE c.id = ?
            `,
            [id]
        );

        if (!contract) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'Договор с указанным ID не найден',
            });
        }

        // Проверка прав доступа
        if (user.role === 'renter' && contract.renter_id !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message:
                    'У вас нет прав для просмотра платежей по этому договору',
            });
        }

        if (user.role === 'landlord' && contract.owner_id !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message:
                    'У вас нет прав для просмотра платежей по этому договору',
            });
        }

        // Получаем платежи
        let query = 'SELECT * FROM payments WHERE contract_id = ?';
        const params = [id];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY payment_date DESC';

        const payments = await db.query(query, params);

        // Получаем детали договора
        const contractDetails = await db.get(
            `
            SELECT 
                c.*,
                p.address as plot_address,
                p.area as plot_area,
                renter.name as renter_name,
                renter.phone as renter_phone,
                owner.name as owner_name
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            JOIN users renter ON c.renter_id = renter.id
            JOIN users owner ON p.owner_id = owner.id
            WHERE c.id = ?
            `,
            [id]
        );

        res.json({
            data: payments || [],
            contract: contractDetails,
        });
    } catch (error) {
        console.error('Ошибка при получении платежей:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts/{id}/payments:
 *   post:
 *     summary: Создать платеж по договору
 *     tags: [Договоры]
 *     description: Создание нового платежа по договору аренды
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - payment_date
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Сумма платежа
 *                 example: 15000.00
 *               payment_date:
 *                 type: string
 *                 format: date
 *                 description: Дата платежа
 *                 example: "2024-01-15"
 *               description:
 *                 type: string
 *                 description: Описание платежа
 *                 example: "Авансовый платеж за январь"
 *     responses:
 *       201:
 *         description: Платеж успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Платеж успешно создан"
 *                 payment:
 *                   $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Невозможно создать платеж
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для создания платежа
 *       404:
 *         description: Договор не найден
 */
router.post('/:id/payments', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_date, description } = req.body;
        const user = req.user;

        // Проверка обязательных полей
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Некорректная сумма',
                message: 'Поле "amount" должно быть положительным числом',
            });
        }

        if (!payment_date) {
            return res.status(400).json({
                error: 'Не указана дата',
                message: 'Поле "payment_date" обязательно для заполнения',
            });
        }

        // Проверяем существование договора и права доступа
        const contract = await db.get(
            `
            SELECT c.*, p.owner_id 
            FROM contracts c
            JOIN plots p ON c.plot_id = p.id
            WHERE c.id = ?
            `,
            [id]
        );

        if (!contract) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'Договор с указанным ID не найден',
            });
        }

        // Проверка прав (только арендатор может создавать платежи по своему договору)
        if (user.role === 'renter' && contract.renter_id !== user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Вы не можете создавать платежи по этому договору',
            });
        }

        // Проверка статуса договора
        if (contract.status !== 'active') {
            return res.status(400).json({
                error: 'Некорректный статус договора',
                message: 'Платежи можно создавать только по активным договорам',
            });
        }

        // Создаем платеж
        const paymentResult = await db.run(
            `
            INSERT INTO payments (
                contract_id, amount, payment_date, 
                description, status, created_at
            ) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
            `,
            [id, amount, payment_date, description || null]
        );

        const newPayment = await db.get('SELECT * FROM payments WHERE id = ?', [
            paymentResult.id,
        ]);

        res.status(201).json({
            message: 'Платеж успешно создан',
            payment: newPayment,
        });
    } catch (error) {
        console.error('Ошибка при создании платежа:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/contracts/{id}/payments/{paymentId}/status:
 *   put:
 *     summary: Обновить статус платежа
 *     tags: [Договоры]
 *     description: Обновление статуса платежа (например, подтверждение оплаты)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID договора
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID платежа
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, paid, failed]
 *                 description: Новый статус платежа
 *                 example: "paid"
 *     responses:
 *       200:
 *         description: Статус платежа обновлен
 *       400:
 *         description: Невозможно обновить статус
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав для обновления статуса
 *       404:
 *         description: Платеж не найден
 */
router.put(
    '/:id/payments/:paymentId/status',
    authenticate,
    authorize(['landlord', 'chairman']),
    async (req, res) => {
        try {
            const { id, paymentId } = req.params;
            const { status } = req.body;
            const user = req.user;

            if (!status || !['pending', 'paid', 'failed'].includes(status)) {
                return res.status(400).json({
                    error: 'Некорректный статус',
                    message:
                        'Статус должен быть одним из: pending, paid, failed',
                });
            }

            // Проверяем существование платежа
            const payment = await db.get(
                `
            SELECT p.*, c.renter_id, plots.owner_id
            FROM payments p
            JOIN contracts c ON p.contract_id = c.id
            JOIN plots ON c.plot_id = plots.id
            WHERE p.id = ? AND p.contract_id = ?
            `,
                [paymentId, id]
            );

            if (!payment) {
                return res.status(404).json({
                    error: 'Payment not found',
                    message: 'Платеж с указанным ID не найден',
                });
            }

            // Проверка прав (только владелец участка или председатель)
            if (user.role === 'landlord' && payment.owner_id !== user.id) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            // Обновляем статус платежа
            await db.run('UPDATE payments SET status = ? WHERE id = ?', [
                status,
                paymentId,
            ]);

            const updatedPayment = await db.get(
                'SELECT * FROM payments WHERE id = ?',
                [paymentId]
            );

            res.json({
                message: 'Статус платежа успешно обновлен',
                payment: updatedPayment,
            });
        } catch (error) {
            console.error('Ошибка при обновлении статуса платежа:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

module.exports = router;
