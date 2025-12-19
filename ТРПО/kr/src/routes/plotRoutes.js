// src/routes/plotRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/plots:
 *   get:
 *     summary: Получить список доступных участков
 *     tags: [Участки]
 *     description: Возвращает список участков с возможностью фильтрации
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, reserved, rented, unavailable]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: minArea
 *         schema:
 *           type: number
 *         description: Минимальная площадь
 *       - in: query
 *         name: maxArea
 *         schema:
 *           type: number
 *         description: Максимальная площадь
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
 *         description: Список участков
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plot'
 */
router.get('/', async (req, res) => {
    try {
        const { status, minArea, maxArea, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                p.*, 
                pi.price_per_day,
                u.name as owner_name,
                u.phone as owner_phone
            FROM plots p
            LEFT JOIN price_items pi ON p.price_item_id = pi.id
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        if (minArea) {
            query += ' AND p.area >= ?';
            params.push(minArea);
        }

        if (maxArea) {
            query += ' AND p.area <= ?';
            params.push(maxArea);
        }

        query += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        console.log('SQL Query:', query);
        console.log('SQL Params:', params);

        const plots = await db.query(query, params);

        let countQuery = 'SELECT COUNT(*) as total FROM plots WHERE 1=1';
        const countParams = [];

        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }

        if (minArea) {
            countQuery += ' AND area >= ?';
            countParams.push(minArea);
        }

        if (maxArea) {
            countQuery += ' AND area <= ?';
            countParams.push(maxArea);
        }

        // const countResult = await db.get(countQuery, countParams);

        res.json({
            data: plots,
            // pagination: {
            //     page: parseInt(page),
            //     limit: parseInt(limit),
            //     total: countResult.total,
            //     pages: Math.ceil(countResult.total / limit),
            // },
        });
    } catch (error) {
        console.error('Полная ошибка при получении участков:');
        console.error('Сообщение:', error.message);
        console.error('Стек:', error.stack);

        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            details:
                process.env.NODE_ENV === 'development'
                    ? error.stack
                    : undefined,
        });
    }
});

/**
 * @swagger
 * /api/plots/{id}:
 *   get:
 *     summary: Получить информацию об участке по ID
 *     tags: [Участки]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID участка
 *     responses:
 *       200:
 *         description: Информация об участке
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plot'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', async (req, res) => {
    try {
        const plot = await db.get('SELECT * FROM plots WHERE id = ?', [
            req.params.id,
        ]);

        if (!plot) {
            return res.status(404).json({ error: 'Plot not found' });
        }

        res.json(plot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/plots:
 *   post:
 *     summary: Создать новый участок
 *     tags: [Участки]
 *     security:
 *       - bearerAuth: []
 *     description: Создание нового участка (только для арендодателей)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - area
 *               - price_per_day
 *             properties:
 *               address:
 *                 type: string
 *                 example: "ул. Ленина, 10"
 *               area:
 *                 type: number
 *                 example: 100.5
 *               description:
 *                 type: string
 *                 example: "Участок в центре города"
 *               price_per_day:
 *                 type: number
 *                 example: 1500
 *     responses:
 *       201:
 *         description: Участок успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Участок создан"
 *                 plotId:
 *                   type: integer
 *                   example: 1
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав (требуется роль landlord)
 */
