import { useState } from 'react';
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
import { login, type ApiError } from '@/config/api';

interface LoginProps {
    onLogin?: () => void;
}

export function Login({ onLogin }: LoginProps) {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await login(phone, password);
            console.log('Успешный вход:', result);

            if (onLogin) {
                onLogin();
            }

            navigate('/');
        } catch (err) {
            const error = err as ApiError;
            setError(error.response?.data?.message || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50'>
            <Card className='w-[350px]'>
                <CardHeader>
                    <CardTitle>Вход в систему</CardTitle>
                    <CardDescription>
                        Введите свои учетные данные ниже
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className='pb-6'>
                        {error && (
                            <div className='text-red-500 text-sm mb-4 p-2 bg-red-50 rounded'>
                                {error}
                            </div>
                        )}
                        <div className='grid w-full items-center gap-4'>
                            <div className='flex flex-col space-y-1.5'>
                                <Label htmlFor='phone'>Номер телефона</Label>
                                <Input
                                    id='phone'
                                    type='text'
                                    placeholder='+7 (999) 999-99-99'
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className='flex flex-col space-y-1.5'>
                                <Label htmlFor='password'>Пароль</Label>
                                <Input
                                    id='password'
                                    type='password'
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className='flex justify-between'>
                        <Button
                            variant='outline'
                            type='button'
                            disabled={loading}
                        >
                            Демо
                        </Button>
                        <Button type='submit' disabled={loading}>
                            {loading ? 'Вход...' : 'Войти'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
