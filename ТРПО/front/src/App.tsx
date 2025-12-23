import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { Login } from './components/Login';
import { Home } from './components/Home';
import { isAuthenticated } from './utils/auth';
import { Profile } from './components/Profile';
import { PlotCard } from './components/PlotCard';

function App() {
    const [authChecked, setAuthChecked] = useState(false);
    const [isAuth, setIsAuth] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            setIsAuth(isAuthenticated());
            setAuthChecked(true);
        };

        checkAuth();

        const handleStorageChange = () => {
            checkAuth();
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    if (!authChecked) {
        return (
            <div className='min-h-screen flex items-center justify-center'>
                <div>Загрузка...</div>
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path='/'
                element={isAuth ? <Home /> : <Navigate to='/login' />}
            />
            <Route
                path='/login'
                element={
                    !isAuth ? (
                        <Login onLogin={() => setIsAuth(true)} />
                    ) : (
                        <Navigate to='/' />
                    )
                }
            />
            <Route
                path='/profile'
                element={isAuth ? <Profile /> : <Navigate to='/login' />}
            />
            <Route
                path='/plots/:id'
                element={
                    isAuthenticated() ? <PlotCard /> : <Navigate to='/login' />
                }
            />
            <Route path='*' element={<Navigate to='/' />} />
        </Routes>
    );
}

export default App;
