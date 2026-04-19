import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { fetchServerRoot, HTTP_BASE_URL_LABEL } from '../api/http';

const Layout = () => {
    const { user, logoutUser } = useUser();
    const [serverState, setServerState] = useState({
        label: 'Проверка сервера',
        online: false,
    });

    useEffect(() => {
        let cancelled = false;

        const loadServerState = async () => {
            try {
                const response = await fetchServerRoot();
                if (cancelled) {
                    return;
                }

                setServerState({
                    label: typeof response === 'string' && response.trim()
                        ? response
                        : 'Сервер доступен',
                    online: true,
                });
            } catch (error) {
                if (!cancelled) {
                    setServerState({
                        label: 'Нет соединения с сервером',
                        online: false,
                    });
                }
            }
        };

        loadServerState();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="app-shell">
            <div className="background-glow background-glow--one" />
            <div className="background-glow background-glow--two" />
            <div className="app">
                <header className="site-header">
                    <div>
                        <nav>
                            <Link to="/">Комнаты</Link>
                            <Link to="/account">Профиль</Link>
                        </nav>
                    </div>
                    <div className="header-side">
                        <div className={`server-badge ${serverState.online ? 'online' : 'offline'}`}>
                            <span className="server-badge__dot" />
                            <div className="server-badge__content">
                                <strong>{serverState.label}</strong>
                                <span>{HTTP_BASE_URL_LABEL}</span>
                            </div>
                        </div>
                        <div className="header-user">
                            <span className="header-user__name">{user.username}</span>
                            <span className="header-user__meta">
                                {user.stats?.gamesPlayed ?? 0} игр
                            </span>
                        </div>
                        <div className="user-balance">бонусы: {user.balance} </div>
                        <button type="button" className="logout-btn" onClick={() => logoutUser()}>
                            Выйти
                        </button>
                    </div>
                </header>
                <main>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
