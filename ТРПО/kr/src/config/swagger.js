const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Системы Аренды Участков',
            version: '1.0.0',
            description: `Документация REST API для системы аренды земельных участков`,
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                // Модели пользователей
                User: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        name: {
                            type: 'string',
                            example: 'Иван Иванов',
                        },
                        phone: {
                            type: 'string',
                            example: '+79161234567',
                        },
                        email: {
                            type: 'string',
                            example: 'ivan@example.com',
                        },
                        role: {
                            type: 'string',
                            enum: ['renter', 'landlord', 'chairman'],
                            example: 'renter',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-15T10:30:00Z',
                        },
                    },
                },
                // Модели участков
                Plot: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        address: {
                            type: 'string',
                            example: 'ул. Ленина, 10',
                        },
                        area: {
                            type: 'number',
                            format: 'float',
                            example: 100.5,
                        },
                        description: {
                            type: 'string',
                            example: 'Участок в центре города с коммуникациями',
                        },
                        status: {
                            type: 'string',
                            enum: [
                                'available',
                                'reserved',
                                'rented',
                                'unavailable',
                            ],
                            example: 'available',
                        },
                        price_per_day: {
                            type: 'number',
                            format: 'float',
                            example: 1500.0,
                        },
                        owner_name: {
                            type: 'string',
                            example: 'Петр Петров',
                        },
                        owner_phone: {
                            type: 'string',
                            example: '+79161234568',
                        },
                    },
                },
                // Модели заявок
                Application: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        plot_id: {
                            type: 'integer',
                            example: 1,
                        },
                        renter_id: {
                            type: 'integer',
                            example: 1,
                        },
                        start_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-02-01',
                        },
                        end_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-02-15',
                        },
                        status: {
                            type: 'string',
                            enum: [
                                'pending',
                                'approved',
                                'rejected',
                                'contract_created',
                            ],
                            example: 'pending',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-15T10:30:00Z',
                        },
                        plot_address: {
                            type: 'string',
                            example: 'ул. Ленина, 10',
                        },
                        renter_name: {
                            type: 'string',
                            example: 'Иван Иванов',
                        },
                        owner_name: {
                            type: 'string',
                            example: 'Петр Петров',
                        },
                    },
                },
                // Модели договоров
                Contract: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        application_id: {
                            type: 'integer',
                            example: 1,
                        },
                        plot_id: {
                            type: 'integer',
                            example: 1,
                        },
                        renter_id: {
                            type: 'integer',
                            example: 2,
                        },
                        start_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15',
                        },
                        end_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-02-15',
                        },
                        price_per_day: {
                            type: 'number',
                            format: 'float',
                            example: 1500.0,
                        },
                        status: {
                            type: 'string',
                            enum: [
                                'draft',
                                'active',
                                'completed',
                                'terminated',
                            ],
                            example: 'active',
                        },
                        signed_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-10T12:00:00Z',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-10T12:00:00Z',
                        },
                    },
                },
                ContractDetails: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        plot_id: {
                            type: 'integer',
                            example: 1,
                        },
                        renter_id: {
                            type: 'integer',
                            example: 2,
                        },
                        start_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15',
                        },
                        end_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-02-15',
                        },
                        price_per_day: {
                            type: 'number',
                            format: 'float',
                            example: 1500.0,
                        },
                        status: {
                            type: 'string',
                            enum: [
                                'draft',
                                'active',
                                'completed',
                                'terminated',
                            ],
                            example: 'active',
                        },
                        signed_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-10T12:00:00Z',
                        },
                        plot_address: {
                            type: 'string',
                            example: 'ул. Ленина, 10',
                        },
                        plot_area: {
                            type: 'number',
                            format: 'float',
                            example: 100.5,
                        },
                        renter_name: {
                            type: 'string',
                            example: 'Иван Иванов',
                        },
                        renter_phone: {
                            type: 'string',
                            example: '+79161234567',
                        },
                        owner_name: {
                            type: 'string',
                            example: 'Петр Петров',
                        },
                        total_days: {
                            type: 'integer',
                            example: 31,
                        },
                        total_amount: {
                            type: 'number',
                            format: 'float',
                            example: 46500.0,
                        },
                    },
                },
                ContractCreate: {
                    type: 'object',
                    required: ['application_id'],
                    properties: {
                        application_id: {
                            type: 'integer',
                            description: 'ID заявки для создания договора',
                            example: 1,
                        },
                    },
                },
                ContractSign: {
                    type: 'object',
                    properties: {
                        signed_at: {
                            type: 'string',
                            format: 'date-time',
                            description:
                                'Дата подписания (если не указана, используется текущая дата)',
                            example: '2024-01-10T12:00:00Z',
                        },
                    },
                },
                // Модели платежей
                Payment: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        contract_id: {
                            type: 'integer',
                            example: 1,
                        },
                        amount: {
                            type: 'number',
                            format: 'float',
                            example: 15000.0,
                        },
                        payment_date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15',
                        },
                        description: {
                            type: 'string',
                            example: 'Авансовый платеж за январь',
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'paid', 'failed'],
                            example: 'pending',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-10T12:00:00Z',
                        },
                    },
                },
                PaymentCreate: {
                    type: 'object',
                    required: ['amount', 'payment_date'],
                    properties: {
                        amount: {
                            type: 'number',
                            description: 'Сумма платежа',
                            example: 15000.0,
                        },
                        payment_date: {
                            type: 'string',
                            format: 'date',
                            description: 'Дата платежа',
                            example: '2024-01-15',
                        },
                        description: {
                            type: 'string',
                            description: 'Описание платежа',
                            example: 'Авансовый платеж за январь',
                        },
                    },
                },
                // Прайс-листы
                PriceList: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        name: {
                            type: 'string',
                            example: 'Основной прейскурант',
                        },
                        valid_from: {
                            type: 'string',
                            format: 'date',
                            example: '2023-01-01',
                        },
                        valid_to: {
                            type: 'string',
                            format: 'date',
                            example: '2024-12-31',
                        },
                    },
                },
                PriceItem: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1,
                        },
                        price_list_id: {
                            type: 'integer',
                            example: 1,
                        },
                        price_per_day: {
                            type: 'number',
                            format: 'float',
                            example: 1500.0,
                        },
                    },
                },
                // Обработка ошибок
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            example: 'Ошибка валидации',
                        },
                        message: {
                            type: 'string',
                            example: 'Неверный формат телефона',
                        },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    field: {
                                        type: 'string',
                                        example: 'phone',
                                    },
                                    message: {
                                        type: 'string',
                                        example:
                                            'Телефон должен быть в формате +7XXXXXXXXXX',
                                    },
                                },
                            },
                        },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        page: {
                            type: 'integer',
                            example: 1,
                        },
                        limit: {
                            type: 'integer',
                            example: 10,
                        },
                        total: {
                            type: 'integer',
                            example: 100,
                        },
                        pages: {
                            type: 'integer',
                            example: 10,
                        },
                    },
                },
            },
            responses: {
                UnauthorizedError: {
                    description: 'Неавторизованный доступ',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                error: 'Не авторизован',
                                message: 'Требуется авторизация',
                            },
                        },
                    },
                },
                ForbiddenError: {
                    description: 'Доступ запрещен',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                error: 'Доступ запрещен',
                                message:
                                    'Недостаточно прав для выполнения операции',
                            },
                        },
                    },
                },
                ValidationError: {
                    description: 'Ошибка валидации',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                error: 'Ошибка валидации',
                                message: 'Некорректные данные',
                                details: [
                                    {
                                        field: 'phone',
                                        message:
                                            'Телефон должен быть в формате +7XXXXXXXXXX',
                                    },
                                ],
                            },
                        },
                    },
                },
                NotFoundError: {
                    description: 'Ресурс не найден',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                error: 'Ресурс не найден',
                                message: 'Участок с ID 999 не существует',
                            },
                        },
                    },
                },
                ConflictError: {
                    description: 'Конфликт данных',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error',
                            },
                            example: {
                                error: 'Конфликт дат',
                                message:
                                    'На указанные даты уже есть активный договор',
                            },
                        },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: [
            {
                name: 'Аутентификация',
                description: 'Регистрация и вход в систему',
            },
            {
                name: 'Участки',
                description: 'Управление земельными участками',
            },
            {
                name: 'Заявки',
                description: 'Заявки на аренду участков',
            },
            {
                name: 'Договоры',
                description: 'Управление договорами аренды',
            },
            {
                name: 'Платежи',
                description: 'Управление платежами по договорам',
            },
            {
                name: 'Профиль',
                description: 'Управление профилем пользователя',
            },
        ],
    },
    apis: ['./src/routes/*.js', './src/routes/**/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
