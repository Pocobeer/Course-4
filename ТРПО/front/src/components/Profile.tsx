import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    fetchProfile,
    updateProfile,
    fetchApplications,
    approveApplication,
    rejectApplication,
    cancelApplication,
    type UserProfile,
    type RentalApplication,
    type ApiError,
} from '@/config/api';

export function Profile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [applications, setApplications] = useState<RentalApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });
    const [processingId, setProcessingId] = useState<number | null>(null);

    // Загрузка профиля и заявок
    const loadProfile = async () => {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            const [profileData, applicationsData] = await Promise.all([
                fetchProfile(),
                fetchApplications(1, 20),
            ]);
            setProfile(profileData);
            setApplications(applicationsData.data);
            setFormData({
                name: profileData.name,
                email: profileData.email || '',
            });
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось загрузить данные'
            );
            console.error('Ошибка загрузки:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        setError('');
        setSuccessMessage('');

        try {
            const updatedProfile = await updateProfile(formData);
            setProfile(updatedProfile);
            setEditMode(false);
            setSuccessMessage('Профиль успешно обновлен!');

            // Автоматически скрываем сообщение через 3 секунды
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось обновить профиль'
            );
            console.error('Ошибка обновления профиля:', err);
        } finally {
            setSaving(false);
        }
    };

    // Обработка заявок для арендодателя
    const handleApprove = async (id: number) => {
        if (!window.confirm('Вы уверены, что хотите подтвердить заявку?'))
            return;

        setProcessingId(id);
        setError('');
        setSuccessMessage('');
        try {
            await approveApplication(id);
            await loadProfile();
            setSuccessMessage('Заявка успешно подтверждена!');

            // Автоматически скрываем сообщение через 3 секунды
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось подтвердить заявку'
            );
            console.error('Ошибка подтверждения заявки:', err);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: number) => {
        const reason = window.prompt('Введите причину отказа:');
        if (!reason) return;

        setProcessingId(id);
        setError('');
        setSuccessMessage('');
        try {
            await rejectApplication(id, reason);
            await loadProfile();
            setSuccessMessage('Заявка успешно отклонена!');

            // Автоматически скрываем сообщение через 3 секунды
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось отклонить заявку'
            );
            console.error('Ошибка отклонения заявки:', err);
        } finally {
            setProcessingId(null);
        }
    };

    // Обработка заявок для арендатора
    const handleCancel = async (id: number) => {
        if (!window.confirm('Вы уверены, что хотите отменить заявку?')) return;

        setProcessingId(id);
        setError('');
        setSuccessMessage('');
        try {
            await cancelApplication(id);
            await loadProfile();
            setSuccessMessage('Заявка успешно отменена!');

            // Автоматически скрываем сообщение через 3 секунды
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось отменить заявку'
            );
            console.error('Ошибка отмены заявки:', err);
        } finally {
            setProcessingId(null);
        }
    };

    // Получение инициалов для аватара
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((word) => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Форматирование даты
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    // Фильтрация заявок по статусу для разных ролей
    const getFilteredApplications = () => {
        if (!profile) return { pending: [], active: [], history: [] };

        let filteredApps = applications;

        // Арендодатель видит заявки на свои участки
        // Арендатор видит только свои заявки
        // (это должно быть настроено на бэкенде, но дополнительно фильтруем на фронте)
        if (profile.role === 'tenant') {
            filteredApps = applications; // Бэкенд уже отфильтровал по арендатору
        }

        const pending = filteredApps.filter((app) => app.status === 'pending');
        const active = filteredApps.filter((app) =>
            ['approved', 'active'].includes(app.status)
        );
        const history = filteredApps.filter((app) =>
            ['completed', 'rejected', 'cancelled'].includes(app.status)
        );

        return { pending, active, history };
    };

    const { pending, active, history } = getFilteredApplications();

    // Получение цвета для статуса
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'approved':
                return 'bg-blue-100 text-blue-800';
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Перевод статуса на русский
    const getStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            pending: 'На рассмотрении',
            approved: 'Одобрено',
            active: 'Активно',
            completed: 'Завершено',
            rejected: 'Отклонено',
            cancelled: 'Отменено',
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
                    <p className='mt-4 text-gray-600'>Загрузка профиля...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div className='text-center'>
                    <p className='text-gray-500'>Профиль не найден</p>
                    <Button onClick={loadProfile} className='mt-4'>
                        Попробовать снова
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen bg-gray-50 py-8 px-4'>
            <div className='max-w-7xl mx-auto'>
                {/* Шапка */}
                <div className='mb-8'>
                    <Button
                        variant='outline'
                        onClick={() => navigate(-1)}
                        className='mb-6'
                    >
                        ← Назад
                    </Button>
                    <h1 className='text-3xl font-bold text-gray-900'>
                        Профиль пользователя
                    </h1>
                </div>

                {error && (
                    <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
                        <p className='text-red-600'>{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className='mb-6 p-4 bg-green-50 border border-green-200 rounded-lg animate-fadeIn'>
                        <p className='text-green-600'>{successMessage}</p>
                    </div>
                )}

                <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                    <div className='lg:col-span-1'>
                        <Card className='h-full'>
                            <CardHeader>
                                <CardTitle>Личная информация</CardTitle>
                                <CardDescription>
                                    Основные данные профиля
                                </CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                {/* Аватар и имя */}
                                <div className='flex flex-col items-center text-center mb-6'>
                                    <Avatar className='h-24 w-24 mb-4'>
                                        <AvatarFallback className='text-2xl'>
                                            {getInitials(profile.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <h3 className='text-xl font-semibold'>
                                        {profile.name}
                                    </h3>
                                    <Badge className='mt-2'>
                                        {profile.role === 'landlord'
                                            ? 'Арендодатель'
                                            : 'Арендатор'}
                                    </Badge>
                                </div>

                                <div className='space-y-3'>
                                    <div>
                                        <Label className='text-sm text-gray-500'>
                                            Email
                                        </Label>
                                        <p className='font-medium'>
                                            {profile.email || 'Не указан'}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className='text-sm text-gray-500'>
                                            Телефон
                                        </Label>
                                        <p className='font-medium'>
                                            {profile.phone}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className='text-sm text-gray-500'>
                                            Дата регистрации
                                        </Label>
                                        <p className='font-medium'>
                                            {formatDate(profile.created_at)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className='flex flex-col space-y-2'>
                                <Button
                                    variant='outline'
                                    className='w-full'
                                    onClick={() => setEditMode(!editMode)}
                                >
                                    {editMode
                                        ? 'Отменить редактирование'
                                        : 'Редактировать профиль'}
                                </Button>
                                <Button
                                    variant='destructive'
                                    className='w-full'
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                'Вы уверены, что хотите выйти?'
                                            )
                                        ) {
                                            localStorage.removeItem(
                                                'auth_token'
                                            );
                                            window.location.href = '/login';
                                        }
                                    }}
                                >
                                    Выйти из системы
                                </Button>
                            </CardFooter>
                        </Card>

                        {editMode && (
                            <Card className='mt-6'>
                                <CardHeader>
                                    <CardTitle>
                                        Редактирование профиля
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className='space-y-4'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='name'>Имя</Label>
                                        <Input
                                            id='name'
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    name: e.target.value,
                                                })
                                            }
                                            placeholder='Введите ваше имя'
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor='email'>Email</Label>
                                        <Input
                                            id='email'
                                            type='email'
                                            value={formData.email}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    email: e.target.value,
                                                })
                                            }
                                            placeholder='example@mail.com'
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className='flex justify-between'>
                                    <Button
                                        variant='outline'
                                        onClick={() => {
                                            setEditMode(false);
                                            setFormData({
                                                name: profile.name,
                                                email: profile.email || '',
                                            });
                                        }}
                                    >
                                        Отмена
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? 'Сохранение...' : 'Сохранить'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>

                    <div className='lg:col-span-2'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Заявки на аренду</CardTitle>
                                <CardDescription>
                                    {profile.role === 'landlord'
                                        ? 'Управление заявками на ваши участки'
                                        : 'Ваши арендные заявки'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue='pending' className='w-full'>
                                    <TabsList className='grid grid-cols-3 mb-6'>
                                        <TabsTrigger value='pending'>
                                            На рассмотрении ({pending.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='active'>
                                            Текущая аренда ({active.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='history'>
                                            История ({history.length})
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Таб 1: Заявки на рассмотрении */}
                                    <TabsContent
                                        value='pending'
                                        className='space-y-4'
                                    >
                                        {pending.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                Нет заявок на рассмотрении
                                            </div>
                                        ) : (
                                            pending.map((application) => (
                                                <Card key={application.id}>
                                                    <CardContent className='pt-6'>
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <h4 className='font-semibold'>
                                                                    {
                                                                        application.plot_address
                                                                    }
                                                                </h4>
                                                                <p className='text-sm text-gray-500 mt-1'>
                                                                    Площадь:{' '}
                                                                    {
                                                                        application.plot_area
                                                                    }{' '}
                                                                    м²
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Срок:{' '}
                                                                    {formatDate(
                                                                        application.start_date
                                                                    )}{' '}
                                                                    -{' '}
                                                                    {formatDate(
                                                                        application.end_date
                                                                    )}
                                                                </p>
                                                                {profile.role ===
                                                                'landlord' ? (
                                                                    <>
                                                                        <p className='text-sm text-gray-500'>
                                                                            Арендатор:{' '}
                                                                            {
                                                                                application.renter_name
                                                                            }
                                                                        </p>
                                                                        <p className='text-sm text-gray-500'>
                                                                            Телефон:{' '}
                                                                            {
                                                                                application.renter_phone
                                                                            }
                                                                        </p>
                                                                    </>
                                                                ) : (
                                                                    <p className='text-sm text-gray-500'>
                                                                        Владелец:{' '}
                                                                        {
                                                                            application.owner_name
                                                                        }
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Badge
                                                                className={getStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <div className='mt-4 flex justify-end space-x-2'>
                                                            {profile.role ===
                                                            'landlord' ? (
                                                                <>
                                                                    <Button
                                                                        size='sm'
                                                                        onClick={() =>
                                                                            handleApprove(
                                                                                application.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            processingId ===
                                                                            application.id
                                                                        }
                                                                    >
                                                                        {processingId ===
                                                                        application.id
                                                                            ? 'Обработка...'
                                                                            : 'Подтвердить'}
                                                                    </Button>
                                                                    <Button
                                                                        size='sm'
                                                                        variant='destructive'
                                                                        onClick={() =>
                                                                            handleReject(
                                                                                application.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            processingId ===
                                                                            application.id
                                                                        }
                                                                    >
                                                                        {processingId ===
                                                                        application.id
                                                                            ? 'Обработка...'
                                                                            : 'Отклонить'}
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <Button
                                                                    variant='destructive'
                                                                    size='sm'
                                                                    onClick={() =>
                                                                        handleCancel(
                                                                            application.id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        processingId ===
                                                                        application.id
                                                                    }
                                                                >
                                                                    {processingId ===
                                                                    application.id
                                                                        ? 'Отмена...'
                                                                        : 'Отменить'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Таб 2: Текущая аренда */}
                                    <TabsContent
                                        value='active'
                                        className='space-y-4'
                                    >
                                        {active.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                Нет активных аренд
                                            </div>
                                        ) : (
                                            active.map((application) => (
                                                <Card key={application.id}>
                                                    <CardContent className='pt-6'>
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <h4 className='font-semibold'>
                                                                    {
                                                                        application.plot_address
                                                                    }
                                                                </h4>
                                                                <p className='text-sm text-gray-500 mt-1'>
                                                                    Площадь:{' '}
                                                                    {
                                                                        application.plot_area
                                                                    }{' '}
                                                                    м²
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Срок:{' '}
                                                                    {formatDate(
                                                                        application.start_date
                                                                    )}{' '}
                                                                    -{' '}
                                                                    {formatDate(
                                                                        application.end_date
                                                                    )}
                                                                </p>
                                                                {profile.role ===
                                                                'landlord' ? (
                                                                    <p className='text-sm text-gray-500'>
                                                                        Арендатор:{' '}
                                                                        {
                                                                            application.renter_name
                                                                        }
                                                                    </p>
                                                                ) : (
                                                                    <p className='text-sm text-gray-500'>
                                                                        Владелец:{' '}
                                                                        {
                                                                            application.owner_name
                                                                        }
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Badge
                                                                className={getStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        {profile.role ===
                                                            'tenant' && (
                                                            <div className='mt-4 flex justify-end space-x-2'>
                                                                <Button
                                                                    variant='outline'
                                                                    size='sm'
                                                                    onClick={() => {
                                                                        // Логика продления аренды
                                                                        setSuccessMessage(
                                                                            'Функция продления в разработке'
                                                                        );
                                                                        setTimeout(
                                                                            () =>
                                                                                setSuccessMessage(
                                                                                    ''
                                                                                ),
                                                                            3000
                                                                        );
                                                                    }}
                                                                >
                                                                    Продлить
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Таб 3: История */}
                                    <TabsContent
                                        value='history'
                                        className='space-y-4'
                                    >
                                        {history.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                Нет истории аренд
                                            </div>
                                        ) : (
                                            history.map((application) => (
                                                <Card key={application.id}>
                                                    <CardContent className='pt-6'>
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <h4 className='font-semibold'>
                                                                    {
                                                                        application.plot_address
                                                                    }
                                                                </h4>
                                                                <p className='text-sm text-gray-500 mt-1'>
                                                                    Площадь:{' '}
                                                                    {
                                                                        application.plot_area
                                                                    }{' '}
                                                                    м²
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Период:{' '}
                                                                    {formatDate(
                                                                        application.start_date
                                                                    )}{' '}
                                                                    -{' '}
                                                                    {formatDate(
                                                                        application.end_date
                                                                    )}
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Создана:{' '}
                                                                    {formatDate(
                                                                        application.created_at
                                                                    )}
                                                                </p>
                                                                {application.rejection_reason && (
                                                                    <p className='text-sm text-red-500 mt-2'>
                                                                        Причина
                                                                        отказа:{' '}
                                                                        {
                                                                            application.rejection_reason
                                                                        }
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Badge
                                                                className={getStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    variant='outline'
                                    className='w-full'
                                    onClick={loadProfile}
                                >
                                    Обновить данные
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
