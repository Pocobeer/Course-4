const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
    res.json({
        message: 'test route',
        method: req.method,
        url: req.url,
    });
});

router.get('/db-test', async (req, res) => {
    try {
        const db = require('../models/database');

        const result = await db.get('SELECT sqlite_version() as version');

        res.json({
            database: 'SQLite',
            version: result.version,
            status: 'connected',
        });
    } catch (error) {
        res.status(500).json({
            error: 'Database connection failed',
            message: error.message,
        });
    }
});

module.exports = router;