router.post('/', authenticate, authorize(['landlord']), async (req, res) => {
    try {
        const { address, area, description, price_per_day } = req.body;
        const owner_id = req.user.id;

        if (!address || address.trim() === '') {
            return res.status(400).json({
                error: 'Не указан адрес',
                message: 'Поле "address" обязательно для заполнения',
            });
        }

        if (!area || area <= 0) {
            return res.status(400).json({
                error: 'Некорректная площадь',
                message: 'Поле "area" должно быть положительным числом',
            });
        }

        if (!price_per_day || price_per_day <= 0) {
            return res.status(400).json({
                error: 'Некорректная цена',
                message:
                    'Поле "price_per_day" должно быть положительным числом',
            });
        }

        const priceList = await db.get(
            'SELECT id FROM price_lists WHERE name = ?',
            ['Основной прейскурант']
        );

        if (!priceList) {
            return res.status(500).json({
                error: 'Основной прайс-лист не найден',
                message: 'Не удалось найти основной прайс-лист в базе данных',
            });
        }

        const priceItemResult = await db.run(
            'INSERT INTO price_items (price_list_id, price_per_day) VALUES (?,?)',
            [priceList.id, price_per_day]
        );

        if (!priceItemResult || !priceItemResult.id) {
            throw new Error('Не удалось создать запись о цене');
        }

        const plotResult = await db.run(
            'INSERT INTO plots (owner_id, price_item_id, address, area, description, status) VALUES (?, ?, ?, ?, ?, ?)',
            [
                owner_id,
                priceItemResult.id,
                address.trim(),
                area,
                description || null,
                'available',
            ]
        );

        const newPlot = await db.get('SELECT * FROM plots WHERE id = ?', [
            plotResult.id,
        ]);

        res.status(201).json({
            message: 'Участок создан',
            plotId: newPlot.id,
            plot: newPlot,
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
 * /api/plots/{id}:
 *   put:
 *     summary: Обновить информацию об участке
 *     tags: [Участки]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *               area:
 *                 type: number
 *               description:
 *                 type: string
 *               price_per_day:
 *                 type: number
 *     responses:
 *       200:
 *         description: Участок обновлен
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', authenticate, authorize(['landlord']), async (req, res) => {
    try {
        const { id } = req.params;
        const { address, area, description, price_per_day } = req.body;
        const owner_id = req.user.id;

        const existingPlot = await db.get('SELECT * FROM plots WHERE id = ?', [
            id,
        ]);

        if (!existingPlot) {
            return res.status(404).json({
                error: 'Участок не найден',
                message: 'Участок с указанным ID не существует',
            });
        }

        if (existingPlot.owner_id !== owner_id) {
            return res.status(403).json({
                error: 'Доступ запрещен',
                message: 'Вы не являетесь владельцем этого участка',
            });
        }

        const updateFields = [];
        const params = [];

        if (address !== undefined && address.trim() !== '') {
            updateFields.push('address = ?');
            params.push(address.trim());
        }

        if (area !== undefined && area > 0) {
            updateFields.push('area = ?');
            params.push(area);
        }

        if (description !== undefined) {
            updateFields.push('description = ?');
            params.push(description);
        }

        if (updateFields.length === 0 && price_per_day === undefined) {
            return res.status(400).json({
                error: 'Нет данных для обновления',
                message: 'Укажите хотя бы одно поле для обновления',
            });
        }

        if (updateFields.length > 0) {
            params.push(id);
            const query = `UPDATE plots SET ${updateFields.join(
                ', '
            )} WHERE id = ?`;
            await db.run(query, params);
        }

        if (price_per_day !== undefined) {
            if (price_per_day < 0) {
                return res.status(400).json({
                    error: 'Некорректная цена',
                    message: 'Цена не может быть отрицательной',
                });
            }

            await db.run(
                'UPDATE price_items SET price_per_day = ? WHERE id = ?',
                [price_per_day, existingPlot.price_item_id]
            );
        }

        // Получаем обновленный участок
        const updatedPlot = await db.get(
            `
            SELECT p.*, pi.price_per_day 
            FROM plots p 
            LEFT JOIN price_items pi ON p.price_item_id = pi.id 
            WHERE p.id = ?
        `,
            [id]
        );

        res.json({
            message: 'Участок успешно обновлен',
            plot: updatedPlot,
        });
    } catch (error) {
        console.error('Ошибка при обновлении участка:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @swagger
 * /api/plots/{id}:
 *   delete:
 *     summary: Удалить участок
 *     tags: [Участки]
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
 *         description: Участок удален
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
    '/:id',
    authenticate,
    authorize(['landlord']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const owner_id = req.user.id;

            // Проверяем существование участка
            const existingPlot = await db.get(
                'SELECT * FROM plots WHERE id = ?',
                [id]
            );

            if (!existingPlot) {
                return res.status(404).json({
                    error: 'Участок не найден',
                    message: 'Участок с указанным ID не существует',
                });
            }

            if (existingPlot.owner_id !== owner_id) {
                return res.status(403).json({
                    error: 'Доступ запрещен',
                    message: 'Вы не являетесь владельцем этого участка',
                });
            }

            if (existingPlot.status === 'rented' || existingPlot.renter_id) {
                return res.status(400).json({
                    error: 'Невозможно удалить участок',
                    message: 'Участок сдан в аренду. Сначала завершите аренду',
                });
            }

            await db.run('DELETE FROM plots WHERE id = ?', [id]);
            await db.run('DELETE FROM price_items WHERE id = ?', [
                existingPlot.price_item_id,
            ]);

            res.json({
                message: 'Участок успешно удален',
            });
        } catch (error) {
            console.error('Ошибка при удалении участка:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
);

module.exports = router;
