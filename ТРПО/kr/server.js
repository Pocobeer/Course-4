const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');
const { all } = require('./src/routes/plotRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        swaggerOptions: {
            url: `http://localhost:${PORT}/api-docs.json`,
            dom_id: '#swagger-ui',
            displayRequestDuration: true,
            showCommonExtensions: true,
            tryItOutEnabled: true,
            requestInterceptor: (req) => {
                req.headers['Content-Type'] = 'application/json';
                return req;
            },
            onComplete: () => {
                console.log('Swagger UI has been loaded');
            },
        },
    })
);

app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

try {
    const db = require('./src/models/database');
    db.initializeDatabase();
    console.log('База данных подключена');
} catch (error) {
    console.log('База данных отключена:', error.message);
}

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/plots', require('./src/routes/plotRoutes'));
app.use('/api/contracts', require('./src/routes/contractRoutes'));
app.use('/api/applications', require('./src/routes/applicationRoutes'));
// app.use('/api/profile', require('./src/routes/profileRoutes'));

app.get('/', (req, res) => {
    res.json({
        message: '🚀 Система аренды участков API',
        version: '1.0.0',
        documentation: '/api-docs',
        endpoints: {
            auth: '/api/auth',
            plots: '/api/plots',
            applications: '/api/applications',
            profile: '/api/profile',
            test: '/api/test',
        },
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Маршрут не найден',
        path: req.path,
        method: req.method,
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        error: 'Произошла ошибка на сервере',
        path: req.path,
        method: req.method,
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`📊 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  База данных: SQLite (${process.env.DB_PATH})`);
});
