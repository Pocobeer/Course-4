import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { fetchPlots } from '@/config/api';
import { type Plot, type ApiError } from '@/config/api';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export function Home() {
    const [plots, setPlots] = useState<Plot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const loadPlots = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchPlots('available');
            setPlots(data.data);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось загрузить участки'
            );
            console.error('Ошибка загрузки:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlots();
    }, []);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className='min-h-screen bg-gray-50 p-4 md:p-8'>
            {/* Шапка */}
            <div className='max-w-7xl mx-auto'>
                <div className='flex justify-between items-center mb-8'>
                    <h1 className='text-3xl font-bold text-gray-800'>
                        Доступные участки
                    </h1>
                    <div className='space-x-2'>
                        <Button onClick={loadPlots} disabled={loading}>
                            Обновить
                        </Button>
                        <Button asChild variant='outline'>
                            <Link to='/profile'>Профиль</Link>
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
                        <p className='text-red-600'>{error}</p>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={loadPlots}
                            className='mt-2'
                        >
                            Попробовать снова
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className='flex justify-center items-center py-12'>
                        <div className='text-center'>
                            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
                            <p className='mt-4 text-gray-600'>
                                Загрузка участков...
                            </p>
                        </div>
                    </div>
                ) : plots.length === 0 ? (
                    <Card>
                        <CardContent className='py-12 text-center'>
                            <p className='text-gray-500 text-lg'>
                                Нет доступных участков
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    /* Список участков */
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                        {plots.map((plot) => (
                            <Card
                                key={plot.id}
                                className='hover:shadow-lg transition-shadow'
                            >
                                <CardHeader>
                                    <CardTitle className='text-xl'>
                                        {plot.address}
                                    </CardTitle>
                                    <CardDescription>
                                        {plot.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className='space-y-4'>
                                    <div className='grid grid-cols-2 gap-4'>
                                        <div>
                                            <p className='text-sm text-gray-500'>
                                                Площадь
                                            </p>
                                            <p className='font-semibold'>
                                                {plot.area} м²
                                            </p>
                                        </div>
                                        <div>
                                            <p className='text-sm text-gray-500'>
                                                Цена за день
                                            </p>
                                            <p className='font-semibold text-green-600'>
                                                {formatPrice(
                                                    plot.price_per_day
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className='border-t pt-4'>
                                        <p className='text-sm text-gray-500 mb-1'>
                                            Владелец
                                        </p>
                                        <div>
                                            <p className='font-medium'>
                                                {plot.owner_name}
                                            </p>
                                            <p className='text-sm text-gray-500'>
                                                {plot.owner_phone}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        variant='outline'
                                        className='w-full'
                                        onClick={() =>
                                            navigate(`/plots/${plot.id}`)
                                        }
                                    >
                                        Подробнее
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
