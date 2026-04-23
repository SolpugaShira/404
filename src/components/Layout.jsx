import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { fetchServerRoot, HTTP_BASE_URL_LABEL } from '../api/http';

const Layout = () => {
    const { user } = useUser();
    const [serverState, setServerState] = useState({
        label: 'Проверка сервера',
        online: false,
    });

    useEffect(() => {
        let cancelled = false;

        const loadServerState = async () => {
            try {
                await fetchServerRoot();
                if (cancelled) return;
                setServerState({
                    label: 'Сервер доступен',
                    online: true,
                });
            } catch {
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
            <div className="app">
                <header className="site-header">
                    <nav>
                        <Link to="/">Bonus Rooms</Link>
                    </nav>
                    <div className="header-side">
                        <div className="header-user">
                            <span className="header-user__name">{user.username}</span>
                        </div>
                        <div className={`server-badge ${serverState.online ? 'online' : 'offline'}`}>
                            <span className="server-badge__dot" />
                            <div className="server-badge__content">
                                <strong>{serverState.label}</strong>
                                <span>{HTTP_BASE_URL_LABEL}</span>
                            </div>
                        </div>
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
