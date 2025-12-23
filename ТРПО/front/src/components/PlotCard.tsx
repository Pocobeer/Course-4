import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    fetchPlotById,
    createApplication,
    type PlotDetails,
    type ApiError,
} from '@/config/api';

export function PlotCard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [plot, setPlot] = useState<PlotDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showApplicationForm, setShowApplicationForm] = useState(false);
    const [applicationLoading, setApplicationLoading] = useState(false);
    const [applicationError, setApplicationError] = useState('');

    // Состояния для формы заявки
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [applicationSuccess, setApplicationSuccess] = useState(false);

    const loadPlot = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        setError('');
        try {
            const data = await fetchPlotById(parseInt(id));
            setPlot(data);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message ||
                    'Не удалось загрузить данные об участке'
            );
            console.error('Ошибка загрузки участка:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadPlot();
    }, [loadPlot, id]);

    // Обработка подачи заявки
    const handleSubmitApplication = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!plot) return;

        // Валидация дат
        if (!startDate || !endDate) {
            setApplicationError('Заполните обе даты');
            return;
        }

        if (new Date(endDate) <= new Date(startDate)) {
            setApplicationError('Дата окончания должна быть позже даты начала');
            return;
        }

        if (new Date(startDate) <= new Date()) {
            setApplicationError('Дата начала должна быть в будущем');
            return;
        }

        setApplicationLoading(true);
        setApplicationError('');

        try {
            const response = await createApplication({
                plot_id: plot.id,
                start_date: startDate,
                end_date: endDate,
            });

            console.log('Заявка создана:', response);

            // Успех - показываем сообщение и закрываем форму
            setApplicationSuccess(true);

            // Через 2 секунды редирект на профиль
            setTimeout(() => {
                setShowApplicationForm(false);
                navigate('/profile');
            }, 2000);
        } catch (err) {
            const error = err as ApiError;
            setApplicationError(
                error.response?.data?.message || 'Ошибка при создании заявки'
            );
            console.error('Ошибка создания заявки:', err);
        } finally {
            setApplicationLoading(false);
        }
    };

    // Расчет количества дней
    const calculateDays = () => {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Расчет общей стоимости
    const calculateTotalPrice = () => {
        if (!plot?.price_per_day) return 0;
        return calculateDays() * plot.price_per_day;
    };

    // Форматирование цены
    const formatPrice = (price?: number) => {
        if (!price) return 'Не указана';
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    // Получение цвета для статуса
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available':
                return 'bg-green-100 text-green-800';
            case 'rented':
                return 'bg-red-100 text-red-800';
            case 'reserved':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Перевод статуса на русский
    const getStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            available: 'Доступен',
            rented: 'Арендован',
            reserved: 'Забронирован',
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
                    <p className='mt-4 text-gray-600'>Загрузка участка...</p>
                </div>
            </div>
        );
    }

    if (!plot) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <p className='text-gray-500'>Участок не найден</p>
                    <Button onClick={() => navigate(-1)} className='mt-4'>
                        Назад
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-gray-50 py-8 px-4'>
            <div className='max-w-4xl mx-auto'>
                {/* Шапка */}
                <div className='mb-8'>
                    <Button
                        variant='outline'
                        onClick={() => navigate(-1)}
                        className='mb-6'
                    >
                        ← Назад к списку
                    </Button>

                    <div className='flex justify-between items-start'>
                        <div>
                            <h1 className='text-3xl font-bold text-gray-900'>
                                {plot.address}
                            </h1>
                            <p className='text-gray-600'>Участок #{plot.id}</p>
                        </div>
                        <Badge
                            className={`text-lg px-4 py-2 ${getStatusColor(
                                plot.status
                            )}`}
                        >
                            {getStatusText(plot.status)}
                        </Badge>
                    </div>
                </div>

                {error && (
                    <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
                        <p className='text-red-600'>{error}</p>
                        <Button
                            variant='outline'
                            onClick={loadPlot}
                            className='mt-2'
                        >
                            Попробовать снова
                        </Button>
                    </div>
                )}

                {/* Основная информация */}
                <Card className='mb-6'>
                    <CardHeader>
                        <CardTitle>Основная информация</CardTitle>
                        <CardDescription>
                            Детальные данные об участке
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-6'>
                        {/* Площадь и цена */}
                        <div className='grid grid-cols-2 gap-4'>
                            <div className='bg-gray-50 p-4 rounded-lg'>
                                <p className='text-sm text-gray-500'>Площадь</p>
                                <p className='text-2xl font-bold'>
                                    {plot.area} м²
                                </p>
                            </div>
                            <div className='bg-gray-50 p-4 rounded-lg'>
                                <p className='text-sm text-gray-500'>
                                    Цена за день
                                </p>
                                <p className='text-2xl font-bold text-green-600'>
                                    {formatPrice(plot.price_per_day)}
                                </p>
                            </div>
                        </div>
                        <Separator />
                        {/* Описание */}
                        <div>
                            <h3 className='text-lg font-semibold mb-2'>
                                Описание
                            </h3>
                            <p className='text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded-lg'>
                                {plot.description || 'Описание отсутствует'}
                            </p>
                        </div>

                        {(plot.owner_name || plot.owner_phone) && (
                            <>
                                <div>
                                    <h3 className='text-lg font-semibold mb-4'>
                                        Контактная информация владельца
                                    </h3>
                                    <div className='bg-gray-50 p-4 rounded-lg space-y-2'>
                                        {plot.owner_name && (
                                            <div className='flex justify-between'>
                                                <span className='text-gray-600'>
                                                    Имя:
                                                </span>
                                                <span className='font-medium'>
                                                    {plot.owner_name}
                                                </span>
                                            </div>
                                        )}
                                        {plot.owner_phone && (
                                            <div className='flex justify-between'>
                                                <span className='text-gray-600'>
                                                    Телефон:
                                                </span>
                                                <span className='font-medium'>
                                                    {plot.owner_phone}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Separator />
                            </>
                        )}
                    </CardContent>
                    <CardFooter className='flex justify-between'>
                        <div className='space-x-2'>
                            <Button
                                variant='outline'
                                onClick={() => navigate(-1)}
                            >
                                Назад
                            </Button>
                            <Button variant='outline' onClick={loadPlot}>
                                Обновить
                            </Button>
                        </div>

                        {/* Кнопка подачи заявки или диалог */}
                        {plot.status === 'available' ? (
                            <Dialog
                                open={showApplicationForm}
                                onOpenChange={setShowApplicationForm}
                            >
                                <DialogTrigger asChild>
                                    <Button>Подать заявку на аренду</Button>
                                </DialogTrigger>
                                <DialogContent className='sm:max-w-[425px]'>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Заявка на аренду участка
                                        </DialogTitle>
                                        <DialogDescription>
                                            Заполните даты аренды для участка:{' '}
                                            {plot.address}
                                        </DialogDescription>
                                    </DialogHeader>

                                    {applicationSuccess ? (
                                        <div className='py-6 text-center'>
                                            <div className='text-green-600 text-4xl mb-4'>
                                                ✓
                                            </div>
                                            <h3 className='text-lg font-semibold mb-2'>
                                                Заявка успешно подана!
                                            </h3>
                                            <p className='text-gray-600'>
                                                Вы будете перенаправлены на
                                                страницу профиля...
                                            </p>
                                        </div>
                                    ) : (
                                        <form
                                            onSubmit={handleSubmitApplication}
                                        >
                                            <div className='grid gap-4 py-4'>
                                                {/* Дата начала */}
                                                <div className='grid grid-cols-4 items-center gap-4'>
                                                    <Label
                                                        htmlFor='start_date'
                                                        className='text-right'
                                                    >
                                                        Дата начала
                                                    </Label>
                                                    <Input
                                                        id='start_date'
                                                        type='date'
                                                        value={startDate}
                                                        onChange={(e) =>
                                                            setStartDate(
                                                                e.target.value
                                                            )
                                                        }
                                                        className='col-span-3'
                                                        required
                                                        min={
                                                            new Date()
                                                                .toISOString()
                                                                .split('T')[0]
                                                        }
                                                    />
                                                </div>

                                                {/* Дата окончания */}
                                                <div className='grid grid-cols-4 items-center gap-4'>
                                                    <Label
                                                        htmlFor='end_date'
                                                        className='text-right'
                                                    >
                                                        Дата окончания
                                                    </Label>
                                                    <Input
                                                        id='end_date'
                                                        type='date'
                                                        value={endDate}
                                                        onChange={(e) =>
                                                            setEndDate(
                                                                e.target.value
                                                            )
                                                        }
                                                        className='col-span-3'
                                                        required
                                                        min={
                                                            startDate ||
                                                            new Date()
                                                                .toISOString()
                                                                .split('T')[0]
                                                        }
                                                    />
                                                </div>

                                                {/* Расчет стоимости */}
                                                {startDate &&
                                                    endDate &&
                                                    plot.price_per_day && (
                                                        <div className='mt-4 p-4 bg-gray-50 rounded-lg'>
                                                            <div className='space-y-2'>
                                                                <div className='flex justify-between'>
                                                                    <span className='text-gray-600'>
                                                                        Количество
                                                                        дней:
                                                                    </span>
                                                                    <span className='font-medium'>
                                                                        {calculateDays()}
                                                                    </span>
                                                                </div>
                                                                <div className='flex justify-between'>
                                                                    <span className='text-gray-600'>
                                                                        Цена за
                                                                        день:
                                                                    </span>
                                                                    <span className='font-medium'>
                                                                        {formatPrice(
                                                                            plot.price_per_day
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className='flex justify-between text-lg font-bold pt-2 border-t'>
                                                                    <span>
                                                                        Итого:
                                                                    </span>
                                                                    <span className='text-green-600'>
                                                                        {formatPrice(
                                                                            calculateTotalPrice()
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                {/* Ошибка */}
                                                {applicationError && (
                                                    <div className='mt-2 p-3 bg-red-50 border border-red-200 rounded-lg'>
                                                        <p className='text-sm text-red-600'>
                                                            {applicationError}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <DialogFooter>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() =>
                                                        setShowApplicationForm(
                                                            false
                                                        )
                                                    }
                                                    disabled={
                                                        applicationLoading
                                                    }
                                                >
                                                    Отмена
                                                </Button>
                                                <Button
                                                    type='submit'
                                                    disabled={
                                                        applicationLoading
                                                    }
                                                >
                                                    {applicationLoading
                                                        ? 'Отправка...'
                                                        : 'Подать заявку'}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    )}
                                </DialogContent>
                            </Dialog>
                        ) : (
                            <Button variant='secondary' disabled>
                                Участок{' '}
                                {plot.status === 'rented'
                                    ? 'арендован'
                                    : 'забронирован'}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
