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
    createContract,
    fetchUserContracts,
    signContract,
    completeContract,
    terminateContract,
    type UserProfile,
    type RentalApplication,
    type ContractDetails,
    type ApiError,
} from '@/config/api';

export function Profile() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [applications, setApplications] = useState<RentalApplication[]>([]);
    const [contracts, setContracts] = useState<ContractDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [contractsLoading, setContractsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [creatingContractId, setCreatingContractId] = useState<number | null>(
        null
    );
    const [signingContractId, setSigningContractId] = useState<number | null>(
        null
    );
    const [activeTab, setActiveTab] = useState('pending');

    // Загрузка профиля и заявок
    const loadProfile = async () => {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            const [profileData, applicationsData] = await Promise.all([
                fetchProfile(),
                fetchApplications(1, 50), // Увеличиваем лимит
            ]);
            setProfile(profileData);
            setApplications(applicationsData.data || []);
            setFormData({
                name: profileData.name,
                email: profileData.email || '',
            });
            console.log(
                'Загружено заявок:',
                applicationsData.data?.length || 0
            );
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

    // Загрузка договоров
    const loadContracts = async () => {
        setContractsLoading(true);
        setError('');
        try {
            const contractsData = await fetchUserContracts(1, 50);
            setContracts(contractsData.data || []);
            console.log(
                'Загружено договоров:',
                contractsData.data?.length || 0
            );
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось загрузить договоры'
            );
            console.error('Ошибка загрузки договоров:', err);
        } finally {
            setContractsLoading(false);
        }
    };

    // Загружаем данные при монтировании
    useEffect(() => {
        loadProfile();
        loadContracts();
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

    // Создание договора на основе заявки
    const handleCreateContract = async (id: number) => {
        if (!window.confirm('Создать договор на основе этой заявки?')) return;

        setCreatingContractId(id);
        setError('');
        setSuccessMessage('');
        try {
            await createContract({ application_id: id });
            // Перезагружаем оба списка
            await Promise.all([loadProfile(), loadContracts()]);
            setSuccessMessage('Договор успешно создан!');
            // Переключаем на вкладку договоров
            setActiveTab('contracts-draft');

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось создать договор'
            );
            console.error('Ошибка создания договора:', err);
        } finally {
            setCreatingContractId(null);
        }
    };

    // Подписание договора
    const handleSignContract = async (id: number) => {
        if (!window.confirm('Вы уверены, что хотите подписать этот договор?'))
            return;

        setSigningContractId(id);
        setError('');
        setSuccessMessage('');
        try {
            await signContract(id, { signed_at: new Date().toISOString() });
            await loadContracts();
            setSuccessMessage('Договор успешно подписан!');

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            setError(
                error.response?.data?.message || 'Не удалось подписать договор'
            );
            console.error('Ошибка подписания договора:', err);
        } finally {
            setSigningContractId(null);
        }
    };

    // Завершение договора
    const handleCompleteContract = async (id: number) => {
        if (!window.confirm('Завершить договор аренды?')) return;

        try {
            await completeContract(id);
            await loadContracts();
            setSuccessMessage('Договор успешно завершен!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            alert(
                error.response?.data?.message ||
                    'Ошибка при завершении договора'
            );
        }
    };

    // Расторжение договора
    const handleTerminateContract = async (id: number) => {
        const reason = window.prompt('Введите причину расторжения договора:');
        if (!reason) return;

        if (!window.confirm('Расторгнуть договор досрочно?')) return;

        try {
            await terminateContract(id, {
                termination_reason: reason,
                termination_date: new Date().toISOString().split('T')[0],
            });
            await loadContracts();
            setSuccessMessage('Договор успешно расторгнут!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            const error = err as ApiError;
            alert(
                error.response?.data?.message ||
                    'Ошибка при расторжении договора'
            );
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

    // Фильтрация заявок по статусу
    const getFilteredApplications = () => {
        if (!profile) return { pending: [], approved: [], history: [] };

        const filteredApps = applications;

        const pending = filteredApps.filter((app) => app.status === 'pending');
        const approved = filteredApps.filter(
            (app) => app.status === 'approved'
        );
        const history = filteredApps.filter((app) =>
            ['completed', 'rejected', 'cancelled', 'contract_created'].includes(
                app.status
            )
        );

        return { pending, approved, history };
    };

    // Фильтрация договоров по статусу
    const getFilteredContracts = () => {
        const draft = contracts.filter((c) => c.status === 'draft');
        const active = contracts.filter((c) => c.status === 'active');
        const completed = contracts.filter((c) => c.status === 'completed');
        const terminated = contracts.filter((c) => c.status === 'terminated');

        return { draft, active, completed, terminated };
    };

    const { pending, approved, history } = getFilteredApplications();
    const { draft, active, completed, terminated } = getFilteredContracts();

    // Получение цвета для статуса заявки
    const getApplicationStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'active':
                return 'bg-blue-100 text-blue-800';
            case 'contract_created':
                return 'bg-purple-100 text-purple-800';
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

    // Получение цвета для статуса договора
    const getContractStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'active':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'completed':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'terminated':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Перевод статуса заявки на русский
    const getApplicationStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            pending: 'На рассмотрении',
            approved: 'Одобрено',
            active: 'Активно',
            contract_created: 'Договор создан',
            completed: 'Завершено',
            rejected: 'Отклонено',
            cancelled: 'Отменено',
        };
        return statusMap[status] || status;
    };

    // Перевод статуса договора на русский
    const getContractStatusText = (status: string) => {
        const statusMap: Record<string, string> = {
            draft: 'Черновик',
            active: 'Активен',
            completed: 'Завершен',
            terminated: 'Расторгнут',
        };
        return statusMap[status] || status;
    };

    // Проверка, может ли пользователь создавать договор
    const canCreateContract = (application: RentalApplication) => {
        if (!profile) return false;
        const isLandlordOrChairman =
            profile.role === 'landlord' || profile.role === 'chairman';
        const isApproved = application.status === 'approved';
        return isLandlordOrChairman && isApproved;
    };

    // Проверка, может ли пользователь подписывать договор
    const canSignContract = (contract: ContractDetails) => {
        if (!profile) return false;

        // Только черновики можно подписывать
        if (contract.status !== 'draft') return false;

        // Арендатор может подписать свой договор
        if (profile.role === 'tenant' && contract.renter_id === profile.id)
            return true;

        // Арендодатель может подписать договор на свой участок
        if (profile.role === 'landlord') return true; // Проверка на бэкенде

        // Председатель может подписать любой договор
        if (profile.role === 'chairman') return true;

        return false;
    };

    // Проверка, может ли пользователь завершить договор
    const canCompleteContract = (contract: ContractDetails) => {
        if (!profile) return false;

        // Только активные договоры можно завершать
        if (contract.status !== 'active') return false;

        // Арендодатель или председатель могут завершить
        return profile.role === 'landlord' || profile.role === 'chairman';
    };

    // Проверка, может ли пользователь расторгнуть договор
    const canTerminateContract = (contract: ContractDetails) => {
        if (!profile) return false;

        // Только активные договоры можно расторгать
        if (contract.status !== 'active') return false;

        // Арендатор может расторгнуть свой договор
        if (profile.role === 'tenant' && contract.renter_id === profile.id)
            return true;

        // Арендодатель может расторгнуть
        if (profile.role === 'landlord') return true;

        // Председатель может расторгнуть
        if (profile.role === 'chairman') return true;

        return false;
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
                    {/* Боковая панель с информацией профиля */}
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
                                            : profile.role === 'chairman'
                                            ? 'Председатель'
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

                    {/* Основной контент с вкладками */}
                    <div className='lg:col-span-2'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Мои документы</CardTitle>
                                <CardDescription>
                                    {profile.role === 'landlord'
                                        ? 'Управление заявками и договорами на ваши участки'
                                        : profile.role === 'chairman'
                                        ? 'Управление всеми заявками и договорами'
                                        : 'Ваши арендные документы'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    className='w-full'
                                >
                                    <TabsList className='grid grid-cols-5 mb-6'>
                                        <TabsTrigger value='pending'>
                                            На рассмотрении ({pending.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='approved'>
                                            Одобренные ({approved.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='history'>
                                            История ({history.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='contracts-draft'>
                                            Черновики ({draft.length})
                                        </TabsTrigger>
                                        <TabsTrigger value='contracts-active'>
                                            Активные ({active.length})
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Вкладка: На рассмотрении */}
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
                                                <Card
                                                    key={application.id}
                                                    className='mb-4'
                                                >
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
                                                                'tenant' ? (
                                                                    <p className='text-sm text-gray-500'>
                                                                        Владелец:{' '}
                                                                        {
                                                                            application.owner_name
                                                                        }
                                                                    </p>
                                                                ) : (
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
                                                                )}
                                                            </div>
                                                            <Badge
                                                                className={getApplicationStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getApplicationStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <div className='mt-4 flex justify-end space-x-2'>
                                                            {profile.role ===
                                                            'renter' ? (
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
                                                            ) : (
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
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Вкладка: Одобренные заявки */}
                                    <TabsContent
                                        value='approved'
                                        className='space-y-4'
                                    >
                                        {approved.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                Нет одобренных заявок
                                            </div>
                                        ) : (
                                            approved.map((application) => (
                                                <Card
                                                    key={application.id}
                                                    className='mb-4'
                                                >
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
                                                                'tenant' ? (
                                                                    <p className='text-sm text-gray-500'>
                                                                        Владелец:{' '}
                                                                        {
                                                                            application.owner_name
                                                                        }
                                                                    </p>
                                                                ) : (
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
                                                                )}
                                                            </div>
                                                            <Badge
                                                                className={getApplicationStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getApplicationStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <div className='mt-4 flex justify-end space-x-2'>
                                                            {profile.role ===
                                                            'tenant' ? (
                                                                <Button
                                                                    variant='outline'
                                                                    size='sm'
                                                                    onClick={() => {
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
                                                            ) : (
                                                                // Для арендодателя и председателя
                                                                <>
                                                                    {canCreateContract(
                                                                        application
                                                                    ) && (
                                                                        <Button
                                                                            size='sm'
                                                                            className='bg-green-600 hover:bg-green-700'
                                                                            onClick={() =>
                                                                                handleCreateContract(
                                                                                    application.id
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                creatingContractId ===
                                                                                application.id
                                                                            }
                                                                        >
                                                                            {creatingContractId ===
                                                                            application.id
                                                                                ? 'Создание...'
                                                                                : 'Создать договор'}
                                                                        </Button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Вкладка: История заявок */}
                                    <TabsContent
                                        value='history'
                                        className='space-y-4'
                                    >
                                        {history.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                Нет истории заявок
                                            </div>
                                        ) : (
                                            history.map((application) => (
                                                <Card
                                                    key={application.id}
                                                    className='mb-4'
                                                >
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
                                                                className={getApplicationStatusColor(
                                                                    application.status
                                                                )}
                                                            >
                                                                {getApplicationStatusText(
                                                                    application.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Вкладка: Черновики договоров */}
                                    <TabsContent
                                        value='contracts-draft'
                                        className='space-y-4'
                                    >
                                        {contractsLoading ? (
                                            <div className='text-center py-8'>
                                                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto'></div>
                                                <p className='mt-4 text-gray-600'>
                                                    Загрузка договоров...
                                                </p>
                                            </div>
                                        ) : draft.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                <p className='mb-2'>
                                                    Нет черновиков договоров
                                                </p>
                                                <p className='text-sm'>
                                                    Черновики появятся здесь
                                                    после создания договоров на
                                                    основе одобренных заявок
                                                </p>
                                            </div>
                                        ) : (
                                            draft.map((contract) => (
                                                <Card
                                                    key={contract.id}
                                                    className={`mb-4 border ${getContractStatusColor(
                                                        contract.status
                                                    )}`}
                                                >
                                                    <CardContent className='pt-6'>
                                                        <div className='flex justify-between items-start'>
                                                            <div>
                                                                <h4 className='font-semibold'>
                                                                    Договор №
                                                                    {
                                                                        contract.id
                                                                    }
                                                                </h4>
                                                                <p className='text-sm text-gray-500'>
                                                                    {
                                                                        contract.plot_address
                                                                    }{' '}
                                                                    •{' '}
                                                                    {
                                                                        contract.plot_area
                                                                    }{' '}
                                                                    м²
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Период:{' '}
                                                                    {formatDate(
                                                                        contract.start_date
                                                                    )}{' '}
                                                                    -{' '}
                                                                    {formatDate(
                                                                        contract.end_date
                                                                    )}
                                                                </p>
                                                                <p className='text-sm text-gray-500'>
                                                                    Арендатор:{' '}
                                                                    {
                                                                        contract.renter_name
                                                                    }
                                                                </p>
                                                            </div>
                                                            <Badge
                                                                className={
                                                                    getContractStatusColor(
                                                                        contract.status
                                                                    ).split(
                                                                        ' '
                                                                    )[0]
                                                                }
                                                            >
                                                                {getContractStatusText(
                                                                    contract.status
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <div className='mt-4 flex justify-end space-x-2'>
                                                            <Button
                                                                size='sm'
                                                                variant='outline'
                                                                onClick={() =>
                                                                    navigate(
                                                                        `/contracts/${contract.id}`
                                                                    )
                                                                }
                                                            >
                                                                Подробнее
                                                            </Button>
                                                            {canSignContract(
                                                                contract
                                                            ) && (
                                                                <Button
                                                                    size='sm'
                                                                    disabled={
                                                                        signingContractId ===
                                                                        contract.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleSignContract(
                                                                            contract.id
                                                                        )
                                                                    }
                                                                >
                                                                    {signingContractId ===
                                                                    contract.id
                                                                        ? 'Подписание...'
                                                                        : 'Подписать'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </TabsContent>

                                    {/* Вкладка: Активные договоры */}
                                    <TabsContent
                                        value='contracts-active'
                                        className='space-y-4'
                                    >
                                        {contractsLoading ? (
                                            <div className='text-center py-8'>
                                                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto'></div>
                                                <p className='mt-4 text-gray-600'>
                                                    Загрузка договоров...
                                                </p>
                                            </div>
                                        ) : active.length === 0 ? (
                                            <div className='text-center py-8 text-gray-500'>
                                                <p className='mb-2'>
                                                    Нет активных договоров
                                                </p>
                                                <p className='text-sm'>
                                                    Активные договоры появятся
                                                    здесь после подписания
                                                    черновиков
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {active.map((contract) => (
                                                    <Card
                                                        key={contract.id}
                                                        className={`mb-4 border ${getContractStatusColor(
                                                            contract.status
                                                        )}`}
                                                    >
                                                        <CardContent className='pt-6'>
                                                            <div className='flex justify-between items-start'>
                                                                <div>
                                                                    <h4 className='font-semibold'>
                                                                        Договор
                                                                        №
                                                                        {
                                                                            contract.id
                                                                        }
                                                                    </h4>
                                                                    <p className='text-sm text-gray-500'>
                                                                        {
                                                                            contract.plot_address
                                                                        }{' '}
                                                                        •{' '}
                                                                        {
                                                                            contract.plot_area
                                                                        }{' '}
                                                                        м²
                                                                    </p>
                                                                    <p className='text-sm text-gray-500'>
                                                                        Период:{' '}
                                                                        {formatDate(
                                                                            contract.start_date
                                                                        )}{' '}
                                                                        -{' '}
                                                                        {formatDate(
                                                                            contract.end_date
                                                                        )}
                                                                    </p>
                                                                    <p className='text-sm text-gray-500'>
                                                                        Арендатор:{' '}
                                                                        {
                                                                            contract.renter_name
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <Badge
                                                                    className={
                                                                        getContractStatusColor(
                                                                            contract.status
                                                                        ).split(
                                                                            ' '
                                                                        )[0]
                                                                    }
                                                                >
                                                                    {getContractStatusText(
                                                                        contract.status
                                                                    )}
                                                                </Badge>
                                                            </div>
                                                            <div className='mt-4 flex justify-end space-x-2'>
                                                                <Button
                                                                    size='sm'
                                                                    variant='outline'
                                                                    onClick={() =>
                                                                        navigate(
                                                                            `/contracts/${contract.id}`
                                                                        )
                                                                    }
                                                                >
                                                                    Подробнее
                                                                </Button>
                                                                {canCompleteContract(
                                                                    contract
                                                                ) && (
                                                                    <Button
                                                                        size='sm'
                                                                        variant='outline'
                                                                        onClick={() =>
                                                                            handleCompleteContract(
                                                                                contract.id
                                                                            )
                                                                        }
                                                                    >
                                                                        Завершить
                                                                    </Button>
                                                                )}
                                                                {canTerminateContract(
                                                                    contract
                                                                ) && (
                                                                    <Button
                                                                        size='sm'
                                                                        variant='destructive'
                                                                        onClick={() =>
                                                                            handleTerminateContract(
                                                                                contract.id
                                                                            )
                                                                        }
                                                                    >
                                                                        Расторгнуть
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}

                                                {/* Завершенные и расторгнутые договоры - только если есть */}
                                                {(completed.length > 0 ||
                                                    terminated.length > 0) && (
                                                    <div className='mt-8'>
                                                        <h3 className='font-semibold text-lg mb-3'>
                                                            История договоров
                                                        </h3>

                                                        {completed.length > 0 &&
                                                            completed.map(
                                                                (contract) => (
                                                                    <Card
                                                                        key={
                                                                            contract.id
                                                                        }
                                                                        className={`mb-3 border ${getContractStatusColor(
                                                                            contract.status
                                                                        )}`}
                                                                    >
                                                                        <CardContent className='pt-4'>
                                                                            <div className='flex justify-between items-start'>
                                                                                <div>
                                                                                    <h4 className='font-medium'>
                                                                                        Договор
                                                                                        №
                                                                                        {
                                                                                            contract.id
                                                                                        }{' '}
                                                                                        (Завершен)
                                                                                    </h4>
                                                                                    <p className='text-sm text-gray-500'>
                                                                                        {
                                                                                            contract.plot_address
                                                                                        }{' '}
                                                                                        •{' '}
                                                                                        {formatDate(
                                                                                            contract.start_date
                                                                                        )}{' '}
                                                                                        -{' '}
                                                                                        {formatDate(
                                                                                            contract.end_date
                                                                                        )}
                                                                                    </p>
                                                                                </div>
                                                                                <Badge variant='outline'>
                                                                                    Завершен
                                                                                </Badge>
                                                                            </div>
                                                                        </CardContent>
                                                                    </Card>
                                                                )
                                                            )}

                                                        {terminated.length >
                                                            0 &&
                                                            terminated.map(
                                                                (contract) => (
                                                                    <Card
                                                                        key={
                                                                            contract.id
                                                                        }
                                                                        className={`mb-3 border ${getContractStatusColor(
                                                                            contract.status
                                                                        )}`}
                                                                    >
                                                                        <CardContent className='pt-4'>
                                                                            <div className='flex justify-between items-start'>
                                                                                <div>
                                                                                    <h4 className='font-medium'>
                                                                                        Договор
                                                                                        №
                                                                                        {
                                                                                            contract.id
                                                                                        }{' '}
                                                                                        (Расторгнут)
                                                                                    </h4>
                                                                                    <p className='text-sm text-gray-500'>
                                                                                        {
                                                                                            contract.plot_address
                                                                                        }{' '}
                                                                                        •{' '}
                                                                                        {formatDate(
                                                                                            contract.start_date
                                                                                        )}{' '}
                                                                                        -{' '}
                                                                                        {formatDate(
                                                                                            contract.end_date
                                                                                        )}
                                                                                    </p>
                                                                                    {contract.termination_reason && (
                                                                                        <p className='text-sm text-red-500'>
                                                                                            Причина:{' '}
                                                                                            {
                                                                                                contract.termination_reason
                                                                                            }
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                                <Badge variant='destructive'>
                                                                                    Расторгнут
                                                                                </Badge>
                                                                            </div>
                                                                        </CardContent>
                                                                    </Card>
                                                                )
                                                            )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                            <CardFooter className='flex flex-col space-y-4'>
                                <div className='w-full flex gap-2'>
                                    <Button
                                        variant='outline'
                                        className='flex-1'
                                        onClick={() => {
                                            if (
                                                activeTab.startsWith(
                                                    'contracts'
                                                )
                                            ) {
                                                loadContracts();
                                            } else {
                                                loadProfile();
                                            }
                                        }}
                                    >
                                        Обновить данные
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
